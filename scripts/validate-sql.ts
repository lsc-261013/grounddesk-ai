import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const migrationPath = resolve('supabase/migrations/202608290001_initial_schema.sql')
const seedPath = resolve('supabase/seed/001_demo_workspace.sql')

const [migration, seed] = await Promise.all([
  readFile(migrationPath, 'utf8'),
  readFile(seedPath, 'utf8'),
])

const requiredMigrationFragments = [
  'create extension if not exists vector',
  'extensions.vector(1024)',
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

const missingFragments = [
  ...requiredMigrationFragments.filter((fragment) => !migration.includes(fragment)),
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
      migration: '202608290001_initial_schema.sql',
      vectorDimensions: 1024,
      products: productInsertCount,
      generatedOrders: 30,
      note: 'Static validation only; applying to PostgreSQL requires a connected Supabase project.',
    },
    null,
    2,
  )}\n`,
)
