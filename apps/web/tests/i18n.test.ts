// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest'

const flattenMessageKeys = (value: unknown, prefix = ''): string[] => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [prefix]

  return Object.entries(value).flatMap(([key, child]) =>
    flattenMessageKeys(child, prefix ? `${prefix}.${key}` : key),
  )
}

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

  it('translates retrieval handoff reasons in both locales', async () => {
    const { i18n } = await import('../src/i18n')

    i18n.global.locale.value = 'zh-CN'
    expect(i18n.global.t('tickets.reason.low_confidence')).toBe('证据低于可信阈值')

    i18n.global.locale.value = 'en-US'
    expect(i18n.global.t('tickets.reason.low_confidence')).toBe(
      'Evidence below the confidence threshold',
    )
  })

  it('renders the public author credit naturally in both locales', async () => {
    const { i18n } = await import('../src/i18n')

    i18n.global.locale.value = 'zh-CN'
    expect(i18n.global.t('authorCredit', { name: 'Alex' })).toBe('由 Alex 独立设计与开发')

    i18n.global.locale.value = 'en-US'
    expect(i18n.global.t('authorCredit', { name: 'Alex' })).toBe('Designed and built by Alex')
  })

  it('keeps every interface message key available in both locales', async () => {
    const { i18n } = await import('../src/i18n')
    const chineseKeys = flattenMessageKeys(i18n.global.getLocaleMessage('zh-CN')).sort()
    const englishKeys = flattenMessageKeys(i18n.global.getLocaleMessage('en-US')).sort()

    expect(chineseKeys).toEqual(englishKeys)
    expect(chineseKeys.length).toBeGreaterThan(100)
  })
})
