export class AuthenticationError extends Error {
  readonly statusCode = 401
  readonly code = 'authentication_required'

  constructor(message = 'A valid access token is required.') {
    super(message)
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends Error {
  readonly statusCode = 403
  readonly code = 'permission_denied'

  constructor(message = 'You do not have permission to access this resource.') {
    super(message)
    this.name = 'AuthorizationError'
  }
}

export class ServiceUnavailableError extends Error {
  readonly statusCode = 503
  readonly code = 'service_unavailable'

  constructor(message = 'The requested service is not configured.') {
    super(message)
    this.name = 'ServiceUnavailableError'
  }
}

export interface HttpError extends Error {
  statusCode: number
  code: string
}

export const isHttpError = (error: Error): error is HttpError =>
  'statusCode' in error &&
  typeof error.statusCode === 'number' &&
  'code' in error &&
  typeof error.code === 'string'
