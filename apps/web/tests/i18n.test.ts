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

  it('compiles authentication messages in both locales', async () => {
    const { i18n } = await import('../src/i18n')

    i18n.global.locale.value = 'zh-CN'
    expect(i18n.global.t('auth.emailPlaceholder')).toBe('name@example.com')

    i18n.global.locale.value = 'en-US'
    expect(i18n.global.t('auth.emailPlaceholder')).toBe('name@example.com')
  })
})
