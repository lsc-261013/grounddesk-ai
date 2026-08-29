import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import {
  knowledgeChunkListResponseSchema,
  knowledgeDocumentListResponseSchema,
  knowledgeDocumentUploadResponseSchema,
  localeSchema,
  retrievalEvidenceSchema,
} from '@grounddesk/shared'

import { AuthenticationError } from '../auth/errors.js'
import { createWorkspaceGuard } from '../auth/guards.js'
import type { IdentityDependencies } from '../auth/types.js'
import type { KnowledgeDependencies } from '../knowledge/dependencies.js'
import { KnowledgeInputError } from '../knowledge/errors.js'

const workspaceParamsSchema = z.object({ workspaceId: z.uuid() })
const documentParamsSchema = workspaceParamsSchema.extend({ documentId: z.uuid() })
const uploadFieldsSchema = z.object({
  title: z.string().trim().min(1).max(180).optional(),
  language: z.enum(['zh-CN', 'en-US', 'bilingual']),
})
const searchBodySchema = z.object({
  query: z.string().trim().min(1).max(2_000),
  language: localeSchema,
  productModel: z.string().trim().min(1).max(80).nullable().default(null),
  limit: z.number().int().min(1).max(20).default(8),
})

export const registerKnowledgeRoutes = (
  app: FastifyInstance,
  identity: IdentityDependencies,
  knowledge: KnowledgeDependencies,
): void => {
  app.get(
    '/v1/workspaces/:workspaceId/knowledge/documents',
    { preHandler: createWorkspaceGuard(identity, 'knowledge:read') },
    async (request) => {
      const { workspaceId } = workspaceParamsSchema.parse(request.params)
      return knowledgeDocumentListResponseSchema.parse({
        documents: await knowledge.knowledgeService.listDocuments(workspaceId),
      })
    },
  )

  app.get(
    '/v1/workspaces/:workspaceId/knowledge/documents/:documentId/chunks',
    { preHandler: createWorkspaceGuard(identity, 'knowledge:read') },
    async (request) => {
      const { workspaceId, documentId } = documentParamsSchema.parse(request.params)
      return knowledgeChunkListResponseSchema.parse({
        chunks: await knowledge.knowledgeService.listChunks(workspaceId, documentId),
      })
    },
  )

  app.post(
    '/v1/workspaces/:workspaceId/knowledge/documents',
    { preHandler: createWorkspaceGuard(identity, 'knowledge:write') },
    async (request, reply) => {
      const { workspaceId } = workspaceParamsSchema.parse(request.params)
      const authContext = request.authContext
      if (!authContext) throw new AuthenticationError()

      let uploadedFile: { filename: string; mimeType: string; bytes: Buffer } | undefined
      const rawFields: Record<string, string> = {}

      try {
        for await (const part of request.parts()) {
          if (part.type === 'file') {
            if (uploadedFile)
              throw new KnowledgeInputError('Upload exactly one document at a time.')
            uploadedFile = {
              filename: part.filename,
              mimeType: part.mimetype,
              bytes: await part.toBuffer(),
            }
          } else if (typeof part.value === 'string') {
            rawFields[part.fieldname] = part.value
          }
        }
      } catch (cause) {
        if (cause instanceof KnowledgeInputError) throw cause
        throw new KnowledgeInputError('The upload could not be read or exceeds the 10 MB limit.')
      }

      if (!uploadedFile) throw new KnowledgeInputError('A document file is required.')
      const fields = uploadFieldsSchema.parse(rawFields)
      const result = await knowledge.knowledgeService.registerDocument({
        workspaceId,
        createdBy: authContext.userId,
        ...(fields.title ? { title: fields.title } : {}),
        language: fields.language,
        file: uploadedFile,
      })

      await reply.status(result.duplicate ? 200 : 202).send(
        knowledgeDocumentUploadResponseSchema.parse({
          document: result.document,
          duplicate: result.duplicate,
        }),
      )
    },
  )

  app.post(
    '/v1/workspaces/:workspaceId/knowledge/documents/:documentId/retry',
    { preHandler: createWorkspaceGuard(identity, 'knowledge:write') },
    async (request, reply) => {
      const { workspaceId, documentId } = documentParamsSchema.parse(request.params)
      const document = await knowledge.knowledgeService.retryDocument(workspaceId, documentId)
      await reply.status(202).send({ document })
    },
  )

  app.post(
    '/v1/workspaces/:workspaceId/knowledge/search',
    { preHandler: createWorkspaceGuard(identity, 'knowledge:read') },
    async (request) => {
      const { workspaceId } = workspaceParamsSchema.parse(request.params)
      const body = searchBodySchema.parse(request.body)
      const evidence = await knowledge.knowledgeService.search({ workspaceId, ...body })
      return { evidence: z.array(retrievalEvidenceSchema).parse(evidence) }
    },
  )
}
