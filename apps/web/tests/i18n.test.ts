// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest'

describe('locale persistence', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('persists the selected locale and updates the document language', async () => {
    const { persistLocale } = await import('../src/i18n')

    persistLocale('en-US')

    expect(window.localStorage.getItem('grounddesk-locale')).toBe('en-US')
    expect(document.documentElement.lang).toBe('en-US')
  })
})
