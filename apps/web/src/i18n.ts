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
          '用户身份、角色与工作区均由服务端验证。知识库已连接真实文档处理链路，其余业务模块会按里程碑继续开放。',
        user: '当前用户',
        workspace: '工作区',
        role: '服务端角色',
        navigation: '控制台导航',
        overview: '概览',
        knowledge: '知识库',
        conversations: '会话',
        tickets: '工单',
        settings: '设置',
        readyForUse: '真实链路已就绪',
        openModule: '打开模块',
        roleSource: '角色来自服务端成员关系',
      },
      knowledge: {
        title: '知识来源',
        description: '上传文档后，系统会保留章节与页码、生成多语言向量，并把处理状态写回数据库。',
        uploadTitle: '添加可信资料',
        uploadHint: 'PDF、Markdown 或 TXT，单文件不超过 10MB；每个工作区最多 20 份。',
        chooseFile: '选择一份文档',
        documentTitle: '资料标题',
        language: '资料语言',
        bilingual: '中英双语',
        upload: '上传并处理',
        uploading: '正在上传…',
        readOnly: '当前为客服只读权限：可以查看资料与 Chunk，但不能上传或重试。',
        error: '知识库请求失败，请检查连接后重试。',
        notice: {
          uploaded: '文档已进入处理队列，状态会自动刷新。',
          duplicate: '检测到相同内容，已返回现有文档，没有创建重复数据。',
          retrying: '失败文档已重新进入处理队列。',
        },
        sources: '已连接资料',
        sourcesHint: '状态与 Chunk 数量均来自数据库，不使用占位数据。',
        refresh: '刷新资料列表',
        loading: '正在读取真实状态…',
        empty: '还没有上传资料。',
        status: {
          queued: '排队中',
          processing: '处理中',
          ready: '可检索',
          failed: '处理失败',
        },
        chunks: 'Chunks',
        retry: '重新处理',
        close: '关闭 Chunk 预览',
        noSection: '未标注章节',
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
          'Identity, role, and workspace access are verified by the API. Knowledge now uses the real ingestion pipeline while the remaining modules roll out by milestone.',
        user: 'Current user',
        workspace: 'Workspace',
        role: 'Server role',
        navigation: 'Console navigation',
        overview: 'Overview',
        knowledge: 'Knowledge',
        conversations: 'Conversations',
        tickets: 'Tickets',
        settings: 'Settings',
        readyForUse: 'Real pipeline ready',
        openModule: 'Open module',
        roleSource: 'Role loaded from server membership',
      },
      knowledge: {
        title: 'Knowledge sources',
        description:
          'GroundDesk preserves sections and page numbers, creates multilingual embeddings, and records each processing state in the database.',
        uploadTitle: 'Add trusted material',
        uploadHint: 'PDF, Markdown, or TXT up to 10 MB each, with a 20-document workspace limit.',
        chooseFile: 'Choose one document',
        documentTitle: 'Source title',
        language: 'Document language',
        bilingual: 'Bilingual',
        upload: 'Upload and process',
        uploading: 'Uploading…',
        readOnly:
          'Agent read-only access: you may inspect documents and chunks but cannot upload or retry.',
        error: 'The knowledge request failed. Check the connection and retry.',
        notice: {
          uploaded: 'The document entered the processing queue. Status will refresh automatically.',
          duplicate: 'Identical content already exists, so no duplicate data was created.',
          retrying: 'The failed document returned to the processing queue.',
        },
        sources: 'Connected sources',
        sourcesHint: 'Statuses and chunk counts come from the database, never placeholder data.',
        refresh: 'Refresh sources',
        loading: 'Reading live status…',
        empty: 'No documents have been uploaded yet.',
        status: {
          queued: 'Queued',
          processing: 'Processing',
          ready: 'Searchable',
          failed: 'Failed',
        },
        chunks: 'Chunks',
        retry: 'Retry processing',
        close: 'Close chunk preview',
        noSection: 'No section metadata',
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
