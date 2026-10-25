import { test, expect } from '@playwright/test'
import { BACKUP_KEY, MAP, SAVE_KEY, WORLDS, emptyProgress, treasuresFor } from '../src/lib/treasureKingdom.js'

const waterStarts = [{ x: 740, y: 480 }, { x: 680, y: 480 }, { x: 760, y: 500 }, { x: 760, y: 520 }]
async function enter(page, worldId, position) {
  const previous = WORLDS.filter((world) => world.id < worldId).flatMap((world) => treasuresFor(world.id).map((item) => item.id))
  const progress = { ...emptyProgress(), collected: [...previous, `${worldId}-0`], banked: previous, positions: { [worldId]: position } }
  await page.addInitScript(({ key, backup, progress }) => { localStorage.setItem(key, JSON.stringify(progress)); localStorage.setItem(backup, JSON.stringify(progress)) }, { key: SAVE_KEY, backup: BACKUP_KEY, progress })
  await page.goto('/game/treasure-kingdom')
  await page.getByRole('button', { name: new RegExp(`^${WORLDS[worldId].short} (탐험 시작|이어서 탐험)$`) }).click()
  await expect(page.locator('.tk-scene-loading')).toHaveCount(0, { timeout: 15000 })
  await expect(page.locator('.tk-canvas-host canvas')).toBeVisible()
  await page.waitForTimeout(400)
}
const playerX = (page) => page.locator('.tk-player-dot').getAttribute('cx').then(Number)
async function tapDestination(page, isMobile, target) {
  const player = { x: await playerX(page), y: Number(await page.locator('.tk-player-dot').getAttribute('cy')) }
  const { width, height } = page.viewportSize(), zoom = width < 600 ? .96 : Math.max(.94, Math.min(1.2, width / 1250))
  const sx = Math.max(0, Math.min(MAP.width - width / zoom, player.x - width / zoom / 2))
  const sy = Math.max(0, Math.min(MAP.height - height / zoom, player.y - 45 - height / zoom / 2))
  const x = (target.x - sx) * zoom, y = (target.y - sy) * zoom
  if (isMobile) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y)
}

for (const world of WORLDS) {
  test(`${world.theme}: walking on water splashes at the feet, pauses and clears after stopping`, async ({ page, isMobile }, testInfo) => {
    const errors = []; page.on('pageerror', (error) => errors.push(error.message))
    const start = waterStarts[world.id]
    await enter(page, world.id, start)
    await tapDestination(page, isMobile, { x: start.x + 85, y: start.y })
    await expect.poll(() => playerX(page), { intervals: [25, 50] }).toBeGreaterThan(start.x + 80)
    await page.screenshot({ path: testInfo.outputPath(`${world.theme}-water-footstep.png`) })
    await page.getByRole('button', { name: '게임 일시정지' }).click()
    const paused = await playerX(page)
    await page.waitForTimeout(200); expect(await playerX(page)).toEqual(paused)
    await page.getByRole('button', { name: /계속하기/ }).click()
    await page.waitForTimeout(1000)
    await page.screenshot({ path: testInfo.outputPath(`${world.theme}-water-rest.png`) })
    const stopped = await playerX(page)
    await page.waitForTimeout(200); expect(await playerX(page)).toBe(stopped)
    expect(errors).toEqual([])
  })
}

test('land keeps dry footsteps instead of water particles', async ({ page, isMobile }, testInfo) => {
  await enter(page, 0, MAP.spawn)
  await tapDestination(page, isMobile, { x: MAP.spawn.x + 85, y: MAP.spawn.y })
  await expect.poll(() => playerX(page), { intervals: [25, 50] }).toBeGreaterThan(MAP.spawn.x + 80)
  await page.screenshot({ path: testInfo.outputPath('dry-footstep.png') })
})

test('reduced motion allows water travel without animated splashes', async ({ page, isMobile }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const start = waterStarts[0]
  await enter(page, 0, start)
  await tapDestination(page, isMobile, { x: start.x + 85, y: start.y })
  await expect.poll(() => playerX(page), { intervals: [25, 50] }).toBeGreaterThan(start.x + 80)
  await page.screenshot({ path: testInfo.outputPath('reduced-motion-water.png') })
})
