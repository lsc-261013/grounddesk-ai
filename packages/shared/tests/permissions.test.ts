import { describe, expect, it } from 'vitest'

import { hasPermission } from '../src/index.js'

describe('workspace permissions', () => {
  it('allows an administrator to manage workspace settings', () => {
    expect(hasPermission('admin', 'settings:manage')).toBe(true)
  })

  it('prevents a support agent from changing critical settings', () => {
    expect(hasPermission('agent', 'settings:manage')).toBe(false)
    expect(hasPermission('agent', 'knowledge:write')).toBe(false)
  })

  it('allows a support agent to read and reply to tickets', () => {
    expect(hasPermission('agent', 'tickets:read')).toBe(true)
    expect(hasPermission('agent', 'tickets:reply')).toBe(true)
  })
})
