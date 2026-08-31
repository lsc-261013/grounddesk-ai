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
  if (process.env.VITE_AUTHOR_NAME && process.env.VITE_CONTACT_URL) {
    await expect(page.getByText(`由 ${process.env.VITE_AUTHOR_NAME} 独立设计与开发`)).toBeVisible()
    await expect(page.getByRole('link', { name: '联系作者', exact: true })).toHaveAttribute(
      'href',
      process.env.VITE_CONTACT_URL,
    )
  }
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

  await page.goto('/console/products')
  await expect(page.getByRole('heading', { name: '商品目录', exact: true })).toBeVisible()
  await expect(page.getByText('Airwave S1', { exact: false }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: '新增商品', exact: true })).toBeVisible()

  await page.goto('/console/knowledge')
  const readySource = page.locator('.document-list > li').filter({ hasText: '可检索' }).first()
  await expect(readySource).toBeVisible()
  await readySource.locator('button').first().click()
  await expect(page.getByRole('heading', { name: /Avenlo/ })).toBeVisible()
  await expect(page.locator('.chunk-list > li').first()).toBeVisible()
  await page.getByRole('button', { name: '关闭 Chunk 预览', exact: true }).first().click()

  await page.getByRole('button', { name: '退出登录', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('button', { name: '安全登录', exact: true })).toBeVisible()
})

test('agent navigation and direct-route states respect role boundaries', async ({ page }) => {
  await login(page, AGENT_EMAIL)

  const navigation = page.getByRole('navigation', { name: '控制台导航', exact: true })
  await expect(navigation.getByRole('link', { name: '订单', exact: true })).toBeVisible()
  await expect(navigation.getByRole('link', { name: '评测', exact: true })).toHaveCount(0)
  await expect(navigation.getByRole('link', { name: '设置', exact: true })).toHaveCount(0)

  await page.goto('/console/settings')
  await expect(page.getByRole('heading', { name: '需要管理员权限', exact: true })).toBeVisible()

  await page.goto('/console/products')
  await expect(page.getByRole('heading', { name: '需要管理员权限', exact: true })).toBeVisible()

  await page.goto('/console/tickets')
  await expect(page.getByRole('heading', { name: '人工工单队列', exact: true })).toBeVisible()
})

test('live demo cites knowledge, calls tools, and completes human handoff', async ({ page }) => {
  test.skip(process.env.E2E_LIVE_AI !== 'true', 'Run explicitly against configured live providers.')
  test.setTimeout(180_000)

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

  await page.goto('/console/playground')
  await page
    .getByRole('button', { name: 'LinkCore C240 线材的保修期是多久？', exact: true })
    .click()
  const citation = page.locator('.citation-stack details').first()
  await expect(citation).toBeVisible({ timeout: 45_000 })
  await citation.locator('summary').click()
  await expect(citation.locator('blockquote')).toBeVisible()

  await page.goto('/console/tickets')
  const ticketRow = page
    .locator('.ticket-row:has(.status-badge[data-status="open"])')
    .filter({ hasText: '你们是否为火星殖民地提供维修服务？' })
    .first()
  await expect(ticketRow).toBeVisible()
  await ticketRow.click()
  const assignee = page
    .locator('.ticket-controls label')
    .filter({ hasText: '分配客服' })
    .locator('select')
  await assignee.selectOption({ label: 'GroundDesk Demo Agent' })
  await expect(assignee).not.toHaveValue('')

  await page.getByRole('button', { name: '退出登录', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await login(page, AGENT_EMAIL)
  await page.goto('/console/tickets')

  const assignedTicket = page
    .locator('.ticket-row:has(.status-badge[data-status="open"])')
    .filter({ hasText: '你们是否为火星殖民地提供维修服务？' })
    .first()
  await expect(assignedTicket).toBeVisible()
  await assignedTicket.click()
  const reply = '已收到请求，我们会核对服务覆盖范围后由人工继续处理。'
  await page.getByPlaceholder('输入给顾客的人工回复…', { exact: true }).fill(reply)
  await page.getByRole('button', { name: '发送回复', exact: true }).click()
  await expect(page.getByText(reply, { exact: true })).toBeVisible()
  await page
    .locator('.ticket-controls label')
    .filter({ hasText: '处理状态' })
    .locator('select')
    .selectOption('resolved')
  await expect(page.getByPlaceholder('输入给顾客的人工回复…', { exact: true })).toHaveCount(0)
})

test('administrator can reset the Demo Workspace to its baseline', async ({ page }) => {
  test.skip(
    process.env.E2E_RESET_DEMO !== 'true',
    'Run explicitly because this clears Demo operations and evaluation runs.',
  )

  await login(page, ADMIN_EMAIL)
  await page.goto('/console/settings')
  await page.getByLabel('输入 RESET 确认仅重置模拟数据', { exact: true }).fill('RESET')
  await page.getByRole('button', { name: '重置 Demo', exact: true }).click()
  await expect(page.getByRole('button', { name: '重置完成', exact: true })).toBeVisible({
    timeout: 15_000,
  })

  await page.goto('/console/products')
  await expect(page.locator('.product-admin-card')).toHaveCount(8)
  await expect(page.locator('.product-admin-card.archived')).toHaveCount(0)

  await page.goto('/console/orders')
  await expect(page.locator('.order-record')).toHaveCount(30)

  await page.goto('/console/tickets')
  await expect(page.getByText('当前筛选条件下没有工单。', { exact: true })).toBeVisible()
})
