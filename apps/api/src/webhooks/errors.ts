export class WebhookInputError extends Error {
  readonly statusCode = 400
  readonly code = 'webhook_invalid'
}

export class WebhookNotFoundError extends Error {
  readonly statusCode = 404
  readonly code = 'webhook_not_found'

  constructor() {
    super('The webhook endpoint does not exist in this workspace.')
  }
}
