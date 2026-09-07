import { test, expect } from '@playwright/test'
import { games } from '../src/data/games.js'

const starts = {
  'swimming-race': /경기 시작|출발|게임 시작|입수/,
  'lava-castle': /수호 작전 시작/,
  'magic-hanja': /^시작하기$/,
  'tower-defense': /^게임 시작$/,
  'fruit-slash': /^시작$/,
  'star-rescue': /^출동$/,
  'help-me': /^시작하기$/,
  'fortress': /혼자서 도전/,
  'monster-defense': /수비 시작/,
  'suika': /게임 시작/,
  'tetris': /^게임 시작$/,
  'missile-shoot': /^시작하기$/,
  'brick-breaker': /^게임 시작$/,
  'poop-dodge': /생존 시작/,
  'stack-tower': /^게임 시작$/,
  'code-adventure': /시작하기/,
  'word-puzzle': /^게임 시작$/,
  'math-spell': /^게임 시작$/,
}

for (const game of games) {
  test(`${game.id}: start, input, pause, resume and return home`, async ({ page, isMobile }) => {
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => { if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text()) })
    await page.goto(`/game/${game.id}`)
    await expect(page.locator('.game-loading')).toHaveCount(0)
    await expect(page.locator('.session-title')).toContainText(game.title)
    if (game.id === 'swimming-race') await page.getByRole('button', { name: /어린이/ }).click()
    if (starts[game.id]) {
      const start = page.getByRole('button', { name: starts[game.id] }).first()
      await start.click()
      await expect(start).not.toBeVisible()
    }
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowRight')
    if (game.id === 'tetris' && isMobile) await page.getByRole('button', { name: '블록 회전', exact: true }).click()
    const surface = page.locator('.game-content canvas, .bb-game-area, .st-game-area, .sk-playfield, .poop-game-area').first()
    if (await surface.count()) {
      const box = await surface.boundingBox()
      if (box && box.y + 120 < page.viewportSize().height) {
        if (isMobile) await page.touchscreen.tap(box.x + box.width * .6, box.y + 100)
        else { await page.mouse.move(box.x + box.width * .6, box.y + 100); await page.mouse.down(); await page.mouse.up() }
      }
    }
    await page.getByRole('button', { name: '게임 일시정지' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.locator('.game-content')).toHaveAttribute('inert', '')
    await page.getByRole('button', { name: '계속하기' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.locator('.game-content')).toBeFocused()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await page.locator('.session-home').click()
    await expect(page.locator('.game-card')).toHaveCount(19)
    await expect(page.locator('.home-recent')).toContainText(game.title)
    expect(errors).toEqual([])
  })
}

test('home categories and mobile scrolling remain available after playing', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.game-card')).toHaveCount(19)
  await page.getByRole('button', { name: /생각하는 퍼즐/ }).click()
  await expect(page.locator('.game-card')).toHaveCount(4)
  await page.getByRole('button', { name: /모든 게임/ }).click()
  await page.locator('.game-card').last().scrollIntoViewIfNeeded()
  await expect(page.locator('.game-card').last()).toBeInViewport()
  expect(await page.evaluate(() => getComputedStyle(document.body).overflowY)).not.toBe('hidden')
})

test('learning level menus scroll to the last level without clipping the heading', async ({ page }) => {
  await page.goto('/game/math-spell')
  await expect(page.locator('.ms2-menu-title')).toBeInViewport()
  const lastLevel = page.locator('.ms2-level-btn').last()
  await lastLevel.scrollIntoViewIfNeeded()
  await expect(lastLevel).toBeInViewport()
  await lastLevel.click()
  await expect(page.locator('.ms2-menu')).toHaveCount(0)
})

test('portrait defense can buy a tower through full-size controls', async ({ page, isMobile }) => {
  test.skip(!isMobile || page.viewportSize().width > page.viewportSize().height, 'Portrait controls only')
  await page.goto('/game/monster-defense')
  await page.getByRole('button', { name: /수비 시작/ }).click()
  await page.getByLabel('성벽 선택', { exact: true }).selectOption('0')
  const buy = page.getByRole('button', { name: /화살탑/ })
  await expect(buy).toBeInViewport()
  await buy.click()
  await expect(page.locator('.md-slot-filled')).toHaveCount(1)
  await expect(page.locator('.md-mobile-controls')).toContainText('100 G')
})
