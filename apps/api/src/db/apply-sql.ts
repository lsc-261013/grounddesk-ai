import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import postgres from 'postgres'
import { z } from 'zod'

import { env } from '../config/env.js'

const actionSchema = z.enum(['migrate', 'seed'])
const action = actionSchema.parse(process.argv[2])

const repositoryRoot = resolve(process.cwd(), '../..')
const sqlPath =
  action === 'migrate'
    ? resolve(repositoryRoot, 'supabase/migrations/202608290001_initial_schema.sql')
    : resolve(repositoryRoot, 'supabase/seed/001_demo_workspace.sql')

if (!env.SUPABASE_DB_URL) {
  process.stderr.write('SUPABASE_DB_URL is required to apply database changes.\n')
  process.exitCode = 1
} else {
  const database = postgres(env.SUPABASE_DB_URL, {
    max: 1,
    ssl: 'require',
    connection: {
      application_name: `grounddesk-${action}`,
    },
  })

  try {
    const sql = await readFile(sqlPath, 'utf8')
    await database.unsafe(sql, [], { prepare: false })
    process.stdout.write(`GroundDesk database ${action} completed successfully.\n`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown database error'
    process.stderr.write(`GroundDesk database ${action} failed: ${message}\n`)
    process.exitCode = 1
  } finally {
    await database.end({ timeout: 5 })
  }
}
