import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const directory = fileURLToPath(new URL('../../../docs/images/demo-round-four/', import.meta.url))
test.use({ video: { mode: 'on', size: { width: 1440, height: 900 } } })

test('each scene tab replays its workflow, including repeat clicks, without freezing under the pointer', async ({
  page,
  context,
}) => {
  await mkdir(directory, { recursive: true })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  let aiRequests = 0
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/chat/stream', (route) => {
    aiRequests++
    return route.abort()
  })
  await page.goto('/')
  const stage = page.locator('.support-preview')
  const ready = async () => {
    await expect(page.locator('.preview-scene')).toHaveCSS('opacity', '1')
    await expect(page.locator('.preview-response')).toHaveCSS('opacity', '1')
    await expect(page.locator('.preview-proof')).toHaveCSS('opacity', '1')
    await expect(page.locator('.preview-response > p')).toBeVisible()
  }
  await ready()
  await expect(page.getByRole('button', { name: '重播流程', exact: true })).toHaveCount(0)
  const size = await stage.boundingBox()
  const playScene = async (name: string, scene: string, answer: string) => {
    const previousScene = await page.locator('.preview-scene').elementHandle()
    await page.getByRole('tab', { name, exact: true }).click()
    expect(await previousScene.evaluate((element) => element.isConnected)).toBe(false)
    await expect(stage).toHaveAttribute('data-motion', 'replay')
    await page.locator('.preview-response').hover()
    const animations = await page.locator('.preview-scene').evaluate((element) =>
      element.getAnimations({ subtree: true }).map((animation) => ({
        state: animation.playState,
        name: (animation as CSSAnimation).animationName,
      })),
    )
    expect(animations.map((animation) => animation.name)).toEqual(
      expect.arrayContaining(['preview-question-in', 'preview-answer-in', 'preview-source-in']),
    )
    expect(animations.some((animation) => animation.state === 'paused')).toBe(false)
    await ready()
    await expect(page.locator('.preview-scene')).toHaveAttribute('data-scene', scene)
    await expect(page.locator('.preview-response')).toContainText(answer)
  }
  await playScene('产品咨询', 'product', '18 个月')
  await playScene('订单查询', 'order', '订单号与下单邮箱匹配后')
  await playScene('人工接管', 'handoff', '资料不足')
  await playScene('产品咨询', 'product', '18 个月')
  await playScene('产品咨询', 'product', '18 个月')
  for (const scene of ['订单查询', '人工接管', '产品咨询', '人工接管', '订单查询'])
    await page.getByRole('tab', { name: scene, exact: true }).click()
  await page.locator('.preview-response').hover()
  await ready()
  await expect(page.locator('.preview-scene')).toHaveAttribute('data-scene', 'order')
  await expect(page.locator('.preview-response')).toContainText('订单号与下单邮箱匹配后')
  expect((await stage.boundingBox())?.height).toBe(size?.height)
  await playScene('订单查询', 'order', '订单号与下单邮箱匹配后')
  const primaryCta = page.getByRole('link', { name: '体验 AI 客服', exact: true })
  await primaryCta.hover()
  await expect(primaryCta).toHaveCSS('background-color', 'rgb(144, 235, 201)')
  await page.mouse.down()
  await page.screenshot({ path: directory + '/after-home-cta-pressed.png' })
  await page.mouse.move(12, 12)
  await page.mouse.up()
  await page.locator('.landing-evaluation').scrollIntoViewIfNeeded()
  const lowerReveal = page.locator('.landing-workbench__inner')
  await lowerReveal.scrollIntoViewIfNeeded()
  await expect(lowerReveal).toHaveClass(/is-revealed/)
  await expect
    .poll(() =>
      lowerReveal.evaluate(
        (e) => e.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length,
      ),
    )
    .toBe(0)
  await page.locator('.support-preview').scrollIntoViewIfNeeded()
  await ready()
  expect(
    await lowerReveal.evaluate(
      (e) => e.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length,
    ),
  ).toBe(0)
  await page.getByRole('tab', { name: '产品咨询', exact: true }).press('End')
  await expect(page.locator('.preview-scene')).toHaveAttribute('data-scene', 'handoff')
  await ready()
  await page.getByRole('tab', { name: '人工接管', exact: true }).press('Home')
  await ready()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: directory + '/after-home-1440x900.png' })
  await page.setViewportSize({ width: 1280, height: 720 })
  const cta = page.getByRole('link', { name: '亲自试试这个问题', exact: true })
  const bounds = await cta.boundingBox()
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(720)
  await page.screenshot({ path: directory + '/after-home-1280x720.png' })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('tab', { name: '订单查询', exact: true }).click()
  await ready()
  await expect(page.locator('.preview-proof')).toHaveCSS('animation-name', 'none')
  expect(aiRequests).toBe(0)
  expect(errors).toEqual([])
  const video = page.video()
  await context.close()
  await video?.saveAs(directory + '/hero-motion-1440x900.webm')
})

test('observer failure leaves all scenario content usable', async ({ page }) => {
  await page.addInitScript(() => {
    window.IntersectionObserver = undefined as unknown as typeof IntersectionObserver
  })
  await page.goto('/')
  await expect(page.locator('.preview-response')).toHaveCSS('opacity', '1')
  await page.getByRole('tab', { name: '人工接管', exact: true }).click()
  await expect(page.locator('.preview-proof')).toHaveCSS('opacity', '1')
  await expect(page.locator('.preview-response')).toContainText('资料不足')
})
