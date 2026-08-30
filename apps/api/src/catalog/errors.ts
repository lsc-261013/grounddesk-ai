export class ProductConflictError extends Error {
  readonly statusCode = 409
  readonly code = 'product_conflict'

  constructor(message = 'A product with this SKU or model already exists in the workspace.') {
    super(message)
    this.name = 'ProductConflictError'
  }
}
