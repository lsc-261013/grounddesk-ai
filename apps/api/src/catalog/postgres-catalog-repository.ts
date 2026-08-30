import type { Sql } from 'postgres'

import { publicProductSchema, type PublicProduct } from '@grounddesk/shared'

import {
  closeRepositoryDatabase,
  createRepositoryDatabase,
  type DatabaseSource,
} from '../db/client.js'
import type { CatalogRepository } from './repository.js'

interface ProductRow {
  id: string
  sku: string
  model: string
  category: string
  nameZh: string
  nameEn: string
  descriptionZh: string
  descriptionEn: string
  priceCents: number
  currency: string
  specs: unknown
}

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

export class PostgresCatalogRepository implements CatalogRepository {
  constructor(private readonly database: Sql) {}

  async listPublicProducts(workspaceSlug: string): Promise<PublicProduct[]> {
    const rows = await this.database<ProductRow[]>`
      select product.id, product.sku, product.model, product.category,
        product.name_zh as "nameZh", product.name_en as "nameEn",
        product.description_zh as "descriptionZh", product.description_en as "descriptionEn",
        product.price_cents as "priceCents", product.currency, product.specs
      from public.products product
      join public.workspaces workspace on workspace.id = product.workspace_id
      where workspace.slug = ${workspaceSlug} and workspace.is_demo
      order by product.created_at, product.id
    `
    return rows.map((row) => publicProductSchema.parse({ ...row, specs: asRecord(row.specs) }))
  }

  async close(): Promise<void> {
    await closeRepositoryDatabase(this.database)
  }
}

export const createPostgresCatalogRepository = (source: DatabaseSource): CatalogRepository =>
  new PostgresCatalogRepository(
    createRepositoryDatabase(source, {
      max: 3,
      applicationName: 'grounddesk-catalog',
    }),
  )
