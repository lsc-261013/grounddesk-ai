import postgres from 'postgres'

import { env } from '../config/env.js'

interface DatabaseCounts {
  workspaces: number
  products: number
  orders: number
  orderItems: number
  returnPolicies: number
}

interface DatabaseInfrastructure {
  vectorInstalled: boolean
  embeddingType: string
  hybridFunctionExists: boolean
  vectorIndexExists: boolean
  rlsTableCount: number
  rlsEnabledCount: number
  migrationCount: number
  knowledgeBucketExists: boolean
  productLifecycleColumnExists: boolean
}

interface DemoCases {
  lookupOrderExists: boolean
  withinReturnWindowExists: boolean
  outsideReturnWindowExists: boolean
}

if (!env.SUPABASE_DB_URL) {
  process.stderr.write('SUPABASE_DB_URL is required to verify the database.\n')
  process.exitCode = 1
} else {
  const database = postgres(env.SUPABASE_DB_URL, {
    max: 1,
    ssl: 'require',
    connection: {
      application_name: 'grounddesk-verify',
    },
  })

  try {
    const counts = await database<DatabaseCounts[]>`
      select
        (select count(*)::integer from public.workspaces where is_demo) as workspaces,
        (
          select count(*)::integer
          from public.products
          where workspace_id = '11111111-1111-4111-8111-111111111111'
        ) as products,
        (select count(*)::integer from public.orders where is_demo) as orders,
        (
          select count(*)::integer
          from public.order_items item
          join public.orders orders on orders.id = item.order_id
          where orders.is_demo
        ) as "orderItems",
        (
          select count(*)::integer
          from public.return_policies
          where workspace_id = '11111111-1111-4111-8111-111111111111'
        ) as "returnPolicies"
    `

    const infrastructure = await database<DatabaseInfrastructure[]>`
      select
        exists (select 1 from pg_extension where extname = 'vector') as "vectorInstalled",
        (
          select format_type(attribute.atttypid, attribute.atttypmod)
          from pg_attribute attribute
          where attribute.attrelid = 'public.knowledge_chunks'::regclass
            and attribute.attname = 'embedding'
        ) as "embeddingType",
        exists (
          select 1
          from pg_proc procedure
          join pg_namespace namespace on namespace.oid = procedure.pronamespace
          where namespace.nspname = 'public'
            and procedure.proname = 'match_hybrid_chunks'
        ) as "hybridFunctionExists",
        exists (
          select 1
          from pg_indexes
          where schemaname = 'public'
            and indexname = 'knowledge_chunks_embedding_idx'
        ) as "vectorIndexExists",
        (
          select count(*)::integer
          from pg_class relation
          join pg_namespace namespace on namespace.oid = relation.relnamespace
          where namespace.nspname = 'public'
            and relation.relkind = 'r'
            and relation.relname in (
              'profiles', 'workspaces', 'workspace_members', 'embedding_configs', 'products',
              'orders', 'order_items', 'return_policies', 'knowledge_documents',
              'knowledge_chunks', 'conversations', 'messages', 'message_citations',
              'tool_calls', 'retrieval_logs', 'tickets', 'ticket_messages',
              'webhook_endpoints', 'webhook_deliveries', 'ai_usage_events',
              'daily_demo_usage', 'eval_cases', 'eval_runs', 'eval_results', 'audit_logs',
              'message_feedback'
            )
        ) as "rlsTableCount",
        (
          select count(*)::integer
          from pg_class relation
          join pg_namespace namespace on namespace.oid = relation.relnamespace
          where namespace.nspname = 'public'
            and relation.relkind = 'r'
            and relation.relrowsecurity
            and relation.relname in (
              'profiles', 'workspaces', 'workspace_members', 'embedding_configs', 'products',
              'orders', 'order_items', 'return_policies', 'knowledge_documents',
              'knowledge_chunks', 'conversations', 'messages', 'message_citations',
              'tool_calls', 'retrieval_logs', 'tickets', 'ticket_messages',
              'webhook_endpoints', 'webhook_deliveries', 'ai_usage_events',
              'daily_demo_usage', 'eval_cases', 'eval_runs', 'eval_results', 'audit_logs',
              'message_feedback'
            )
        ) as "rlsEnabledCount",
        (
          select count(*)::integer
          from grounddesk_internal.schema_migrations
          where version in (
            '202608290001_initial_schema',
            '202608290002_auth_boundaries',
            '202608290003_knowledge_storage',
            '202608300004_chat_evidence_signals',
            '202608300005_ticket_webhook_outbox',
            '202608300006_conversation_sources',
            '202608300007_message_feedback',
            '202608310008_product_lifecycle'
          )
        ) as "migrationCount",
        exists (
          select 1
          from storage.buckets
          where id = 'grounddesk-knowledge'
            and not public
            and file_size_limit = 10485760
        ) as "knowledgeBucketExists",
        exists (
          select 1
          from information_schema.columns
          where table_schema = 'public' and table_name = 'products' and column_name = 'is_active'
        ) as "productLifecycleColumnExists"
    `

    const demoCases = await database<DemoCases[]>`
      select
        exists (
          select 1
          from public.orders
          where order_number = 'GD-2026D019'
            and customer_email = 'demo.customer19@example.com'
            and is_demo
        ) as "lookupOrderExists",
        exists (
          select 1
          from public.orders
          where is_demo
            and status = 'delivered'
            and delivered_at >= now() - interval '30 days'
        ) as "withinReturnWindowExists",
        exists (
          select 1
          from public.orders
          where is_demo
            and status = 'delivered'
            and delivered_at < now() - interval '30 days'
        ) as "outsideReturnWindowExists"
    `

    const countResult = counts[0]
    const infrastructureResult = infrastructure[0]
    const demoResult = demoCases[0]

    if (!countResult || !infrastructureResult || !demoResult) {
      throw new Error('Database verification queries returned no result')
    }

    const checks = {
      workspaceCount: countResult.workspaces === 1,
      productCount: countResult.products === 8,
      orderCount: countResult.orders === 30,
      orderItemCount: countResult.orderItems === 30,
      returnPolicyCount: countResult.returnPolicies === 1,
      vectorInstalled: infrastructureResult.vectorInstalled,
      embeddingDimension: infrastructureResult.embeddingType === 'vector(1024)',
      hybridFunction: infrastructureResult.hybridFunctionExists,
      vectorIndex: infrastructureResult.vectorIndexExists,
      rlsCoverage:
        infrastructureResult.rlsTableCount === 26 &&
        infrastructureResult.rlsEnabledCount === infrastructureResult.rlsTableCount,
      migrationsRecorded: infrastructureResult.migrationCount === 8,
      privateKnowledgeBucket: infrastructureResult.knowledgeBucketExists,
      productLifecycle: infrastructureResult.productLifecycleColumnExists,
      demoLookup: demoResult.lookupOrderExists,
      returnWindowCases:
        demoResult.withinReturnWindowExists && demoResult.outsideReturnWindowExists,
    }

    if (Object.values(checks).some((passed) => !passed)) {
      throw new Error(`Database verification failed: ${JSON.stringify(checks)}`)
    }

    process.stdout.write(
      `${JSON.stringify(
        {
          valid: true,
          counts: countResult,
          infrastructure: infrastructureResult,
          demoCases: demoResult,
        },
        null,
        2,
      )}\n`,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown database verification error'
    process.stderr.write(`GroundDesk database verification failed: ${message}\n`)
    process.exitCode = 1
  } finally {
    await database.end({ timeout: 5 })
  }
}
