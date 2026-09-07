import { test, expect } from '@playwright/test'
import { games } from '../src/data/games.js'

test.beforeEach(async ({ page }) => {
  await page.clock.install()
})

test('2048 merges once, scores once and resets immediately', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0 })
  await page.goto('/game/song-ian')
  await expect(page.locator('.t48-tile')).toHaveCount(2)
  await page.keyboard.press('ArrowLeft')
  await expect(page.locator('.t48-tile').filter({ hasText: /^4$/ })).toHaveCount(1)
  await expect(page.locator('.t48-score-value').first()).toHaveText('4')
  await page.getByRole('button', { name: '새 게임', exact: true }).click()
  await expect(page.locator('.t48-score-value').first()).toHaveText('0')
  await page.keyboard.press('ArrowLeft')
  await expect(page.locator('.t48-score-value').first()).toHaveText('4')
})

test('Tetris cannot lock the same piece twice during line clear', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => .2 }) // O pieces
  await page.goto('/game/tetris')
  await page.getByRole('button', { name: '게임 시작', exact: true }).click()
  for (const offset of [-4, -2, 0, 2, 4]) {
    for (let i = 0; i < Math.abs(offset); i++) await page.keyboard.press(offset < 0 ? 'ArrowLeft' : 'ArrowRight')
    await page.keyboard.press('Space')
  }
  const lines = page.locator('.tt-side-value').nth(2)
  await expect(lines).toHaveText('2')
  const score = await page.locator('.tt-side-value').first().textContent()
  for (let i = 0; i < 4; i++) await page.keyboard.press('Space')
  await expect(lines).toHaveText('2')
  await expect(page.locator('.tt-side-value').first()).toHaveText(score)
  await page.clock.runFor(240)
  await expect(page.locator('.tt-line-flash')).toHaveCount(0)
  await page.keyboard.press('Space')
  await expect(page.locator('.tt-side-value').first()).not.toHaveText(score)
})

test('Stack Tower accepts a mouse placement and reports actual floors', async ({ page }) => {
  await page.goto('/game/stack-tower')
  await page.getByRole('button', { name: '게임 시작', exact: true }).click()
  await page.clock.runFor(672)
  await page.locator('.st-game-area').click({ position: { x: 120, y: 150 } })
  await expect(page.locator('.st-hud-score')).toHaveText('1')
  await expect(page.locator('.st-gameover')).toHaveCount(0)
})

test('a round freezes on blur and keyboard focus returns after resume', async ({ page }) => {
  await page.goto('/game/fruit-slash')
  await page.getByRole('button', { name: '시작', exact: true }).click()
  await page.clock.runFor(1100)
  const remaining = Number(await page.locator('.fs-time').textContent())
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.clock.runFor(10000)
  await expect(page.locator('.fs-time')).toHaveText(String(remaining))
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: '게임 목록으로', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: '계속하기' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('.game-content')).toBeFocused()
  await page.clock.runFor(2000)
  expect(Number(await page.locator('.fs-time').textContent())).toBeLessThan(remaining)
})

test('scrolling to a game at the end of the home grid opens it at the top', async ({ page }) => {
  await page.goto('/')
  await page.clock.runFor(500)
  await page.locator('.game-card').last().click()
  await expect(page.locator('.session-toolbar')).toBeInViewport()
  expect(await page.evaluate(() => scrollY)).toBe(0)
})

test('all games still open when persistent storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('Storage blocked') }
    Storage.prototype.setItem = () => { throw new Error('Storage blocked') }
  })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  for (const game of games) {
    await page.goto(`/game/${game.id}`)
    await expect(page.locator('.game-loading')).toHaveCount(0)
    await expect(page.locator('.game-content')).not.toBeEmpty()
  }
  expect(errors).toEqual([])
})

test('reduced motion keeps the home grid and game start visible', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.clock.runFor(500)
  await expect(page.locator('.game-card').first()).toHaveCSS('opacity', '1')
  await page.goto('/game/tetris')
  await page.getByRole('button', { name: '게임 시작', exact: true }).click()
  await expect(page.locator('.tt-cell')).not.toHaveCount(0)
})

test('coding commands reset when replaying the same level', async ({ page }) => {
  await page.goto('/game/code-adventure')
  await page.getByRole('button', { name: /시작하기/ }).click()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowDown')
  await expect(page.locator('.ca-command-item')).toHaveCount(2)
  await page.getByRole('button', { name: '레벨 선택 메뉴', exact: true }).click()
  await page.getByRole('button', { name: /시작하기/ }).click()
  await expect(page.locator('.ca-command-item')).toHaveCount(0)
})
