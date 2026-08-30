import { afterEach, describe, expect, it } from 'vitest'

import type {
  ConsoleOrder,
  ConversationDetail,
  ConversationSummary,
  WorkspaceMember,
  WorkspaceMembership,
  WorkspaceRole,
  WorkspaceSettings,
} from '@grounddesk/shared'

import type { IdentityDependencies } from '../src/auth/types.js'
import { buildApp } from '../src/app.js'
import { parseApiEnv } from '../src/config/env.js'
import type { ConversationRepository } from '../src/conversations/repository.js'
import type { OrderRepository } from '../src/orders/repository.js'
import type { WorkspaceRepository } from '../src/workspaces/repository.js'

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ORDER_ID = '22222222-2222-4222-8222-222222222222'
const CONVERSATION_ID = '33333333-3333-4333-8333-333333333333'
const NOW = '2026-08-30T08:00:00.000Z'

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

const order: ConsoleOrder = {
  id: ORDER_ID,
  orderNumber: 'GD-2026D018',
  customerName: 'Demo Customer',
  customerEmail: 'demo.customer@example.com',
  status: 'delivered',
  orderedAt: NOW,
  shippedAt: NOW,
  deliveredAt: NOW,
  cancelledAt: null,
  carrier: 'GroundShip',
  trackingNumberMasked: '********1208',
  shippingCountryCode: 'SG',
  totalCents: 89900,
  currency: 'CNY',
  isDemo: true,
  items: [
    {
      id: '44444444-4444-4444-8444-444444444444',
      productId: '55555555-5555-4555-8555-555555555555',
      sku: 'AV-BUDS-PRO-2',
      model: 'Buds Pro 2',
      nameZh: 'Avenlo Buds Pro 2',
      nameEn: 'Avenlo Buds Pro 2',
      quantity: 1,
      unitPriceCents: 89900,
      opened: false,
    },
  ],
  updatedAt: NOW,
}

class FakeOrderRepository implements OrderRepository {
  updateCalls = 0

  list() {
    return Promise.resolve({ orders: [order], total: 1 })
  }

  get(_workspaceId: string, orderId: string) {
    return Promise.resolve(orderId === ORDER_ID ? order : null)
  }

  updateStatus(_workspaceId: string, orderId: string, status: ConsoleOrder['status']) {
    this.updateCalls += 1
    return Promise.resolve(orderId === ORDER_ID ? { ...order, status } : null)
  }

  close() {
    return Promise.resolve()
  }
}

const conversationSummary: ConversationSummary = {
  id: CONVERSATION_ID,
  locale: 'zh-CN',
  status: 'active',
  source: 'playground',
  messageCount: 2,
  latestMessage: '保修期是多久？',
  lastIntent: 'knowledge_answer',
  refused: false,
  handedOff: false,
  ticketId: null,
  startedAt: NOW,
  updatedAt: NOW,
}

const conversationDetail: ConversationDetail = {
  ...conversationSummary,
  messages: [
    {
      id: '66666666-6666-4666-8666-666666666666',
      role: 'user',
      content: '保修期是多久？',
      intent: 'knowledge_answer',
      refused: false,
      handedOff: false,
      firstTokenLatencyMs: null,
      totalLatencyMs: null,
      inputTokens: null,
      outputTokens: null,
      estimatedCostUsd: null,
      citations: [],
      createdAt: NOW,
    },
  ],
  tools: [],
}

class FakeConversationRepository implements ConversationRepository {
  lastRole: WorkspaceRole | null = null

  list(_workspaceId: string, access: { userId: string; role: WorkspaceRole }) {
    this.lastRole = access.role
    return Promise.resolve({ conversations: [conversationSummary], total: 1 })
  }

  get(
    _workspaceId: string,
    conversationId: string,
    access: { userId: string; role: WorkspaceRole },
  ) {
    this.lastRole = access.role
    return Promise.resolve(conversationId === CONVERSATION_ID ? conversationDetail : null)
  }

  close() {
    return Promise.resolve()
  }
}

const workspaceSettings: WorkspaceSettings = {
  id: WORKSPACE_ID,
  name: 'Avenlo Demo Workspace',
  slug: 'avenlo-demo',
  defaultLocale: 'zh-CN',
  confidenceThreshold: 0.6,
  isDemo: true,
  updatedAt: NOW,
}

const workspaceMember: WorkspaceMember = {
  userId: USER_ID,
  email: 'admin@example.com',
  displayName: 'Demo Admin',
  role: 'admin',
  createdAt: NOW,
}

class FakeWorkspaceRepository implements WorkspaceRepository {
  getSettings() {
    return Promise.resolve(workspaceSettings)
  }

  updateSettings(
    _workspaceId: string,
    input: { name: string; defaultLocale: 'zh-CN' | 'en-US'; confidenceThreshold: number },
  ) {
    return Promise.resolve({ ...workspaceSettings, ...input })
  }

