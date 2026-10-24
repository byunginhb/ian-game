import { test, expect } from '@playwright/test'

test('pointer game buttons return focus and Space still controls Tetris', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 900 })
  await page.goto('/game/tetris')
  await page.getByRole('button', { name: '게임 시작', exact: true }).click()
  await page.getByRole('button', { name: '블록 회전', exact: true }).click()
  await expect(page.locator('.game-content')).toBeFocused()
  const before = await page.locator('.tt-side-value').first().textContent()
  await page.keyboard.press('Space')
  await expect(page.locator('.tt-side-value').first()).not.toHaveText(before)
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.game-content')).toBeFocused()
})

test('keyboard activation retains button focus and remains usable with Tab', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 600, height: 900 })
  await page.goto('/game/tetris')
  await page.getByRole('button', { name: '게임 시작', exact: true }).click()
  const rotate = page.getByRole('button', { name: '블록 회전', exact: true })
  await rotate.focus()
  await page.keyboard.press('Enter')
  await expect(rotate).toBeFocused()
  if (browserName === 'chromium') {
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: '오른쪽 이동', exact: true })).toBeFocused()
  } else {
    await page.keyboard.press('Enter')
    await expect(rotate).toBeFocused()
  }
})

test('pointer buttons, arrows and Space work together in the treasure adventure', async ({ page }) => {
  await page.goto('/game/treasure-kingdom')
  await page.getByRole('button', { name: '공룡 정글 탐험 시작', exact: true }).click()
  await expect(page.locator('.tk-scene-loading')).toHaveCount(0)
  await expect(page.locator('.tk-canvas-host canvas')).toBeVisible()
  await expect(page.locator('#tk-field-map')).toBeHidden()
  await page.getByRole('button', { name: '지도', exact: true }).click()
  await expect(page.locator('#tk-field-map')).toBeVisible()
  await expect(page.locator('.game-content')).toBeFocused()
  const before = Number(await page.locator('.tk-player-dot').getAttribute('cx'))
  await page.keyboard.down('ArrowRight')
  await expect.poll(async () => Number(await page.locator('.tk-player-dot').getAttribute('cx'))).toBeGreaterThan(before + 25)
  await page.keyboard.up('ArrowRight')
  await page.getByRole('button', { name: '점프', exact: true }).click()
  await expect(page.locator('.game-content')).toBeFocused()
  const next = Number(await page.locator('.tk-player-dot').getAttribute('cx'))
  await page.keyboard.down('ArrowRight')
  await expect.poll(async () => Number(await page.locator('.tk-player-dot').getAttribute('cx'))).toBeGreaterThan(next + 25)
  await page.keyboard.up('ArrowRight')
  await page.keyboard.press('Space')
  await page.getByRole('button', { name: '보물 수첩', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog')).toBeFocused()
  const close = page.getByRole('button', { name: '닫기', exact: true })
  await page.keyboard.press('Tab')
  await expect(close).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.game-content')).toBeFocused()
})

test('native selectors and pause-dialog keyboard navigation keep their own focus', async ({ page, browserName }) => {
  await page.goto('/game/monster-defense')
  await page.getByRole('button', { name: /수비 시작/ }).click()
  const selector = page.getByLabel('성벽 선택', { exact: true })
  if (await selector.isVisible()) {
    await selector.focus()
    await expect(selector).toBeFocused()
  } else {
    await page.getByRole('button', { name: /게임 속도/ }).click()
    await expect(page.locator('.game-content')).toBeFocused()
  }
  await page.getByRole('button', { name: '게임 일시정지' }).click()
  await expect(page.getByRole('button', { name: /계속하기/ })).toBeFocused()
  if (browserName === 'chromium') {
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: '게임 목록으로', exact: true })).toBeFocused()
    await page.keyboard.press('Tab')
  }
  await page.keyboard.press('Enter')
  await expect(page.locator('.game-content')).toBeFocused()
})
