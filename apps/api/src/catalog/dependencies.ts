import type { Sql } from 'postgres'

import { ServiceUnavailableError } from '../auth/errors.js'
import type { ApiEnv } from '../config/env.js'
import { createPostgresCatalogRepository } from './postgres-catalog-repository.js'
import type { CatalogRepository } from './repository.js'

class UnavailableCatalogRepository implements CatalogRepository {
  listPublicProducts(): Promise<never> {
    return Promise.reject(new ServiceUnavailableError('Catalog is unavailable in offline mode.'))
  }

  listProducts(): Promise<never> {
    return Promise.reject(new ServiceUnavailableError('Catalog is unavailable in offline mode.'))
  }

  createProduct(): Promise<never> {
    return Promise.reject(new ServiceUnavailableError('Catalog is unavailable in offline mode.'))
  }

  updateProduct(): Promise<never> {
    return Promise.reject(new ServiceUnavailableError('Catalog is unavailable in offline mode.'))
  }

  close(): Promise<void> {
    return Promise.resolve()
  }
}

export interface CatalogDependencies {
  catalogRepository: CatalogRepository
}

export const createCatalogDependencies = (
  environment: ApiEnv,
  database?: Sql,
): CatalogDependencies => ({
  catalogRepository:
    environment.RUNTIME_MODE === 'connected' && environment.SUPABASE_DB_URL
      ? createPostgresCatalogRepository(database ?? environment.SUPABASE_DB_URL)
      : new UnavailableCatalogRepository(),
})
