import type { Sql } from 'postgres'
import { describe, expect, it, vi } from 'vitest'

import { closeRepositoryDatabase, createRepositoryDatabase } from '../src/db/client.js'

describe('database client lifecycle', () => {
  it('lets repositories share a pool without closing the application-owned connection', async () => {
    const end = vi.fn(() => Promise.resolve())
    const database = Object.assign(() => Promise.resolve([]), { end }) as unknown as Sql

    const repositoryDatabase = createRepositoryDatabase(database, {
      applicationName: 'grounddesk-test',
    })
    await closeRepositoryDatabase(repositoryDatabase)

    expect(repositoryDatabase).toBe(database)
    expect(end).not.toHaveBeenCalled()
  })
})
