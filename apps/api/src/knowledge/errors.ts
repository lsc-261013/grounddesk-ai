export class KnowledgeInputError extends Error {
  readonly statusCode = 400
  readonly code = 'invalid_document'

  constructor(message: string) {
    super(message)
    this.name = 'KnowledgeInputError'
  }
}

export class KnowledgeConflictError extends Error {
  readonly statusCode = 409
  readonly code = 'document_conflict'

  constructor(message: string) {
    super(message)
    this.name = 'KnowledgeConflictError'
  }
}

export class KnowledgeLimitError extends Error {
  readonly statusCode = 422
  readonly code = 'document_limit_reached'

  constructor(message: string) {
    super(message)
    this.name = 'KnowledgeLimitError'
  }
}
