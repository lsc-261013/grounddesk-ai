import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createServer, type ServerResponse } from 'node:http'

import { expect, test, type Page } from '@playwright/test'

const screenshotDir = fileURLToPath(
  new URL('../../../docs/images/demo-round-one/', import.meta.url),
)
const source = (number = 1) => ({
  ordinal: number,
  chunkId: `40000000-0000-4000-8000-00000000000${number}`,
  documentId: `50000000-0000-4000-8000-00000000000${number}`,
  documentTitle: `测试来源 ${number} · 仅用于自动化检查`,
  sectionPath: ['保修条款', '线材'],
  pageStart: 2,
  pageEnd: 3,
  quote: `这是测试来源 ${number} 的原文片段，用于核对引用联动，不来自真实知识库。`,
})
const sse = (events: unknown[]) =>
  events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')
const answer = (
  content: string,
  index = 1,
  extra: unknown[] = [],
  citations = [source(index)],
  handedOff = false,
) =>
  sse([
    { type: 'session', conversationId: '60000000-0000-4000-8000-000000000001' },
    { type: 'stage', stage: 'understanding', status: 'completed' },
    { type: 'citations', citations },
    ...extra,
    { type: 'token', delta: content },
    {
      type: 'done',
      messageId: `70000000-0000-4000-8000-00000000000${index}`,
      intent: handedOff ? 'human_handoff' : 'knowledge_answer',
      refused: handedOff,
      handedOff,
    },
  ])
const setup = async (page: Page) => {
  await page.route('**/v1/public/workspaces/avenlo-demo/products', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"products":[]}' }),
  )
  await mkdir(screenshotDir, { recursive: true })
}
const send = async (page: Page, text: string) => {
  await page.getByLabel('输入客服问题', { exact: true }).fill(text)
  await page.getByRole('button', { name: '发送问题', exact: true }).click()
}
const widths = async (page: Page) => {
  const dimensions = await page.evaluate(() => ({
    view: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }))
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.view)
}

test('product loading failure stays separate from chat and can be retried', async ({ page }) => {
  await setup(page)
  let attempts = 0
  await page.route('**/v1/public/workspaces/avenlo-demo/products', (route) => {
    attempts++
    return route.fulfill(
      attempts === 1
        ? {
            status: 503,
            contentType: 'application/json',
            body: '{"message":"Test product service unavailable"}',
          }
        : { status: 200, contentType: 'application/json', body: '{"products":[]}' },
    )
  })
  await page.goto('/demo')
  await page.locator('.demo-product-context summary').click()
  await expect(page.locator('.demo-product-context')).toContainText('商品数据暂时无法加载')
  await page.getByRole('button', { name: '查产品与保修', exact: true }).click()
  await expect(page.getByRole('button', { name: '发送问题', exact: true })).toBeEnabled()
  await page
    .locator('.demo-product-context')
    .getByRole('button', { name: '重试', exact: true })
    .click()
  await expect(page.locator('.demo-product-context')).toContainText('当前没有可展示的商品')
  expect(attempts).toBe(2)
})

