import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

let client: SupabaseClient | null = null

export const isSupabaseConfigured = Boolean(supabaseUrl && publishableKey)

export const getSupabaseClient = (): SupabaseClient => {
  if (!supabaseUrl || !publishableKey) {
    throw new Error('Supabase public configuration is unavailable.')
  }

  client ??= createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })

  return client
}
