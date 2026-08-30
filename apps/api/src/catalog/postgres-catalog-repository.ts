import type { JSONValue, Sql } from 'postgres'

import {
  consoleProductSchema,
  publicProductSchema,
  type ConsoleProduct,
  type ProductMutationInput,
  type PublicProduct,
} from '@grounddesk/shared'

import {
  closeRepositoryDatabase,
  createRepositoryDatabase,
  type DatabaseSource,
} from '../db/client.js'
import { ProductConflictError } from './errors.js'
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
  isReturnable: boolean
  openedReturnPolicy: string
  isActive: boolean
  updatedAt: Date
}

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const asJsonValue = (value: Record<string, unknown>): JSONValue =>
  JSON.parse(JSON.stringify(value)) as JSONValue

const mapPublicProduct = (row: ProductRow): PublicProduct =>
  publicProductSchema.parse({ ...row, specs: asRecord(row.specs) })

const mapConsoleProduct = (row: ProductRow): ConsoleProduct =>
  consoleProductSchema.parse({
    ...row,
    specs: asRecord(row.specs),
    updatedAt: row.updatedAt.toISOString(),
  })

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && Reflect.get(error, 'code') === '23505'

export class PostgresCatalogRepository implements CatalogRepository {
  constructor(private readonly database: Sql) {}

  async listPublicProducts(workspaceSlug: string): Promise<PublicProduct[]> {
    const rows = await this.database<ProductRow[]>`
      select product.id, product.sku, product.model, product.category,
        product.name_zh as "nameZh", product.name_en as "nameEn",
        product.description_zh as "descriptionZh", product.description_en as "descriptionEn",
        product.price_cents::integer as "priceCents", product.currency, product.specs,
        product.is_returnable as "isReturnable",
        product.opened_return_policy as "openedReturnPolicy",
        product.is_active as "isActive", product.updated_at as "updatedAt"
      from public.products product
      join public.workspaces workspace on workspace.id = product.workspace_id
      where workspace.slug = ${workspaceSlug} and workspace.is_demo and product.is_active
      order by product.created_at, product.id
    `
    return rows.map(mapPublicProduct)
  }

  async listProducts(workspaceId: string): Promise<ConsoleProduct[]> {
    const rows = await this.database<ProductRow[]>`
      select id, sku, model, category, name_zh as "nameZh", name_en as "nameEn",
        description_zh as "descriptionZh", description_en as "descriptionEn",
        price_cents::integer as "priceCents", currency, specs,
        is_returnable as "isReturnable", opened_return_policy as "openedReturnPolicy",
        is_active as "isActive", updated_at as "updatedAt"
      from public.products
      where workspace_id = ${workspaceId}
      order by is_active desc, updated_at desc, id
    `
    return rows.map(mapConsoleProduct)
  }

  async createProduct(workspaceId: string, input: ProductMutationInput): Promise<ConsoleProduct> {
    try {
      const rows = await this.database<ProductRow[]>`
        insert into public.products (
          workspace_id, sku, model, category, name_zh, name_en, description_zh,
          description_en, price_cents, currency, specs, is_returnable,
          opened_return_policy, is_active
        ) values (
          ${workspaceId}, ${input.sku}, ${input.model}, ${input.category}, ${input.nameZh},
          ${input.nameEn}, ${input.descriptionZh}, ${input.descriptionEn}, ${input.priceCents},
          ${input.currency}, ${this.database.json(asJsonValue(input.specs))},
          ${input.isReturnable}, ${input.openedReturnPolicy}, ${input.isActive}
        )
        returning id, sku, model, category, name_zh as "nameZh", name_en as "nameEn",
          description_zh as "descriptionZh", description_en as "descriptionEn",
          price_cents::integer as "priceCents", currency, specs,
          is_returnable as "isReturnable", opened_return_policy as "openedReturnPolicy",
          is_active as "isActive", updated_at as "updatedAt"
      `
      return mapConsoleProduct(rows[0]!)
    } catch (error) {
      if (isUniqueViolation(error)) throw new ProductConflictError()
      throw error
    }
  }

  async updateProduct(
    workspaceId: string,
    productId: string,
    input: ProductMutationInput,
  ): Promise<ConsoleProduct | null> {
    try {
      const rows = await this.database<ProductRow[]>`
        update public.products set
          sku = ${input.sku}, model = ${input.model}, category = ${input.category},
          name_zh = ${input.nameZh}, name_en = ${input.nameEn},
          description_zh = ${input.descriptionZh}, description_en = ${input.descriptionEn},
          price_cents = ${input.priceCents}, currency = ${input.currency},
          specs = ${this.database.json(asJsonValue(input.specs))},
          is_returnable = ${input.isReturnable},
          opened_return_policy = ${input.openedReturnPolicy}, is_active = ${input.isActive},
          updated_at = now()
        where workspace_id = ${workspaceId} and id = ${productId}
        returning id, sku, model, category, name_zh as "nameZh", name_en as "nameEn",
          description_zh as "descriptionZh", description_en as "descriptionEn",
          price_cents::integer as "priceCents", currency, specs,
          is_returnable as "isReturnable", opened_return_policy as "openedReturnPolicy",
          is_active as "isActive", updated_at as "updatedAt"
      `
      return rows[0] ? mapConsoleProduct(rows[0]) : null
    } catch (error) {
      if (isUniqueViolation(error)) throw new ProductConflictError()
      throw error
    }
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
