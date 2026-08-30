import { createHash } from 'node:crypto'

import {
  chatStreamEventSchema,
  type AgentIntent,
  type ChatCitation,
  type ChatStreamEvent,
  type ConversationSource,
  type PublicChatFeedbackInput,
  type PublicChatRequest,
  type RetrievalEvidence,
  type ToolResultStatus,
  type ToolEventDetails,
} from '@grounddesk/shared'

import type { AgentPlanResult, GenerationProvider, ProviderUsage } from '../generation/types.js'
import { estimateGenerationCostUsd } from '../generation/cost.js'
import type { KnowledgeService } from '../knowledge/service.js'
import {
  assessEvidence,
  createCitations,
  isPromptInjectionAttempt,
  requestsHumanSupport,
  validateAnswerCitations,
} from '../rag/evidence-guard.js'
import type { ToolExecutionService } from '../tools/types.js'
import { chatCopy } from './copy.js'
import { PublicChatError } from './errors.js'
import { constrainAgentPlan, shouldUseModelPlanner } from './plan-constraints.js'
import type {
  AgentRepository,
  ConversationRecord,
  HandoffInput,
  PublicWorkspaceConfig,
  RetrievalLogInput,
} from './repository.js'

interface AgentServiceOptions {
  dailyRequestLimit: number
  dailyTokenLimit: number
  inputCostPerMillionUsd: number
  outputCostPerMillionUsd: number
}

export interface OpenChatResult {
  conversationId: string
  events: AsyncGenerator<ChatStreamEvent, void, undefined>
}

export interface AgentService {
  openPublicChat(
    workspaceSlug: string,
    input: PublicChatRequest,
    options?: { quotaExempt?: boolean; source?: ConversationSource },
  ): Promise<OpenChatResult>
  submitFeedback(workspaceSlug: string, input: PublicChatFeedbackInput): Promise<boolean>
  close(): Promise<void>
}

interface RunContext {
  workspace: PublicWorkspaceConfig
  conversation: ConversationRecord
  input: PublicChatRequest
  startedAt: number
  quotaExempt: boolean
  source: ConversationSource
}

interface GenerationOutcome {
  answer: string
  citations: ChatCitation[]
  usage: ProviderUsage
  providerRequestId: string | null
  firstTokenLatencyMs: number | null
  errorType: string | null
}

const EMPTY_USAGE: ProviderUsage = {
  inputTokens: null,
  outputTokens: null,
  totalTokens: null,
  available: false,
}

const combineUsage = (...usageValues: ProviderUsage[]): ProviderUsage => {
  const available = usageValues.some((usage) => usage.available)
  const sum = (field: 'inputTokens' | 'outputTokens' | 'totalTokens'): number | null => {
    const values = usageValues.map((usage) => usage[field]).filter((value) => value !== null)
    return values.length > 0 ? values.reduce((total, value) => total + value, 0) : null
  }
  return {
    inputTokens: sum('inputTokens'),
    outputTokens: sum('outputTokens'),
    totalTokens: sum('totalTokens'),
    available,
  }
}

const event = (value: ChatStreamEvent): ChatStreamEvent => chatStreamEventSchema.parse(value)

const stage = (
  stageName: Extract<ChatStreamEvent, { type: 'stage' }>['stage'],
  status: Extract<ChatStreamEvent, { type: 'stage' }>['status'],
): ChatStreamEvent => event({ type: 'stage', stage: stageName, status })

const hashSession = (sessionId: string): string =>
  createHash('sha256').update(`grounddesk:${sessionId}`).digest('hex')

const redactQuery = (value: string): string =>
  value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email-redacted]')
    .replace(/GD-[A-Z0-9]{8}/g, (orderNumber) => `GD-••••${orderNumber.slice(-4)}`)

