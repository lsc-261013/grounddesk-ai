import { expect, test, type Page } from '@playwright/test'

import { DEMO_LOGIN_PASSWORD } from '@grounddesk/shared'

const ADMIN_EMAIL = 'admin@demo.grounddesk.app'
const AGENT_EMAIL = 'agent@demo.grounddesk.app'

const login = async (page: Page, email: string): Promise<void> => {
  await page.goto('/login')
  await page.getByLabel('邮箱', { exact: true }).fill(email)
  await page.getByLabel('密码', { exact: true }).fill(DEMO_LOGIN_PASSWORD)
  await page.getByRole('button', { name: '安全登录', exact: true }).click()
  await expect(page).toHaveURL(/\/console$/)
}

test('landing page is bilingual, reduced-motion safe, and responsive', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  await expect(page.getByRole('heading', { name: '每一次回答，都有依据。' })).toBeVisible()
  await expect(page.locator('.flow-document')).toHaveCSS('animation-name', 'none')
  await page.getByRole('button', { name: 'EN', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Support answers you can verify.' })).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('grounddesk-locale')))
    .toBe('en-US')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/demo')
  await expect(page.getByRole('heading', { name: 'Avenlo Support', exact: true })).toBeVisible()
  const pageWidths = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }))
  expect(pageWidths.document).toBeLessThanOrEqual(pageWidths.viewport)
})

test('administrator can refresh protected pages and inspect operations data', async ({ page }) => {
  await login(page, ADMIN_EMAIL)

  await page.goto('/console/orders')
  await expect(page.getByText('GD-2026D019', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('GD-2026D019', { exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)

  await page.goto('/console/settings')
  await expect(page.getByLabel('工作区名称', { exact: true })).toHaveValue('Avenlo Demo Workspace')
  await expect(page.getByText('admin@demo.grounddesk.app', { exact: true })).toBeVisible()
  await expect(page.getByText('agent@demo.grounddesk.app', { exact: true })).toBeVisible()
})

test('agent navigation and direct-route states respect role boundaries', async ({ page }) => {
  await login(page, AGENT_EMAIL)

  const navigation = page.getByRole('navigation', { name: '控制台导航', exact: true })
  await expect(navigation.getByRole('link', { name: '订单', exact: true })).toBeVisible()
  await expect(navigation.getByRole('link', { name: '评测', exact: true })).toHaveCount(0)
  await expect(navigation.getByRole('link', { name: '设置', exact: true })).toHaveCount(0)

  await page.goto('/console/settings')
  await expect(page.getByRole('heading', { name: '需要管理员权限', exact: true })).toBeVisible()

  await page.goto('/console/tickets')
  await expect(page.getByRole('heading', { name: '人工工单队列', exact: true })).toBeVisible()
})

test('live public demo performs order lookup and creates a handoff ticket', async ({ page }) => {
  test.skip(process.env.E2E_LIVE_AI !== 'true', 'Run explicitly against configured live providers.')
  test.setTimeout(90_000)

  await page.goto('/demo')
  await page
    .getByRole('button', {
      name: '查询订单 GD-2026D019，下单邮箱是 demo.customer19@example.com。',
      exact: true,
    })
    .click()
  await expect(page.locator('.demo-tool')).toContainText('订单凭据已由服务端校验', {
    timeout: 45_000,
  })
  await expect(page.locator('.demo-message[data-role="assistant"]').last()).toContainText(
    'GD-2026D019',
  )

  await page.getByRole('button', { name: '新建会话', exact: true }).click()
  await page
    .getByRole('button', { name: '你们是否为火星殖民地提供维修服务？', exact: true })
    .click()
  const handoff = page.locator('.demo-message[data-role="assistant"][data-handoff="true"]')
  await expect(handoff).toContainText('资料不足', { timeout: 45_000 })

  await login(page, ADMIN_EMAIL)
  await page.goto('/console/tickets')
  await expect(
    page.getByText('你们是否为火星殖民地提供维修服务？', { exact: false }).first(),
  ).toBeVisible()
})
