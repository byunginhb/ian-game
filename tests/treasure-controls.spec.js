import { test, expect } from '@playwright/test'
import { BACKUP_KEY, SAVE_KEY, MAP, emptyProgress, hazardsFor, heartsFor, sceneryFor } from '../src/lib/treasureKingdom.js'

async function enter(page, position = MAP.spawn) {
  await page.addInitScript(({ key, backup, progress }) => { if (!localStorage.getItem(key)) { localStorage.setItem(key, JSON.stringify(progress)); localStorage.setItem(backup, JSON.stringify(progress)) } }, { key: SAVE_KEY, backup: BACKUP_KEY, progress: { ...emptyProgress(), positions: { 0: position } } })
  await page.goto('/game/treasure-kingdom')
  await page.getByRole('button', { name: '공룡 정글 탐험 시작', exact: true }).click()
  await expect(page.locator('.tk-scene-loading')).toHaveCount(0)
  await expect(page.locator('.tk-canvas-host canvas')).toBeVisible()
  await page.waitForTimeout(700)
}
async function position(page) { return { x: Number(await page.locator('.tk-player-dot').getAttribute('cx')), y: Number(await page.locator('.tk-player-dot').getAttribute('cy')) } }
async function screenPoint(page, target) {
  const player = await position(page), { width, height } = page.viewportSize()
  const zoom = width < 600 ? .96 : Math.max(.94, Math.min(1.2, width / 1250))
  const sx = Math.max(0, Math.min(MAP.width - width / zoom, player.x - width / zoom / 2))
  const sy = Math.max(0, Math.min(MAP.height - height / zoom, player.y - 45 - height / zoom / 2))
  return { x: (target.x - sx) * zoom, y: (target.y - sy) * zoom }
}

test('tap, held pointer, drag steering, release and pause keep direct movement predictable', async ({ page, isMobile, browserName }, testInfo) => {
  const cdp = isMobile && browserName === 'chromium' ? await page.context().newCDPSession(page) : null
  let pressed = false, pointer = { x: 0, y: 0 }
  const move = async (x, y) => { pointer = { x, y }; if (cdp) { if (pressed) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pointer] }) } else await page.mouse.move(x, y, { steps: 8 }) }
  const down = async () => { pressed = true; if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pointer] }); else await page.mouse.down() }
  const up = async () => { pressed = false; if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); else await page.mouse.up() }
  const errors = []; page.on('pageerror', (error) => errors.push(error.message))
  await enter(page)
  await expect(page.locator('.tk-dpad')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '점프', exact: true })).toHaveText(/점프/)
  await page.getByRole('button', { name: '지도', exact: true }).click()
  const beforeUI = await position(page)
  await page.getByRole('button', { name: '점프', exact: true }).click()
  await page.waitForTimeout(250)
  expect(await position(page)).toEqual(beforeUI)
  const target = await screenPoint(page, { x: beforeUI.x + 125, y: 1100 })
  if (isMobile) await page.touchscreen.tap(target.x, target.y); else await page.mouse.click(target.x, target.y)
  await expect.poll(async () => (await position(page)).x).toBeGreaterThan(beforeUI.x + 95)
  await page.waitForTimeout(600)
  const beforeHold = await position(page), hold = await screenPoint(page, { x: beforeHold.x + 140, y: beforeHold.y })
  await move(hold.x, hold.y); await down()
  await expect.poll(async () => (await position(page)).x).toBeGreaterThan(beforeHold.x + 160)
  const during = await position(page)
  // Drag the captured pointer upward, even though the touch started elsewhere.
  const steering = await screenPoint(page, { x: during.x, y: during.y - 140 })
  await move(steering.x, steering.y)
  await expect.poll(async () => (await position(page)).y).toBeLessThan(during.y - 40)
  await up(); await page.waitForTimeout(250)
  const stopped = await position(page); await page.waitForTimeout(350)
  expect(await position(page)).toEqual(stopped)
  await page.getByRole('button', { name: '게임 일시정지' }).click()
  await page.waitForTimeout(250); expect(await position(page)).toEqual(stopped)
  await page.getByRole('button', { name: /계속하기/ }).click()
  await page.screenshot({ path: testInfo.outputPath('direct-input.png') })
  expect(errors).toEqual([])
})

