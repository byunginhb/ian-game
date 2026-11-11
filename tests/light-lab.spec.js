import { test, expect } from '@playwright/test'
import { LEVELS } from '../src/lib/lightLabLevels.js'

const width = (level) => level.rows[0].split(' ').length

/** 키보드 커서를 (0,0)에서 시작해 주어진 칸으로 옮기고 거울을 원하는 방향이 될 때까지 누른다. */
async function placeMirrors(page, level, entries) {
  await page.keyboard.press('ArrowLeft')
  let cx = 0, cy = 0
  for (const [index, mirror] of entries) {
    const x = index % width(level), y = Math.floor(index / width(level))
    for (; cx < x; cx++) await page.keyboard.press('ArrowRight')
    for (; cx > x; cx--) await page.keyboard.press('ArrowLeft')
    for (; cy < y; cy++) await page.keyboard.press('ArrowDown')
    for (; cy > y; cy--) await page.keyboard.press('ArrowUp')
    for (let i = 0; i < mirror; i++) await page.keyboard.press('Space')
  }
}

test.describe('light lab', () => {
  // GPU 없는 테스트 환경에서는 3D 준비와 프레임이 느리다.
  test.setTimeout(60000)
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { if (!sessionStorage.getItem('ll-seeded')) { localStorage.removeItem('ian-light-lab-v1'); sessionStorage.setItem('ll-seeded', '1') } })
    await page.goto('/game/light-lab')
    await expect(page.locator('.game-loading')).toHaveCount(0, { timeout: 15000 })
    await expect(page.locator('.ll-canvas')).toBeAttached()
  })

  test('the first experiment opens with its note and later ones stay locked', async ({ page }) => {
    await expect(page.getByRole('button', { name: '실험 2 잠김', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: '실험 1 시작', exact: true }).click()
    await expect(page.locator('.ll-note')).toContainText('들어온 각도')
    await page.getByRole('button', { name: '실험 시작' }).click()
    await expect(page.locator('.ll-note')).toHaveCount(0)
    await expect(page.locator('.ll-status')).toContainText('1개 중 0개')
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  })

  test('placing the recorded mirrors lights the crystal, saves the marks and unlocks the next experiment', async ({ page }) => {
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    const level = LEVELS[0]
    await page.getByRole('button', { name: '실험 1 시작', exact: true }).click()
    await page.getByRole('button', { name: '실험 시작' }).click()
    await placeMirrors(page, level, level.solution)
    await expect(page.locator('.ll-play')).toHaveAttribute('data-solved', 'true')
    const report = page.locator('.ll-note')
    // 결과 쪽지는 게임 시계로 1.1초 뒤에 뜬다. GPU 없는 테스트 환경은 프레임이 느려 그 시간이 길어진다.
    await expect(report).toContainText('실험 1 성공', { timeout: 20000 })
    await expect(report.locator('.ll-report-goals li').nth(0)).toHaveClass(/is-done/)
    await expect(report.locator('.ll-report-goals li').nth(2)).toHaveClass(/is-done/)
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ian-light-lab-v1')).marks[0] & 5)).toBe(5)
    await report.getByRole('button', { name: '목록' }).click()
    await expect(page.getByRole('button', { name: '실험 2 시작', exact: true })).toBeEnabled()
    expect(errors).toEqual([])
  })

  test('the tray runs out, and undo and clear give mirrors back', async ({ page }) => {
    const level = LEVELS[0]
    const empties = level.rows.flatMap((row, y) => row.split(' ').map((token, x) => [token, y * width(level) + x])).filter(([token]) => token === '..').map(([, index]) => index)
    await page.getByRole('button', { name: '실험 1 시작', exact: true }).click()
    await page.getByRole('button', { name: '실험 시작' }).click()
    await placeMirrors(page, level, empties.filter((index) => !level.solution.some(([spot]) => spot === index)).slice(0, level.mirrors + 1).map((index) => [index, 1]))
    await expect(page.locator('.ll-tray')).toHaveAttribute('aria-label', '남은 거울 0개')
    await expect(page.locator('.ll-toast')).toContainText('거울을 다 썼어요')
    await page.getByRole('button', { name: '되돌리기' }).click()
    await expect(page.locator('.ll-tray')).toHaveAttribute('aria-label', '남은 거울 1개')
    await page.getByRole('button', { name: '모두 치우기' }).click()
    await expect(page.locator('.ll-tray')).toHaveAttribute('aria-label', `남은 거울 ${level.mirrors}개`)
  })
})
