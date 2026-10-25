import { test, expect } from '@playwright/test'
import { SAVE_KEY, BACKUP_KEY, WORLDS, emptyProgress, missionChallenge, puzzleFor, treasuresFor } from '../src/lib/treasureKingdom.js'

const route = '/game/treasure-kingdom'
async function openGame(page, progress) {
  if (progress) await page.addInitScript(({ key, backup, value }) => {
    if (!sessionStorage.getItem('treasure-seeded')) { localStorage.setItem(key, JSON.stringify(value)); localStorage.setItem(backup, JSON.stringify(value)); sessionStorage.setItem('treasure-seeded', 'true') }
  }, { key: SAVE_KEY, backup: BACKUP_KEY, value: progress })
  await page.goto(route); await expect(page.locator('.tk-worlds')).toBeVisible()
}
async function enter(page, name = '공룡 정글') {
  await page.getByRole('button', { name: new RegExp(`^${name} (탐험 시작|이어서 탐험)$`) }).click()
  await expect(page.locator('.tk-canvas-host canvas')).toBeVisible()
  await expect(page.locator('.tk-scene-loading')).toHaveCount(0)
  await page.locator('.tk-canvas-host').focus()
}
const readSave = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), SAVE_KEY)

test('fullscreen exploration, actual input, immediate save, restoration and reload', async ({ page, isMobile }, testInfo) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message))
  await openGame(page)
  await expect(page.locator('.session-title')).toContainText('이안이의 보물찾기 잘하자')
  await expect(page.getByRole('button', { name: '바다와 섬 잠김', exact: true })).toBeDisabled()
  await page.screenshot({ path: testInfo.outputPath('kingdom-start.png'), fullPage: true })
  await enter(page)
  if (!isMobile && page.viewportSize().width >= 900) expect(await page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true)
  expect(await page.locator('.tk-canvas-host').boundingBox()).toMatchObject({ x: 0, y: 0 })
  if (isMobile) {
    await page.waitForTimeout(700)
    const { width, height } = page.viewportSize(), zoom = .96
    const x = (330 - Math.max(0, 240 - width / zoom / 2)) * zoom
    const y = (1100 - Math.min(1320 - height / zoom, 1065 - height / zoom / 2)) * zoom
    await page.touchscreen.tap(x, y)
    await expect.poll(async () => (await readSave(page))?.collected).toContain('0-0')
  } else {
    await page.keyboard.down('ArrowRight'); await expect.poll(async () => (await readSave(page))?.collected).toContain('0-0'); await page.keyboard.up('ArrowRight')
  }
  await expect(page.locator('.tk-acquisition')).toContainText(treasuresFor(0)[0].name)
  await expect(page.locator('.tk-acquisition')).toContainText('+1')
  await page.screenshot({ path: testInfo.outputPath('treasure-acquisition.png'), fullPage: true })
  await page.getByRole('button', { name: '점프', exact: true }).click()
  await expect(page.locator('.game-content')).toBeFocused()
  const position = Number(await page.locator('.tk-player-dot').getAttribute('cx'))
  await page.keyboard.down('ArrowRight'); await expect.poll(async () => Number(await page.locator('.tk-player-dot').getAttribute('cx'))).toBeGreaterThan(position + 20); await page.keyboard.up('ArrowRight')
  await page.screenshot({ path: testInfo.outputPath('jungle-playing.png'), fullPage: true })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.getByRole('button', { name: /왕국으로/ }).first().click()
  await expect(page.getByRole('dialog')).toContainText('중앙 관문 재가동')
  await page.getByRole('button', { name: '왕국 확인', exact: true }).click()
  await expect(page.getByRole('progressbar', { name: '왕국 복구' })).toHaveAttribute('aria-valuenow', '1')
  await page.reload()
  await expect(page.getByRole('progressbar', { name: '왕국 복구' })).toHaveAttribute('aria-valuenow', '1')
  await enter(page)
  await page.getByRole('button', { name: '보물 수첩', exact: true }).click()
  await expect(page.locator('.tk-journal-grid .is-found')).toHaveCount(1)
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await page.getByRole('button', { name: '게임 일시정지' }).click()
  const paused = await page.locator('.tk-player-dot').getAttribute('cx')
  await page.waitForTimeout(220); expect(await page.locator('.tk-player-dot').getAttribute('cx')).toBe(paused)
  await page.getByRole('button', { name: /계속하기/ }).click()
  expect(errors).toEqual([])
})