test('journal hints open and pulse the correct map location without starting movement', async ({ page }, testInfo) => {
  await enter(page)
  const before = await position(page)
  await page.getByRole('button', { name: '보물 수첩', exact: true }).click()
  await page.getByRole('button', { name: '봉인된 정찰 기록 힌트', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('#tk-field-map')).toBeVisible()
  await expect(page.locator('.tk-map-beacon')).toHaveAttribute('data-treasure-id', '0-2')
  await expect(page.locator('.tk-map-target')).toContainText('봉인된 정찰 기록')
  await expect(page.locator('.tk-map-pulse')).toHaveCSS('animation-name', 'tk-map-beacon')
  await page.waitForTimeout(250); expect(await position(page)).toEqual(before)
  await page.screenshot({ path: testInfo.outputPath('hint-map.png') })
  await page.getByRole('button', { name: '보물 위치 추적 해제', exact: true }).click()
  await expect(page.locator('.tk-map-beacon')).toHaveCount(0)
})

test('a visible hazard damages health and a heart restores it while treasure progress remains saved', async ({ page }, testInfo) => {
  test.setTimeout(45000)
  const hazard = hazardsFor(0, 0)[0]
  await enter(page, { x: hazard.x, y: hazard.y })
  await expect(page.locator('.tk-health')).toHaveAttribute('aria-label', '탐사 체력 4/4')
  await page.screenshot({ path: testInfo.outputPath('swamp-idle.png') })
  await expect(page.locator('.tk-health')).toHaveAttribute('aria-label', '탐사 체력 3/4', { timeout: 15000 })
  const heart = heartsFor(0)[0]
  const left = await screenPoint(page, { x: hazard.x - 140, y: hazard.y })
  await page.mouse.move(left.x, left.y); await page.mouse.down()
  await expect(page.locator('.tk-health')).toHaveAttribute('aria-label', '탐사 체력 4/4', { timeout: 10000 })
  await page.mouse.up()
  expect((await position(page)).x).toBeLessThan(heart.x + 45)
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)).collected, SAVE_KEY)).toContain('0-1')
  await page.screenshot({ path: testInfo.outputPath('heart-recovery.png') })
})


test('water accepts saved positions, tap destinations and keyboard movement without detours', async ({ page, isMobile }, testInfo) => {
  const start = { x: 1000, y: 800 }
  await enter(page, start)
  expect(await position(page)).toEqual(start)
  await page.screenshot({ path: testInfo.outputPath('free-water.png') })
  const target = await screenPoint(page, { x: 1090, y: 800 })
  if (isMobile) await page.touchscreen.tap(target.x, target.y); else await page.mouse.click(target.x, target.y)
  await expect.poll(async () => (await position(page)).x).toBeGreaterThan(1080)
  await page.waitForTimeout(250)
  expect(Math.abs((await position(page)).y - start.y)).toBeLessThan(3)
  await page.keyboard.down('ArrowLeft')
  try { await expect.poll(async () => (await position(page)).x).toBeLessThan(970) } finally { await page.keyboard.up('ArrowLeft') }
  await page.waitForTimeout(250)
  const stopped = await position(page)
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)).positions[0], SAVE_KEY)).toEqual(stopped)
  await page.reload()
  await page.getByRole('button', { name: '공룡 정글 탐험 시작', exact: true }).click()
  await expect(page.locator('.tk-scene-loading')).toHaveCount(0)
  await expect.poll(() => position(page)).toEqual(stopped)
})

test('trees allow resuming inside their roots and walking through in either direction', async ({ page }, testInfo) => {
  const tree = sceneryFor(0).find((object) => object.variant !== 2)
  await enter(page, { x: tree.x, y: tree.y })
  expect((await position(page)).x).toBeCloseTo(tree.x, 1)
  await page.screenshot({ path: testInfo.outputPath('free-tree.png') })
  await page.keyboard.down('ArrowRight')
  try { await expect.poll(async () => (await position(page)).x).toBeGreaterThan(tree.x + 65) } finally { await page.keyboard.up('ArrowRight') }
  await page.keyboard.down('ArrowLeft')
  try { await expect.poll(async () => (await position(page)).x).toBeLessThan(tree.x - 65) } finally { await page.keyboard.up('ArrowLeft') }
  expect(Math.abs((await position(page)).y - tree.y)).toBeLessThan(1)
})
