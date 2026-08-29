import type { FastifyInstance } from 'fastify'

import type { ApiEnv } from '../config/env.js'

export const registerHealthRoute = (app: FastifyInstance, environment: ApiEnv): void => {
  app.get('/health', () => ({
    service: 'grounddesk-api' as const,
    status: 'ok' as const,
    runtimeMode: environment.RUNTIME_MODE,
    timestamp: new Date().toISOString(),
    providers: {
      database:
        environment.SUPABASE_URL && environment.SUPABASE_SECRET_KEY
          ? ('configured' as const)
          : ('unconfigured' as const),
      generation: environment.DEEPSEEK_API_KEY
        ? ('configured' as const)
        : ('unconfigured' as const),
      embedding: environment.SILICONFLOW_API_KEY
        ? ('configured' as const)
        : ('unconfigured' as const),
    },
  }))
}
