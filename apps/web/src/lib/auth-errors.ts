export type AuthErrorKind =
  | 'configuration'
  | 'credentials'
  | 'provider_connection'
  | 'provider_rejected'
  | 'session_expired'
  | 'workspace_connection'
  | 'workspace_rejected'
  | 'workspace_response'

export class AuthFlowError extends Error {
  constructor(readonly kind: AuthErrorKind) {
    super(kind)
    this.name = 'AuthFlowError'
  }
}

export const classifyProviderError = (cause: unknown): AuthErrorKind => {
  if (cause && typeof cause === 'object') {
    const code = 'code' in cause ? cause.code : undefined
    const status = 'status' in cause ? cause.status : undefined
    const name = 'name' in cause ? cause.name : undefined
    if (code === 'invalid_credentials') return 'credentials'
    if (status === 0 || name === 'AuthRetryableFetchError' || cause instanceof TypeError)
      return 'provider_connection'
  }
  return 'provider_rejected'
}