const redactedToolArguments = (input: {
  orderNumber: string
  email: string
  productSku?: string | null
  reason?: string
  opened?: boolean
}): Record<string, unknown> => ({
  orderNumberSuffix: input.orderNumber.slice(-4),
  emailHashPrefix: createHash('sha256').update(input.email).digest('hex').slice(0, 10),
  ...(input.productSku !== undefined ? { productSku: input.productSku } : {}),
  ...(input.reason !== undefined ? { reason: input.reason } : {}),
  ...(input.opened !== undefined ? { opened: input.opened } : {}),
})

const wantsReturnApplication = (message: string): boolean =>
  /(继续|提交|发起|申请).{0,12}退货|proceed.{0,12}return|start.{0,12}return|submit.{0,12}return/i.test(
    message,
  )

export class DefaultAgentService implements AgentService {
  constructor(
    private readonly repository: AgentRepository,
    private readonly knowledge: KnowledgeService,
    private readonly tools: ToolExecutionService,
    private readonly generation: GenerationProvider,
    private readonly options: AgentServiceOptions,
  ) {}

  async openPublicChat(
    workspaceSlug: string,
    input: PublicChatRequest,
    options: { quotaExempt?: boolean; source?: ConversationSource } = {},
  ): Promise<OpenChatResult> {
    const workspace = await this.repository.getPublicWorkspace(workspaceSlug)
    if (!workspace)
      throw new PublicChatError('The public Demo Workspace does not exist.', 404, 'not_found')
    if (!options.quotaExempt) {
      const withinQuota = await this.repository.reserveDemoRequest(
        workspace.id,
        this.options.dailyRequestLimit,
        this.options.dailyTokenLimit,
      )
      if (!withinQuota) {
        throw new PublicChatError(
          'The public Demo has reached its daily usage limit. Please try again tomorrow.',
          429,
          'demo_quota_exceeded',
        )
      }
    }

    const source = options.source ?? 'public_demo'
    const conversation = await this.repository.getOrCreateConversation({
      workspaceId: workspace.id,
      sessionHash: hashSession(input.sessionId),
      requestedConversationId: input.conversationId ?? null,
      locale: input.locale,
      source,
    })
    if (!conversation) {
      throw new PublicChatError(
        'The conversation does not belong to this browser session.',
        403,
        'conversation_forbidden',
      )
    }
    if (conversation.status === 'closed') {
      throw new PublicChatError('This conversation is closed.', 409, 'conversation_closed')
    }
    await this.repository.saveUserMessage(workspace.id, conversation.id, input.message)
    return {
      conversationId: conversation.id,
      events: this.run({
        workspace,
        conversation,
        input,
        startedAt: performance.now(),
        quotaExempt: options.quotaExempt === true,
        source,
      }),
    }
  }

  async submitFeedback(workspaceSlug: string, input: PublicChatFeedbackInput): Promise<boolean> {
    const workspace = await this.repository.getPublicWorkspace(workspaceSlug)
    if (!workspace) return false
    return this.repository.saveFeedback({
      workspaceId: workspace.id,
      sessionHash: hashSession(input.sessionId),
      conversationId: input.conversationId,
      messageId: input.messageId,
      rating: input.rating,
      comment: input.comment ?? null,
    })
  }

