import {
  authSessionResponseSchema,
  workspaceOnboardingResponseSchema,
  type AuthSessionResponse,
  type Locale,
} from '@grounddesk/shared'
import type { Session } from '@supabase/supabase-js'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { getSupabaseClient } from '../lib/supabase'
import { AuthFlowError, classifyProviderError, type AuthErrorKind } from '../lib/auth-errors'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787'

export const useAuthStore = defineStore('auth', () => {
  const providerSession = ref<Session | null>(null)
  const session = ref<AuthSessionResponse | null>(null)
  const isInitializing = ref(true)
  const isSubmitting = ref(false)
  const error = ref<string | null>(null)
  const loginError = ref<AuthErrorKind | null>(null)
  const restoreError = ref<AuthErrorKind | null>(null)
  let listenerRegistered = false
  let initializing: Promise<void> | null = null
  let revision = 0
  let pendingSession: { token: string; promise: Promise<void> } | null = null

  const isAuthenticated = computed(() => Boolean(providerSession.value && session.value))
  const accessToken = computed(() => providerSession.value?.access_token ?? null)
  const activeMembership = computed(() => session.value?.memberships[0] ?? null)

  const loadApiSession = async (accessToken: string): Promise<AuthSessionResponse> => {
    let response: Response
    try {
      response = await fetch(`${API_BASE_URL}/v1/auth/session`, {
        headers: { authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(15_000),
      })
    } catch {
      throw new AuthFlowError('workspace_connection')
    }

    if (!response.ok) {
      throw new AuthFlowError(
        response.status === 401
          ? 'session_expired'
          : response.status >= 500
            ? 'workspace_connection'
            : 'workspace_rejected',
      )
    }

    try {
      return authSessionResponseSchema.parse(await response.json())
    } catch {
      throw new AuthFlowError('workspace_response')
    }
  }

  const applyProviderSession = async (nextSession: Session | null): Promise<void> => {
    if (nextSession?.access_token === providerSession.value?.access_token && session.value) return
    if (nextSession && pendingSession?.token === nextSession.access_token)
      return pendingSession.promise
    const current = ++revision
    providerSession.value = nextSession
    session.value = null
    if (!nextSession) return
    const promise = loadApiSession(nextSession.access_token)
      .then((result) => {
        // A stale response must not restore membership after logout or a newer sign-in.
        if (current === revision) {
          session.value = result
          restoreError.value = null
        }
      })
      .finally(() => {
        if (pendingSession?.promise === promise) pendingSession = null
      })
    pendingSession = { token: nextSession.access_token, promise }
    return promise
  }

  const errorKind = (cause: unknown): AuthErrorKind =>
    cause instanceof AuthFlowError ? cause.kind : classifyProviderError(cause)

  const restore = async (): Promise<void> => {
    error.value = null

    try {
      const client = getSupabaseClient()
      if (!listenerRegistered) {
        client.auth.onAuthStateChange((_event, nextSession) => {
          if (nextSession?.access_token === providerSession.value?.access_token && session.value) {
            return
          }
          void applyProviderSession(nextSession).catch((cause: unknown) => {
            restoreError.value = errorKind(cause)
          })
        })
        listenerRegistered = true
      }
      const { data, error: sessionError } = await client.auth.getSession()
      if (sessionError) throw sessionError
      await applyProviderSession(data.session)
    } catch (cause) {
      providerSession.value = null
      session.value = null
      restoreError.value = errorKind(cause)
    } finally {
      isInitializing.value = false
    }
  }
  const initialize = (): Promise<void> => {
    if (initializing) return initializing
    if (!isInitializing.value) return Promise.resolve()
    initializing = restore().finally(() => {
      initializing = null
    })
    return initializing
  }
  const clearLoginError = (): void => {
    loginError.value = null
  }

  const signIn = async (email: string, password: string): Promise<boolean> => {
    if (isSubmitting.value) return false
    isSubmitting.value = true
    error.value = null
    loginError.value = null
    restoreError.value = null

    try {
      const { data, error: signInError } = await getSupabaseClient().auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) throw new AuthFlowError(classifyProviderError(signInError))
      if (!data.session) throw new AuthFlowError('provider_rejected')
      await applyProviderSession(data.session)
      return isAuthenticated.value
    } catch (cause) {
      session.value = null
      loginError.value = errorKind(cause)
      error.value = loginError.value
      return false
    } finally {
      isSubmitting.value = false
    }
  }

  const signUp = async (
    email: string,
    password: string,
    displayName: string,
    locale: Locale,
  ): Promise<'signed_in' | 'confirmation_required' | 'failed'> => {
    isSubmitting.value = true
    error.value = null
    try {
      const { data, error: signUpError } = await getSupabaseClient().auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName, locale } },
      })
      if (signUpError) throw signUpError
      if (!data.session) return 'confirmation_required'
      await applyProviderSession(data.session)
      return 'signed_in'
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Sign up failed.'
      return 'failed'
    } finally {
      isSubmitting.value = false
    }
  }

  const onboard = async (name: string, slug: string, defaultLocale: Locale): Promise<boolean> => {
    const token = accessToken.value
    if (!token) return false
    isSubmitting.value = true
    error.value = null
    try {
      const response = await fetch(`${API_BASE_URL}/v1/auth/onboard`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, slug, defaultLocale }),
      })
      if (!response.ok)
        throw new Error(`Workspace onboarding failed with status ${response.status}`)
      workspaceOnboardingResponseSchema.parse(await response.json())
      session.value = await loadApiSession(token)
      return true
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Workspace onboarding failed.'
      return false
    } finally {
      isSubmitting.value = false
    }
  }

  const signOut = async (): Promise<void> => {
    isSubmitting.value = true
    error.value = null
    ++revision
    providerSession.value = null
    session.value = null
    pendingSession = null
    loginError.value = null
    restoreError.value = null

    try {
      const { error: signOutError } = await getSupabaseClient().auth.signOut({ scope: 'local' })
      if (signOutError) throw signOutError
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Sign out failed.'
    } finally {
      providerSession.value = null
      session.value = null
      isSubmitting.value = false
    }
  }

  return {
    accessToken,
    activeMembership,
    clearLoginError,
    error,
    loginError,
    restoreError,
    initialize,
    isAuthenticated,
    isInitializing,
    isSubmitting,
    onboard,
    session,
    signIn,
    signOut,
    signUp,
  }
})
