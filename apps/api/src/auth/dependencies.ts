import type { ApiEnv } from '../config/env.js'
import { ServiceUnavailableError } from './errors.js'
import { createPostgresIdentityRepository } from './postgres-identity-repository.js'
import { createSupabaseAuthVerifier } from './supabase-auth-verifier.js'
import type {
  AuthenticatedUser,
  AuthVerifier,
  IdentityDependencies,
  IdentityProfile,
  IdentityRepository,
} from './types.js'

class UnavailableAuthVerifier implements AuthVerifier {
  verifyAccessToken(): Promise<AuthenticatedUser> {
    return Promise.reject(
      new ServiceUnavailableError('Authentication is unavailable in offline mode.'),
    )
  }
}

class UnavailableIdentityRepository implements IdentityRepository {
  getProfile(): Promise<IdentityProfile | null> {
    return Promise.reject(
      new ServiceUnavailableError('Identity storage is unavailable in offline mode.'),
    )
  }

  listMemberships(): Promise<never[]> {
    return Promise.reject(
      new ServiceUnavailableError('Identity storage is unavailable in offline mode.'),
    )
  }

  getMembership(): Promise<null> {
    return Promise.reject(
      new ServiceUnavailableError('Identity storage is unavailable in offline mode.'),
    )
  }

  close(): Promise<void> {
    return Promise.resolve()
  }
}

export const createIdentityDependencies = (environment: ApiEnv): IdentityDependencies => {
  if (
    environment.RUNTIME_MODE !== 'connected' ||
    !environment.SUPABASE_URL ||
    !environment.SUPABASE_PUBLISHABLE_KEY ||
    !environment.SUPABASE_DB_URL
  ) {
    return {
      authVerifier: new UnavailableAuthVerifier(),
      identityRepository: new UnavailableIdentityRepository(),
    }
  }

  return {
    authVerifier: createSupabaseAuthVerifier(
      environment.SUPABASE_URL,
      environment.SUPABASE_PUBLISHABLE_KEY,
    ),
    identityRepository: createPostgresIdentityRepository(environment.SUPABASE_DB_URL),
  }
}
