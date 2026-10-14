import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

const evidence = fileURLToPath(
  new URL('../../../test-results/service-recovery/', import.meta.url),
)
const product = {
  id: '30000000-0000-4000-8000-000000000001',
  sku: 'TEST-C240',
  model: 'LinkCore C240',
  category: 'cable',
  nameZh: '本地合成商品 · LinkCore C240',
  nameEn: 'Local synthetic product · LinkCore C240',
  descriptionZh: '只用于界面回归',
  descriptionEn: 'UI regression fixture only',
  priceCents: 100,
  currency: 'USD',
  specs: {},
}
const checkWidth = async (page: Page) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => innerWidth),
  )
}
test.beforeEach(async ({ page }) => {
  await page.clock.install()
  await mkdir(evidence, { recursive: true })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  // All API requests are synthetic; never reach a real service during regression.
  await page.route('**/v1/**', (route) =>
    route.fulfill({
      status: 503,
      body: '{"message":"Local fixture only"}',
      contentType: 'application/json',
    }),
  )
})

for (const width of [1440, 390, 320]) {
  test(`demo recovery preserves drafts and never sends on retry at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    let reads = 0,
      posts = 0
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route('**/products', async (route) => {
      reads++
      if (reads === 1) await gate
      await route.fulfill({
        status: reads === 1 ? 503 : 200,
        contentType: 'application/json',
        body: JSON.stringify({ products: [product] }),
      })
    })
    await page.route('**/chat/stream', (route) => {
      posts++
      return route.abort()
    })
    await page.goto('/demo?scenario=product')
    const input = page.getByLabel('输入客服问题', { exact: true })
    await expect(input).toHaveValue(/LinkCore C240/)
    await expect(page.locator('.demo-service-notice')).toContainText('正在读取演示资料')
    await expect(page.getByText('可以开始提问', { exact: true })).toHaveCount(0)
    await input.fill('保留此草稿，不自动发送')
    await page.clock.fastForward(8_100)
    await expect(page.locator('.demo-service-notice')).toContainText('服务响应较慢')
    await page.screenshot({ path: `${evidence}/demo-slow-${width}.png`, fullPage: true })
    release?.()
    const retry = page.getByRole('button', { name: '重试读取资料', exact: true })
    await expect(retry).toBeVisible()
    await page.screenshot({ path: `${evidence}/demo-failed-${width}.png`, fullPage: true })
    await retry.click()
    await expect(page.locator('.demo-service-notice')).toHaveCount(0)
    await expect(page.locator('.demo-chat__header')).toContainText('演示资料已载入')
    await expect(input).toHaveValue('保留此草稿，不自动发送')
    expect(reads).toBe(2)
    expect(posts).toBe(0)
    await checkWidth(page)
    await page.screenshot({ path: `${evidence}/demo-recovered-${width}.png`, fullPage: true })
    expect(errors).toEqual([])
  })
}

test('home separates loading, failure, retry and genuine empty history', async ({ page }) => {
  let reads = 0
  let release: (() => void) | undefined
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/evaluations/latest', async (route) => {
    reads++
    if (reads === 1) await gate
    await route.fulfill({
      status: reads === 1 ? 503 : 200,
      contentType: 'application/json',
      body: '{"evaluation":null}',
    })
  })
  await page.goto('/')
  const panel = page.locator('.landing-evaluation')
  await panel.scrollIntoViewIfNeeded()
  await expect(panel).toContainText('正在读取历史真实评测')
  await expect(panel).not.toContainText('尚无完成')
  await page.screenshot({ path: `${evidence}/home-loading.png` })
  release?.()
  await expect(panel).toContainText('真实评测数据暂不可用')
  await expect(panel).not.toContainText('尚无完成')
  await page.screenshot({ path: `${evidence}/home-failed.png` })
  await page.getByRole('button', { name: '重新读取评测', exact: true }).click()
  await expect(panel).toContainText('尚无完成的真实评测运行')
  await expect(panel).not.toContainText('暂不可用')
  expect(reads).toBe(2)
  await checkWidth(page)
})

test('a stalled chat unlocks and restores the question without replaying the request', async ({
  page,
}) => {
  let posts = 0
  await page.route('**/products', (route) =>
    route.fulfill({ contentType: 'application/json', body: '{"products":[]}' }),
  )
  await page.route('**/chat/stream', () => {
    posts++
  })
  await page.goto('/demo')
  const input = page.getByLabel('输入客服问题', { exact: true })
  await input.fill('本地超时回归问题')
  await page.getByRole('button', { name: '发送问题', exact: true }).click()
  await expect(page.locator('.demo-chat__header')).toContainText('正在处理')
  await page.clock.fastForward(60_100)
  await expect(page.locator('.demo-chat__error')).toContainText('工单状态尚未确认')
  await page.getByRole('button', { name: '把原问题放回输入框', exact: true }).click()
  await expect(input).toHaveValue('本地超时回归问题')
  await expect(page.getByRole('button', { name: '发送问题', exact: true })).toBeEnabled()
  expect(posts).toBe(1)
  await page.screenshot({ path: `${evidence}/chat-timeout-recovery.png`, fullPage: true })
})
