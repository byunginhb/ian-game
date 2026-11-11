import { test, expect } from '@playwright/test'

test.describe('number squad 3D', () => {
  // GPU 없는 테스트 환경에서는 CPU로 그려 게임 시계가 느리게 흐른다.
  test.setTimeout(90000)
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { if (!sessionStorage.getItem('ns-seeded')) { localStorage.removeItem('ian-number-squad-v1'); sessionStorage.setItem('ns-seeded', '1') } })
    await page.goto('/game/number-squad')
    await expect(page.locator('.ns-canvas')).toBeVisible({ timeout: 15000 })
  })

  test('only the first stage is open and options persist', async ({ page }) => {
    await expect(page.getByRole('button', { name: '1탄 출동', exact: true })).toBeEnabled()
    await expect(page.getByRole('button', { name: '2탄 잠김', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: /도전/ }).click()
    await page.reload()
    await expect(page.getByRole('button', { name: /도전/ })).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  })

  test('running through the first gate grows the squad and the run can be left', async ({ page }) => {
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.getByRole('button', { name: '1탄 출동', exact: true }).click()
    const count = page.locator('.ns-chip-count b')
    await expect(count).toHaveText('1')
    const brake = page.getByRole('button', { name: /브레이크/ })
    await page.keyboard.down('Space')
    await expect(brake).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.up('Space')
    await expect(brake).toHaveAttribute('aria-pressed', 'false')
    await page.keyboard.down('ArrowRight')
    // 1탄의 첫 문은 항상 더하기 문이라 어느 쪽을 지나도 인원이 늘어난다.
    await expect(count).not.toHaveText('1', { timeout: 60000 })
    await page.keyboard.up('ArrowRight')
    expect(Number(await count.textContent())).toBeGreaterThan(1)
    await page.getByRole('button', { name: '탄 고르기' }).click()
    await expect(page.getByRole('button', { name: '1탄 출동', exact: true })).toBeVisible()
    expect(errors).toEqual([])
  })
})
