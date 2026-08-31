import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { expect, test, type Page } from '@playwright/test'

import { DEMO_LOGIN_PASSWORD } from '@grounddesk/shared'

const ADMIN_EMAIL = 'admin@demo.grounddesk.app'
const SCREENSHOT_DIR = fileURLToPath(new URL('../../../docs/images/', import.meta.url))

const expectNoHorizontalOverflow = async (page: Page): Promise<void> => {
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }))
  expect(widths.content).toBeLessThanOrEqual(widths.viewport)
}

const login = async (page: Page): Promise<void> => {
  await page.goto('/login')
  await page.getByLabel('邮箱', { exact: true }).fill(ADMIN_EMAIL)
  await page.getByLabel('密码', { exact: true }).fill(DEMO_LOGIN_PASSWORD)
  await page.getByRole('button', { name: '安全登录', exact: true }).click()
  await expect(page).toHaveURL(/\/console$/)
}

test('target viewports stay usable and produce portfolio screenshots', async ({ page }) => {
  test.skip(
    process.env.E2E_VISUAL_AUDIT !== 'true',
    'Run explicitly when recording visual acceptance evidence.',
  )

  await mkdir(SCREENSHOT_DIR, { recursive: true })
  await page.emulateMedia({ reducedMotion: 'reduce' })

  const publicViewports = [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]

  for (const viewport of publicViewports) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: '每一次回答，都有依据。' })).toBeVisible()
    await expect(page.locator('.landing-product-grid article')).toHaveCount(4)
    await expect(page.locator('.landing-evaluation__score')).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await page.goto('/demo')
    await expect(page.getByRole('heading', { name: 'Avenlo Support', exact: true })).toBeVisible()
    await expect(page.locator('.demo-product-grid article')).toHaveCount(8)
    await expectNoHorizontalOverflow(page)
  }

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect(page.locator('.landing-evaluation__score')).toBeVisible()
  await page.screenshot({ path: `${SCREENSHOT_DIR}/landing-desktop.png`, fullPage: true })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/demo')
  await expect(page.locator('.demo-product-grid article')).toHaveCount(8)
  await page.locator('.demo-chat').scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${SCREENSHOT_DIR}/demo-mobile.png` })

  await page.setViewportSize({ width: 1280, height: 800 })
  await login(page)
  await expect(page.getByRole('heading', { name: '可信运营概览', exact: true })).toBeVisible()
  await expect(page.locator('.metric-card--loading')).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
  await page.screenshot({ path: `${SCREENSHOT_DIR}/console-desktop.png`, fullPage: true })

  for (const viewport of publicViewports.slice(2)) {
    await page.setViewportSize(viewport)
    await page.goto('/console')
    await expect(page.getByRole('heading', { name: '可信运营概览', exact: true })).toBeVisible()
    await expect(page.locator('.metric-card--loading')).toHaveCount(0)
    await expectNoHorizontalOverflow(page)
  }
})
