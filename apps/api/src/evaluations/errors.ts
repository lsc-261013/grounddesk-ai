export class EvaluationNotFoundError extends Error {
  readonly statusCode = 404
  readonly code = 'evaluation_not_found'

  constructor() {
    super('The evaluation run does not exist in this workspace.')
  }
}

export class EvaluationConflictError extends Error {
  readonly statusCode = 409
  readonly code = 'evaluation_conflict'
}
