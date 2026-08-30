import { z } from 'zod'

import {
  AGENT_INTENTS,
  CHAT_STAGES,
  CHAT_STAGE_STATUSES,
  CONVERSATION_STATUSES,
  CONVERSATION_SOURCES,
  DOCUMENT_KINDS,
  DOCUMENT_STATUSES,
  EVALUATION_CATEGORIES,
  EVALUATION_RUN_STATUSES,
  FEEDBACK_RATINGS,
  ORDER_STATUSES,
  RETURN_ELIGIBILITY_STATUSES,
  RETURN_REASONS,
  SUPPORTED_LOCALES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TOOL_RESULT_STATUSES,
  WEBHOOK_DELIVERY_STATUSES,
  WEBHOOK_EVENTS,
  WORKSPACE_ROLES,
} from './constants.js'

export const localeSchema = z.enum(SUPPORTED_LOCALES)
export const workspaceRoleSchema = z.enum(WORKSPACE_ROLES)
export const documentStatusSchema = z.enum(DOCUMENT_STATUSES)
export const documentKindSchema = z.enum(DOCUMENT_KINDS)
export const orderStatusSchema = z.enum(ORDER_STATUSES)
export const agentIntentSchema = z.enum(AGENT_INTENTS)
export const ticketStatusSchema = z.enum(TICKET_STATUSES)
export const ticketPrioritySchema = z.enum(TICKET_PRIORITIES)
export const webhookEventSchema = z.enum(WEBHOOK_EVENTS)
export const webhookDeliveryStatusSchema = z.enum(WEBHOOK_DELIVERY_STATUSES)
export const evaluationCategorySchema = z.enum(EVALUATION_CATEGORIES)
export const evaluationRunStatusSchema = z.enum(EVALUATION_RUN_STATUSES)
export const conversationSourceSchema = z.enum(CONVERSATION_SOURCES)
export const conversationStatusSchema = z.enum(CONVERSATION_STATUSES)
export const feedbackRatingSchema = z.enum(FEEDBACK_RATINGS)
export const returnEligibilityStatusSchema = z.enum(RETURN_ELIGIBILITY_STATUSES)
export const returnReasonSchema = z.enum(RETURN_REASONS)
export const chatStageSchema = z.enum(CHAT_STAGES)
export const chatStageStatusSchema = z.enum(CHAT_STAGE_STATUSES)
export const toolResultStatusSchema = z.enum(TOOL_RESULT_STATUSES)

export const healthResponseSchema = z.object({
  service: z.literal('grounddesk-api'),
  status: z.enum(['ok', 'degraded']),
  runtimeMode: z.enum(['offline', 'connected']),
  timestamp: z.iso.datetime(),
  providers: z.object({
    database: z.enum(['unconfigured', 'configured']),
    generation: z.enum(['unconfigured', 'configured']),
    embedding: z.enum(['unconfigured', 'configured']),
  }),
})

export const orderLookupInputSchema = z.object({
  orderNumber: z
    .string()
    .trim()
    .regex(/^GD-[A-Z0-9]{8}$/),
  email: z.email().transform((value) => value.toLowerCase()),
})

export const returnEligibilityInputSchema = z.object({
  orderId: z.uuid(),
  productId: z.uuid(),
  reason: returnReasonSchema,
  opened: z.boolean(),
})

export const workspaceSchema = z.object({
  id: z.uuid(),
  name: z.string().min(2).max(80),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  isDemo: z.boolean(),
})

export const profileSchema = z.object({
  id: z.uuid(),
  displayName: z.string().min(1).max(80),
  avatarUrl: z.url().nullable(),
  locale: localeSchema,
})

export const workspaceMembershipSchema = z.object({
  workspace: workspaceSchema,
  role: workspaceRoleSchema,
})

export const authSessionResponseSchema = z.object({
  user: z.object({
    id: z.uuid(),
    email: z.email().nullable(),
  }),
  profile: profileSchema,
  memberships: z.array(workspaceMembershipSchema),
})

