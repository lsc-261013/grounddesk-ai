// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it } from 'vitest'

import type { AuthSessionResponse, WorkspaceRole } from '@grounddesk/shared'

import ConsoleLayout from '../src/components/ConsoleLayout.vue'
import { i18n } from '../src/i18n'
import { useAuthStore } from '../src/stores/auth'

const authSession = (role: WorkspaceRole): AuthSessionResponse => ({
  user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'member@example.com' },
  profile: {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    displayName: 'Demo Member',
    avatarUrl: null,
    locale: 'zh-CN',
  },
  memberships: [
    {
      workspace: {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Avenlo Demo Workspace',
        slug: 'avenlo-demo',
        isDemo: true,
      },
      role,
    },
  ],
})

const renderNavigation = async (role: WorkspaceRole) => {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().session = authSession(role)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/console',
        component: { template: '<div />' },
      },
    ],
  })
  await router.push('/console')
  await router.isReady()
  return mount(ConsoleLayout, { global: { plugins: [pinia, router, i18n] } })
}

describe('console navigation permissions', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'zh-CN'
  })

  it('hides administrator-only destinations from agents', async () => {
    const wrapper = await renderNavigation('agent')

    expect(wrapper.text()).toContain('订单')
    expect(wrapper.text()).not.toContain('商品')
    expect(wrapper.text()).not.toContain('评测')
    expect(wrapper.text()).not.toContain('设置')
  })

  it('shows product, evaluation, and settings destinations to administrators', async () => {
    const wrapper = await renderNavigation('admin')

    expect(wrapper.text()).toContain('商品')
    expect(wrapper.text()).toContain('评测')
    expect(wrapper.text()).toContain('设置')
  })
})
