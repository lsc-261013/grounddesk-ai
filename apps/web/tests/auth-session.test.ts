// @vitest-environment happy-dom

import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  listener: null as ((event: string, session: Session | null) => void) | null,
  session: null as Session | null,
  signOutError: null as Error | null,
  signInError: null as { code?: string; status?: number; name?: string } | null,
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
        signOut: () => Promise.resolve({ error: authMock.signOutError }),
        signInWithPassword: () =>
          Promise.resolve({ data: { session: authMock.session }, error: authMock.signInError }),
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
    authMock.signOutError = null
    authMock.signInError = null
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

  it('separates restored-session failure from a submitted login error', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 503 }))
    const { useAuthStore } = await import('../src/stores/auth')
    const store = useAuthStore()
    await store.initialize()
    expect(store.loginError).toBeNull()
    expect(store.restoreError).toBe('workspace_connection')
    expect(await store.signIn('public@example.com', 'fixture-password')).toBe(false)
    expect(store.loginError).toBe('workspace_connection')
    expect(store.isAuthenticated).toBe(false)
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(apiSession)))
    expect(await store.signIn('public@example.com', 'fixture-password')).toBe(true)
    expect(store.loginError).toBeNull()
    expect(store.restoreError).toBeNull()
  })

  it('distinguishes invalid credentials from an unreachable Auth provider', async () => {
    const { useAuthStore } = await import('../src/stores/auth')
    const store = useAuthStore()
    authMock.signInError = { code: 'invalid_credentials', status: 400 }
    expect(await store.signIn('public@example.com', 'fixture-password')).toBe(false)
    expect(store.loginError).toBe('credentials')
    authMock.signInError = { name: 'AuthRetryableFetchError', status: 0 }
    expect(await store.signIn('public@example.com', 'fixture-password')).toBe(false)
    expect(store.loginError).toBe('provider_connection')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('deduplicates simultaneous provider events and sign-in session loads', async () => {
    const { useAuthStore } = await import('../src/stores/auth')
    const store = useAuthStore()
    authMock.session = null
    await store.initialize()
    let resolveFetch!: (value: Response) => void
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve
        }),
    )
    authMock.session = providerSession
    authMock.listener?.('SIGNED_IN', providerSession)
    const signingIn = store.signIn('public@example.com', 'fixture-password')
    await Promise.resolve()
    expect(fetch).toHaveBeenCalledTimes(1)
    resolveFetch(new Response(JSON.stringify(apiSession)))
    expect(await signingIn).toBe(true)
  })

  it('does not restore membership when an in-flight request completes after logout', async () => {
    const { useAuthStore } = await import('../src/stores/auth')
    const store = useAuthStore()
    authMock.session = null
    await store.initialize()
    let resolveFetch!: (value: Response) => void
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve
        }),
    )
    authMock.session = providerSession
    const signingIn = store.signIn('public@example.com', 'fixture-password')
    await Promise.resolve()
    await store.signOut()
    resolveFetch(new Response(JSON.stringify(apiSession)))
    await signingIn
    expect(store.isAuthenticated).toBe(false)
    expect(store.session).toBeNull()
  })

  it('clears the browser session even when the provider cannot complete sign-out', async () => {
    const { useAuthStore } = await import('../src/stores/auth')
    const store = useAuthStore()
    await store.initialize()
    authMock.signOutError = new Error('Provider sign-out unavailable')

    await store.signOut()

    expect(store.isAuthenticated).toBe(false)
    expect(store.session).toBeNull()
    expect(store.error).toBe('Provider sign-out unavailable')
  })

  it('does not declare JSON for authenticated requests without a body', async () => {
    const { useAuthStore } = await import('../src/stores/auth')
    const { authenticatedApi } = await import('../src/lib/api')
    await useAuthStore().initialize()

    await authenticatedApi('/v1/test-action', { method: 'POST' })

    const request = vi.mocked(fetch).mock.calls.at(-1)?.[1]
    const headers = new Headers(request?.headers)
    expect(headers.get('content-type')).toBeNull()
    expect(headers.get('authorization')).toBe('Bearer stable-access-token')
  })

  it('declares JSON when an authenticated request has a JSON body', async () => {
    const { useAuthStore } = await import('../src/stores/auth')
    const { authenticatedApi } = await import('../src/lib/api')
    await useAuthStore().initialize()

    await authenticatedApi('/v1/test-action', {
      method: 'POST',
      body: JSON.stringify({ ok: true }),
    })

    const request = vi.mocked(fetch).mock.calls.at(-1)?.[1]
    expect(new Headers(request?.headers).get('content-type')).toBe('application/json')
  })
})
