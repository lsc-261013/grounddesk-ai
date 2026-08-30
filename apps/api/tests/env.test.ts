import { describe, expect, it } from 'vitest'

import { getEnvPaths, parseApiEnv } from '../src/config/env.js'

describe('API environment validation', () => {
  it('finds both package-local and monorepo-root environment files', () => {
    const paths = getEnvPaths('C:/workspace/apps/api')

    expect(paths[0]).toMatch(/apps[\\/]api[\\/]\.env$/)
    expect(paths[1]).toMatch(/workspace[\\/]\.env$/)
  })

  it('supports an offline development shell without external secrets', () => {
    const result = parseApiEnv({
      RUNTIME_MODE: 'offline',
      NODE_ENV: 'test',
    })

    expect(result.RUNTIME_MODE).toBe('offline')
    expect(result.EMBEDDING_DIMENSION).toBe(1024)
  })

  it('uses the platform-provided PORT when API_PORT is not set', () => {
    const result = parseApiEnv({
      RUNTIME_MODE: 'offline',
      NODE_ENV: 'production',
      PORT: '10000',
    })

    expect(result.API_PORT).toBe(10_000)
  })

  it('keeps an explicit API_PORT ahead of the platform fallback', () => {
    const result = parseApiEnv({
      RUNTIME_MODE: 'offline',
      NODE_ENV: 'production',
      API_PORT: '8787',
      PORT: '10000',
    })

    expect(result.API_PORT).toBe(8_787)
  })

  it('requires every provider secret in connected mode', () => {
    expect(() =>
      parseApiEnv({
        RUNTIME_MODE: 'connected',
        NODE_ENV: 'test',
      }),
    ).toThrow(/SUPABASE_URL/)
  })

  it('rejects an embedding dimension that differs from the database schema', () => {
    expect(() =>
      parseApiEnv({
        RUNTIME_MODE: 'connected',
        NODE_ENV: 'test',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
        SUPABASE_SECRET_KEY: 'sb_secret_test',
        SUPABASE_DB_URL: 'database-connection-test-value',
        DEEPSEEK_API_KEY: 'deepseek-key',
        SILICONFLOW_API_KEY: 'siliconflow-key',
        EMBEDDING_DIMENSION: '768',
      }),
    ).toThrow(/vector\(1024\)/)
  })
})
