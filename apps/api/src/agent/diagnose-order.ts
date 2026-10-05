import { env } from '../config/env.js'
import { DeepSeekGenerationProvider } from '../generation/deepseek-provider.js'
import { constrainAgentPlan } from './plan-constraints.js'

// Only shape-level diagnostics are emitted; credentials and provider payloads stay private.
const provider = new DeepSeekGenerationProvider(
  env.DEEPSEEK_MODEL,
  env.DEEPSEEK_BASE_URL,
  env.DEEPSEEK_API_KEY ?? '',
  env.DEEPSEEK_TIMEOUT_MS,
)
const question = '查询订单 GD-2026D019，下单邮箱是 demo.customer19@example.com。'
for (let attempt = 1; attempt <= 2; attempt += 1) {
  const { plan } = await provider.plan(question, 'zh-CN')
  const constrained = constrainAgentPlan(plan, question)
  console.log(
    JSON.stringify({
      attempt,
      runtime: env.RUNTIME_MODE,
      providerIntent: plan.intent,
      providerHasTool: Boolean(plan.toolCall),
      providerMissingFields: plan.missingFields,
      constrainedHasTool: Boolean(constrained.toolCall),
      constrainedMissingFields: constrained.missingFields,
    }),
  )
}