export const workspaceAccessResponseSchema = workspaceMembershipSchema.extend({
  permissions: z.array(z.string()),
})

export const knowledgeDocumentSchema = z.object({
  id: z.uuid(),
  workspaceId: z.uuid(),
  title: z.string().min(1).max(180),
  originalFilename: z.string().min(1),
  kind: documentKindSchema,
  language: z.enum(['zh-CN', 'en-US', 'bilingual']),
  byteSize: z.number().int().positive(),
  status: documentStatusSchema,
  failureCode: z.string().nullable(),
  failureMessage: z.string().nullable(),
  processedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  chunkCount: z.number().int().nonnegative(),
})

export const knowledgeChunkPreviewSchema = z.object({
  id: z.uuid(),
  chunkIndex: z.number().int().nonnegative(),
  content: z.string().min(1),
  pageStart: z.number().int().positive().nullable(),
  pageEnd: z.number().int().positive().nullable(),
  sectionPath: z.array(z.string()),
  productModels: z.array(z.string()),
  language: z.enum(['zh-CN', 'en-US', 'bilingual']),
  tokenCount: z.number().int().positive(),
})

export const knowledgeDocumentListResponseSchema = z.object({
  documents: z.array(knowledgeDocumentSchema),
})

export const knowledgeDocumentUploadResponseSchema = z.object({
  document: knowledgeDocumentSchema,
  duplicate: z.boolean(),
})

export const knowledgeChunkListResponseSchema = z.object({
  chunks: z.array(knowledgeChunkPreviewSchema),
})

export const retrievalEvidenceSchema = z.object({
  chunkId: z.uuid(),
  documentId: z.uuid(),
  documentTitle: z.string(),
  content: z.string(),
  sectionPath: z.array(z.string()),
  pageStart: z.number().int().positive().nullable(),
  pageEnd: z.number().int().positive().nullable(),
  fusedScore: z.number().nonnegative(),
  vectorSimilarity: z.number().min(-1).max(1).nullable(),
  keywordScore: z.number().nonnegative().nullable(),
  vectorRank: z.number().int().positive().nullable(),
  keywordRank: z.number().int().positive().nullable(),
})

export const publicChatRequestSchema = z.object({
  sessionId: z.uuid(),
  conversationId: z.uuid().optional(),
  message: z.string().trim().min(1).max(2_000),
  locale: localeSchema,
})

export const publicChatFeedbackInputSchema = z.object({
  sessionId: z.uuid(),
  conversationId: z.uuid(),
  messageId: z.uuid(),
  rating: feedbackRatingSchema,
  comment: z.string().trim().max(500).optional(),
})
export const publicChatFeedbackResponseSchema = z.object({ accepted: z.literal(true) })

export const orderLookupToolInputSchema = orderLookupInputSchema

export const returnEligibilityToolInputSchema = orderLookupInputSchema.extend({
  productSku: z.string().trim().min(2).max(80).nullable().default(null),
  reason: returnReasonSchema,
  opened: z.boolean(),
})

export const publicOrderItemSchema = z.object({
  productId: z.uuid(),
  sku: z.string(),
  model: z.string(),
  name: z.string(),
  quantity: z.number().int().positive(),
  opened: z.boolean(),
})

export const publicOrderSchema = z.object({
  orderNumber: z.string(),
  customerNameMasked: z.string(),
  customerEmailMasked: z.string(),
  status: orderStatusSchema,
  orderedAt: z.iso.datetime(),
  shippedAt: z.iso.datetime().nullable(),
  deliveredAt: z.iso.datetime().nullable(),
  carrier: z.string().nullable(),
  trackingNumberMasked: z.string().nullable(),
  totalCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  items: z.array(publicOrderItemSchema).min(1),
})

