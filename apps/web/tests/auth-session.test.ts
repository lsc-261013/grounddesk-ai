// @vitest-environment happy-dom

import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  listener: null as ((event: string, session: Session | null) => void) | null,
  session: null as Session | null,
}))

vi.mock('../src/lib/supabase', () => ({
  getSupabaseClient: (): SupabaseClient =>
    ({
      auth: {
        getSession: () => Promise.resolve({ data: { session: authMock.session }, error: null }),
        onAuthStateChange: (listener: (event: string, session: Session | null) => void) => {
          authMock.listener = listener
          return { data: { subscription: { unsubscribe: vi.fn() } } }
        },
      },
    }) as unknown as SupabaseClient,
}))

const providerSession = {
  access_token: 'stable-access-token',
  refresh_token: 'refresh-token',
  expires_in: 3_600,
  token_type: 'bearer',
  user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
} as unknown as Session

const apiSession = {
  user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'admin@example.com' },
  profile: {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    displayName: 'Demo Admin',
    avatarUrl: null,
    locale: 'zh-CN',
  },
  memberships: [
    {
      workspace: {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Avenlo Demo Workspace',
        slug: 'avenlo-demo',
        isDemo: true,
      },
      role: 'admin',
    },
  ],
}

describe('authentication session synchronization', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    authMock.session = providerSession
    authMock.listener = null
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify(apiSession), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      ),
    )
  })

  it('does not clear workspace membership when Supabase repeats the initial session', async () => {
    const { useAuthStore } = await import('../src/stores/auth')
    const store = useAuthStore()

    await store.initialize()
    expect(store.activeMembership?.role).toBe('admin')

    authMock.listener?.('INITIAL_SESSION', providerSession)

    expect(store.activeMembership?.workspace.slug).toBe('avenlo-demo')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
