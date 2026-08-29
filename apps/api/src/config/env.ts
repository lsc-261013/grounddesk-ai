import { resolve } from 'node:path'

import dotenv from 'dotenv'
import { z } from 'zod'

export const getEnvPaths = (workingDirectory: string): string[] => [
  resolve(workingDirectory, '.env'),
  resolve(workingDirectory, '../../.env'),
]

dotenv.config({ path: getEnvPaths(process.cwd()), quiet: true })

const optionalSecretSchema = z.string().trim().min(1).optional()

const apiEnvSchema = z
  .object({
    RUNTIME_MODE: z.enum(['offline', 'connected']).default('offline'),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_HOST: z.string().default('127.0.0.1'),
    API_PORT: z.coerce.number().int().min(1).max(65_535).default(8787),
    WEB_ORIGIN: z.url().default('http://localhost:5173'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    SUPABASE_URL: optionalSecretSchema,
    SUPABASE_ANON_KEY: optionalSecretSchema,
    SUPABASE_SERVICE_ROLE_KEY: optionalSecretSchema,
    SUPABASE_JWT_SECRET: optionalSecretSchema,
    SUPABASE_DB_URL: optionalSecretSchema,
    DEEPSEEK_API_KEY: optionalSecretSchema,
    DEEPSEEK_BASE_URL: z.url().default('https://api.deepseek.com'),
    DEEPSEEK_MODEL: z.string().min(1).default('deepseek-v4-flash'),
    DEEPSEEK_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(30_000),
    SILICONFLOW_API_KEY: optionalSecretSchema,
    EMBEDDING_BASE_URL: z.url().default('https://api.siliconflow.cn/v1'),
    EMBEDDING_MODEL: z.string().min(1).default('BAAI/bge-m3'),
    EMBEDDING_DIMENSION: z.coerce.number().int().positive().default(1024),
    EMBEDDING_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(20_000),
    DEMO_DAILY_REQUEST_LIMIT: z.coerce.number().int().positive().default(120),
    DEMO_DAILY_TOKEN_LIMIT: z.coerce.number().int().positive().default(250_000),
    PUBLIC_CHAT_RATE_LIMIT: z.coerce.number().int().positive().default(12),
    PUBLIC_CHAT_RATE_WINDOW_MS: z.coerce.number().int().min(1_000).default(60_000),
    MAX_UPLOAD_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(10 * 1024 * 1024),
    MAX_WORKSPACE_DOCUMENTS: z.coerce.number().int().positive().default(20),
    WEBHOOK_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(8_000),
    WEBHOOK_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(3),
  })
  .superRefine((value, context) => {
    if (value.RUNTIME_MODE !== 'connected') {
      return
    }

    const requiredConnectedKeys = [
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_JWT_SECRET',
      'DEEPSEEK_API_KEY',
      'SILICONFLOW_API_KEY',
    ] as const

    for (const key of requiredConnectedKeys) {
      if (!value[key]) {
        context.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} is required when RUNTIME_MODE=connected`,
        })
      }
    }

    if (value.EMBEDDING_DIMENSION !== 1024) {
      context.addIssue({
        code: 'custom',
        path: ['EMBEDDING_DIMENSION'],
        message: 'Embedding dimension must match the vector(1024) database schema',
      })
    }
  })

export type ApiEnv = z.infer<typeof apiEnvSchema>

export const parseApiEnv = (source: NodeJS.ProcessEnv): ApiEnv => apiEnvSchema.parse(source)

export const env = parseApiEnv(process.env)
