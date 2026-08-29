import { z } from 'zod'

import {
  AGENT_INTENTS,
  DOCUMENT_KINDS,
  DOCUMENT_STATUSES,
  ORDER_STATUSES,
  RETURN_ELIGIBILITY_STATUSES,
  SUPPORTED_LOCALES,
  TICKET_STATUSES,
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
  reason: z.enum(['changed_mind', 'defective', 'shipping_damage', 'wrong_item', 'other']),
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
  vectorRank: z.number().int().positive().nullable(),
  keywordRank: z.number().int().positive().nullable(),
})

export type Locale = z.infer<typeof localeSchema>
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>
export type DocumentStatus = z.infer<typeof documentStatusSchema>
export type DocumentKind = z.infer<typeof documentKindSchema>
export type OrderStatus = z.infer<typeof orderStatusSchema>
export type AgentIntent = z.infer<typeof agentIntentSchema>
export type TicketStatus = z.infer<typeof ticketStatusSchema>
export type ReturnEligibilityStatus = z.infer<typeof returnEligibilityStatusSchema>
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
