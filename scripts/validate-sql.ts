import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const migrationPath = resolve('supabase/migrations/202608290001_initial_schema.sql')
const authMigrationPath = resolve('supabase/migrations/202608290002_auth_boundaries.sql')
const seedPath = resolve('supabase/seed/001_demo_workspace.sql')

const [migration, authMigration, seed] = await Promise.all([
  readFile(migrationPath, 'utf8'),
  readFile(authMigrationPath, 'utf8'),
  readFile(seedPath, 'utf8'),
])

const requiredMigrationFragments = [
  'create extension if not exists vector',
  'extensions.vector(1024)',
  'operator(extensions.<=>)',
  'create or replace function public.match_hybrid_chunks',
  'alter table public.workspace_members enable row level security',
  'create policy workspaces_member_read',
  'create trigger enforce_workspace_document_limit',
]

const requiredSeedFragments = [
  'Avenlo Demo Workspace',
  'BAAI/bge-m3',
  'from generate_series(1, 30)',
  "format('demo.customer%s@example.com'",
  'current_date',
]

const requiredAuthMigrationFragments = [
  'add column if not exists locale text not null',
  'create or replace function public.handle_new_auth_user()',
  'after insert on auth.users',
  'grant select on public.profiles, public.workspaces, public.workspace_members to authenticated',
  'revoke execute on function public.handle_new_auth_user() from public, anon, authenticated',
]

const missingFragments = [
  ...requiredMigrationFragments.filter((fragment) => !migration.includes(fragment)),
  ...requiredAuthMigrationFragments.filter((fragment) => !authMigration.includes(fragment)),
  ...requiredSeedFragments.filter((fragment) => !seed.includes(fragment)),
]

if (missingFragments.length > 0) {
  throw new Error(`SQL validation failed. Missing: ${missingFragments.join(', ')}`)
}

const productInsertCount = (seed.match(/'30000000-0000-4000-8000-00000000000[1-8]'/g) ?? []).filter(
  (value, index, values) => values.indexOf(value) === index,
).length

if (productInsertCount !== 8) {
  throw new Error(`Expected 8 deterministic products, found ${productInsertCount}`)
}

process.stdout.write(
  `${JSON.stringify(
    {
      valid: true,
      migrations: ['202608290001_initial_schema.sql', '202608290002_auth_boundaries.sql'],
      vectorDimensions: 1024,
      products: productInsertCount,
      generatedOrders: 30,
      note: 'Static validation only; applying to PostgreSQL requires a connected Supabase project.',
    },
    null,
    2,
  )}\n`,
)
