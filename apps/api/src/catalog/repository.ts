import type { ConsoleProduct, ProductMutationInput, PublicProduct } from '@grounddesk/shared'

export interface CatalogRepository {
  listPublicProducts(workspaceSlug: string): Promise<PublicProduct[]>
  listProducts(workspaceId: string): Promise<ConsoleProduct[]>
  createProduct(workspaceId: string, input: ProductMutationInput): Promise<ConsoleProduct>
  updateProduct(
    workspaceId: string,
    productId: string,
    input: ProductMutationInput,
  ): Promise<ConsoleProduct | null>
  close(): Promise<void>
}