  async *run(context: RunContext): AsyncGenerator<ChatStreamEvent, void, undefined> {
    const { conversation, input } = context
    yield event({ type: 'session', conversationId: conversation.id })

    if (conversation.status === 'handed_off') {
      yield* this.finishRefusal(
        context,
        'human_handoff',
        chatCopy[input.locale].handoffPending,
        'handoff_pending',
        [],
      )
      return
    }

    yield stage('understanding', 'active')

    if (requestsHumanSupport(input.message)) {
      yield stage('understanding', 'completed')
      yield* this.finishRefusal(
        context,
        'human_handoff',
        chatCopy[input.locale].human,
        'user_requested_human',
        [],
      )
      return
    }
    if (isPromptInjectionAttempt(input.message)) {
      yield stage('understanding', 'failed')
      yield* this.finishRefusal(
        context,
        'human_handoff',
        chatCopy[input.locale].injection,
        'prompt_injection',
        [],
      )
      return
    }

    let planning: AgentPlanResult
    if (shouldUseModelPlanner(input.message)) {
      try {
        planning = await this.generation.plan(input.message, input.locale)
      } catch {
        yield stage('understanding', 'failed')
        yield* this.finishRefusal(
          context,
          'human_handoff',
          chatCopy[input.locale].providerFailure,
          'planning_failed',
          [],
        )
        return
      }
    } else {
      planning = {
        plan: {
          intent: 'knowledge_answer',
          normalizedQuestion: input.message,
          missingFields: [],
          toolCall: null,
        },
        providerRequestId: null,
        usage: EMPTY_USAGE,
      }
    }
    planning = { ...planning, plan: constrainAgentPlan(planning.plan, input.message) }
    yield stage('understanding', 'completed')

    if (planning.plan.intent === 'human_handoff') {
      yield* this.finishRefusal(
        context,
        'human_handoff',
        chatCopy[input.locale].human,
        'agent_requested_handoff',
        [],
        planning,
      )
      return
    }
    if (planning.plan.intent === 'knowledge_answer') {
      yield* this.answerFromKnowledge(context, planning)
      return
    }
    yield* this.answerFromTool(context, planning)
  }

  private async *answerFromKnowledge(
    context: RunContext,
    planning: AgentPlanResult,
  ): AsyncGenerator<ChatStreamEvent, void, undefined> {
    yield stage('retrieving', 'active')
    let trace: Awaited<ReturnType<KnowledgeService['searchWithTrace']>>
    try {
      trace = await this.knowledge.searchWithTrace({
        workspaceId: context.workspace.id,
        query: planning.plan.normalizedQuestion,
        language: context.input.locale,
        productModel: null,
        limit: 8,
      })
    } catch {
      yield stage('retrieving', 'failed')
      yield* this.finishRefusal(
        context,
        'human_handoff',
        chatCopy[context.input.locale].providerFailure,
        'retrieval_failed',
        [],
        planning,
      )
      return
    }
    yield stage('retrieving', 'completed')
    yield stage('validating', 'active')
    const assessment = assessEvidence(trace.evidence, context.workspace.confidenceThreshold)
    const retrievalLog: Omit<RetrievalLogInput, 'messageId'> = {
      workspaceId: context.workspace.id,
      conversationId: context.conversation.id,
      embeddingConfigId: trace.embeddingConfigId,
      queryTextRedacted: redactQuery(planning.plan.normalizedQuestion),
      candidateChunkIds: trace.evidence.map((candidate) => candidate.chunkId),
      finalChunkIds: assessment.accepted.map((candidate) => candidate.chunkId),
      filters: { locale: context.input.locale, productModel: null },
      wasEmpty: trace.evidence.length === 0,
      conflictDetected: assessment.rejectionReason === 'conflict',
      durationMs: trace.durationMs,
    }

    if (assessment.rejectionReason) {
      yield stage('validating', 'failed')
      const checked = assessment.checked.slice(0, 3)
      const citations = createCitations(
        checked.map((_candidate, index) => index + 1),
        checked,
      )
      if (citations.length > 0) yield event({ type: 'citations', citations })
      const copy =
        assessment.rejectionReason === 'conflict'
          ? chatCopy[context.input.locale].conflict
          : chatCopy[context.input.locale].noEvidence
      yield* this.finishRefusal(
        context,
        'human_handoff',
        copy,
        assessment.rejectionReason,
        checked,
        planning,
        citations,
        retrievalLog,
      )
      return
    }
    yield stage('validating', 'completed')

    const generation = yield* this.generateAnswer(
      context,
      'knowledge_answer',
      assessment.accepted,
      null,
    )
    const citationCheck = validateAnswerCitations(generation.answer, assessment.accepted.length)
    let finalAnswer = generation.answer
    let citations = generation.citations
    let refused = false
    let handedOff = false
    let errorType = generation.errorType
    if (generation.errorType || !citationCheck.valid) {
      finalAnswer = generation.errorType
        ? chatCopy[context.input.locale].providerFailure
        : chatCopy[context.input.locale].citationFailure
      citations = []
      refused = true
      handedOff = true
      errorType = generation.errorType ?? 'citation_validation_failed'
      yield event({ type: 'replace_answer', content: finalAnswer, citations: [] })
      await this.createHandoff(context, {
        summary: redactQuery(context.input.message).slice(0, 300),
        reason: errorType,
        evidenceChunkIds: assessment.accepted.map((candidate) => candidate.chunkId),
        toolCallIds: [],
        priority: 'high',
      })
      yield stage('handed_off', 'completed')
    }

    const usage = combineUsage(planning.usage, generation.usage)
    const messageId = await this.repository.saveAssistantMessage({
      workspaceId: context.workspace.id,
      conversationId: context.conversation.id,
      content: finalAnswer,
      intent: 'knowledge_answer',
      refused,
      handedOff,
      firstTokenLatencyMs: generation.firstTokenLatencyMs,
      totalLatencyMs: Math.round(performance.now() - context.startedAt),
      usage,
      estimatedCostUsd: this.estimateCostUsd(usage),
      providerRequestId: generation.providerRequestId ?? planning.providerRequestId,
      errorType,
    })
    if (citations.length > 0) {
      await this.repository.saveCitations(context.workspace.id, messageId, citations)
    }
    await this.repository.saveRetrievalLog({ ...retrievalLog, messageId })
    await this.recordUsage(context, usage, generation.firstTokenLatencyMs)
    yield stage(handedOff ? 'handed_off' : 'completed', 'completed')
    yield event({
      type: 'done',
      messageId,
      intent: 'knowledge_answer',
      refused,
      handedOff,
    })
  }

