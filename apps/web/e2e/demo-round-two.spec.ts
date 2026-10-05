import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const screenshotDir = fileURLToPath(
  new URL('../../../docs/images/demo-round-two/', import.meta.url),
)
test('home scenarios change actual content without model requests and prefill a manual draft', async ({
  page,
}) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  let chatRequests = 0
  await page.route('**/chat/stream', (route) => {
    chatRequests++
    return route.abort()
  })
  await page.goto('/')
  await expect(page.locator('.preview-scene')).toContainText('18 个月')
  await page.getByRole('tab', { name: '订单查询', exact: true }).click()
  await expect(page.locator('.preview-scene')).toContainText('服务端核对凭据')
  await expect(page.locator('.preview-scene')).not.toContainText('18 个月')
  await page.getByRole('tab', { name: '人工接管', exact: true }).click()
  await expect(page.locator('.preview-scene')).toContainText('等待人工处理')
  await page.getByRole('tab', { name: '人工接管', exact: true }).press('Home')
  await expect(page.getByRole('tab', { name: '产品咨询' })).toBeFocused()
  await page.getByRole('tab', { name: '订单查询', exact: true }).click()
  await page.getByRole('link', { name: '亲自试试这个问题' }).click()
  await expect(page.getByLabel('输入客服问题', { exact: true })).toHaveValue(
    /GD-2026D019.*demo.customer19@example.com/,
  )
  await expect(page.locator('.demo-message')).toHaveCount(0)
  expect(chatRequests).toBe(0)
  expect(pageErrors).toEqual([])
})

test('tool results lead the evidence pane without hiding citations or fabricating status steps', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mkdir(screenshotDir, { recursive: true })
  await page.route('**/products', (route) =>
    route.fulfill({ contentType: 'application/json', body: '{"products":[]}' }),
  )
  const citation = {
    ordinal: 1,
    chunkId: '40000000-0000-4000-8000-000000000001',
    documentId: '50000000-0000-4000-8000-000000000001',
    documentTitle: '测试政策 · 隔离夹具',
    sectionPath: ['保修'],
    pageStart: null,
    pageEnd: null,
    quote: '测试原文，不代表真实政策。',
  }
  await page.route('**/chat/stream', (route) =>
    route.fulfill({
      contentType: 'text/event-stream',
      body: [
        { type: 'session', conversationId: '60000000-0000-4000-8000-000000000001' },
        {
          type: 'tool',
          toolName: 'order_lookup',
          status: 'succeeded',
          summary: '隔离测试：订单凭据已由服务端校验',
          details: {
            kind: 'order_lookup',
            orderNumber: 'GD-2026D019',
            orderStatus: 'delivered',
            itemModels: ['Orbit H5'],
          },
        },
        { type: 'citations', citations: [citation] },
        { type: 'token', delta: '仅用于测试的工具与来源共存回答。[1]' },
        {
          type: 'done',
          messageId: '70000000-0000-4000-8000-000000000001',
          intent: 'order_lookup',
          refused: false,
          handedOff: false,
        },
      ]
        .map((event) => `data: ${JSON.stringify(event)}\n\n`)
        .join(''),
    }),
  )
  await page.goto('/demo')
  await page.getByLabel('输入客服问题', { exact: true }).fill('隔离工具展示测试')
  await page.getByRole('button', { name: '发送问题', exact: true }).click()
  const pane = page.locator('.demo-evidence')
  await expect(pane.locator('.demo-order-result')).toContainText('已签收')
  await expect(pane.locator('.demo-evidence__empty')).toHaveCount(0)
  await page.getByRole('button', { name: '查看来源 1', exact: true }).click()
  await expect(pane.locator('blockquote')).toHaveText(citation.quote)
  await expect(pane.locator('.demo-order-result')).toBeVisible()
  await page.screenshot({ path: `${screenshotDir}/fixture-order-source-1440x900.png` })
  await page.getByRole('button', { name: '新建会话', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('tab', { name: '问答', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByRole('button', { name: '模拟订单查询', exact: true })).toBeVisible()
})

test('home and demo retain clear layout at desktop, phone and narrower bilingual widths', async ({
  page,
}) => {
  await mkdir(screenshotDir, { recursive: true })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const width of [1440, 1280, 390, 320]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 900 })
    for (const path of ['/', '/demo']) {
      await page.goto(path)
      await expect(page.locator('h1')).toBeVisible()
      const dimensions = await page.evaluate(() => ({
        view: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
      }))
      expect(dimensions.content).toBeLessThanOrEqual(dimensions.view)
      if (path === '/') {
        expect(
          await page
            .locator('.landing-hero h1 span')
            .evaluateAll((elements) =>
              elements.every((element) => element.getBoundingClientRect().height < 80),
            ),
        ).toBe(true)
      } else {
        const entryBounds = await page.locator('.demo-chat__welcome').evaluate((element) => ({
          bottom: element.getBoundingClientRect().bottom,
          containerBottom: element.parentElement!.getBoundingClientRect().bottom,
        }))
        expect(entryBounds.bottom).toBeLessThanOrEqual(entryBounds.containerBottom)
        const input = await page.getByLabel('输入客服问题', { exact: true }).boundingBox()
        expect(input!.y + input!.height).toBeLessThanOrEqual(844 + (width >= 500 ? 56 : 0))
      }
      await page.screenshot({
        path: `${screenshotDir}/fixture-${path === '/' ? 'home' : 'demo'}-${width}-zh.png`,
      })
    }
  }
  await page.getByRole('button', { name: 'EN', exact: true }).click()
  for (const path of ['/', '/demo']) {
    await page.goto(path)
    const dimensions = await page.evaluate(() => ({
      view: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }))
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.view)
    if (path === '/demo') {
      const entry = await page.locator('.demo-chat__welcome').evaluate((element) => ({
        bottom: element.getBoundingClientRect().bottom,
        containerBottom: element.parentElement!.getBoundingClientRect().bottom,
      }))
      expect(entry.bottom).toBeLessThanOrEqual(entry.containerBottom)
      const input = await page.getByLabel('Ask a support question', { exact: true }).boundingBox()
      expect(input!.y + input!.height).toBeLessThanOrEqual(844)
    }
    await page.screenshot({
      path: `${screenshotDir}/fixture-${path === '/' ? 'home' : 'demo'}-320-en.png`,
    })
  }
})
