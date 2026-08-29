import { createClient } from '@supabase/supabase-js'

import {
  authSessionResponseSchema,
  DEMO_ADMIN_EMAIL,
  DEMO_AGENT_EMAIL,
  DEMO_LOGIN_PASSWORD,
  DEMO_WORKSPACE_ID,
  workspaceAccessResponseSchema,
  type WorkspaceRole,
} from '@grounddesk/shared'

import { buildApp } from '../app.js'
import { env } from '../config/env.js'

interface AuthCase {
  email: string
  expectedRole: WorkspaceRole
  expectedSettingsStatus: 200 | 403
}

const cases: readonly AuthCase[] = [
  { email: DEMO_ADMIN_EMAIL, expectedRole: 'admin', expectedSettingsStatus: 200 },
  { email: DEMO_AGENT_EMAIL, expectedRole: 'agent', expectedSettingsStatus: 403 },
]

if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Connected Supabase URL and publishable key are required.')
}

const app = await buildApp({ logger: false })
const results: Array<{
  email: string
  role: WorkspaceRole
  sessionStatus: number
  settingsStatus: number
  crossWorkspaceStatus: number
}> = []

try {
  for (const authCase of cases) {
    const client = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })
    const { data, error } = await client.auth.signInWithPassword({
      email: authCase.email,
      password: DEMO_LOGIN_PASSWORD,
    })

    if (error || !data.session) {
      throw error ?? new Error(`No session returned for ${authCase.email}`)
    }

    const headers = { authorization: `Bearer ${data.session.access_token}` }
    const sessionResponse = await app.inject({ method: 'GET', url: '/v1/auth/session', headers })
    const accessResponse = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${DEMO_WORKSPACE_ID}/access`,
      headers,
    })
    const settingsResponse = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${DEMO_WORKSPACE_ID}/settings-access`,
      headers,
    })
    const crossWorkspaceResponse = await app.inject({
      method: 'GET',
      url: '/v1/workspaces/22222222-2222-4222-8222-222222222222/access',
      headers,
    })

    const sessionPayload = authSessionResponseSchema.parse(sessionResponse.json())
    const accessPayload = workspaceAccessResponseSchema.parse(accessResponse.json())

    if (
      sessionResponse.statusCode !== 200 ||
      accessResponse.statusCode !== 200 ||
      accessPayload.role !== authCase.expectedRole ||
      settingsResponse.statusCode !== authCase.expectedSettingsStatus ||
      crossWorkspaceResponse.statusCode !== 403 ||
      sessionPayload.user.email !== authCase.email
    ) {
      throw new Error(`Auth smoke validation failed for ${authCase.email}`)
    }

    results.push({
      email: authCase.email,
      role: accessPayload.role,
      sessionStatus: sessionResponse.statusCode,
      settingsStatus: settingsResponse.statusCode,
      crossWorkspaceStatus: crossWorkspaceResponse.statusCode,
    })

    await client.auth.signOut()
  }

  process.stdout.write(`${JSON.stringify({ valid: true, results }, null, 2)}\n`)
} finally {
  await app.close()
}
