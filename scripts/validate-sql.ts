import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const migrationPath = resolve('supabase/migrations/202608290001_initial_schema.sql')
const authMigrationPath = resolve('supabase/migrations/202608290002_auth_boundaries.sql')
const storageMigrationPath = resolve('supabase/migrations/202608290003_knowledge_storage.sql')
const chatMigrationPath = resolve('supabase/migrations/202608300004_chat_evidence_signals.sql')
const webhookMigrationPath = resolve('supabase/migrations/202608300005_ticket_webhook_outbox.sql')
const sourceMigrationPath = resolve('supabase/migrations/202608300006_conversation_sources.sql')
const feedbackMigrationPath = resolve('supabase/migrations/202608300007_message_feedback.sql')
const seedPath = resolve('supabase/seed/001_demo_workspace.sql')
const evaluationSeedPath = resolve('supabase/seed/002_evaluation_cases.sql')

const [
  migration,
  authMigration,
  storageMigration,
  chatMigration,
  webhookMigration,
  sourceMigration,
  feedbackMigration,
  seed,
  evaluationSeed,
] = await Promise.all([
  readFile(migrationPath, 'utf8'),
  readFile(authMigrationPath, 'utf8'),
  readFile(storageMigrationPath, 'utf8'),
  readFile(chatMigrationPath, 'utf8'),
  readFile(webhookMigrationPath, 'utf8'),
  readFile(sourceMigrationPath, 'utf8'),
  readFile(feedbackMigrationPath, 'utf8'),
  readFile(seedPath, 'utf8'),
  readFile(evaluationSeedPath, 'utf8'),
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

const requiredEvaluationSeedFragments = [
  'Isolation Test Workspace',
  'GD-ISOLATION-PRODUCT-9F4C',
  "'knowledge_zh_01'",
  "'security_02'",
  "'isolation_02'",
]

const requiredAuthMigrationFragments = [
  'add column if not exists locale text not null',
  'create or replace function public.handle_new_auth_user()',
  'after insert on auth.users',
  'grant select on public.profiles, public.workspaces, public.workspace_members to authenticated',
  'revoke execute on function public.handle_new_auth_user() from public, anon, authenticated',
]

const requiredStorageMigrationFragments = [
  "'grounddesk-knowledge'",
  'file_size_limit',
  "array['application/pdf', 'text/plain', 'text/markdown']",
]

const requiredChatMigrationFragments = [
  'conversations_anonymous_session_unique',
  'vector_similarity double precision',
  'keyword_score real',
]

const requiredWebhookMigrationFragments = [
  'webhook_deliveries_due_idx',
  'enqueue_webhook_delivery',
  "'ticket.created'",
  "'ticket.updated'",
  "'ticket.reply.created'",
]

const requiredSourceMigrationFragments = [
  'conversations_anonymous_source_unique',
  "source = 'evaluation'",
  "source in ('public_demo', 'playground', 'evaluation')",
]

const requiredFeedbackMigrationFragments = [
  'create table if not exists public.message_feedback',
  "rating in ('helpful', 'unhelpful')",
  'alter table public.message_feedback enable row level security',
]

const missingFragments = [
  ...requiredMigrationFragments.filter((fragment) => !migration.includes(fragment)),
  ...requiredAuthMigrationFragments.filter((fragment) => !authMigration.includes(fragment)),
  ...requiredStorageMigrationFragments.filter((fragment) => !storageMigration.includes(fragment)),
  ...requiredChatMigrationFragments.filter((fragment) => !chatMigration.includes(fragment)),
  ...requiredWebhookMigrationFragments.filter((fragment) => !webhookMigration.includes(fragment)),
  ...requiredSourceMigrationFragments.filter((fragment) => !sourceMigration.includes(fragment)),
  ...requiredFeedbackMigrationFragments.filter((fragment) => !feedbackMigration.includes(fragment)),
  ...requiredSeedFragments.filter((fragment) => !seed.includes(fragment)),
  ...requiredEvaluationSeedFragments.filter((fragment) => !evaluationSeed.includes(fragment)),
]

if (missingFragments.length > 0) {
  throw new Error(`SQL validation failed. Missing: ${missingFragments.join(', ')}`)
}

const productInsertCount = (seed.match(/'30000000-0000-4000-8000-00000000000[1-8]'/g) ?? []).filter(
  (value, index, values) => values.indexOf(value) === index,
).length

const evaluationCaseCount = (
  evaluationSeed.match(/'((knowledge|order|return|unknown|security|isolation)_[a-z0-9_]+)'/g) ?? []
).length

if (evaluationCaseCount !== 26) {
  throw new Error(`Expected 26 deterministic evaluation cases, found ${evaluationCaseCount}`)
}

if (productInsertCount !== 8) {
  throw new Error(`Expected 8 deterministic products, found ${productInsertCount}`)
}

process.stdout.write(
  `${JSON.stringify(
    {
      valid: true,
      migrations: [
        '202608290001_initial_schema.sql',
        '202608290002_auth_boundaries.sql',
        '202608290003_knowledge_storage.sql',
        '202608300004_chat_evidence_signals.sql',
        '202608300005_ticket_webhook_outbox.sql',
        '202608300006_conversation_sources.sql',
        '202608300007_message_feedback.sql',
      ],
      vectorDimensions: 1024,
      products: productInsertCount,
      generatedOrders: 30,
      evaluationCases: evaluationCaseCount,
      note: 'Static validation only; applying to PostgreSQL requires a connected Supabase project.',
    },
    null,
    2,
  )}\n`,
)
