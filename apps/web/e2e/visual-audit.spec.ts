import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { expect, test, type Page } from '@playwright/test'

const SCREENSHOT_DIR = fileURLToPath(new URL('../../../docs/images/', import.meta.url))

const productFixtures = [
  ['Airwave S1', 'Airwave S1 真无线耳机', 'Airwave S1 True Wireless Earbuds'],
  ['Airwave S1 Pro', 'Airwave S1 Pro 真无线降噪耳机', 'Airwave S1 Pro ANC Earbuds'],
  ['Orbit H5', 'Orbit H5 头戴式耳机', 'Orbit H5 Over-Ear Headphones'],
  ['Flux 67', 'Flux 67 GaN 充电器', 'Flux 67 GaN Charger'],
  ['Flux 100', 'Flux 100 GaN 充电器', 'Flux 100 GaN Charger'],
  ['LinkCore C240', 'LinkCore C240 240W USB-C 线材', 'LinkCore C240 240 W USB-C Cable'],
  ['Reserve 10K', 'Reserve 10K 移动电源', 'Reserve 10K Power Bank'],
  ['Dockline 6', 'Dockline 6 桌面充电底座', 'Dockline 6 Desktop Charging Dock'],
] as const

const demoProducts = {
  products: productFixtures.map(([model, nameZh, nameEn], index) => ({
    id: `30000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    sku: `AVL-DEMO-${index + 1}`,
    model,
    category: 'demo_product',
    nameZh,
    nameEn,
    descriptionZh: '用于公开体验的虚构消费电子商品资料。',
    descriptionEn: 'Fictional consumer-electronics product data for the public Demo.',
    priceCents: 2900 + index * 1000,
    currency: 'USD',
    specs: { source: 'visual-audit-fixture' },
  })),
}

const citation = {
  ordinal: 1,
  chunkId: '40000000-0000-4000-8000-000000000001',
  documentId: '50000000-0000-4000-8000-000000000001',
  documentTitle: 'Avenlo 配送、退货与保修政策',
  sectionPath: ['保修政策', '线材'],
  pageStart: null,
  pageEnd: null,
  quote: 'LinkCore C240 线材享有 18 个月有限保修。',
}

const encodeSse = (events: unknown[]): string =>
  events.map((event) => `event: grounddesk\ndata: ${JSON.stringify(event)}\n\n`).join('')

const installDeterministicPublicApi = async (page: Page): Promise<void> => {
  await page.route('**/v1/public/workspaces/avenlo-demo/products', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(demoProducts),
    })
  })
  await page.route('**/v1/public/workspaces/avenlo-demo/evaluations/latest', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Evaluation service unavailable during visual audit.' }),
    })
  })
  await page.route('**/v1/public/workspaces/avenlo-demo/chat/stream', async (route) => {
    const body = route.request().postDataJSON() as { message?: string }
    if (body.message?.includes('火星殖民地')) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: '演示中的可恢复错误：问答服务暂时不可用，请稍后重试。' }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream; charset=utf-8',
      body: encodeSse([
        { type: 'session', conversationId: '60000000-0000-4000-8000-000000000001' },
        { type: 'stage', stage: 'understanding', status: 'completed' },
        { type: 'stage', stage: 'retrieving', status: 'completed' },
        { type: 'stage', stage: 'validating', status: 'completed' },
        { type: 'citations', citations: [citation] },
        {
          type: 'token',
          delta:
            'LinkCore C240 线材自购买日起享有 18 个月有限保修，覆盖正常使用下的材料或制造缺陷。[1]',
        },
        { type: 'stage', stage: 'generating', status: 'completed' },
        { type: 'stage', stage: 'completed', status: 'completed' },
        {
          type: 'done',
          messageId: '70000000-0000-4000-8000-000000000001',
          intent: 'knowledge_answer',
          refused: false,
          handedOff: false,
        },
      ]),
    })
  })
}

const expectNoHorizontalOverflow = async (page: Page): Promise<void> => {
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }))
  expect(widths.content).toBeLessThanOrEqual(widths.viewport)
}

test('homepage and public Demo stay usable at target viewports and produce evidence', async ({
  page,
}) => {
  test.skip(
    process.env.E2E_VISUAL_AUDIT !== 'true',
    'Run explicitly when recording visual acceptance evidence.',
  )

  await mkdir(SCREENSHOT_DIR, { recursive: true })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await installDeterministicPublicApi(page)

  const targetViewports = [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]

  for (const viewport of targetViewports) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: '让客服回答有依据，让复杂问题有人接手。' }),
    ).toBeVisible()
    await expect(page.locator('.landing-scenario-grid article')).toHaveCount(3)
    await expectNoHorizontalOverflow(page)
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/redesign-home-${viewport.width}x${viewport.height}.png`,
    })
  }

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/demo')
  await expect(page.getByRole('heading', { name: 'Avenlo Support', exact: true })).toBeVisible()
  await expect(page.getByLabel('输入客服问题', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /查产品与保修/ }).click()
  await expect(page.getByLabel('输入客服问题', { exact: true })).toHaveValue(
    'LinkCore C240 线材的保修期是多久？',
  )
  await page.getByRole('button', { name: '发送问题', exact: true }).click()
  await expect(
    page.locator('.demo-message[data-role="assistant"] .demo-message__content').last(),
  ).toContainText('18 个月有限保修')
  await expect(page.getByText('Avenlo 配送、退货与保修政策', { exact: true })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await page.screenshot({ path: `${SCREENSHOT_DIR}/redesign-demo-answer-1440x900.png` })

  await page.setViewportSize({ width: 1280, height: 800 })
  await page.reload()
  await expect(page.getByLabel('输入客服问题', { exact: true })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await page.screenshot({ path: `${SCREENSHOT_DIR}/redesign-demo-1280x800.png` })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await page.getByRole('button', { name: /资料不足怎么办/ }).click()
  await page.getByRole('button', { name: '发送问题', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('问答服务暂时不可用')
  await expectNoHorizontalOverflow(page)
  await page.screenshot({ path: `${SCREENSHOT_DIR}/redesign-demo-error-390x844.png` })
})
