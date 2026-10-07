import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

import {
  authSessionResponseSchema,
  DEMO_LOGIN_PASSWORD,
  webhookEndpointListResponseSchema,
} from '@grounddesk/shared'

const evidenceDirectory = fileURLToPath(
  new URL('../../../docs/images/release-2026-10-07/', import.meta.url),
)
const apiOrigin = 'https://grounddesk-api-lsc.onrender.com'

test.skip(process.env.E2E_RELEASE_SMOKE !== 'true', 'Explicit live release verification only.')
test.use({
  launchOptions: process.env.E2E_PROXY_URL ? { proxy: { server: process.env.E2E_PROXY_URL } } : {},
})
test.beforeEach(async () => {
  await mkdir(evidenceDirectory, { recursive: true })
})

const login = async (page: Page, email: string) => {
  await page.goto('/login')
  await page.getByLabel('邮箱', { exact: true }).fill(email)
  await page.getByLabel('密码', { exact: true }).fill(DEMO_LOGIN_PASSWORD)
  const response = page.waitForResponse(
    (candidate) => candidate.url() === `${apiOrigin}/v1/auth/session`,
  )
  await page.getByRole('button', { name: '安全登录', exact: true }).click()
  const sessionResponse = await response
  expect(sessionResponse.status()).toBe(200)
  await expect(page).toHaveURL(/\/console$/)
  const session = authSessionResponseSchema.parse(await sessionResponse.json())
  const authorization = (await sessionResponse.request().allHeaders()).authorization
  expect(authorization).toMatch(/^Bearer /)
  if (!authorization) throw new Error('Verified demo authorization is unavailable.')
  const membership = session.memberships[0]
  expect(membership).toBeDefined()
  if (!membership) throw new Error('Demo membership is unavailable.')
  return { headers: { authorization }, workspaceId: membership.workspace.id }
}

test('live home replays all tabs, remains bilingual, and fits desktop/mobile', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await expect(page.getByText('已验证流程的示例 · 非实时回答', { exact: true })).toBeVisible()
  const ready = async () => {
    await expect(page.locator('.preview-response')).toHaveCSS('opacity', '1')
    await expect(page.locator('.preview-proof')).toHaveCSS('opacity', '1')
  }
  await ready()
  for (const [label, scene] of [
    ['产品咨询', 'product'],
    ['订单查询', 'order'],
    ['人工接管', 'handoff'],
    ['产品咨询', 'product'],
    ['产品咨询', 'product'],
  ] as const) {
    const previous = await page.locator('.preview-scene').elementHandle()
    await page.getByRole('tab', { name: label, exact: true }).click()
    expect(await previous?.evaluate((element) => element.isConnected)).toBe(false)
    await expect(page.locator('.preview-scene')).toHaveAttribute('data-scene', scene)
    await page.locator('.preview-response').hover()
    await ready()
  }
  await expect(page.getByRole('button', { name: '重播流程', exact: true })).toHaveCount(0)
  await page.screenshot({ path: `${evidenceDirectory}/home-1440x900.png` })
  await page.getByRole('button', { name: 'EN', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Support answers. You can verify.' }),
  ).toBeVisible()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('.preview-proof')).toHaveCSS('animation-name', 'none')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: `${evidenceDirectory}/home-390x844-en.png` })
  await page.goto('/demo')
  await expect(page.getByRole('heading', { name: 'Avenlo Support', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: `${evidenceDirectory}/demo-390x844-en.png` })
})

test('live demo roles retain authentication and server permission boundaries', async ({ page }) => {
  test.setTimeout(150_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  for (const role of ['admin', 'agent']) {
    const credentials = await login(page, `${role}@demo.grounddesk.app`)
    await expect(page.locator('.role-chip')).toHaveText(role)
    await page.screenshot({ path: `${evidenceDirectory}/${role}-1440x900.png` })
    const settings = await page.request.get(
      `${apiOrigin}/v1/workspaces/${credentials.workspaceId}/settings-access`,
      { headers: credentials.headers },
    )
    expect(settings.status()).toBe(role === 'admin' ? 200 : 403)
    const isolation = await page.request.get(
      `${apiOrigin}/v1/workspaces/22222222-2222-4222-8222-222222222222/access`,
      { headers: credentials.headers },
    )
    expect(isolation.status()).toBe(403)
    await page.goto(role === 'admin' ? '/console/orders' : '/console/tickets')
    await page.reload()
    await expect(
      page.getByRole('heading', {
        name: role === 'admin' ? '订单' : '人工工单队列',
        exact: true,
      }),
    ).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await page.getByRole('button', { name: '退出登录', exact: true }).click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('button', { name: '安全登录', exact: true })).toBeVisible()
    await page.goto('/console/settings')
    await expect(page).toHaveURL(/\/login\?redirect=/)
  }
})

