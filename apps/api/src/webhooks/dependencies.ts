import { ServiceUnavailableError } from '../auth/errors.js'
import type { ApiEnv } from '../config/env.js'
import { createPostgresWebhookRepository } from './postgres-webhook-repository.js'
import { DefaultWebhookService, type WebhookService } from './service.js'

export interface WebhookDependencies {
  webhookService: WebhookService
}

class UnavailableWebhookService implements WebhookService {
  start(): void {}
  private unavailable(): ServiceUnavailableError {
    return new ServiceUnavailableError('Webhooks are unavailable in offline mode.')
  }
  listEndpoints(): ReturnType<WebhookService['listEndpoints']> {
    return Promise.reject(this.unavailable())
  }
  createEndpoint(): ReturnType<WebhookService['createEndpoint']> {
    return Promise.reject(this.unavailable())
  }
  updateEndpoint(): ReturnType<WebhookService['updateEndpoint']> {
    return Promise.reject(this.unavailable())
  }
  listDeliveries(): ReturnType<WebhookService['listDeliveries']> {
    return Promise.reject(this.unavailable())
  }
  testEndpoint(): ReturnType<WebhookService['testEndpoint']> {
    return Promise.reject(this.unavailable())
  }
  drainOnce(): Promise<number> {
    return Promise.resolve(0)
  }
  close(): Promise<void> {
    return Promise.resolve()
  }
}

export const createWebhookDependencies = (environment: ApiEnv): WebhookDependencies => {
  if (
    environment.RUNTIME_MODE !== 'connected' ||
    !environment.SUPABASE_DB_URL ||
    !environment.SUPABASE_SECRET_KEY
  ) {
    return { webhookService: new UnavailableWebhookService() }
  }
  const webhookService = new DefaultWebhookService(
    createPostgresWebhookRepository(environment.SUPABASE_DB_URL),
    environment.SUPABASE_SECRET_KEY,
    {
      timeoutMs: environment.WEBHOOK_TIMEOUT_MS,
      maxAttempts: environment.WEBHOOK_MAX_ATTEMPTS,
      production: environment.NODE_ENV === 'production',
    },
  )
  webhookService.start()
  return { webhookService }
}
