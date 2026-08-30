import type { PublicProduct } from '@grounddesk/shared'

export interface CatalogRepository {
  listPublicProducts(workspaceSlug: string): Promise<PublicProduct[]>
  close(): Promise<void>
}
