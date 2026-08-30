import { ServiceUnavailableError } from '../auth/errors.js'
import type { ApiEnv } from '../config/env.js'
import { createPostgresCatalogRepository } from './postgres-catalog-repository.js'
import type { CatalogRepository } from './repository.js'

class UnavailableCatalogRepository implements CatalogRepository {
  listPublicProducts(): Promise<never> {
    return Promise.reject(new ServiceUnavailableError('Catalog is unavailable in offline mode.'))
  }

  close(): Promise<void> {
    return Promise.resolve()
  }
}

export interface CatalogDependencies {
  catalogRepository: CatalogRepository
}

export const createCatalogDependencies = (environment: ApiEnv): CatalogDependencies => ({
  catalogRepository:
    environment.RUNTIME_MODE === 'connected' && environment.SUPABASE_DB_URL
      ? createPostgresCatalogRepository(environment.SUPABASE_DB_URL)
      : new UnavailableCatalogRepository(),
})