export const publicProductSchema = z.object({
  id: z.uuid(),
  sku: z.string().min(1),
  model: z.string().min(1),
  category: z.string().min(1),
  nameZh: z.string().min(1),
  nameEn: z.string().min(1),
  descriptionZh: z.string().min(1),
  descriptionEn: z.string().min(1),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  specs: z.record(z.string(), z.unknown()),
})
export const publicProductListResponseSchema = z.object({
  products: z.array(publicProductSchema),
})

export const consoleOrderItemSchema = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  sku: z.string().min(1),
  model: z.string().min(1),
  nameZh: z.string().min(1),
  nameEn: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().nonnegative(),
  opened: z.boolean(),
})

export const consoleOrderSchema = z.object({
  id: z.uuid(),
  orderNumber: z.string().min(1),
  customerName: z.string().min(1),
  customerEmail: z.email(),
  status: orderStatusSchema,
  orderedAt: z.iso.datetime(),
  shippedAt: z.iso.datetime().nullable(),
  deliveredAt: z.iso.datetime().nullable(),
  cancelledAt: z.iso.datetime().nullable(),
  carrier: z.string().nullable(),
  trackingNumberMasked: z.string().nullable(),
  shippingCountryCode: z.string().length(2),
  totalCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  isDemo: z.boolean(),
  items: z.array(consoleOrderItemSchema),
  updatedAt: z.iso.datetime(),
})

export const consoleOrderListResponseSchema = z.object({
  orders: z.array(consoleOrderSchema),
  total: z.number().int().nonnegative(),
})
export const consoleOrderResponseSchema = z.object({ order: consoleOrderSchema })
export const orderStatusUpdateInputSchema = z.object({ status: orderStatusSchema })

export const orderLookupToolResultSchema = z.object({
  status: toolResultStatusSchema,
  order: publicOrderSchema.nullable(),
})

export const returnEligibilityResultSchema = z.object({
  status: returnEligibilityStatusSchema,
  policyVersion: z.number().int().positive(),
  reasonCodes: z.array(z.string().min(1)),
  explanation: z.string().min(1),
  matchedClauses: z.array(z.string().min(1)),
  requiresApproval: z.literal(true),
})

export const chatCitationSchema = z.object({
  ordinal: z.number().int().positive(),
  chunkId: z.uuid(),
  documentId: z.uuid(),
  documentTitle: z.string().min(1),
  sectionPath: z.array(z.string()),
  pageStart: z.number().int().positive().nullable(),
  pageEnd: z.number().int().positive().nullable(),
  quote: z.string().min(1),
})

export const toolEventDetailsSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('order_lookup'),
    orderNumber: z.string(),
    orderStatus: orderStatusSchema,
    itemModels: z.array(z.string()),
  }),
  z.object({
    kind: z.literal('return_eligibility'),
    eligibility: returnEligibilityStatusSchema,
    policyVersion: z.number().int().positive(),
    reasonCodes: z.array(z.string()),
  }),
  z.object({
    kind: z.literal('status'),
    code: toolResultStatusSchema,
  }),
])

export const chatStreamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('session'), conversationId: z.uuid() }),
  z.object({
    type: z.literal('stage'),
    stage: chatStageSchema,
    status: chatStageStatusSchema,
  }),
  z.object({ type: z.literal('token'), delta: z.string().min(1) }),
  z.object({ type: z.literal('citations'), citations: z.array(chatCitationSchema) }),
  z.object({
    type: z.literal('tool'),
    toolName: z.enum(['order_lookup', 'return_eligibility']),
    status: toolResultStatusSchema,
    summary: z.string().min(1),
    details: toolEventDetailsSchema,
  }),
  z.object({
    type: z.literal('replace_answer'),
    content: z.string().min(1),
    citations: z.array(chatCitationSchema).optional(),
  }),
  z.object({
    type: z.literal('done'),
    messageId: z.uuid(),
    intent: agentIntentSchema,
    refused: z.boolean(),
    handedOff: z.boolean(),
  }),
  z.object({ type: z.literal('error'), code: z.string().min(1), message: z.string().min(1) }),
])

