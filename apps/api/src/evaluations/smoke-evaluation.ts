import { createClient } from '@supabase/supabase-js'

import {
  DEMO_ADMIN_EMAIL,
  DEMO_LOGIN_PASSWORD,
  DEMO_WORKSPACE_ID,
  evaluationCaseListResponseSchema,
  evaluationRunDetailResponseSchema,
  evaluationRunResponseSchema,
} from '@grounddesk/shared'

import { buildApp } from '../app.js'
import { env } from '../config/env.js'

if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Supabase public configuration is required for evaluation smoke tests.')
}

const providerMode = process.argv.includes('--live') ? 'live' : 'mock'
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})
const { data, error } = await supabase.auth.signInWithPassword({
  email: DEMO_ADMIN_EMAIL,
  password: DEMO_LOGIN_PASSWORD,
})
if (error || !data.session) throw new Error('Demo administrator sign-in failed.')
const authorization = `Bearer ${data.session.access_token}`
const app = await buildApp({ logger: false })

const wait = (durationMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, durationMs))

try {
  const caseResponse = await app.inject({
    method: 'GET',
    url: `/v1/workspaces/${DEMO_WORKSPACE_ID}/evaluations/cases`,
    headers: { authorization },
  })
  const cases = evaluationCaseListResponseSchema.parse(caseResponse.json()).cases
  if (cases.filter((evaluationCase) => evaluationCase.enabled).length !== 26) {
    throw new Error('The real database does not contain exactly 26 enabled evaluation cases.')
  }
  const startResponse = await app.inject({
    method: 'POST',
    url: `/v1/workspaces/${DEMO_WORKSPACE_ID}/evaluations/runs`,
    headers: { authorization },
    payload: { providerMode },
  })
  if (startResponse.statusCode !== 202) throw new Error(startResponse.body)
  const runId = evaluationRunResponseSchema.parse(startResponse.json()).run.id
  const deadline = Date.now() + (providerMode === 'live' ? 12 * 60_000 : 60_000)
  let detail
  while (Date.now() < deadline) {
    const response = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${DEMO_WORKSPACE_ID}/evaluations/runs/${runId}`,
      headers: { authorization },
    })
    detail = evaluationRunDetailResponseSchema.parse(response.json())
    if (['completed', 'failed'].includes(detail.run.status)) break
    await wait(250)
  }
  if (!detail || detail.run.status !== 'completed' || !detail.run.summary) {
    throw new Error('The evaluation run did not complete successfully.')
  }
  const summary = detail.run.summary
  const meetsThresholds =
    summary.citationCoverage === 1 &&
    (summary.retrievalAt5 ?? 0) >= 0.85 &&
    (summary.refusalHandoffRate ?? 0) >= 0.9 &&
    (summary.toolSelectionAccuracy ?? 0) >= 0.9 &&
    summary.returnRuleAccuracy === 1 &&
    summary.isolationPassRate === 1
  if (!meetsThresholds) {
    throw new Error(`Evaluation thresholds were not met: ${JSON.stringify(summary)}`)
  }
  process.stdout.write(
    `${JSON.stringify(
      {
        valid: true,
        providerMode,
        runId,
        summary,
        failedCases: detail.results
          .filter((result) => !result.passed)
          .map((result) => ({ caseKey: result.caseKey, failures: result.failures })),
      },
      null,
      2,
    )}\n`,
  )
} finally {
  await app.close()
}
