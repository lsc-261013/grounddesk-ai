import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { publicProductListResponseSchema } from '@grounddesk/shared'

import type { CatalogDependencies } from '../catalog/dependencies.js'

const workspaceParamsSchema = z.object({
  workspaceSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
})

export const registerCatalogRoutes = (app: FastifyInstance, catalog: CatalogDependencies): void => {
  app.get('/v1/public/workspaces/:workspaceSlug/products', async (request) => {
    const { workspaceSlug } = workspaceParamsSchema.parse(request.params)
    return publicProductListResponseSchema.parse({
      products: await catalog.catalogRepository.listPublicProducts(workspaceSlug),
    })
  })
}
