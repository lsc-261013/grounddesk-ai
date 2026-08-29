import { z } from 'zod'

import {
  AGENT_INTENTS,
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

export type Locale = z.infer<typeof localeSchema>
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>
export type DocumentStatus = z.infer<typeof documentStatusSchema>
export type OrderStatus = z.infer<typeof orderStatusSchema>
export type AgentIntent = z.infer<typeof agentIntentSchema>
export type TicketStatus = z.infer<typeof ticketStatusSchema>
export type ReturnEligibilityStatus = z.infer<typeof returnEligibilityStatusSchema>
export type HealthResponse = z.infer<typeof healthResponseSchema>
export type OrderLookupInput = z.infer<typeof orderLookupInputSchema>
export type ReturnEligibilityInput = z.infer<typeof returnEligibilityInputSchema>
export type Workspace = z.infer<typeof workspaceSchema>
