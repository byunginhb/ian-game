import { test, expect } from '@playwright/test'
import { BACKUP_KEY, SAVE_KEY, WORLDS, emptyProgress, missionChallenge, treasuresFor } from '../src/lib/treasureKingdom.js'
const read = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), SAVE_KEY)
async function enter(page, item, step = 1) {
  const previous = WORLDS.filter((world) => world.id < item.worldId).flatMap((world) => treasuresFor(world.id).map((treasure) => treasure.id))
  const progress = { ...emptyProgress(), collected: previous, banked: previous, quests: [item.id], questItems: item.targets.slice(0, step).map((target) => target.id), positions: { [item.worldId]: item.targets[step] } }
  await page.addInitScript(({ key, backup, value }) => { if (!sessionStorage.getItem('mission-puzzle-seeded')) { localStorage.setItem(key, JSON.stringify(value)); localStorage.setItem(backup, JSON.stringify(value)); sessionStorage.setItem('mission-puzzle-seeded', 'true') } }, { key: SAVE_KEY, backup: BACKUP_KEY, value: progress })
  await page.goto('/game/treasure-kingdom')
  await page.getByRole('button', { name: new RegExp(`^${WORLDS[item.worldId].short} (탐험 시작|이어서 탐험)$`) }).click()
  await expect(page.locator('.tk-scene-loading')).toHaveCount(0, { timeout: 15000 })
  await page.getByRole('button', { name: '현장 조사', exact: true }).click()
}
async function confirmRecord(page, item, step) {
  await expect(page.getByRole('button', { name: '기록 저장하고 계속', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect.poll(async () => (await read(page)).questItems).toContain(item.targets[step].id)
  expect((await read(page)).collected).not.toContain(item.id)
}

test('4x4 nonogram supports clues, mistakes, X notes, one-cell help, reset and Enter confirmation', async ({ page }, testInfo) => {
  const item = treasuresFor(0)[4], puzzle = missionChallenge(item, 1), errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await enter(page, item)
  await expect(page.locator('.tk-picture-cell')).toHaveCount(16)
  await page.getByRole('button', { name: '정답 확인', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('아직 단서와 맞지 않는 줄')
  await page.getByRole('button', { name: '한 칸 도움', exact: true }).click()
  await expect(page.locator('.tk-picture-cell.is-helped')).toHaveCount(1)
  await page.getByRole('button', { name: '퍼즐 초기화', exact: true }).click()
  await expect(page.locator('.tk-picture-cell.is-filled')).toHaveCount(0)
  const cells = page.locator('.tk-picture-cell'), empty = puzzle.solution.indexOf(0)
  await cells.nth(empty).click(); await cells.nth(empty).click(); await expect(cells.nth(empty)).toHaveText('×')
  for (const [index, value] of puzzle.solution.entries()) if (value) await cells.nth(index).click()
  await expect(page.locator('.tk-nonogram-row.is-complete')).toHaveCount(4)
  await expect(page.locator('.tk-nonogram-column.is-complete')).toHaveCount(4)
  await page.screenshot({ path: testInfo.outputPath('nonogram-4x4.png') })
  await cells.nth(0).focus(); await page.keyboard.press('ArrowRight'); await expect(cells.nth(1)).toBeFocused()
  await page.keyboard.press('Enter'); await confirmRecord(page, item, 1)
  await page.reload(); expect((await read(page)).questItems).toContain(item.targets[1].id)
  expect(errors).toEqual([])
})

test('3x3 sudoku keeps fixed clues and supports correcting duplicates, keypad, keyboard and help', async ({ page }, testInfo) => {
  const item = treasuresFor(0)[15], puzzle = missionChallenge(item, 1)
  await enter(page, item)
  const cells = page.locator('.tk-sudoku-board button'), fixed = puzzle.givens.findIndex(Boolean), blanks = puzzle.givens.map((value, index) => value ? -1 : index).filter((index) => index >= 0)
  await expect(cells).toHaveCount(9)
  await cells.nth(fixed).focus(); await page.keyboard.press(String(puzzle.givens[fixed] % 3 + 1))
  await expect(cells.nth(fixed)).toHaveText(String(puzzle.givens[fixed]))
  for (const index of blanks) { await cells.nth(index).click(); await page.getByRole('button', { name: '숫자 1 입력', exact: true }).click() }
  await page.getByRole('button', { name: '정답 확인', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('겹치는 숫자')
  expect(await page.locator('.tk-sudoku-board .has-conflict').count()).toBeGreaterThan(0)
  expect((await read(page)).questItems).not.toContain(item.targets[1].id)
  await page.getByRole('button', { name: '한 칸 도움', exact: true }).click()
  await expect(page.locator('.tk-sudoku-board .is-helped')).toHaveCount(1)
  await page.getByRole('button', { name: '퍼즐 초기화', exact: true }).click()
  for (const index of blanks) { await cells.nth(index).click(); await page.getByRole('button', { name: `숫자 ${puzzle.solution[index]} 입력`, exact: true }).click() }
  await cells.nth(blanks[0]).click(); await page.getByRole('button', { name: '선택한 숫자 지우기', exact: true }).click(); await expect(cells.nth(blanks[0])).toHaveText('·')
  await cells.nth(blanks[0]).focus(); await page.keyboard.press(String(puzzle.solution[blanks[0]]))
  await page.screenshot({ path: testInfo.outputPath('sudoku-3x3.png') })
  await page.keyboard.press('Enter'); await confirmRecord(page, item, 1)
})

test('the later 5x5 nonogram remains readable and the one-cell aid can finish a stuck picture', async ({ page }, testInfo) => {
  const item = treasuresFor(2)[4], puzzle = missionChallenge(item, 1)
  await enter(page, item)
  await expect(page.locator('.tk-picture-cell')).toHaveCount(25)
  await page.getByText('숫자 읽는 방법', { exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('한 칸씩 두 묶음')
  for (let i = 0; i < puzzle.solution.filter(Boolean).length; i++) await page.getByRole('button', { name: '한 칸 도움', exact: true }).click()
  await page.getByRole('button', { name: '한 칸 도움', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('모두 완성했어요')
  await page.screenshot({ path: testInfo.outputPath('nonogram-5x5-help.png') })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.getByRole('button', { name: '정답 확인', exact: true }).click(); await confirmRecord(page, item, 1)
})

test('the first mission uses a short school-level sum with optional help and gentle retries', async ({ page }, testInfo) => {
  const item = treasuresFor(0)[4], challenge = missionChallenge(item, 0)
  await enter(page, item, 0)
  await expect(page.getByRole('dialog')).toContainText('10 + 6 = ?')
  await page.locator('.tk-mission-choices button').nth((challenge.correct + 1) % 3).click()
  await page.getByRole('button', { name: '현장 판단 확인', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('한 번 더 생각해 볼까요?')
  await page.getByRole('button', { name: '도움말 보기', exact: true }).click()
  await expect(page.locator('.tk-mission-help')).toContainText('6만큼 더 세어')
  await page.screenshot({ path: testInfo.outputPath('simple-mission-calculation.png') })
  await page.locator('.tk-mission-choices button').nth(challenge.correct).click()
  await page.getByRole('button', { name: '현장 판단 확인', exact: true }).click(); await confirmRecord(page, item, 0)
})
