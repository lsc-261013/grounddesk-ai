import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js'
import type * as SupabaseModule from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ getClaims: vi.fn() }))
vi.mock('@supabase/supabase-js', async (importOriginal) => ({
  ...(await importOriginal<typeof SupabaseModule>()),
  createClient: () => ({ auth: { getClaims: mocks.getClaims } }),
}))
import { createSupabaseAuthVerifier } from '../src/auth/supabase-auth-verifier.js'
const verifier = () => createSupabaseAuthVerifier('https://example.supabase.co', 'public-test-key')
describe('Supabase verification failures', () => {
  beforeEach(() => vi.resetAllMocks())
  it('does not turn a provider connection failure into a 401', async () => {
    mocks.getClaims.mockResolvedValue({
      data: null,
      error: new AuthRetryableFetchError('safe test', 0),
    })
    await expect(verifier().verifyAccessToken('fixture')).rejects.toMatchObject({ statusCode: 503 })
  })
  it('returns 503 when public key retrieval throws a transport error', async () => {
    mocks.getClaims.mockRejectedValue(new TypeError('fetch failed'))
    await expect(verifier().verifyAccessToken('fixture')).rejects.toMatchObject({ statusCode: 503 })
  })
  it('still rejects invalid or expired tokens', async () => {
    mocks.getClaims.mockResolvedValue({
      data: null,
      error: new AuthApiError('expired', 401, 'bad_jwt'),
    })
    await expect(verifier().verifyAccessToken('fixture')).rejects.toMatchObject({ statusCode: 401 })
  })
  it('only returns a verified subject', async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: 'verified-user', email: 'public@example.com' } },
      error: null,
    })
    await expect(verifier().verifyAccessToken('fixture')).resolves.toEqual({
      userId: 'verified-user',
      email: 'public@example.com',
    })
    mocks.getClaims.mockResolvedValue({ data: { claims: {} }, error: null })
    await expect(verifier().verifyAccessToken('fixture')).rejects.toMatchObject({ statusCode: 401 })
  })
})
