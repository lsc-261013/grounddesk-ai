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
        signIn: '登录',
        console: '控制台',
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
      auth: {
        title: '进入可信客服工作台',
        description:
          '登录由 Supabase Auth 完成，业务数据仍由 GroundDesk API 进行身份、角色与工作区双重校验。',
        boundaryJwt: '服务端验证访问令牌，而不是信任浏览器状态',
        boundaryRole: '管理员与客服拥有不同的操作权限',
        boundaryIsolation: '每次业务请求都绑定并检查 Workspace',
        formTitle: '工作区登录',
        formDescription: '当前仅允许已创建的 Demo Workspace 成员进入。',
        email: '邮箱',
        emailPlaceholder: "name{'@'}example.com",
        password: '密码',
        passwordPlaceholder: '输入登录密码',
        signIn: '安全登录',
        signingIn: '正在验证…',
        signOut: '退出登录',
        signInError: '登录失败，请检查账号、密码或服务连接。',
        notConfigured: 'Supabase 前端公开配置尚未生效。',
      },
      console: {
        title: '身份边界已建立',
        description:
          '这是里程碑 2 的认证验收页。完整 Overview、Knowledge、Tickets 与 Evaluations 控制台将在后续里程碑接入真实业务数据。',
        user: '当前用户',
        workspace: '工作区',
        role: '服务端角色',
      },
      footer: 'GroundDesk · Demo Workspace · 所有商品与订单均为模拟数据',
      locale: 'EN',
    },
    'en-US': {
      navigation: {
        architecture: 'Architecture baseline',
        status: 'System status',
        signIn: 'Sign in',
        console: 'Console',
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
      auth: {
        title: 'Enter the trusted support workspace',
        description:
          'Supabase Auth handles sign-in while the GroundDesk API independently verifies identity, role, and workspace access for business data.',
        boundaryJwt: 'The API verifies access tokens instead of trusting browser state',
        boundaryRole: 'Administrators and support agents have distinct permissions',
        boundaryIsolation: 'Every business request is scoped to a verified workspace',
        formTitle: 'Workspace sign in',
        formDescription: 'Access is currently limited to provisioned Demo Workspace members.',
        email: 'Email',
        emailPlaceholder: "name{'@'}example.com",
        password: 'Password',
        passwordPlaceholder: 'Enter your password',
        signIn: 'Sign in securely',
        signingIn: 'Verifying…',
        signOut: 'Sign out',
        signInError: 'Sign-in failed. Check the account, password, or service connection.',
        notConfigured: 'The public Supabase web configuration is not available.',
      },
      console: {
        title: 'Identity boundary established',
        description:
          'This is the Milestone 2 authentication acceptance view. The complete Overview, Knowledge, Tickets, and Evaluations console will connect to real business data in later milestones.',
        user: 'Current user',
        workspace: 'Workspace',
        role: 'Server role',
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