  private async *answerFromTool(
    context: RunContext,
    planning: AgentPlanResult,
  ): AsyncGenerator<ChatStreamEvent, void, undefined> {
    const plan = planning.plan
    if (plan.intent !== 'order_lookup' && plan.intent !== 'return_eligibility') return
    if (!plan.toolCall) {
      const fallbackFields =
        plan.missingFields.length > 0
          ? plan.missingFields
          : plan.intent === 'order_lookup'
            ? ['orderNumber', 'email']
            : ['orderNumber', 'email', 'reason', 'opened']
      const answer = chatCopy[context.input.locale].missing(fallbackFields)
      yield event({ type: 'token', delta: answer })
      const messageId = await this.repository.saveAssistantMessage({
        workspaceId: context.workspace.id,
        conversationId: context.conversation.id,
        content: answer,
        intent: plan.intent,
        refused: false,
        handedOff: false,
        firstTokenLatencyMs: Math.round(performance.now() - context.startedAt),
        totalLatencyMs: Math.round(performance.now() - context.startedAt),
        usage: planning.usage,
        estimatedCostUsd: this.estimateCostUsd(planning.usage),
        providerRequestId: planning.providerRequestId,
        errorType: null,
      })
      await this.recordUsage(context, planning.usage, null)
      yield stage('completed', 'completed')
      yield event({
        type: 'done',
        messageId,
        intent: plan.intent,
        refused: false,
        handedOff: false,
      })
      return
    }

    yield stage('calling_tool', 'active')
    const toolStartedAt = performance.now()
    let status: ToolResultStatus
    let toolDetails: ToolEventDetails
    let safeToolResult: Record<string, unknown> | null = null
    let resultSummary: Record<string, unknown> | null = null
    if (plan.toolCall.name === 'order_lookup') {
      const result = await this.tools.lookupOrder(
        context.workspace.id,
        plan.toolCall.input,
        context.input.locale,
      )
      status = result.status
      if (result.order) {
        safeToolResult = { kind: 'order_lookup', ...result }
        resultSummary = { status: result.status, orderStatus: result.order.status }
        toolDetails = {
          kind: 'order_lookup',
          orderNumber: result.order.orderNumber,
          orderStatus: result.order.status,
          itemModels: result.order.items.map((item) => item.model),
        }
      } else {
        toolDetails = { kind: 'status', code: result.status }
      }
    } else {
      const result = await this.tools.evaluateReturn(
        context.workspace.id,
        plan.toolCall.input,
        context.input.locale,
      )
      status = result.status
      if (result.result && result.order) {
        safeToolResult = { kind: 'return_eligibility', ...result }
        resultSummary = {
          status: result.status,
          eligibility: result.result.status,
          policyVersion: result.result.policyVersion,
          reasonCodes: result.result.reasonCodes,
        }
        toolDetails = {
          kind: 'return_eligibility',
          eligibility: result.result.status,
          policyVersion: result.result.policyVersion,
          reasonCodes: result.result.reasonCodes,
        }
      } else {
        toolDetails = { kind: 'status', code: result.status }
      }
    }
    const durationMs = Math.max(0, Math.round(performance.now() - toolStartedAt))
    const toolCallId = await this.repository.saveToolCall({
      workspaceId: context.workspace.id,
      conversationId: context.conversation.id,
      messageId: null,
      toolName: plan.toolCall.name,
      argumentsRedacted: redactedToolArguments(plan.toolCall.input),
      status,
      resultSummary,
      durationMs,
      errorType: status === 'failed' ? 'tool_failed' : null,
    })
    const summary =
      plan.toolCall.name === 'order_lookup'
        ? chatCopy[context.input.locale].orderToolSummary
        : chatCopy[context.input.locale].returnToolSummary
    yield event({
      type: 'tool',
      toolName: plan.toolCall.name,
      status,
      summary,
      details: toolDetails,
    })

    if (status !== 'succeeded' || !safeToolResult) {
      yield stage('calling_tool', status === 'failed' ? 'failed' : 'completed')
      const answer =
        status === 'not_found'
          ? chatCopy[context.input.locale].orderNotFound
          : status === 'email_mismatch'
            ? chatCopy[context.input.locale].emailMismatch
            : chatCopy[context.input.locale].toolFailure
      if (status === 'failed') {
        await this.createHandoff(context, {
          summary: redactQuery(context.input.message).slice(0, 300),
          reason: 'tool_failed_after_retry',
          evidenceChunkIds: [],
          toolCallIds: [toolCallId],
          priority: 'high',
        })
      }
      yield event({ type: 'token', delta: answer })
      const messageId = await this.repository.saveAssistantMessage({
        workspaceId: context.workspace.id,
        conversationId: context.conversation.id,
        content: answer,
        intent: plan.intent,
        refused: status === 'failed',
        handedOff: status === 'failed',
        firstTokenLatencyMs: Math.round(performance.now() - context.startedAt),
        totalLatencyMs: Math.round(performance.now() - context.startedAt),
        usage: planning.usage,
        estimatedCostUsd: this.estimateCostUsd(planning.usage),
        providerRequestId: planning.providerRequestId,
        errorType: status === 'failed' ? 'tool_failed_after_retry' : null,
      })
      await this.recordUsage(context, planning.usage, null)
      yield stage(status === 'failed' ? 'handed_off' : 'completed', 'completed')
      yield event({
        type: 'done',
        messageId,
        intent: plan.intent,
        refused: status === 'failed',
        handedOff: status === 'failed',
      })
      return
    }
    yield stage('calling_tool', 'completed')

    const generation = yield* this.generateAnswer(context, plan.intent, [], safeToolResult)
    let answer = generation.answer
    let handedOff = false
    let errorType = generation.errorType
    if (generation.errorType) {
      answer = chatCopy[context.input.locale].providerFailure
      handedOff = true
      yield event({ type: 'replace_answer', content: answer })
      await this.createHandoff(context, {
        summary: redactQuery(context.input.message).slice(0, 300),
        reason: generation.errorType,
        evidenceChunkIds: [],
        toolCallIds: [toolCallId],
        priority: 'high',
      })
    } else if (
      plan.intent === 'return_eligibility' &&
      wantsReturnApplication(context.input.message)
    ) {
      handedOff = true
      answer = `${answer}\n\n${chatCopy[context.input.locale].returnRequested}`
      yield event({ type: 'replace_answer', content: answer })
      await this.createHandoff(context, {
        summary: redactQuery(context.input.message).slice(0, 300),
        reason: 'return_request_pending_approval',
        evidenceChunkIds: [],
        toolCallIds: [toolCallId],
        priority: 'normal',
      })
      errorType = null
    }

    const usage = combineUsage(planning.usage, generation.usage)
    const messageId = await this.repository.saveAssistantMessage({
      workspaceId: context.workspace.id,
      conversationId: context.conversation.id,
      content: answer,
      intent: plan.intent,
      refused: Boolean(generation.errorType),
      handedOff,
      firstTokenLatencyMs: generation.firstTokenLatencyMs,
      totalLatencyMs: Math.round(performance.now() - context.startedAt),
      usage,
      estimatedCostUsd: this.estimateCostUsd(usage),
      providerRequestId: generation.providerRequestId ?? planning.providerRequestId,
      errorType,
    })
    await this.recordUsage(context, usage, generation.firstTokenLatencyMs)
    yield stage(handedOff ? 'handed_off' : 'completed', 'completed')
    yield event({
      type: 'done',
      messageId,
      intent: plan.intent,
      refused: Boolean(generation.errorType),
      handedOff,
    })
  }

