import type { ApiEnv } from '../config/env.js'
import { createPostgresOrderRepository } from './postgres-order-repository.js'
import type { OrderListResult, OrderRepository } from './repository.js'

class UnavailableOrderRepository implements OrderRepository {
  list(): Promise<OrderListResult> {
    return Promise.resolve({ orders: [], total: 0 })
  }
  get(): Promise<null> {
    return Promise.resolve(null)
  }
  updateStatus(): Promise<null> {
    return Promise.resolve(null)
  }
  close(): Promise<void> {
    return Promise.resolve()
  }
}

export interface OrderDependencies {
  orderRepository: OrderRepository
}

export const createOrderDependencies = (environment: ApiEnv): OrderDependencies => ({
  orderRepository:
    environment.RUNTIME_MODE === 'connected' && environment.SUPABASE_DB_URL
      ? createPostgresOrderRepository(environment.SUPABASE_DB_URL)
      : new UnavailableOrderRepository(),
})
