import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import {
  consoleProductListResponseSchema,
  consoleProductResponseSchema,
  productMutationInputSchema,
  publicProductListResponseSchema,
} from '@grounddesk/shared'

import { createWorkspaceGuard } from '../auth/guards.js'
import type { IdentityDependencies } from '../auth/types.js'
import type { CatalogDependencies } from '../catalog/dependencies.js'

const workspaceParamsSchema = z.object({
  workspaceSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
})
const consoleWorkspaceParamsSchema = z.object({ workspaceId: z.uuid() })
const productParamsSchema = consoleWorkspaceParamsSchema.extend({ productId: z.uuid() })

export const registerCatalogRoutes = (
  app: FastifyInstance,
  identity: IdentityDependencies,
  catalog: CatalogDependencies,
): void => {
  app.get('/v1/public/workspaces/:workspaceSlug/products', async (request) => {
    const { workspaceSlug } = workspaceParamsSchema.parse(request.params)
    return publicProductListResponseSchema.parse({
      products: await catalog.catalogRepository.listPublicProducts(workspaceSlug),
    })
  })

  app.get(
    '/v1/workspaces/:workspaceId/products',
    { preHandler: createWorkspaceGuard(identity, 'products:read') },
    async (request) => {
      const { workspaceId } = consoleWorkspaceParamsSchema.parse(request.params)
      return consoleProductListResponseSchema.parse({
        products: await catalog.catalogRepository.listProducts(workspaceId),
      })
    },
  )

  app.post(
    '/v1/workspaces/:workspaceId/products',
    { preHandler: createWorkspaceGuard(identity, 'products:write') },
    async (request, reply) => {
      const { workspaceId } = consoleWorkspaceParamsSchema.parse(request.params)
      const input = productMutationInputSchema.parse(request.body)
      const product = await catalog.catalogRepository.createProduct(workspaceId, input)
      return reply.code(201).send(consoleProductResponseSchema.parse({ product }))
    },
  )

  app.patch(
    '/v1/workspaces/:workspaceId/products/:productId',
    { preHandler: createWorkspaceGuard(identity, 'products:write') },
    async (request, reply) => {
      const { workspaceId, productId } = productParamsSchema.parse(request.params)
      const input = productMutationInputSchema.parse(request.body)
      const product = await catalog.catalogRepository.updateProduct(workspaceId, productId, input)
      if (!product) {
        return reply.code(404).send({ error: 'not_found', message: 'Product not found.' })
      }
      return consoleProductResponseSchema.parse({ product })
    },
  )
}
