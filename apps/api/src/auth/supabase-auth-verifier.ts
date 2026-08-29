import { createClient } from '@supabase/supabase-js'

import { AuthenticationError } from './errors.js'
import type { AuthenticatedUser, AuthVerifier } from './types.js'

export const createSupabaseAuthVerifier = (
  supabaseUrl: string,
  publishableKey: string,
): AuthVerifier => {
  const client = createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })

  return {
    async verifyAccessToken(accessToken: string): Promise<AuthenticatedUser> {
      const { data, error } = await client.auth.getClaims(accessToken)
      const subject = data?.claims.sub

      if (error || typeof subject !== 'string' || !data) {
        throw new AuthenticationError('The access token is invalid or expired.')
      }

      const emailClaim = data.claims.email

      return {
        userId: subject,
        email: typeof emailClaim === 'string' ? emailClaim : null,
      }
    },
  }
}
