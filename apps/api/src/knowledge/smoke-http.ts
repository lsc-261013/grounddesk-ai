import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { createClient } from '@supabase/supabase-js'

import {
  DEMO_ADMIN_EMAIL,
  DEMO_AGENT_EMAIL,
  DEMO_LOGIN_PASSWORD,
  DEMO_WORKSPACE_ID,
  knowledgeChunkListResponseSchema,
  knowledgeDocumentListResponseSchema,
  knowledgeDocumentUploadResponseSchema,
} from '@grounddesk/shared'

import { buildApp } from '../app.js'
import { env } from '../config/env.js'

if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Connected Supabase public configuration is required.')
}

const signIn = async (email: string): Promise<string> => {
  const client = createClient(env.SUPABASE_URL!, env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: DEMO_LOGIN_PASSWORD,
  })
  if (error || !data.session) throw error ?? new Error(`No session returned for ${email}.`)
  return data.session.access_token
}

const createMultipartPayload = (bytes: Buffer): { body: Buffer; contentType: string } => {
  const boundary = 'grounddesk-smoke-boundary'
  const beforeFile = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\nzh-CN\r\n` +
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="products-zh.md"\r\n` +
      'Content-Type: text/markdown\r\n\r\n',
  )
  const ending = Buffer.from(`\r\n--${boundary}--\r\n`)
  return {
    body: Buffer.concat([beforeFile, bytes, ending]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  }
}

const [adminToken, agentToken, demoBytes] = await Promise.all([
  signIn(DEMO_ADMIN_EMAIL),
  signIn(DEMO_AGENT_EMAIL),
  readFile(resolve(process.cwd(), '../../supabase/seed/knowledge/products-zh.md')),
])
const app = await buildApp({ logger: false })

try {
  const adminHeaders = { authorization: `Bearer ${adminToken}` }
  const listResponse = await app.inject({
    method: 'GET',
    url: `/v1/workspaces/${DEMO_WORKSPACE_ID}/knowledge/documents`,
    headers: adminHeaders,
  })
  const listPayload = knowledgeDocumentListResponseSchema.parse(listResponse.json())
  const readyDocument = listPayload.documents.find((document) => document.status === 'ready')
  if (!readyDocument) throw new Error('No ready knowledge document was returned.')

  const chunksResponse = await app.inject({
    method: 'GET',
    url: `/v1/workspaces/${DEMO_WORKSPACE_ID}/knowledge/documents/${readyDocument.id}/chunks`,
    headers: adminHeaders,
  })
  const chunksPayload = knowledgeChunkListResponseSchema.parse(chunksResponse.json())

  const multipart = createMultipartPayload(demoBytes)
  const duplicateResponse = await app.inject({
    method: 'POST',
    url: `/v1/workspaces/${DEMO_WORKSPACE_ID}/knowledge/documents`,
    headers: {
      ...adminHeaders,
      'content-type': multipart.contentType,
    },
    payload: multipart.body,
  })
  const duplicatePayload = knowledgeDocumentUploadResponseSchema.parse(duplicateResponse.json())
  const agentUploadResponse = await app.inject({
    method: 'POST',
    url: `/v1/workspaces/${DEMO_WORKSPACE_ID}/knowledge/documents`,
    headers: {
      authorization: `Bearer ${agentToken}`,
      'content-type': multipart.contentType,
    },
    payload: multipart.body,
  })

  if (
    listResponse.statusCode !== 200 ||
    listPayload.documents.length < 4 ||
    chunksResponse.statusCode !== 200 ||
    chunksPayload.chunks.length < 1 ||
    duplicateResponse.statusCode !== 200 ||
    !duplicatePayload.duplicate ||
    agentUploadResponse.statusCode !== 403
  ) {
    throw new Error('Knowledge HTTP smoke test failed.')
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        valid: true,
        documentListStatus: listResponse.statusCode,
        documentCount: listPayload.documents.length,
        chunkPreviewStatus: chunksResponse.statusCode,
        previewChunkCount: chunksPayload.chunks.length,
        duplicateUploadStatus: duplicateResponse.statusCode,
        duplicateDetected: duplicatePayload.duplicate,
        agentUploadStatus: agentUploadResponse.statusCode,
      },
      null,
      2,
    )}\n`,
  )
} finally {
  await app.close()
}
