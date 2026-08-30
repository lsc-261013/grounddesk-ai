import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'

import postgres from 'postgres'
import { z } from 'zod'

import { env } from '../config/env.js'

const actionSchema = z.enum(['migrate', 'seed'])
const action = actionSchema.parse(process.argv[2])
const INITIAL_MIGRATION_VERSION = '202608290001_initial_schema'
const repositoryRoot = resolve(process.cwd(), '../..')
const migrationsDirectory = resolve(repositoryRoot, 'supabase/migrations')
const seedDirectory = resolve(repositoryRoot, 'supabase/seed')

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
    if (action === 'seed') {
      const seedFiles = (await readdir(seedDirectory))
        .filter((fileName) => fileName.endsWith('.sql'))
        .sort((left, right) => left.localeCompare(right))
      for (const seedFile of seedFiles) {
        const seedSql = await readFile(resolve(seedDirectory, seedFile), 'utf8')
        await database.unsafe(seedSql, [], { prepare: false })
      }
      process.stdout.write('GroundDesk database seed completed successfully.\n')
    } else {
      await database.unsafe(
        `
          create schema if not exists grounddesk_internal;
          revoke all on schema grounddesk_internal from public, anon, authenticated, service_role;
          create table if not exists grounddesk_internal.schema_migrations (
            version text primary key,
            checksum text not null,
            applied_at timestamptz not null default now()
          );
          revoke all on grounddesk_internal.schema_migrations from public, anon, authenticated, service_role;
        `,
        [],
        { prepare: false },
      )

      const migrationFiles = (await readdir(migrationsDirectory))
        .filter((fileName) => fileName.endsWith('.sql'))
        .sort((left, right) => left.localeCompare(right))

      for (const migrationFile of migrationFiles) {
        const migrationPath = resolve(migrationsDirectory, migrationFile)
        const version = basename(migrationFile, '.sql')
        const migrationSql = await readFile(migrationPath, 'utf8')
        const checksum = createHash('sha256').update(migrationSql).digest('hex')
        const appliedMigrations = await database<{ checksum: string }[]>`
          select checksum
          from grounddesk_internal.schema_migrations
          where version = ${version}
        `
        const appliedMigration = appliedMigrations[0]

        if (appliedMigration) {
          if (appliedMigration.checksum !== checksum) {
            throw new Error(
              `Migration ${version} was modified after it was applied; create a new migration instead`,
            )
          }

          process.stdout.write(`GroundDesk migration ${version} is already applied.\n`)
          continue
        }

        if (version === INITIAL_MIGRATION_VERSION) {
          const existingSchemas = await database<{ complete: boolean }[]>`
            select (
              to_regclass('public.workspaces') is not null
              and to_regclass('public.knowledge_chunks') is not null
              and to_regclass('public.orders') is not null
              and to_regclass('public.tickets') is not null
              and exists (
                select 1
                from pg_proc procedure
                join pg_namespace namespace on namespace.oid = procedure.pronamespace
                where namespace.nspname = 'public'
                  and procedure.proname = 'match_hybrid_chunks'
              )
            ) as complete
          `

          if (existingSchemas[0]?.complete) {
            process.stdout.write(`Adopting previously applied GroundDesk migration ${version}.\n`)
          } else {
            await database.unsafe(migrationSql, [], { prepare: false })
          }
        } else {
          await database.unsafe(migrationSql, [], { prepare: false })
        }

        await database`
          insert into grounddesk_internal.schema_migrations (version, checksum)
          values (${version}, ${checksum})
        `
        process.stdout.write(`GroundDesk migration ${version} completed successfully.\n`)
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown database error'
    process.stderr.write(`GroundDesk database ${action} failed: ${message}\n`)
    process.exitCode = 1
  } finally {
    await database.end({ timeout: 5 })
  }
}
