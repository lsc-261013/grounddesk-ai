import type { AgentPlan } from '../src/generation/types.js'
import { describe, expect, it } from 'vitest'

import { constrainAgentPlan, shouldUseModelPlanner } from '../src/agent/plan-constraints.js'

describe('server-side agent plan constraints', () => {
  it('uses deterministic grounded retrieval for ordinary knowledge and unknown questions', () => {
    expect(shouldUseModelPlanner('Does Orbit H5 support USB-C audio?')).toBe(false)
    expect(shouldUseModelPlanner('What is the CEO personal phone number?')).toBe(false)
    expect(shouldUseModelPlanner('Where is my order?')).toBe(true)
    expect(shouldUseModelPlanner('Track GD-2026D019 with demo.customer19@example.com')).toBe(true)
  })

  it('routes unsupported model handoff choices through grounded retrieval', () => {
    const plan: AgentPlan = {
      intent: 'human_handoff',
      normalizedQuestion: 'Does Orbit H5 support USB-C audio?',
      missingFields: [],
      toolCall: null,
    }
    expect(constrainAgentPlan(plan, plan.normalizedQuestion).intent).toBe('knowledge_answer')
  })

  it('does not allow a model to invent missing order credentials', () => {
    const plan: AgentPlan = {
      intent: 'order_lookup',
      normalizedQuestion: 'Track my order',
      missingFields: [],
      toolCall: {
        id: 'call-1',
        name: 'order_lookup',
        input: { orderNumber: 'GD-INVENTED', email: 'invented@example.com' },
      },
    }
    const constrained = constrainAgentPlan(plan, 'Track my order')
    expect(constrained.toolCall).toBeNull()
    expect(constrained.missingFields).toContain('orderNumber')
    expect(constrained.missingFields).toContain('email')
  })

  it('binds return tool fields to values explicitly present in the customer message', () => {
    const plan: AgentPlan = {
      intent: 'return_eligibility',
      normalizedQuestion: 'Return order',
      missingFields: [],
      toolCall: {
        id: 'call-2',
        name: 'return_eligibility',
        input: {
          orderNumber: 'GD-FAKE0001',
          email: 'fake@example.com',
          productSku: null,
          reason: 'other',
          opened: false,
        },
      },
    }
    const constrained = constrainAgentPlan(
      plan,
      '订单 GD-2026D019，demo.customer19@example.com，Orbit H5 已拆封，不想要了，能退吗？',
    )
    expect(constrained).toMatchObject({
      intent: 'return_eligibility',
      toolCall: {
        input: {
          orderNumber: 'GD-2026D019',
          email: 'demo.customer19@example.com',
          productSku: null,
          reason: 'changed_mind',
          opened: true,
        },
      },
    })
  })
})
