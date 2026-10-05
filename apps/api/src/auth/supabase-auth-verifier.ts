import { createClient } from '@supabase/supabase-js'

import { AuthenticationError, ServiceUnavailableError } from './errors.js'
import type { AuthenticatedUser, AuthVerifier } from './types.js'

export const createSupabaseAuthVerifier = (
  supabaseUrl: string,
  publishableKey: string,
): AuthVerifier => {
  const client = createClient(supabaseUrl, publishableKey, {
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          signal: init?.signal ?? AbortSignal.timeout(10_000),
        }),
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })

  return {
    async verifyAccessToken(accessToken: string): Promise<AuthenticatedUser> {
      const result = await client.auth.getClaims(accessToken).catch((cause: unknown) => {
        if (cause instanceof TypeError || (cause instanceof Error && cause.name === 'TimeoutError'))
          throw new ServiceUnavailableError(
            'The authentication service is temporarily unavailable.',
          )
        throw new AuthenticationError('The access token is invalid or expired.')
      })
      const { data, error } = result
      if (
        error &&
        (error.status === 0 ||
          (error.status ?? 0) >= 500 ||
          error.name === 'AuthRetryableFetchError')
      )
        throw new ServiceUnavailableError('The authentication service is temporarily unavailable.')
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