  private async *generateAnswer(
    context: RunContext,
    intent: AgentIntent,
    evidence: RetrievalEvidence[],
    toolResult: Record<string, unknown> | null,
  ): AsyncGenerator<ChatStreamEvent, GenerationOutcome, undefined> {
    yield stage('generating', 'active')
    let answer = ''
    let usage = EMPTY_USAGE
    let providerRequestId: string | null = null
    let firstTokenLatencyMs: number | null = null
    const emittedCitationOrdinals = new Set<number>()
    try {
      for await (const chunk of this.generation.streamGroundedAnswer({
        locale: context.input.locale,
        question: context.input.message,
        intent,
        evidence,
        toolResult,
      })) {
        if (chunk.type === 'usage') {
          usage = chunk.usage
          providerRequestId = chunk.providerRequestId
          continue
        }
        if (firstTokenLatencyMs === null) {
          firstTokenLatencyMs = Math.round(performance.now() - context.startedAt)
        }
        answer += chunk.delta
        yield event({ type: 'token', delta: chunk.delta })
        if (evidence.length > 0) {
          const ordinals = [...answer.matchAll(/\[(\d+)\]/g)].map((match) => Number(match[1]))
          const newOrdinals = ordinals.filter(
            (ordinal) =>
              ordinal >= 1 && ordinal <= evidence.length && !emittedCitationOrdinals.has(ordinal),
          )
          if (newOrdinals.length > 0) {
            newOrdinals.forEach((ordinal) => emittedCitationOrdinals.add(ordinal))
            yield event({ type: 'citations', citations: createCitations(newOrdinals, evidence) })
          }
        }
      }
      if (!answer.trim()) throw new Error('The generation provider returned an empty answer.')
      let validation = validateAnswerCitations(answer, evidence.length)
      if (evidence.length > 0 && !validation.valid) {
        let repairedAnswer = ''
        let repairedUsage = EMPTY_USAGE
        let repairedRequestId: string | null = null
        try {
          for await (const chunk of this.generation.streamGroundedAnswer({
            locale: context.input.locale,
            question: context.input.message,
            intent,
            evidence,
            toolResult,
            citationRepair: true,
          })) {
            if (chunk.type === 'usage') {
              repairedUsage = chunk.usage
              repairedRequestId = chunk.providerRequestId
            } else {
              repairedAnswer += chunk.delta
            }
          }
          const repairedValidation = validateAnswerCitations(repairedAnswer, evidence.length)
          usage = combineUsage(usage, repairedUsage)
          providerRequestId = repairedRequestId ?? providerRequestId
          if (repairedAnswer.trim() && repairedValidation.valid) {
            answer = repairedAnswer
            validation = repairedValidation
            yield event({
              type: 'replace_answer',
              content: repairedAnswer,
              citations: createCitations(validation.ordinals, evidence),
            })
          }
        } catch {
          // The outer citation guard rejects the original invalid answer.
        }
      }
      yield stage('generating', 'completed')
      return {
        answer,
        citations: evidence.length > 0 ? createCitations(validation.ordinals, evidence) : [],
        usage,
        providerRequestId,
        firstTokenLatencyMs,
        errorType: null,
      }
    } catch {
      yield stage('generating', 'failed')
      return {
        answer,
        citations: [],
        usage,
        providerRequestId,
        firstTokenLatencyMs,
        errorType: 'generation_failed',
      }
    }
  }

