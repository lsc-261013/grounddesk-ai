import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { AuthFlowError } from './auth-errors'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

let client: SupabaseClient | null = null

export const isSupabaseConfigured = Boolean(supabaseUrl && publishableKey)

export const getSupabaseClient = (): SupabaseClient => {
  if (!supabaseUrl || !publishableKey) {
    throw new AuthFlowError('configuration')
  }

  client ??= createClient(supabaseUrl, publishableKey, {
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          signal: init?.signal ?? AbortSignal.timeout(15_000),
        }),
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })

  return client
}