for (const index of [3, 11, 17, 20]) {
  const item = treasuresFor(0)[index], puzzle = puzzleFor(item)
  test(`${puzzle.mode}: device requires its real solution and saves completion`, async ({ page }, testInfo) => {
    await openGame(page, { ...emptyProgress(), positions: { 0: { x: item.x, y: item.y } } })
    await enter(page)
    await page.getByRole('button', { name: '장치 조사', exact: true }).click()
    await expect(page.getByRole('dialog')).toContainText(puzzle.question)
    await page.screenshot({ path: testInfo.outputPath(`puzzle-${puzzle.mode}.png`) })
    if (puzzle.mode === 'circuit') {
      await page.getByRole('button', { name: '장치 가동', exact: true }).click()
      await expect(page.getByRole('dialog')).toContainText('전력이 수신부에 도달하지 못했다')
      for (let cell = 0; cell < puzzle.tiles.length; cell++) for (let turn = 0; turn < (4 - puzzle.tiles[cell].turns) % 4; turn++) await page.getByRole('button', { name: `회로 ${cell + 1} 회전`, exact: true }).click()
    }
    if (puzzle.mode === 'sequence') {
      await page.getByRole('button', { name: '관측 신호 재생', exact: true }).click()
      await expect(page.getByRole('button', { name: '관측 신호 재생', exact: true })).toBeEnabled({ timeout: 8000 })
      for (const symbol of puzzle.sequence) await page.getByRole('button', { name: `문양 ${symbol + 1}`, exact: true }).click()
    }
    if (puzzle.mode === 'balance') for (const weight of puzzle.solutionIndices) await page.locator('.tk-weight-buttons button').nth(weight).click()
    if (puzzle.mode === 'route') for (const cell of puzzle.solution.slice(1)) await page.locator('.tk-route-grid button').nth(cell).click()
    if (puzzle.mode !== 'sequence') await page.getByRole('button', { name: '장치 가동', exact: true }).click()
    await expect.poll(async () => (await readSave(page)).collected).toContain(item.id)
    await expect(page.locator('.tk-acquisition')).toContainText(item.name)
    await page.reload(); expect((await readSave(page)).collected).toContain(item.id)
  })
}

test('scan and jump discover hidden and elevated records', async ({ page }) => {
  const hidden = treasuresFor(0)[2]
  await openGame(page, { ...emptyProgress(), positions: { 0: { x: hidden.x, y: hidden.y } } })
  await enter(page)
  expect((await readSave(page))?.collected || []).not.toContain(hidden.id)
  await page.getByRole('button', { name: '탐지 펄스', exact: true }).click()
  await expect.poll(async () => (await readSave(page)).revealed).toContain(hidden.id)
  await expect.poll(async () => (await readSave(page)).collected).toContain(hidden.id)
})