test('live RAG links real sources, order tool is read-only, and safe handoff completes', async ({
  page,
}) => {
  test.setTimeout(240_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  const credentials = await login(page, 'admin@demo.grounddesk.app')
  const endpointsResponse = await page.request.get(
    `${apiOrigin}/v1/workspaces/${credentials.workspaceId}/webhooks`,
    { headers: credentials.headers },
  )
  expect(endpointsResponse.status()).toBe(200)
  const endpoints = webhookEndpointListResponseSchema.parse(await endpointsResponse.json())
  const enabledCount = endpoints.endpoints.filter((endpoint) => endpoint.enabled).length
  test.info().annotations.push({ type: 'enabled-webhooks', description: String(enabledCount) })
  // Any fallback can create a ticket, so check notifications before all model requests.
  test.skip(enabledCount > 0, 'Enabled external Webhooks: do not trigger public chat side effects.')
  await page.getByRole('button', { name: '退出登录', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/demo')
  const products = page.locator('.demo-product-context')
  await expect(products.locator('small')).toHaveText('8 件', { timeout: 30_000 })
  const send = async (question: string) => {
    await page.getByLabel('输入客服问题', { exact: true }).fill(question)
    await page.getByRole('button', { name: '发送问题', exact: true }).click()
    const answer = page.locator('.demo-message[data-role="assistant"]').last()
    await expect(answer.locator('.answer-feedback')).toBeVisible({ timeout: 60_000 })
    await expect(page.locator('.demo-chat__header i')).not.toHaveClass(/is-busy/)
    await expect(answer).toHaveAttribute('data-failed', 'false')
    await expect(page.locator('.demo-chat__error')).toHaveCount(0)
    return answer
  }
  const answer = await send('Airwave S1 和 S1 Pro 都支持双设备连接吗？')
  await expect(answer).toHaveAttribute('data-handoff', 'false')
  await expect(answer).toContainText('S1 Pro')
  const markers = answer.locator('.demo-citation-marker')
  await expect(markers.first()).toBeVisible()
  const lastMarker = markers.last()
  const ordinal = (await lastMarker.getAttribute('aria-label'))?.match(/\d+/)?.[0]
  expect(ordinal).toBeDefined()
  await lastMarker.click()
  const source = page.locator(`.demo-evidence [data-source="${ordinal}"]`)
  await expect(source).toHaveAttribute('open', '')
  await expect(source.locator('blockquote')).toBeVisible()
  expect((await source.locator('blockquote').innerText()).length).toBeGreaterThan(20)
  await answer.locator('.demo-message__source-button').click()
  await expect(source).toHaveAttribute('open', '')
  await page.screenshot({
    path: `${evidenceDirectory}/rag-source-1440x900.png`,
    animations: 'disabled',
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: '返回当前问答', exact: true }).click()
  await page.getByLabel('输入客服问题', { exact: true }).fill('草稿保留检查')
  await lastMarker.click()
  await expect(source.locator('blockquote')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({
    path: `${evidenceDirectory}/rag-source-390x844.png`,
    animations: 'disabled',
  })
  await page.getByRole('button', { name: '返回当前问答', exact: true }).click()
  await expect(page.getByLabel('输入客服问题', { exact: true })).toHaveValue('草稿保留检查')
  await page.getByRole('button', { name: '新建会话', exact: true }).click()
  const order = await send('查询订单 GD-2026D019，下单邮箱是 demo.customer19@example.com。')
  await expect(order).toContainText('这是只读查询，没有修改订单。')
  await expect(order.locator('.demo-tool').first()).toContainText('订单凭据已由服务端校验')
  await page.screenshot({ path: `${evidenceDirectory}/order-390x844.png` })
  await page.getByRole('button', { name: '新建会话', exact: true }).click()
  const handoff = await send('你们是否为火星殖民地提供维修服务？')
  await expect(handoff).toHaveAttribute('data-handoff', 'true')
  await expect(handoff).toContainText('资料不足')
  await handoff.locator('.demo-message__source-button').click()
  await expect(page.locator('.demo-evidence__handoff')).toBeVisible()
  await page.screenshot({
    path: `${evidenceDirectory}/handoff-390x844.png`,
    animations: 'disabled',
  })
})
