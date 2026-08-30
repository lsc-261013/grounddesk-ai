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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787'

export const useAuthStore = defineStore('auth', () => {
  const providerSession = ref<Session | null>(null)
  const session = ref<AuthSessionResponse | null>(null)
  const isInitializing = ref(true)
  const isSubmitting = ref(false)
  const error = ref<string | null>(null)
  let listenerRegistered = false

  const isAuthenticated = computed(() => Boolean(providerSession.value && session.value))
  const accessToken = computed(() => providerSession.value?.access_token ?? null)
  const activeMembership = computed(() => session.value?.memberships[0] ?? null)

  const loadApiSession = async (accessToken: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/v1/auth/session`, {
      headers: { authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      throw new Error(`GroundDesk session request failed with status ${response.status}`)
    }

    session.value = authSessionResponseSchema.parse(await response.json())
  }

  const applyProviderSession = async (nextSession: Session | null): Promise<void> => {
    providerSession.value = nextSession
    session.value = null

    if (nextSession) {
      await loadApiSession(nextSession.access_token)
    }
  }

  const initialize = async (): Promise<void> => {
    if (!isInitializing.value && listenerRegistered) return

    error.value = null

    try {
      const client = getSupabaseClient()
      const { data, error: sessionError } = await client.auth.getSession()

      if (sessionError) throw sessionError
      await applyProviderSession(data.session)

      if (!listenerRegistered) {
        client.auth.onAuthStateChange((_event, nextSession) => {
          void applyProviderSession(nextSession).catch((cause: unknown) => {
            error.value = cause instanceof Error ? cause.message : 'Session synchronization failed.'
          })
        })
        listenerRegistered = true
      }
    } catch (cause) {
      providerSession.value = null
      session.value = null
      error.value = cause instanceof Error ? cause.message : 'Authentication initialization failed.'
    } finally {
      isInitializing.value = false
    }
  }

  const signIn = async (email: string, password: string): Promise<boolean> => {
    isSubmitting.value = true
    error.value = null

    try {
      const { data, error: signInError } = await getSupabaseClient().auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) throw signInError
      await applyProviderSession(data.session)
      return true
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Sign in failed.'
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
      await loadApiSession(token)
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

    try {
      const { error: signOutError } = await getSupabaseClient().auth.signOut()
      if (signOutError) throw signOutError
      providerSession.value = null
      session.value = null
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Sign out failed.'
    } finally {
      isSubmitting.value = false
    }
  }

  return {
    accessToken,
    activeMembership,
    error,
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
