import { expect, test } from '@playwright/test'
import { DEMO_LOGIN_PASSWORD } from '@grounddesk/shared'

test('actual public demo authentication stages (redacted)', async ({ page }) => {
  test.setTimeout(55_000)
  const stages: Array<{ phase: string; status?: number; failure?: string; code?: string }> = []
  page.on('requestfailed', (request) => {
    if (/\/auth\/v1\/|\/v1\/auth\/session/.test(request.url()))
      stages.push({
        phase: new URL(request.url()).pathname,
        failure: request.failure()?.errorText ?? 'unknown',
      })
  })
  page.on('response', async (response) => {
    const path = new URL(response.url()).pathname
    if (!/\/auth\/v1\/|\/v1\/auth\/session/.test(path)) return
    const stage: (typeof stages)[number] = { phase: path, status: response.status() }
    if (!response.ok()) {
      const payload: unknown = await response.json().catch(() => null)
      if (payload && typeof payload === 'object' && 'code' in payload)
        stage.code = String(payload.code)
    }
    stages.push(stage)
  })
  await page.goto('/login')
  console.log(
    JSON.stringify({ beforeSubmitAlert: await page.getByRole('alert').allTextContents() }),
  )
  await page.getByLabel('邮箱', { exact: true }).fill('admin@demo.grounddesk.app')
  await page.getByLabel('密码', { exact: true }).fill(DEMO_LOGIN_PASSWORD)
  await page.getByRole('button', { name: '安全登录', exact: true }).click()
  await expect(page).toHaveURL(/\/console$/, { timeout: 40_000 })
  console.log(
    JSON.stringify({
      stages,
      route: new URL(page.url()).pathname,
      alert: await page.getByRole('alert').allTextContents(),
    }),
  )
  expect(stages.filter((stage) => stage.phase === '/v1/auth/session')).toEqual([
    { phase: '/v1/auth/session', status: 200 },
  ])
})
