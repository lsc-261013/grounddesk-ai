import { z } from 'zod'

import {
  AGENT_INTENTS,
  CHAT_STAGES,
  CHAT_STAGE_STATUSES,
  DOCUMENT_KINDS,
  DOCUMENT_STATUSES,
  ORDER_STATUSES,
  RETURN_ELIGIBILITY_STATUSES,
  RETURN_REASONS,
  SUPPORTED_LOCALES,
  TICKET_STATUSES,
  TOOL_RESULT_STATUSES,
  WORKSPACE_ROLES,
} from './constants.js'

export const localeSchema = z.enum(SUPPORTED_LOCALES)
export const workspaceRoleSchema = z.enum(WORKSPACE_ROLES)
export const documentStatusSchema = z.enum(DOCUMENT_STATUSES)
export const documentKindSchema = z.enum(DOCUMENT_KINDS)
export const orderStatusSchema = z.enum(ORDER_STATUSES)
export const agentIntentSchema = z.enum(AGENT_INTENTS)
export const ticketStatusSchema = z.enum(TICKET_STATUSES)
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
  z.object({ type: z.literal('replace_answer'), content: z.string().min(1) }),
  z.object({
    type: z.literal('done'),
    messageId: z.uuid(),
    intent: agentIntentSchema,
    refused: z.boolean(),
    handedOff: z.boolean(),
  }),
  z.object({ type: z.literal('error'), code: z.string().min(1), message: z.string().min(1) }),
])

export type Locale = z.infer<typeof localeSchema>
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>
export type DocumentStatus = z.infer<typeof documentStatusSchema>
export type DocumentKind = z.infer<typeof documentKindSchema>
export type OrderStatus = z.infer<typeof orderStatusSchema>
export type AgentIntent = z.infer<typeof agentIntentSchema>
export type TicketStatus = z.infer<typeof ticketStatusSchema>
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
export type OrderLookupToolResult = z.infer<typeof orderLookupToolResultSchema>
export type ReturnEligibilityResult = z.infer<typeof returnEligibilityResultSchema>
export type ChatCitation = z.infer<typeof chatCitationSchema>
export type ToolEventDetails = z.infer<typeof toolEventDetailsSchema>
export type ChatStreamEvent = z.infer<typeof chatStreamEventSchema>