export const ticketAssigneeSchema = z.object({
  id: z.uuid(),
  displayName: z.string().min(1),
})

export const ticketSummarySchema = z.object({
  id: z.uuid(),
  conversationId: z.uuid(),
  summary: z.string().min(1),
  handoffReason: z.string().min(1),
  priority: ticketPrioritySchema,
  status: ticketStatusSchema,
  locale: localeSchema,
  assignedTo: ticketAssigneeSchema.nullable(),
  messageCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  firstResponseAt: z.iso.datetime().nullable(),
  resolvedAt: z.iso.datetime().nullable(),
  updatedAt: z.iso.datetime(),
})

export const ticketConversationMessageSchema = z.object({
  id: z.uuid(),
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string(),
  intent: agentIntentSchema.nullable(),
  refused: z.boolean(),
  handedOff: z.boolean(),
  citations: z.array(chatCitationSchema),
  createdAt: z.iso.datetime(),
})

export const ticketReplySchema = z.object({
  id: z.uuid(),
  authorType: z.enum(['customer', 'agent', 'system']),
  author: ticketAssigneeSchema.nullable(),
  body: z.string().min(1),
  createdAt: z.iso.datetime(),
})

export const ticketToolTraceSchema = z.object({
  id: z.uuid(),
  toolName: z.enum(['order_lookup', 'return_eligibility']),
  status: z.enum(['started', 'succeeded', 'not_found', 'forbidden', 'failed']),
  argumentsRedacted: z.record(z.string(), z.unknown()),
  resultSummary: z.record(z.string(), z.unknown()).nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  errorType: z.string().nullable(),
  createdAt: z.iso.datetime(),
})

export const ticketDetailSchema = ticketSummarySchema.extend({
  evidence: z.array(chatCitationSchema),
  tools: z.array(ticketToolTraceSchema),
  conversationMessages: z.array(ticketConversationMessageSchema),
  replies: z.array(ticketReplySchema),
})

export const ticketListResponseSchema = z.object({ tickets: z.array(ticketSummarySchema) })
export const ticketDetailResponseSchema = z.object({ ticket: ticketDetailSchema })
export const ticketReplyInputSchema = z.object({ body: z.string().trim().min(1).max(4_000) })
export const ticketStatusUpdateInputSchema = z.object({ status: ticketStatusSchema })
export const ticketAssignmentInputSchema = z.object({
  assignedTo: z.uuid().nullable(),
  priority: ticketPrioritySchema.optional(),
})
export const assignableAgentsResponseSchema = z.object({ agents: z.array(ticketAssigneeSchema) })

