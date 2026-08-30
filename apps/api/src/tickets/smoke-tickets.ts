import { createClient } from '@supabase/supabase-js'

import {
  DEMO_ADMIN_EMAIL,
  DEMO_AGENT_EMAIL,
  DEMO_LOGIN_PASSWORD,
  DEMO_WORKSPACE_ID,
  authSessionResponseSchema,
  ticketDetailResponseSchema,
  ticketListResponseSchema,
} from '@grounddesk/shared'

import { buildApp } from '../app.js'
import { env } from '../config/env.js'

if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Supabase public configuration is required for the ticket smoke test.')
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

const signIn = async (email: string): Promise<string> => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: DEMO_LOGIN_PASSWORD,
  })
  if (error || !data.session) throw new Error(`Demo sign-in failed for ${email}.`)
  return data.session.access_token
}

const app = await buildApp({ logger: false })

try {
  const [adminToken, agentToken] = await Promise.all([
    signIn(DEMO_ADMIN_EMAIL),
    signIn(DEMO_AGENT_EMAIL),
  ])
  const sessionResponse = await app.inject({
    method: 'GET',
    url: '/v1/auth/session',
    headers: { authorization: `Bearer ${agentToken}` },
  })
  const agentId = authSessionResponseSchema.parse(sessionResponse.json()).user.id
  const listResponse = await app.inject({
    method: 'GET',
    url: `/v1/workspaces/${DEMO_WORKSPACE_ID}/tickets`,
    headers: { authorization: `Bearer ${adminToken}` },
  })
  if (listResponse.statusCode !== 200) throw new Error(listResponse.body)
  const adminTickets = ticketListResponseSchema.parse(listResponse.json()).tickets
  const candidate = adminTickets.find((ticket) => ticket.status !== 'resolved')
  if (!candidate) throw new Error('No unresolved real handoff ticket exists for smoke testing.')

  const assignmentResponse = await app.inject({
    method: 'PATCH',
    url: `/v1/workspaces/${DEMO_WORKSPACE_ID}/tickets/${candidate.id}/assignment`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { assignedTo: agentId, priority: 'high' },
  })
  if (assignmentResponse.statusCode !== 200) throw new Error(assignmentResponse.body)

  const agentListResponse = await app.inject({
    method: 'GET',
    url: `/v1/workspaces/${DEMO_WORKSPACE_ID}/tickets`,
    headers: { authorization: `Bearer ${agentToken}` },
  })
  const agentTickets = ticketListResponseSchema.parse(agentListResponse.json()).tickets
  if (!agentTickets.some((ticket) => ticket.id === candidate.id)) {
    throw new Error('The assigned agent cannot see the assigned ticket.')
  }

  const replyResponse = await app.inject({
    method: 'POST',
    url: `/v1/workspaces/${DEMO_WORKSPACE_ID}/tickets/${candidate.id}/replies`,
    headers: { authorization: `Bearer ${agentToken}` },
    payload: { body: 'Smoke test: a human agent reviewed this simulated Demo ticket.' },
  })
  if (replyResponse.statusCode !== 200) throw new Error(replyResponse.body)
  const replied = ticketDetailResponseSchema.parse(replyResponse.json()).ticket
  if (!replied.replies.some((reply) => reply.body.startsWith('Smoke test:'))) {
    throw new Error('The human reply was not persisted.')
  }

  const resolutionResponse = await app.inject({
    method: 'PATCH',
    url: `/v1/workspaces/${DEMO_WORKSPACE_ID}/tickets/${candidate.id}/status`,
    headers: { authorization: `Bearer ${agentToken}` },
    payload: { status: 'resolved' },
  })
  const resolved = ticketDetailResponseSchema.parse(resolutionResponse.json()).ticket
  if (resolved.status !== 'resolved' || !resolved.resolvedAt) {
    throw new Error('The ticket did not complete the resolution lifecycle.')
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        valid: true,
        adminVisibleTickets: adminTickets.length,
        assignedAgentVisible: true,
        conversationMessages: replied.conversationMessages.length,
        evidenceCount: replied.evidence.length,
        toolTraceCount: replied.tools.length,
        replyPersisted: true,
        finalStatus: resolved.status,
      },
      null,
      2,
    )}\n`,
  )
} finally {
  await app.close()
}
