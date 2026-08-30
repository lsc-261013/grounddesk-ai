import type { ConsoleOrder, OrderStatus } from '@grounddesk/shared'

export interface OrderListInput {
  query: string | null
  status: OrderStatus | null
  limit: number
  offset: number
}

export interface OrderListResult {
  orders: ConsoleOrder[]
  total: number
}

export interface OrderRepository {
  list(workspaceId: string, input: OrderListInput): Promise<OrderListResult>
  get(workspaceId: string, orderId: string): Promise<ConsoleOrder | null>
  updateStatus(
    workspaceId: string,
    orderId: string,
    status: OrderStatus,
  ): Promise<ConsoleOrder | null>
  close(): Promise<void>
}