export const conversationSummarySchema = z.object({
  id: z.uuid(),
  locale: localeSchema,
  status: conversationStatusSchema,
  source: conversationSourceSchema,
  messageCount: z.number().int().nonnegative(),
  latestMessage: z.string().nullable(),
  lastIntent: agentIntentSchema.nullable(),
  refused: z.boolean(),
  handedOff: z.boolean(),
  ticketId: z.uuid().nullable(),
  startedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export const conversationMessageSchema = z.object({
  id: z.uuid(),
  role: z.enum(['user', 'assistant', 'tool', 'system']),
  content: z.string(),
  intent: agentIntentSchema.nullable(),
  refused: z.boolean(),
  handedOff: z.boolean(),
  firstTokenLatencyMs: z.number().int().nonnegative().nullable(),
  totalLatencyMs: z.number().int().nonnegative().nullable(),
  inputTokens: z.number().int().nonnegative().nullable(),
  outputTokens: z.number().int().nonnegative().nullable(),
  estimatedCostUsd: z.number().nonnegative().nullable(),
  citations: z.array(chatCitationSchema),
  createdAt: z.iso.datetime(),
})

export const conversationDetailSchema = conversationSummarySchema.extend({
  messages: z.array(conversationMessageSchema),
  tools: z.array(ticketToolTraceSchema),
})

export const conversationListResponseSchema = z.object({
  conversations: z.array(conversationSummarySchema),
  total: z.number().int().nonnegative(),
})
export const conversationDetailResponseSchema = z.object({
  conversation: conversationDetailSchema,
})

export const workspaceSettingsSchema = z.object({
  id: z.uuid(),
  name: z.string().min(2).max(80),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  defaultLocale: localeSchema,
  confidenceThreshold: z.number().min(0).max(1),
  isDemo: z.boolean(),
  updatedAt: z.iso.datetime(),
})
export const workspaceSettingsResponseSchema = z.object({ workspace: workspaceSettingsSchema })
export const workspaceSettingsUpdateInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  defaultLocale: localeSchema,
  confidenceThreshold: z.number().min(0.3).max(0.95),
})
export const workspaceMemberSchema = z.object({
  userId: z.uuid(),
  email: z.email().nullable(),
  displayName: z.string().min(1).max(80),
  role: workspaceRoleSchema,
  createdAt: z.iso.datetime(),
})
export const workspaceMemberListResponseSchema = z.object({
  members: z.array(workspaceMemberSchema),
})
export const workspaceMemberCreateInputSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  role: workspaceRoleSchema,
})
export const workspaceMemberUpdateInputSchema = z.object({ role: workspaceRoleSchema })
export const workspaceOnboardingInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  defaultLocale: localeSchema,
})
export const workspaceOnboardingResponseSchema = z.object({
  membership: workspaceMembershipSchema,
})
export const demoResetResponseSchema = z.object({
  reset: z.literal(true),
  completedAt: z.iso.datetime(),
})

