import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const outputDir = fileURLToPath(new URL('../../../docs/images/demo-round-three/', import.meta.url))

test('all scenario cards stay readable without collision in both languages and four widths', async ({
  page,
}) => {
  await mkdir(outputDir, { recursive: true })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  for (const locale of ['zh', 'en']) {
    if (locale === 'en') await page.getByRole('button', { name: 'EN', exact: true }).click()
    for (const width of [1440, 1280, 390, 320]) {
      await page.setViewportSize({ width, height: width < 500 ? 844 : 900 })
      const tabs = page.locator('.preview-tabs button')
      let previousHeight = 0
      for (let index = 0; index < 3; index++) {
        await tabs.nth(index).click()
        const layout = await page.evaluate(() => {
          const nodes = [
            ...document.querySelectorAll('.preview-question,.preview-response,.preview-proof'),
          ]
          const cards = nodes.map((e) => ({
            top: e.getBoundingClientRect().top,
            bottom: e.getBoundingClientRect().bottom,
            left: e.getBoundingClientRect().left,
            right: e.getBoundingClientRect().right,
          }))
          return {
            cards,
            footer: document.querySelector('.preview-footer')!.getBoundingClientRect().top,
            height: document.querySelector('.support-preview')!.getBoundingClientRect().height,
            width: innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
          }
        })
        expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width)
        for (let card = 0; card < 2; card++)
          expect(layout.cards[card]!.bottom + 8).toBeLessThanOrEqual(layout.cards[card + 1]!.top)
        expect(layout.cards[2]!.bottom + 8).toBeLessThanOrEqual(layout.footer)
        for (const card of layout.cards) {
          expect(card.left).toBeGreaterThanOrEqual(0)
          expect(card.right).toBeLessThanOrEqual(width)
        }
        if (previousHeight) expect(layout.height).toBe(previousHeight)
        previousHeight = layout.height
        if (width === 390 || width === 320) {
          await page
            .locator('.support-preview')
            .screenshot({ path: `${outputDir}/after-stage-${width}-${locale}-${index}.png` })
        }
      }
      await page.goto('/')
      await page.screenshot({ path: `${outputDir}/after-home-${width}-${locale}.png` })
    }
  }
})
