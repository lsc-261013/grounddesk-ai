import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const screenshotDir = fileURLToPath(
  new URL('../../../docs/images/demo-round-four/', import.meta.url),
)
test.use({ video: { mode: 'on', size: { width: 1440, height: 900 } } })
const citation = (ordinal: number, answer: number) => ({
  ordinal,
  chunkId: `40000000-0000-4000-8000-00000000000${ordinal}`,
  documentId: `50000000-0000-4000-8000-00000000000${answer}`,
  documentTitle: `隔离测试 · 回答 ${answer} · 来源 ${ordinal}`,
  sectionPath: ['测试章节'],
  pageStart: ordinal,
  pageEnd: ordinal,
  quote:
    ordinal === 1
      ? '隔离夹具原文，用于让第二条来源落在右栏屏外，不来自真实知识库。'.repeat(50)
      : `回答 ${answer} 的第二条原文。`.repeat(80),
})

test('aggregate and exact entries open, retain, locate and re-signal the right answer without page/transcript jumps', async ({
  page,
}) => {
  await mkdir(screenshotDir, { recursive: true })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.route('**/products', (route) =>
    route.fulfill({ contentType: 'application/json', body: '{"products":[]}' }),
  )
  let calls = 0
  await page.route('**/chat/stream', (route) => {
    calls++
    return route.fulfill({
      contentType: 'text/event-stream',
      body: [
        { type: 'citations', citations: [citation(1, calls), citation(2, calls)] },
        { type: 'token', delta: `隔离测试回答 ${calls}，第一条 [1] 与第二条 [2]。` },
        {
          type: 'done',
          messageId: `70000000-0000-4000-8000-00000000000${calls}`,
          intent: 'knowledge_answer',
          refused: false,
          handedOff: false,
        },
      ]
        .map((event) => `data: ${JSON.stringify(event)}\n\n`)
        .join(''),
    })
  })
  const send = async (text: string) => {
    await page.getByLabel('输入客服问题', { exact: true }).fill(text)
    await page.getByRole('button', { name: '发送问题', exact: true }).click()
    await expect(page.locator('.demo-message__content').last()).toContainText(`回答 ${calls}`)
  }
  const pane = page.locator('.demo-evidence-wrapper')
  const source = (ordinal: number) => pane.locator(`[data-source="${ordinal}"]`)
  const positions = () =>
    page.evaluate(() => ({
      page: scrollY,
      transcript: document.querySelector('.demo-chat__transcript')!.scrollTop,
    }))
  await page.goto('/demo')
  await send('第一轮问题')
  const before = await positions()
  await page.getByRole('button', { name: '查看 2 条来源', exact: true }).click()
  await expect(source(1)).toHaveAttribute('open', '')
  await expect(source(1)).toHaveClass('is-active')
  expect(await positions()).toEqual(before)
  const paneBefore = await pane.evaluate((e) => e.scrollTop)
  await page.getByRole('button', { name: '查看 2 条来源', exact: true }).click()
  expect(await pane.evaluate((e) => e.scrollTop)).toBe(paneBefore)
  await page.getByRole('button', { name: '查看来源 2', exact: true }).click()
  await expect(source(2).locator('blockquote')).toBeVisible()
  expect(await positions()).toEqual(before)
  // Closing the first excerpt can already bring the second source into view: do not scroll gratuitously.
  expect(await pane.evaluate((e) => e.scrollTop)).toBe(paneBefore)
  await pane.evaluate((e) => {
    e.scrollTop = e.scrollHeight
  })
  expect(await pane.evaluate((e) => e.scrollTop)).toBeGreaterThan(paneBefore)
  await page.getByRole('button', { name: '查看来源 2', exact: true }).click()
  const bounds = await source(2)
    .locator('summary')
    .evaluate((e) => ({
      top: e.getBoundingClientRect().top,
      bottom: e.getBoundingClientRect().bottom,
      paneTop: e.closest('.demo-evidence-wrapper')!.getBoundingClientRect().top,
      paneBottom: e.closest('.demo-evidence-wrapper')!.getBoundingClientRect().bottom,
    }))
  expect(bounds.top).toBeGreaterThanOrEqual(bounds.paneTop)
  expect(bounds.bottom + 96).toBeLessThanOrEqual(bounds.paneBottom)
  expect(await positions()).toEqual(before)
  await page.getByRole('button', { name: '查看 2 条来源', exact: true }).click()
  await expect(source(2)).toHaveAttribute('open', '')
  await page.getByRole('button', { name: '查看来源 2', exact: true }).press('Enter')
  await expect(source(2).locator('.demo-source-locator')).toHaveCount(1)
  await expect(source(2)).toHaveAttribute('open', '')
  await source(2).locator('summary').click()
  await expect(source(2)).not.toHaveAttribute('open', '')
  await page.getByRole('button', { name: '查看来源 2', exact: true }).click()
  await expect(source(2)).toHaveAttribute('open', '')
  await send('第二轮问题')
  await expect(pane.locator('.demo-evidence__question')).toContainText('第一轮问题')
  await expect(source(2)).toHaveAttribute('open', '')
  await page.getByRole('button', { name: '查看 2 条来源', exact: true }).last().click()
  await expect(pane.locator('.demo-evidence__question')).toContainText('第二轮问题')
  await expect(source(1)).toHaveAttribute('open', '')
  await expect(source(1)).toContainText('回答 2')
  await page.getByRole('button', { name: '查看 2 条来源', exact: true }).first().click()
  await expect(source(2).locator('blockquote')).toHaveText(citation(2, 1).quote)
  await page.screenshot({ path: `${screenshotDir}/fixture-source-owner-1440x900.png` })
  expect(calls).toBe(2)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('tab', { name: '问答', exact: true }).click()
  await page.getByLabel('输入客服问题', { exact: true }).fill('返回后保留的草稿')
  const mobileBefore = await positions()
  await page.getByRole('button', { name: '查看 2 条来源', exact: true }).first().click()
  await expect(page.getByRole('tab', { name: '资料与结果 2', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(source(2).locator('blockquote')).toBeVisible()
  await expect(source(2)).toHaveClass('is-active')
  expect(
    await source(2)
      .locator('.demo-source-locator')
      .evaluate((e) => getComputedStyle(e).animationName),
  ).toBe('none')
  await page.screenshot({ path: `${screenshotDir}/fixture-source-390x844.png` })
  await page.getByRole('button', { name: '返回当前问答', exact: true }).click()
  await expect(page.getByLabel('输入客服问题', { exact: true })).toHaveValue('返回后保留的草稿')
  await expect(
    page.getByRole('button', { name: '查看 2 条来源', exact: true }).first(),
  ).toBeFocused()
  expect(await positions()).toEqual(mobileBefore)
})