test('elevated records require a real jump and trackpad-style destination clicks move the explorer', async ({ page }, testInfo) => {
  const item = treasuresFor(0)[5]
  await openGame(page, { ...emptyProgress(), positions: { 0: { x: item.x, y: item.y } } })
  await enter(page)
  expect((await readSave(page))?.collected || []).not.toContain(item.id)
  await expect(page.locator('.tk-jump-cue')).toContainText('점프!')
  await page.screenshot({ path: testInfo.outputPath('jump-instruction.png') })
  await page.getByRole('button', { name: '점프', exact: true }).click()
  await expect.poll(async () => (await readSave(page)).collected).toContain(item.id)
  await expect(page.locator('.tk-jump-cue')).toHaveCount(0)
  const before = { x: Number(await page.locator('.tk-player-dot').getAttribute('cx')), y: Number(await page.locator('.tk-player-dot').getAttribute('cy')) }
  const canvas = page.locator('.tk-canvas-host canvas'), box = await canvas.boundingBox()
  await canvas.click({ position: { x: box.width * .67, y: box.height * .45 } })
  await expect.poll(async () => {
    const x = Number(await page.locator('.tk-player-dot').getAttribute('cx')), y = Number(await page.locator('.tk-player-dot').getAttribute('cy'))
    return Math.hypot(x - before.x, y - before.y)
  }).toBeGreaterThan(35)
})