export const webhookEndpointSchema = z.object({
  id: z.uuid(),
  url: z.url(),
  subscribedEvents: z.array(webhookEventSchema),
  enabled: z.boolean(),
  secretHint: z.string().min(1).nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export const webhookDeliverySchema = z.object({
  id: z.uuid(),
  endpointId: z.uuid(),
  endpointUrl: z.url(),
  eventName: webhookEventSchema,
  status: webhookDeliveryStatusSchema,
  attemptCount: z.number().int().nonnegative().max(5),
  responseStatus: z.number().int().min(100).max(599).nullable(),
  responseExcerpt: z.string().nullable(),
  nextAttemptAt: z.iso.datetime().nullable(),
  deliveredAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export const webhookEndpointCreateInputSchema = z.object({
  url: z.url(),
  subscribedEvents: z.array(webhookEventSchema).min(1),
})
export const webhookEndpointUpdateInputSchema = z
  .object({
    url: z.url().optional(),
    subscribedEvents: z.array(webhookEventSchema).min(1).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one setting is required.')
export const webhookEndpointListResponseSchema = z.object({
  endpoints: z.array(webhookEndpointSchema),
})
export const webhookEndpointCreateResponseSchema = z.object({
  endpoint: webhookEndpointSchema,
  signingSecret: z.string().min(32),
})
export const webhookEndpointResponseSchema = z.object({ endpoint: webhookEndpointSchema })
export const webhookDeliveryListResponseSchema = z.object({
  deliveries: z.array(webhookDeliverySchema),
})
export const webhookTestResponseSchema = z.object({ delivery: webhookDeliverySchema })

export const evaluationCaseSchema = z.object({
  id: z.uuid(),
  caseKey: z.string().min(1),
  category: evaluationCategorySchema,
  locale: localeSchema,
  input: z.record(z.string(), z.unknown()),
  expected: z.record(z.string(), z.unknown()),
  enabled: z.boolean(),
})

export const evaluationMetricsSchema = z.object({
  total: z.number().int().nonnegative(),
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  citationCoverage: z.number().min(0).max(1).nullable(),
  retrievalAt5: z.number().min(0).max(1).nullable(),
  refusalHandoffRate: z.number().min(0).max(1).nullable(),
  toolSelectionAccuracy: z.number().min(0).max(1).nullable(),
  returnRuleAccuracy: z.number().min(0).max(1).nullable(),
  isolationPassRate: z.number().min(0).max(1).nullable(),
})

export const evaluationRunSchema = z.object({
  id: z.uuid(),
  status: evaluationRunStatusSchema,
  providerMode: z.enum(['mock', 'live']),
  gitCommitSha: z.string().nullable(),
  startedAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
  summary: evaluationMetricsSchema.nullable(),
  createdAt: z.iso.datetime(),
})

export const evaluationResultSchema = z.object({
  id: z.uuid(),
  caseId: z.uuid(),
  caseKey: z.string().min(1),
  category: evaluationCategorySchema,
  locale: localeSchema,
  passed: z.boolean(),
  actual: z.record(z.string(), z.unknown()),
  failures: z.array(z.string()),
  latencyMs: z.number().int().nonnegative().nullable(),
})

export const evaluationCaseListResponseSchema = z.object({
  cases: z.array(evaluationCaseSchema),
})
export const evaluationRunListResponseSchema = z.object({
  runs: z.array(evaluationRunSchema),
})
export const evaluationRunDetailResponseSchema = z.object({
  run: evaluationRunSchema,
  results: z.array(evaluationResultSchema),
})
export const evaluationRunCreateInputSchema = z.object({
  providerMode: z.enum(['mock', 'live']),
})
export const evaluationRunResponseSchema = z.object({ run: evaluationRunSchema })
export const publicEvaluationSummarySchema = z.object({
  runId: z.uuid(),
  completedAt: z.iso.datetime(),
  metrics: evaluationMetricsSchema,
})
export const publicEvaluationSummaryResponseSchema = z.object({
  evaluation: publicEvaluationSummarySchema.nullable(),
})

export const overviewKnowledgeGapSchema = z.object({
  query: z.string().min(1),
  occurrenceCount: z.number().int().positive(),
  lastSeenAt: z.iso.datetime(),
})

export const overviewMetricsSchema = z.object({
  periodDays: z.number().int().positive(),
  totalConversations: z.number().int().nonnegative(),
  assistantAnswers: z.number().int().nonnegative(),
  openTickets: z.number().int().nonnegative(),
  citationCoverageRate: z.number().min(0).max(1).nullable(),
  refusalRate: z.number().min(0).max(1).nullable(),
  handoffRate: z.number().min(0).max(1).nullable(),
  medianFirstTokenLatencyMs: z.number().int().nonnegative().nullable(),
  medianTotalLatencyMs: z.number().int().nonnegative().nullable(),
  totalTokens: z.number().int().nonnegative().nullable(),
  estimatedCostUsd: z.number().nonnegative().nullable(),
  knowledgeGaps: z.array(overviewKnowledgeGapSchema),
})

export const overviewMetricsResponseSchema = z.object({ metrics: overviewMetricsSchema })

export type Locale = z.infer<typeof localeSchema>
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>
export type DocumentStatus = z.infer<typeof documentStatusSchema>
export type DocumentKind = z.infer<typeof documentKindSchema>
export type OrderStatus = z.infer<typeof orderStatusSchema>
export type AgentIntent = z.infer<typeof agentIntentSchema>
export type TicketStatus = z.infer<typeof ticketStatusSchema>
export type TicketPriority = z.infer<typeof ticketPrioritySchema>
export type WebhookEvent = z.infer<typeof webhookEventSchema>
export type WebhookDeliveryStatus = z.infer<typeof webhookDeliveryStatusSchema>
export type ReturnEligibilityStatus = z.infer<typeof returnEligibilityStatusSchema>
export type ReturnReason = z.infer<typeof returnReasonSchema>
export type ChatStage = z.infer<typeof chatStageSchema>
export type ChatStageStatus = z.infer<typeof chatStageStatusSchema>
export type ToolResultStatus = z.infer<typeof toolResultStatusSchema>
export type HealthResponse = z.infer<typeof healthResponseSchema>
export type OrderLookupInput = z.infer<typeof orderLookupInputSchema>
export type ReturnEligibilityInput = z.infer<typeof returnEligibilityInputSchema>
export type Workspace = z.infer<typeof workspaceSchema>
export type Profile = z.infer<typeof profileSchema>
export type WorkspaceMembership = z.infer<typeof workspaceMembershipSchema>
export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>
export type WorkspaceAccessResponse = z.infer<typeof workspaceAccessResponseSchema>
export type KnowledgeDocument = z.infer<typeof knowledgeDocumentSchema>
export type KnowledgeChunkPreview = z.infer<typeof knowledgeChunkPreviewSchema>
export type RetrievalEvidence = z.infer<typeof retrievalEvidenceSchema>
export type PublicChatRequest = z.infer<typeof publicChatRequestSchema>
export type OrderLookupToolInput = z.infer<typeof orderLookupToolInputSchema>
export type ReturnEligibilityToolInput = z.infer<typeof returnEligibilityToolInputSchema>
export type PublicOrderItem = z.infer<typeof publicOrderItemSchema>
export type PublicOrder = z.infer<typeof publicOrderSchema>
export type PublicProduct = z.infer<typeof publicProductSchema>
export type OrderLookupToolResult = z.infer<typeof orderLookupToolResultSchema>
export type ReturnEligibilityResult = z.infer<typeof returnEligibilityResultSchema>
export type ChatCitation = z.infer<typeof chatCitationSchema>
export type ToolEventDetails = z.infer<typeof toolEventDetailsSchema>
export type ChatStreamEvent = z.infer<typeof chatStreamEventSchema>
export type TicketAssignee = z.infer<typeof ticketAssigneeSchema>
export type TicketSummary = z.infer<typeof ticketSummarySchema>
export type TicketConversationMessage = z.infer<typeof ticketConversationMessageSchema>
export type TicketReply = z.infer<typeof ticketReplySchema>
export type TicketToolTrace = z.infer<typeof ticketToolTraceSchema>
export type TicketDetail = z.infer<typeof ticketDetailSchema>
export type WebhookEndpoint = z.infer<typeof webhookEndpointSchema>
export type WebhookDelivery = z.infer<typeof webhookDeliverySchema>
export type EvaluationCategory = z.infer<typeof evaluationCategorySchema>
export type EvaluationCase = z.infer<typeof evaluationCaseSchema>
export type EvaluationMetrics = z.infer<typeof evaluationMetricsSchema>
export type EvaluationRun = z.infer<typeof evaluationRunSchema>
export type EvaluationResult = z.infer<typeof evaluationResultSchema>
export type PublicEvaluationSummary = z.infer<typeof publicEvaluationSummarySchema>
export type ConversationSource = z.infer<typeof conversationSourceSchema>
export type ConversationStatus = z.infer<typeof conversationStatusSchema>
export type FeedbackRating = z.infer<typeof feedbackRatingSchema>
export type PublicChatFeedbackInput = z.infer<typeof publicChatFeedbackInputSchema>
export type OverviewKnowledgeGap = z.infer<typeof overviewKnowledgeGapSchema>
export type OverviewMetrics = z.infer<typeof overviewMetricsSchema>
export type ConsoleOrderItem = z.infer<typeof consoleOrderItemSchema>
export type ConsoleOrder = z.infer<typeof consoleOrderSchema>
export type ConversationSummary = z.infer<typeof conversationSummarySchema>
export type ConversationMessage = z.infer<typeof conversationMessageSchema>
export type ConversationDetail = z.infer<typeof conversationDetailSchema>
export type WorkspaceSettings = z.infer<typeof workspaceSettingsSchema>
export type WorkspaceMember = z.infer<typeof workspaceMemberSchema>