test('multi-turn evidence stays pinned, switches correctly, and survives mobile navigation', async ({
  page,
}) => {
  await setup(page)
  let calls = 0
  await page.route('**/chat/stream', (route) => {
    calls++
    return route.fulfill({
      contentType: 'text/event-stream',
      body: answer(`第 ${calls} 条测试回答。[${calls}]`, calls),
    })
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/demo')
  await send(page, '第一条测试问题')
  await page.getByRole('button', { name: '查看来源 1', exact: true }).click()
  await expect(page.locator('[data-source="1"] blockquote')).toBeVisible()
  await send(page, '第二条测试问题')
  await expect(page.locator('.demo-message__content').last()).toContainText('第 2 条')
  await expect(page.locator('.demo-evidence__question')).toContainText('第一条测试问题')
  await expect(page.locator('[data-source="1"] blockquote')).toBeVisible()
  await page.getByRole('button', { name: '查看来源 2', exact: true }).click()
  await expect(page.locator('.demo-evidence__question')).toContainText('第二条测试问题')
  await expect(page.locator('[data-source="1"]')).toHaveCount(0)
  await page.locator('[data-source="2"] summary').click()
  await page.getByRole('button', { name: '查看来源 2', exact: true }).click()
  await expect(page.locator('[data-source="2"] blockquote')).toBeVisible()
  await widths(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('tab', { name: '问答', exact: true }).click()
  await page.getByLabel('输入客服问题', { exact: true }).fill('保留的草稿')
  const pageScrollBefore = await page.evaluate(() => window.scrollY)
  await page.getByRole('button', { name: '查看来源 1', exact: true }).click()
  expect(await page.evaluate(() => window.scrollY)).toBe(pageScrollBefore)
  await expect(page.locator('.demo-evidence__question')).toContainText('第一条测试问题')
  await page.getByRole('button', { name: '返回当前问答', exact: true }).click()
  await expect(page.getByLabel('输入客服问题', { exact: true })).toHaveValue('保留的草稿')
  await expect(page.getByRole('button', { name: '查看来源 1', exact: true })).toBeFocused()
  expect(calls).toBe(2)
  await widths(page)
})

test('waiting state permits drafting but locks submit/reset; IME Enter does not send', async ({
  page,
}) => {
  await setup(page)
  let release: (() => void) | undefined
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let calls = 0
  await page.route('**/chat/stream', async (route) => {
    calls++
    await gate
    await route.fulfill({ contentType: 'text/event-stream', body: answer('完成的测试回答。[1]') })
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/demo')
  const input = page.getByLabel('输入客服问题', { exact: true })
  await input.fill('中文输入中的问题')
  await input.dispatchEvent('compositionstart')
  await input.press('Control+Enter')
  expect(calls).toBe(0)
  await input.dispatchEvent('compositionend')
  await input.press('Control+Enter')
  await expect(page.getByRole('button', { name: '新建会话', exact: true })).toBeDisabled()
  await input.fill('下一条草稿')
  await input.press('Control+Enter')
  await expect(page.getByRole('button', { name: '发送问题', exact: true })).toBeDisabled()
  expect(calls).toBe(1)
  await page.getByRole('tab', { name: '资料与结果', exact: true }).click()
  await expect(page.locator('.demo-evidence__empty')).toHaveAttribute('data-state', 'pending')
  await page.getByRole('tab', { name: '问答', exact: true }).click()
  await page.screenshot({ path: `${screenshotDir}/fixture-waiting-390x844.jpg` })
  release?.()
  await expect(page.locator('.demo-message__content').last()).toContainText('完成的测试回答')
  await expect(input).toHaveValue('下一条草稿')
  expect(calls).toBe(1)
})

test('HTTP and SSE failure states retain the question without automatic side-effectful retries', async ({
  page,
}) => {
  await setup(page)
  let calls = 0
  await page.route('**/chat/stream', (route) => {
    calls++
    return route.fulfill(
      calls === 1
        ? { status: 503, contentType: 'application/json', body: '{"message":"测试服务暂不可用"}' }
        : {
            contentType: 'text/event-stream',
            body: sse([{ type: 'error', code: 'test_failure', message: '测试工单创建未确认' }]),
          },
    )
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/demo')
  await send(page, '保留这个问题')
  await expect(page.locator('.demo-message[data-failed="true"]')).toHaveCount(1)
  await page.getByRole('button', { name: '把原问题放回输入框', exact: true }).click()
  expect(calls).toBe(1)
  await expect(page.getByLabel('输入客服问题', { exact: true })).toHaveValue('保留这个问题')
  await page.screenshot({ path: `${screenshotDir}/fixture-error-390x844.jpg` })
  await page.getByRole('button', { name: '发送问题', exact: true }).click()
  await expect(page.locator('.demo-message[data-failed="true"]')).toHaveCount(2)
  await page.getByRole('button', { name: '查看资料与结果', exact: true }).last().click()
  await expect(page.locator('.demo-evidence__empty')).toHaveAttribute('data-state', 'failed')
  await expect(page.locator('.demo-evidence__handoff')).toHaveCount(0)
})

test('a no-source answer and confirmed handoff have different truthful outcomes', async ({
  page,
}) => {
  await setup(page)
  let calls = 0
  await page.route('**/chat/stream', (route) => {
    calls++
    return route.fulfill({
      contentType: 'text/event-stream',
      body: answer(
        calls === 1 ? '测试回复没有引用。' : '资料不足，转人工。',
        calls,
        [],
        [],
        calls === 2,
      ),
    })
  })
  await page.goto('/demo')
  await send(page, '无引用测试')
  await expect(page.locator('.demo-evidence__empty')).toHaveAttribute('data-state', 'none')
  await expect(page.locator('.demo-evidence__handoff')).toHaveCount(0)
  await send(page, '转人工测试')
  await expect(page.locator('.demo-evidence__handoff')).toBeVisible()
  await expect(page.locator('.demo-evidence__handoff')).toContainText('不代表真人已在线')
  await expect(page.locator('.demo-evidence__handoff')).toContainText('没有自动退款')
})

test('long answers do not force an upward reader to the bottom and provide an explicit latest hint', async ({
  page,
}) => {
  await setup(page)
  const longAnswer = Array.from(
    { length: 30 },
    (_, i) => `${i + 1}. 长段落测试：保留足够的文字以检查滚动和列表排版。[1]`,
  ).join('\n')
  let stream: ServerResponse | undefined
  const server = createServer((request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.setHeader('Access-Control-Allow-Headers', 'content-type')
    if (request.method === 'OPTIONS') {
      response.end()
      return
    }
    response.setHeader('Content-Type', 'text/event-stream')
    stream = response
    response.write(
      sse([
        { type: 'citations', citations: [source()] },
        { type: 'token', delta: longAnswer },
      ]),
    )
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Test stream server was not initialized')
  await page.route('**/chat/stream', (route) =>
    route.continue({ url: `http://127.0.0.1:${address.port}/stream` }),
  )
  try {
    await page.goto('/demo')
    await send(page, '长回答测试')
    const transcript = page.locator('.demo-chat__transcript')
    await expect(transcript.locator('.demo-message__content li')).toHaveCount(30)
    await transcript.evaluate((node) => {
      node.scrollTop = 0
    })
    await transcript.dispatchEvent('scroll')
    stream?.write(sse([{ type: 'token', delta: '\n\n新的流式段落。' }]))
    await expect(page.locator('.demo-message__content').last()).toContainText('新的流式段落')
    expect(await transcript.evaluate((node) => node.scrollTop)).toBe(0)
    await expect(
      page.getByRole('button', { name: '有新内容 · 回到底部', exact: true }),
    ).toBeVisible()
    await page.getByRole('button', { name: '有新内容 · 回到底部', exact: true }).click()
    await expect
      .poll(() =>
        transcript.evaluate((node) => node.scrollHeight - node.scrollTop - node.clientHeight),
      )
      .toBeLessThan(72)
    await widths(page)
    stream?.end(
      sse([
        {
          type: 'done',
          messageId: '70000000-0000-4000-8000-000000000001',
          intent: 'knowledge_answer',
          refused: false,
          handedOff: false,
        },
      ]),
    )
    await expect(page.getByRole('button', { name: '新建会话', exact: true })).toBeEnabled()
  } finally {
    stream?.end()
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})

test('initial layout, keyboard focus, reduced motion and English remain usable at target widths', async ({
  page,
}) => {
  await setup(page)
  let calls = 0
  await page.route('**/chat/stream', (route) => {
    calls++
    return route.abort()
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/demo')
    await expect(page.getByRole('heading', { name: 'Avenlo Support', exact: true })).toBeVisible()
    const inputBox = await page.getByLabel('输入客服问题', { exact: true }).boundingBox()
    expect(inputBox && inputBox.y + inputBox.height).toBeLessThan(viewport.height)
    await page.getByRole('button', { name: '查产品与保修', exact: true }).click()
    expect(calls).toBe(0)
    await expect(page.getByLabel('输入客服问题', { exact: true })).toBeFocused()
    await widths(page)
    await page.screenshot({
      path: `${screenshotDir}/fixture-initial-${viewport.width}x${viewport.height}.jpg`,
    })
  }
  await page.getByRole('button', { name: 'EN', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'A clear question. A verifiable answer.' }),
  ).toBeVisible()
  await widths(page)
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
})