test('a contact explains and saves an accepted mission, with modal keyboard focus intact', async ({ page }) => {
  const item = treasuresFor(0)[4]
  await openGame(page, { ...emptyProgress(), positions: { 0: { x: item.x, y: item.y } } })
  await enter(page)
  await page.getByRole('button', { name: '말 걸기', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText(item.contact)
  await expect(page.getByRole('dialog')).toContainText(item.briefing)
  await expect(page.getByRole('dialog')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await readSave(page)).quests).toContain(item.id)
  await expect(page.locator('.game-content')).toBeFocused()
})

test('site judgment rejects wrong answers, Enter confirms the record, and ordered mission progress persists', async ({ page }) => {
  const item = treasuresFor(0)[4], first = item.targets[0], challenge = missionChallenge(item, 0)
  await openGame(page, { ...emptyProgress(), quests: [item.id], positions: { 0: { x: first.x, y: first.y } } })
  await enter(page)
  expect((await readSave(page)).questItems).toHaveLength(0)
  await page.getByRole('button', { name: '현장 조사', exact: true }).click()
  await page.locator('.tk-mission-choices button').nth((challenge.correct + 1) % challenge.choices.length).click()
  await page.getByRole('button', { name: '현장 판단 확인', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('현장 기록과 일치하지 않는다')
  await page.locator('.tk-mission-choices button').nth(challenge.correct).click()
  await page.getByRole('button', { name: '현장 판단 확인', exact: true }).click()
  await expect(page.getByRole('button', { name: '기록 저장하고 계속', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect.poll(async () => (await readSave(page)).questItems).toEqual([first.id])
  await page.reload(); await enter(page)
  await expect(page.locator('.tk-mission-tracker')).toContainText('관측소 2')
  expect((await readSave(page)).collected).not.toContain(item.id)
})

test('returning with all observations requires decoding their order before awarding a treasure', async ({ page }) => {
  const item = treasuresFor(0)[4], challenge = missionChallenge(item, 3, true)
  await openGame(page, { ...emptyProgress(), quests: [item.id], questItems: item.targets.map((target) => target.id), positions: { 0: { x: item.x, y: item.y } } })
  await enter(page)
  await page.getByRole('button', { name: '말 걸기', exact: true }).click()
  expect((await readSave(page)).collected).not.toContain(item.id)
  await page.locator('.tk-mission-choices button').nth(challenge.correct).click()
  await page.getByRole('button', { name: '현장 판단 확인', exact: true }).click()
  await expect.poll(async () => (await readSave(page)).collected).toContain(item.id)
})

test('guardian telegraphs, exposes its core, escalates and can be defeated', async ({ page }, testInfo) => {
  const collected = treasuresFor(0).slice(0, 10).map((item) => item.id), boss = treasuresFor(0)[12]
  await openGame(page, { ...emptyProgress(), collected, positions: { 0: { x: boss.x + 55, y: boss.y } } })
  await enter(page)
  await page.getByRole('button', { name: '봉인 해제', exact: true }).click()
  await expect(page.locator('.tk-boss-prompt')).toContainText('경고 영역')
  await page.screenshot({ path: testInfo.outputPath('boss-warning.png') })
  await expect(page.getByRole('button', { name: '점프', exact: true })).toHaveCount(0)
  const missile = page.getByRole('button', { name: '미사일', exact: true })
  for (let volley = 0; volley < 3; volley++) {
    if ((await readSave(page)).collected.includes('0-12')) break
    const before = Number(await page.getByRole('progressbar', { name: '수호자 체력' }).getAttribute('aria-valuenow'))
    await missile.focus(); await page.keyboard.down('Space')
    await expect.poll(async () => Number(await page.getByRole('progressbar', { name: '수호자 체력' }).getAttribute('aria-valuenow')), { timeout: 6000 }).toBeLessThan(before)
    await page.keyboard.up('Space')
    await page.waitForTimeout(300)
  }
  await expect.poll(async () => (await readSave(page)).collected).toContain('0-12')
  await expect(page.locator('.tk-acquisition-guardian')).toContainText(boss.name)
})

test('acquisition stays readable during pause and settings preserve dialog focus', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openGame(page); await enter(page)
  await page.keyboard.down('ArrowRight')
  await expect(page.locator('.tk-acquisition')).toBeVisible()
  await page.keyboard.up('ArrowRight')
  await page.getByRole('button', { name: '게임 일시정지' }).click()
  await page.waitForTimeout(2500)
  await expect(page.locator('.tk-acquisition')).toBeAttached()
  await page.getByRole('button', { name: /계속하기/ }).click()
  await expect(page.locator('.tk-acquisition')).toHaveCount(0, { timeout: 4000 })
  await page.getByRole('button', { name: '탐사 설정', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeFocused()
  await page.getByRole('button', { name: '소리 끄기', exact: true }).click()
  await expect(page.getByRole('button', { name: '소리 켜기', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await expect(page.locator('.game-content')).toBeFocused()
})

test('the last returned record restores the kingdom and preserves the ending', async ({ page }, testInfo) => {
  const collected = WORLDS.flatMap((world) => treasuresFor(world.id).map((item) => item.id))
  await openGame(page, { ...emptyProgress(), collected, banked: collected.slice(0, 99) })
  await page.getByRole('button', { name: '보물 1개 전달', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('왕국의 새로운 아침')
  await page.getByRole('button', { name: '왕국 확인', exact: true }).click()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  await page.screenshot({ path: testInfo.outputPath('kingdom-restored.png'), fullPage: true })
  await page.reload(); await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
})

test('save denial is visible while current-session exploration remains playable', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('QuotaExceededError') } })
  await openGame(page); await enter(page)
  await page.keyboard.down('ArrowRight'); await expect(page.locator('.tk-field-count')).toContainText('전체 1/100'); await page.keyboard.up('ArrowRight')
  await expect(page.locator('.tk-save-warning')).toContainText('저장 실패')
})

for (const world of WORLDS) {
  test(`${world.theme}: rendered environment and guardian assets support real exploration`, async ({ page }, testInfo) => {
    const errors = []; page.on('pageerror', (error) => errors.push(error.message))
    const previous = WORLDS.filter((item) => item.id < world.id).flatMap((item) => treasuresFor(item.id).map((record) => record.id)), first = treasuresFor(world.id)[0]
    await openGame(page, { ...emptyProgress(), collected: previous, banked: previous, positions: { [world.id]: { x: first.x - 60, y: first.y } } })
    await enter(page, world.short)
    await page.keyboard.down('ArrowRight'); await expect.poll(async () => (await readSave(page)).collected).toContain(first.id); await page.keyboard.up('ArrowRight')
    await page.screenshot({ path: testInfo.outputPath(`${world.theme}-scene.png`), fullPage: true })
    await expect(page.locator('.tk-field-count')).toContainText('1/25'); expect(errors).toEqual([])
  })
}
