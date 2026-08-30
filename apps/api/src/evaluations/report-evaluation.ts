import postgres from 'postgres'

import { DEMO_WORKSPACE_ID } from '@grounddesk/shared'

import { env } from '../config/env.js'

if (!env.SUPABASE_DB_URL) throw new Error('SUPABASE_DB_URL is required.')

const database = postgres(env.SUPABASE_DB_URL, {
  max: 1,
  ssl: 'require',
  connection: { application_name: 'grounddesk-evaluation-report' },
})

try {
  const runs = await database<
    { id: string; providerMode: string; status: string; summary: unknown; createdAt: Date }[]
  >`
    select id, provider_mode as "providerMode", status::text, summary, created_at as "createdAt"
    from public.eval_runs
    where workspace_id = ${DEMO_WORKSPACE_ID}
    order by created_at desc
    limit 1
  `
  const run = runs[0]
  if (!run) throw new Error('No evaluation run exists.')
  const failures = await database<
    { caseKey: string; category: string; failures: string[]; actual: unknown }[]
  >`
    select evaluation_case.case_key as "caseKey", evaluation_case.category,
      result.failures, result.actual
    from public.eval_results result
    join public.eval_cases evaluation_case on evaluation_case.id = result.case_id
    where result.workspace_id = ${DEMO_WORKSPACE_ID} and result.run_id = ${run.id}
      and not result.passed
    order by evaluation_case.category, evaluation_case.case_key
  `
  const failureMessages = await database<
    { caseKey: string; intent: string | null; errorType: string | null; content: string }[]
  >`
    select evaluation_case.case_key as "caseKey", assistant.intent::text, assistant.error_type as "errorType",
      assistant.content
    from public.eval_results result
    join public.eval_cases evaluation_case on evaluation_case.id = result.case_id
    join public.messages customer on customer.workspace_id = evaluation_case.workspace_id
      and customer.role = 'user' and customer.content = evaluation_case.input ->> 'message'
      and customer.created_at >= ${run.createdAt}
    join lateral (
      select message.intent, message.error_type, message.content
      from public.messages message
      where message.conversation_id = customer.conversation_id and message.role = 'assistant'
        and message.created_at >= customer.created_at
      order by message.created_at
      limit 1
    ) assistant on true
    where result.run_id = ${run.id} and not result.passed
    order by evaluation_case.case_key
  `
  const demoUsage = await database<{ requestCount: number; tokenCount: number }[]>`
    select request_count::integer as "requestCount", token_count::integer as "tokenCount"
    from public.daily_demo_usage
    where workspace_id = ${DEMO_WORKSPACE_ID} and usage_date = current_date
  `
  process.stdout.write(
    `${JSON.stringify(
      {
        run: {
          id: run.id,
          providerMode: run.providerMode,
          status: run.status,
          summary: run.summary,
          createdAt: run.createdAt.toISOString(),
        },
        failures,
        failureMessages,
        demoUsage: demoUsage[0] ?? { requestCount: 0, tokenCount: 0 },
      },
      null,
      2,
    )}\n`,
  )
} finally {
  await database.end({ timeout: 5 })
}
