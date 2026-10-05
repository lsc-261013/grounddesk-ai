import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { parse } from 'dotenv'
import { DEMO_ADMIN_EMAIL, DEMO_LOGIN_PASSWORD } from '@grounddesk/shared'
import { env } from '../config/env.js'

const publicEnv = parse(readFileSync(resolve(process.cwd(), '../../.env')))
if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY)
  throw new Error('Configure the existing Supabase project before running Auth diagnostics.')
console.log(
  JSON.stringify({
    phase: 'configuration',
    urlsMatch: publicEnv.VITE_SUPABASE_URL === env.SUPABASE_URL,
    keysMatch: publicEnv.VITE_SUPABASE_PUBLISHABLE_KEY === env.SUPABASE_PUBLISHABLE_KEY,
    apiHost: new URL(publicEnv.VITE_API_BASE_URL ?? 'http://localhost:8787').host,
    supabaseHost: new URL(env.SUPABASE_URL).host,
  }),
)
const client = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})
try {
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`, {
    signal: AbortSignal.timeout(10_000),
  })
  console.log(JSON.stringify({ phase: 'public-jwks', status: response.status }))
} catch (cause) {
  const detail = cause instanceof Error ? cause.cause : null
  console.log(
    JSON.stringify({
      phase: 'public-jwks',
      name: cause instanceof Error ? cause.name : 'unknown',
      transportCode:
        detail && typeof detail === 'object' && 'code' in detail ? detail.code : undefined,
    }),
  )
}
const { data, error } = await client.auth.signInWithPassword({
  email: DEMO_ADMIN_EMAIL,
  password: DEMO_LOGIN_PASSWORD,
})
console.log(
  JSON.stringify({
    phase: 'password',
    status: error?.status ?? 200,
    code: error?.code,
    name: error?.name,
  }),
)
if (data.session) {
  const claims = await client.auth.getClaims(data.session.access_token)
  console.log(
    JSON.stringify({
      phase: 'claims',
      valid: !!claims.data,
      status: claims.error?.status,
      code: claims.error?.code,
      name: claims.error?.name,
    }),
  )
  const response = await fetch('http://localhost:8787/v1/auth/session', {
    headers: { authorization: `Bearer ${data.session.access_token}` },
  })
  const payload: unknown = await response.json()
  console.log(
    JSON.stringify({
      phase: 'api-session',
      status: response.status,
      code:
        !response.ok && payload && typeof payload === 'object' && 'code' in payload
          ? String(payload.code)
          : undefined,
    }),
  )
  await client.auth.signOut({ scope: 'local' })
}
