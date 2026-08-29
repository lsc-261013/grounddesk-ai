import { createI18n } from 'vue-i18n'

import type { Locale } from '@grounddesk/shared'

const LOCALE_STORAGE_KEY = 'grounddesk-locale'

const getInitialLocale = (): Locale => {
  const savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY)
  return savedLocale === 'en-US' ? 'en-US' : 'zh-CN'
}

export const i18n = createI18n({
  legacy: false,
  locale: getInitialLocale(),
  fallbackLocale: 'en-US',
  messages: {
    'zh-CN': {
      navigation: {
        architecture: '架构基线',
        status: '系统状态',
      },
      hero: {
        eyebrow: 'DEMO WORKSPACE · BUILD IN PROGRESS',
        title: '每一次回答，都有依据。',
        description:
          'GroundDesk 正在构建一条可验证的 AI 客服链路：真实检索、可点击引用、确定性工具与人工接管。',
        milestone: '里程碑 1 / 8',
      },
      status: {
        title: '工程基线',
        description: '这里只展示已经实现并经过检查的能力，不使用占位指标。',
        web: 'Vue 应用',
        api: 'Fastify API',
        database: '数据库迁移',
        ready: '已就绪',
        checking: '检查中',
        unavailable: '未连接',
      },
      footer: 'GroundDesk · Demo Workspace · 所有商品与订单均为模拟数据',
      locale: 'EN',
    },
    'en-US': {
      navigation: {
        architecture: 'Architecture baseline',
        status: 'System status',
      },
      hero: {
        eyebrow: 'DEMO WORKSPACE · BUILD IN PROGRESS',
        title: 'Support answers you can verify.',
        description:
          'GroundDesk is building a verifiable support workflow with real retrieval, clickable citations, deterministic tools, and human handoff.',
        milestone: 'Milestone 1 / 8',
      },
      status: {
        title: 'Engineering baseline',
        description:
          'Only implemented and verified capabilities appear here. No placeholder metrics.',
        web: 'Vue application',
        api: 'Fastify API',
        database: 'Database migration',
        ready: 'Ready',
        checking: 'Checking',
        unavailable: 'Not connected',
      },
      footer: 'GroundDesk · Demo Workspace · All products and orders are simulated',
      locale: '中',
    },
  },
})

export const persistLocale = (locale: Locale): void => {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  document.documentElement.lang = locale
}
