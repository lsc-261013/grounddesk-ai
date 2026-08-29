import { env } from './env.js'

const configuredProviders = {
  database: Boolean(env.SUPABASE_URL && env.SUPABASE_SECRET_KEY && env.SUPABASE_DB_URL),
  generation: Boolean(env.DEEPSEEK_API_KEY),
  embedding: Boolean(env.SILICONFLOW_API_KEY),
}

process.stdout.write(
  `${JSON.stringify(
    {
      valid: true,
      runtimeMode: env.RUNTIME_MODE,
      embeddingModel: env.EMBEDDING_MODEL,
      embeddingDimension: env.EMBEDDING_DIMENSION,
      configuredProviders,
    },
    null,
    2,
  )}\n`,
)