  listMembers() {
    return Promise.resolve([workspaceMember])
  }

  addMember() {
    return Promise.resolve(workspaceMember)
  }

  updateMember() {
    return Promise.resolve(null)
  }

  removeMember() {
    return Promise.resolve(false)
  }

  onboard() {
    return Promise.resolve(membership('admin'))
  }

  resetDemo() {
    return Promise.resolve(true)
  }

  close() {
    return Promise.resolve()
  }
}

const apps: Awaited<ReturnType<typeof buildApp>>[] = []

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()))
})

describe('console operations routes', () => {
  it('lets an agent read orders but blocks order mutations', async () => {
    const orders = new FakeOrderRepository()
    const app = await buildApp({
      environment: parseApiEnv({ RUNTIME_MODE: 'offline', NODE_ENV: 'test' }),
      identityDependencies: createIdentity('agent'),
      orderDependencies: { orderRepository: orders },
      logger: false,
    })
    apps.push(app)

    const list = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${WORKSPACE_ID}/orders`,
      headers: { authorization: 'Bearer valid' },
    })
    const update = await app.inject({
      method: 'PATCH',
      url: `/v1/workspaces/${WORKSPACE_ID}/orders/${ORDER_ID}/status`,
      headers: { authorization: 'Bearer valid' },
      payload: { status: 'cancelled' },
    })

    expect(list.statusCode).toBe(200)
    expect(list.json()).toMatchObject({ total: 1, orders: [{ orderNumber: 'GD-2026D018' }] })
    expect(update.statusCode).toBe(403)
    expect(orders.updateCalls).toBe(0)
  })

  it('passes the authenticated agent scope to conversation queries', async () => {
    const conversations = new FakeConversationRepository()
    const app = await buildApp({
      environment: parseApiEnv({ RUNTIME_MODE: 'offline', NODE_ENV: 'test' }),
      identityDependencies: createIdentity('agent'),
      conversationDependencies: { conversationRepository: conversations },
      logger: false,
    })
    apps.push(app)

    const response = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${WORKSPACE_ID}/conversations/${CONVERSATION_ID}`,
      headers: { authorization: 'Bearer valid' },
    })

    expect(response.statusCode, response.body).toBe(200)
    expect(response.json()).toMatchObject({ conversation: { source: 'playground' } })
    expect(conversations.lastRole).toBe('agent')
  })

  it('allows admins to update workspace settings and rejects agents', async () => {
    const request = {
      method: 'PATCH' as const,
      url: `/v1/workspaces/${WORKSPACE_ID}/settings`,
      headers: { authorization: 'Bearer valid' },
      payload: { name: 'GroundDesk Lab', defaultLocale: 'en-US', confidenceThreshold: 0.7 },
    }
    const adminApp = await buildApp({
      environment: parseApiEnv({ RUNTIME_MODE: 'offline', NODE_ENV: 'test' }),
      identityDependencies: createIdentity('admin'),
      workspaceDependencies: { workspaceRepository: new FakeWorkspaceRepository() },
      logger: false,
    })
    const agentApp = await buildApp({
      environment: parseApiEnv({ RUNTIME_MODE: 'offline', NODE_ENV: 'test' }),
      identityDependencies: createIdentity('agent'),
      workspaceDependencies: { workspaceRepository: new FakeWorkspaceRepository() },
      logger: false,
    })
    apps.push(adminApp, agentApp)

    const adminResponse = await adminApp.inject(request)
    const agentResponse = await agentApp.inject(request)

    expect(adminResponse.statusCode).toBe(200)
    expect(adminResponse.json()).toMatchObject({
      workspace: { name: 'GroundDesk Lab', defaultLocale: 'en-US', confidenceThreshold: 0.7 },
    })
    expect(agentResponse.statusCode).toBe(403)
  })

  it('requires a valid session before onboarding', async () => {
    const app = await buildApp({
      environment: parseApiEnv({ RUNTIME_MODE: 'offline', NODE_ENV: 'test' }),
      identityDependencies: createIdentity('admin'),
      workspaceDependencies: { workspaceRepository: new FakeWorkspaceRepository() },
      logger: false,
    })
    apps.push(app)

    const denied = await app.inject({
      method: 'POST',
      url: '/v1/auth/onboard',
      payload: { name: 'GroundDesk Lab', slug: 'grounddesk-lab', defaultLocale: 'zh-CN' },
    })
    const accepted = await app.inject({
      method: 'POST',
      url: '/v1/auth/onboard',
      headers: { authorization: 'Bearer valid' },
      payload: { name: 'GroundDesk Lab', slug: 'grounddesk-lab', defaultLocale: 'zh-CN' },
    })

    expect(denied.statusCode).toBe(401)
    expect(accepted.statusCode).toBe(200)
    expect(accepted.json()).toMatchObject({ membership: { role: 'admin' } })
  })
})
