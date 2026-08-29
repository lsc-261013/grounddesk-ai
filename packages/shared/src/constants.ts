export const APP_NAME = 'GroundDesk'
export const DEMO_WORKSPACE_SLUG = 'northstar-audio-demo'
export const EMBEDDING_VECTOR_DIMENSION = 1024
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const MAX_WORKSPACE_DOCUMENTS = 20

export const SUPPORTED_LOCALES = ['zh-CN', 'en-US'] as const
export const WORKSPACE_ROLES = ['admin', 'agent'] as const
export const DOCUMENT_STATUSES = ['queued', 'processing', 'ready', 'failed'] as const
export const ORDER_STATUSES = [
  'pending',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
] as const
export const AGENT_INTENTS = [
  'knowledge_answer',
  'order_lookup',
  'return_eligibility',
  'human_handoff',
] as const
export const TICKET_STATUSES = ['open', 'in_progress', 'waiting_customer', 'resolved'] as const
export const RETURN_ELIGIBILITY_STATUSES = ['eligible', 'ineligible', 'manual_review'] as const
