import { randomUUID } from 'node:crypto'

import { z } from 'zod'

import type { EvaluationCase } from '@grounddesk/shared'

import type { AgentService } from '../agent/service.js'
import { isPromptInjectionAttempt } from '../rag/evidence-guard.js'
import type { EvaluationRepository } from './repository.js'

const chatInputSchema = z.object({ kind: z.literal('chat'), message: z.string().min(1) })
const isolationInputSchema = z.object({
  kind: z.literal('isolation'),
  resource: z.enum(['orders', 'products']),
  targetWorkspaceId: z.uuid(),
  marker: z.string().min(1),
})

export interface EvaluationExecutionContext {
  workspaceId: string
  workspaceSlug: string
  userId: string
}

export interface EvaluationExecutor {
  execute(
    evaluationCase: EvaluationCase,
    context: EvaluationExecutionContext,
  ): Promise<Record<string, unknown>>
}

const isolationOutcome = async (
  evaluationCase: EvaluationCase,
  context: EvaluationExecutionContext,
  repository: EvaluationRepository,
): Promise<Record<string, unknown>> => {
  const input = isolationInputSchema.parse(evaluationCase.input)
  return repository.probeIsolation({
    authorizedWorkspaceId: context.workspaceId,
    targetWorkspaceId: input.targetWorkspaceId,
    userId: context.userId,
    resource: input.resource,
    marker: input.marker,
  })
}

export class LiveEvaluationExecutor implements EvaluationExecutor {
  constructor(
    private readonly agent: AgentService,
    private readonly repository: EvaluationRepository,
  ) {}

  async execute(
    evaluationCase: EvaluationCase,
    context: EvaluationExecutionContext,
  ): Promise<Record<string, unknown>> {
    if (evaluationCase.category === 'isolation') {
      return isolationOutcome(evaluationCase, context, this.repository)
    }
    const input = chatInputSchema.parse(evaluationCase.input)
    const startedAt = performance.now()
    const chat = await this.agent.openPublicChat(
      context.workspaceSlug,
      {
        sessionId: randomUUID(),
        message: input.message,
        locale: evaluationCase.locale,
      },
      { quotaExempt: true, source: 'evaluation' },
    )
    const citationTitles = new Set<string>()
    let intent: string | null = null
    let refused = false
    let handedOff = false
    let toolName: string | null = null
    let toolStatus: string | null = null
    let eligibility: string | null = null
    let providerCalled = false
    for await (const streamEvent of chat.events) {
      if (streamEvent.type === 'citations') {
        streamEvent.citations.forEach((citation) => citationTitles.add(citation.documentTitle))
      } else if (streamEvent.type === 'tool') {
        providerCalled = true
        toolName = streamEvent.toolName
        toolStatus = streamEvent.status
        if (streamEvent.details.kind === 'return_eligibility') {
          eligibility = streamEvent.details.eligibility
        }
      } else if (streamEvent.type === 'stage') {
        if (['retrieving', 'calling_tool', 'generating'].includes(streamEvent.stage)) {
          providerCalled = true
        }
      } else if (streamEvent.type === 'done') {
        intent = streamEvent.intent
        refused = streamEvent.refused
        handedOff = streamEvent.handedOff
      }
    }
    return {
      intent,
      refused,
      handedOff,
      citationTitles: [...citationTitles],
      toolName,
      toolStatus,
      eligibility,
      providerCalled,
      latencyMs: Math.round(performance.now() - startedAt),
    }
  }
}

const documentTitleFor = (message: string, locale: EvaluationCase['locale']): string => {
  const policyQuestion =
    /warranty|return window|opened|battery|carry|flight|保修|退货|拆封|电池|托运/i.test(message)
  if (locale === 'zh-CN') {
    return policyQuestion ? 'Avenlo 配送、退货与保修政策' : 'Avenlo 产品与兼容性手册'
  }
  return policyQuestion
    ? 'Avenlo Shipping, Returns, and Warranty Policy'
    : 'Avenlo Product and Compatibility Guide'
}

export class MockEvaluationExecutor implements EvaluationExecutor {
  constructor(private readonly repository: EvaluationRepository) {}

  async execute(
    evaluationCase: EvaluationCase,
    context: EvaluationExecutionContext,
  ): Promise<Record<string, unknown>> {
    const startedAt = performance.now()
    if (evaluationCase.category === 'isolation') {
      return {
        ...(await isolationOutcome(evaluationCase, context, this.repository)),
        latencyMs: Math.round(performance.now() - startedAt),
      }
    }
    const { message } = chatInputSchema.parse(evaluationCase.input)
    if (evaluationCase.category === 'security') {
      const blocked = isPromptInjectionAttempt(message)
      return {
        refused: blocked,
        handedOff: blocked,
        providerCalled: false,
        latencyMs: Math.round(performance.now() - startedAt),
      }
    }
    if (evaluationCase.category === 'unknown') {
      return {
        refused: true,
        handedOff: true,
        latencyMs: Math.round(performance.now() - startedAt),
      }
    }
    if (evaluationCase.category === 'knowledge') {
      return {
        refused: false,
        handedOff: false,
        citationTitles: [documentTitleFor(message, evaluationCase.locale)],
        latencyMs: Math.round(performance.now() - startedAt),
      }
    }
    const orderNumber = /GD-2026D\d{3}/.exec(message)?.[0] ?? ''
    if (evaluationCase.category === 'order') {
      return {
        toolName: 'order_lookup',
        toolStatus: orderNumber.endsWith('999')
          ? 'not_found'
          : /wrong@example\.com/i.test(message)
            ? 'email_mismatch'
            : 'succeeded',
        refused: false,
        latencyMs: Math.round(performance.now() - startedAt),
      }
    }
    const eligibilityByOrder: Record<string, string> = {
      'GD-2026D018': 'eligible',
      'GD-2026D019': 'manual_review',
      'GD-2026D020': 'eligible',
      'GD-2026D023': 'ineligible',
      'GD-2026D021': 'manual_review',
    }
    return {
      toolName: 'return_eligibility',
      toolStatus: 'succeeded',
      eligibility: eligibilityByOrder[orderNumber] ?? 'manual_review',
      refused: false,
      latencyMs: Math.round(performance.now() - startedAt),
    }
  }
}
