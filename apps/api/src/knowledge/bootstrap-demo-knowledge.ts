import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { createClient } from '@supabase/supabase-js'

import { DEMO_ADMIN_EMAIL, DEMO_WORKSPACE_ID, type Locale } from '@grounddesk/shared'

import { env } from '../config/env.js'
import { createKnowledgeDependencies } from './dependencies.js'

const definitions: Readonly<
  Record<string, { title: string; language: Locale; mimeType: 'text/markdown' }>
> = {
  'products-zh.md': {
    title: 'Avenlo 产品与兼容性手册',
    language: 'zh-CN',
    mimeType: 'text/markdown',
  },
  'products-en.md': {
    title: 'Avenlo Product and Compatibility Guide',
    language: 'en-US',
    mimeType: 'text/markdown',
  },
  'policies-zh.md': {
    title: 'Avenlo 配送、退货与保修政策',
    language: 'zh-CN',
    mimeType: 'text/markdown',
  },
  'policies-en.md': {
    title: 'Avenlo Shipping, Returns, and Warranty Policy',
    language: 'en-US',
    mimeType: 'text/markdown',
  },
}

if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
  throw new Error('Connected Supabase URL and secret key are required.')
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
})
const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
})
if (usersError) throw usersError
const admin = usersData.users.find(
  (user) => user.email?.toLowerCase() === DEMO_ADMIN_EMAIL.toLowerCase(),
)
if (!admin) throw new Error('Run pnpm auth:bootstrap before bootstrapping demo knowledge.')

const knowledgeDirectory = resolve(process.cwd(), '../../supabase/seed/knowledge')
const availableFiles = await readdir(knowledgeDirectory)
const dependencies = createKnowledgeDependencies(env)
const reindex = process.argv.includes('--reindex')
const registrations: Array<{ filename: string; duplicate: boolean; documentId: string }> = []

try {
  for (const [filename, definition] of Object.entries(definitions)) {
    if (!availableFiles.includes(filename))
      throw new Error(`Missing demo knowledge file ${filename}.`)
    const bytes = await readFile(resolve(knowledgeDirectory, filename))
    const result = await dependencies.knowledgeService.registerDocument({
      workspaceId: DEMO_WORKSPACE_ID,
      createdBy: admin.id,
      title: definition.title,
      language: definition.language,
      file: { filename, mimeType: definition.mimeType, bytes },
    })
    registrations.push({
      filename,
      duplicate: result.duplicate,
      documentId: result.document.id,
    })
    if (reindex && result.duplicate) {
      await dependencies.knowledgeService.processNow(DEMO_WORKSPACE_ID, result.document.id)
    }
  }

  await dependencies.knowledgeService.waitForIdle()
  const documents = await dependencies.knowledgeService.listDocuments(DEMO_WORKSPACE_ID)
  const demoDocuments = documents.filter((document) =>
    Object.values(definitions).some((definition) => definition.title === document.title),
  )

  if (demoDocuments.length !== Object.keys(definitions).length) {
    throw new Error(`Expected ${Object.keys(definitions).length} demo documents.`)
  }
  if (demoDocuments.some((document) => document.status !== 'ready' || document.chunkCount < 1)) {
    throw new Error(`Demo document processing failed: ${JSON.stringify(demoDocuments)}`)
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        valid: true,
        reindexed: reindex,
        registrations,
        documents: demoDocuments.map((document) => ({
          id: document.id,
          title: document.title,
          language: document.language,
          status: document.status,
          chunkCount: document.chunkCount,
        })),
      },
      null,
      2,
    )}\n`,
  )
} finally {
  await dependencies.knowledgeService.close()
}