  private async *finishRefusal(
    context: RunContext,
    intent: AgentIntent,
    answer: string,
    reason: string,
    evidence: RetrievalEvidence[],
    planning?: AgentPlanResult,
    citations: ChatCitation[] = [],
    retrievalLog?: Omit<RetrievalLogInput, 'messageId'>,
  ): AsyncGenerator<ChatStreamEvent, void, undefined> {
    yield event({ type: 'token', delta: answer })
    const usage = planning?.usage ?? EMPTY_USAGE
    const elapsed = Math.round(performance.now() - context.startedAt)
    const messageId = await this.repository.saveAssistantMessage({
      workspaceId: context.workspace.id,
      conversationId: context.conversation.id,
      content: answer,
      intent,
      refused: true,
      handedOff: true,
      firstTokenLatencyMs: elapsed,
      totalLatencyMs: elapsed,
      usage,
      estimatedCostUsd: this.estimateCostUsd(usage),
      providerRequestId: planning?.providerRequestId ?? null,
      errorType: reason,
    })
    if (citations.length > 0) {
      await this.repository.saveCitations(context.workspace.id, messageId, citations)
    }
    if (retrievalLog) await this.repository.saveRetrievalLog({ ...retrievalLog, messageId })
    await this.createHandoff(context, {
      summary: redactQuery(context.input.message).slice(0, 300),
      reason,
      evidenceChunkIds: evidence.map((candidate) => candidate.chunkId),
      toolCallIds: [],
      priority: reason === 'prompt_injection' ? 'high' : 'normal',
    })
    await this.recordUsage(context, usage, elapsed)
    yield stage('handed_off', 'completed')
    yield event({ type: 'done', messageId, intent, refused: true, handedOff: true })
  }

