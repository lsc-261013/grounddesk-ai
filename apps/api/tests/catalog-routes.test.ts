import { afterEach, describe, expect, it } from 'vitest'

import type {
  ConsoleProduct,
  ProductMutationInput,
  WorkspaceMembership,
  WorkspaceRole,
} from '@grounddesk/shared'

import { buildApp } from '../src/app.js'
import type { IdentityDependencies } from '../src/auth/types.js'
import type { CatalogRepository } from '../src/catalog/repository.js'
import { parseApiEnv } from '../src/config/env.js'

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_WORKSPACE_ID = '22222222-2222-4222-8222-222222222222'
const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PRODUCT_ID = '30000000-0000-4000-8000-000000000001'
const NOW = '2026-08-31T08:00:00.000Z'

const membership = (role: WorkspaceRole): WorkspaceMembership => ({
  workspace: {
    id: WORKSPACE_ID,
    name: 'Avenlo Demo Workspace',
    slug: 'avenlo-demo',
    isDemo: true,
  },
  role,
})

const createIdentity = (role: WorkspaceRole): IdentityDependencies => ({
  authVerifier: {
    verifyAccessToken: () => Promise.resolve({ userId: USER_ID, email: 'member@example.com' }),
  },
  identityRepository: {
    getProfile: () => Promise.resolve(null),
    listMemberships: () => Promise.resolve([membership(role)]),
    getMembership: (_userId, workspaceId) =>
      Promise.resolve(workspaceId === WORKSPACE_ID ? membership(role) : null),
    close: () => Promise.resolve(),
  },
})

const input: ProductMutationInput = {
  sku: 'AVL-AW-S1-BLK',
  model: 'Airwave S1',
  category: 'wireless_earbuds',
  nameZh: 'Airwave S1 真无线耳机',
  nameEn: 'Airwave S1 Wireless Earbuds',
  descriptionZh: '轻量通勤耳机，支持蓝牙连接与基础防水能力。',
  descriptionEn: 'Lightweight commuter earbuds with Bluetooth and basic water resistance.',
  priceCents: 8900,
  currency: 'USD',
  specs: { bluetooth: '5.3' },
  isReturnable: true,
  openedReturnPolicy: 'sealed_audio',
  isActive: true,
}

const product: ConsoleProduct = { id: PRODUCT_ID, ...input, updatedAt: NOW }

class FakeCatalogRepository implements CatalogRepository {
  mutationCalls = 0

  listPublicProducts() {
    return Promise.resolve([product])
  }

  listProducts() {
    return Promise.resolve([product])
  }

  createProduct(_workspaceId: string, next: ProductMutationInput) {
    this.mutationCalls += 1
    return Promise.resolve({ id: PRODUCT_ID, ...next, updatedAt: NOW })
  }

  updateProduct(_workspaceId: string, productId: string, next: ProductMutationInput) {
    this.mutationCalls += 1
    return Promise.resolve(
      productId === PRODUCT_ID ? { id: PRODUCT_ID, ...next, updatedAt: NOW } : null,
    )
  }

  close() {
    return Promise.resolve()
  }
}

const apps: Awaited<ReturnType<typeof buildApp>>[] = []

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()))
})

const createApp = async (role: WorkspaceRole, catalog: FakeCatalogRepository) => {
  const app = await buildApp({
    environment: parseApiEnv({ RUNTIME_MODE: 'offline', NODE_ENV: 'test' }),
    identityDependencies: createIdentity(role),
    catalogDependencies: { catalogRepository: catalog },
    logger: false,
  })
  apps.push(app)
  return app
}

describe('catalog routes', () => {
  it('serves active Demo products without authentication', async () => {
    const app = await createApp('admin', new FakeCatalogRepository())
    const response = await app.inject({
      method: 'GET',
      url: '/v1/public/workspaces/avenlo-demo/products',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ products: [{ model: 'Airwave S1' }] })
  })

  it('allows administrators to create and update catalog records', async () => {
    const catalog = new FakeCatalogRepository()
    const app = await createApp('admin', catalog)
    const created = await app.inject({
      method: 'POST',
      url: `/v1/workspaces/${WORKSPACE_ID}/products`,
      headers: { authorization: 'Bearer valid' },
      payload: input,
    })
    const updated = await app.inject({
      method: 'PATCH',
      url: `/v1/workspaces/${WORKSPACE_ID}/products/${PRODUCT_ID}`,
      headers: { authorization: 'Bearer valid' },
      payload: { ...input, isActive: false },
    })

    expect(created.statusCode, created.body).toBe(201)
    expect(updated.statusCode, updated.body).toBe(200)
    expect(updated.json()).toMatchObject({ product: { isActive: false } })
    expect(catalog.mutationCalls).toBe(2)
  })

  it('blocks agents and cross-workspace catalog access before repository mutation', async () => {
    const catalog = new FakeCatalogRepository()
    const app = await createApp('agent', catalog)
    const agentWrite = await app.inject({
      method: 'POST',
      url: `/v1/workspaces/${WORKSPACE_ID}/products`,
      headers: { authorization: 'Bearer valid' },
      payload: input,
    })
    const crossWorkspace = await app.inject({
      method: 'POST',
      url: `/v1/workspaces/${OTHER_WORKSPACE_ID}/products`,
      headers: { authorization: 'Bearer valid' },
      payload: input,
    })

    expect(agentWrite.statusCode).toBe(403)
    expect(crossWorkspace.statusCode).toBe(403)
    expect(catalog.mutationCalls).toBe(0)
  })

  it('rejects malformed product payloads', async () => {
    const catalog = new FakeCatalogRepository()
    const app = await createApp('admin', catalog)
    const response = await app.inject({
      method: 'POST',
      url: `/v1/workspaces/${WORKSPACE_ID}/products`,
      headers: { authorization: 'Bearer valid' },
      payload: { ...input, sku: 'not valid', priceCents: -1 },
    })

    expect(response.statusCode).toBe(400)
    expect(catalog.mutationCalls).toBe(0)
  })
})
