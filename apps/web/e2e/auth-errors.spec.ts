import { expect, test } from '@playwright/test'

const fixtureToken = [
  Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),
  Buffer.from('{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","exp":1999999999}').toString(
    'base64url',
  ),
  'isolated-test-signature',
].join('.')
const fixtureSession = {
  access_token: fixtureToken,
  refresh_token: 'isolated-test-refresh',
  expires_in: 3600,
  token_type: 'bearer',
  user: {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    email: 'fixture@example.com',
    aud: 'authenticated',
    role: 'authenticated',
  },
}
const cases = [
  {
    name: 'wrong credentials',
    provider: 400,
    code: 'invalid_credentials',
    message: '邮箱或密码不正确',
  },
  { name: 'provider connection', provider: 0, message: '尚未完成账号验证' },
  { name: 'workspace service failure', provider: 200, api: 503, message: '无需修改密码' },
  { name: 'expired workspace token', provider: 200, api: 401, message: '工作区会话校验未通过' },
  { name: 'workspace access denied', provider: 200, api: 403, message: '当前无法访问工作区' },
] as const
for (const item of cases) {
  test(`isolated auth error: ${item.name}`, async ({ page }) => {
    let apiCalls = 0
    await page.route('**/auth/v1/token*', (route) =>
      item.provider === 0
        ? route.abort('failed')
        : route.fulfill({
            status: item.provider,
            json:
              item.provider === 200
                ? fixtureSession
                : {
                    error_code: 'code' in item ? item.code : 'unknown',
                    msg: 'Isolated test failure',
                  },
          }),
    )
    await page.route('**/v1/auth/session', (route) => {
      apiCalls++
      return route.fulfill({
        status: 'api' in item ? item.api : 500,
        json: { error: 'isolated_failure' },
      })
    })
    await page.goto('/login')
    await expect(page.getByRole('alert')).toHaveCount(0)
    await page.getByLabel('邮箱', { exact: true }).fill('fixture@example.com')
    await page.getByLabel('密码', { exact: true }).fill('isolated-password')
    await page.getByRole('button', { name: '安全登录', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText(item.message)
    await expect(page.getByRole('button', { name: '安全登录', exact: true })).toBeEnabled()
    expect(apiCalls).toBe(item.provider === 200 ? 1 : 0)
    if (item.provider === 200) {
      await page.reload()
      await expect(page.getByRole('alert')).toHaveCount(0)
      await expect(page.getByRole('status')).toContainText('上次会话暂未恢复')
      await expect(page.getByRole('button', { name: '安全登录', exact: true })).toBeEnabled()
      await page.goto('/console/settings')
      await expect(page).toHaveURL(/\/login\?redirect=/)
    }
    await page.getByRole('button', { name: 'EN', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Sign in securely', exact: true })).toBeVisible()
  })
}