  private async recordUsage(
    context: RunContext,
    usage: ProviderUsage,
    firstTokenLatencyMs: number | null,
  ): Promise<void> {
    const totalLatencyMs = Math.round(performance.now() - context.startedAt)
    if (!context.quotaExempt && usage.totalTokens !== null) {
      await this.repository.addDemoTokens(context.workspace.id, usage.totalTokens)
    }
    if (!usage.available) return
    await this.repository.saveUsageEvent({
      workspaceId: context.workspace.id,
      conversationId: context.conversation.id,
      provider: this.generation.provider,
      model: this.generation.model,
      usage,
      estimatedCostUsd: this.estimateCostUsd(usage),
      firstTokenLatencyMs,
      totalLatencyMs,
    })
  }

  private async createHandoff(
    context: RunContext,
    input: Omit<HandoffInput, 'workspaceId' | 'conversationId'>,
  ): Promise<void> {
    if (context.source === 'evaluation') return
    await this.repository.createHandoff({
      workspaceId: context.workspace.id,
      conversationId: context.conversation.id,
      ...input,
    })
  }

  private estimateCostUsd(usage: ProviderUsage): number | null {
    return estimateGenerationCostUsd(usage, this.options)
  }

  async close(): Promise<void> {
    await Promise.all([this.repository.close(), this.tools.close()])
  }
}
