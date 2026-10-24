import { test, expect } from '@playwright/test'
import { SAVE_KEY, BACKUP_KEY, WORLDS, emptyProgress, treasuresFor } from '../src/lib/treasureKingdom.js'

for (const world of WORLDS) {
  test(`${world.theme}: 25 treasures open a central celebration, restore the kingdom and receive cheering citizens`, async ({ page }, testInfo) => {
    test.setTimeout(45000)
    const previous = WORLDS.filter((item) => item.id < world.id).flatMap((item) => treasuresFor(item.id).map((item) => item.id)), items = treasuresFor(world.id)
    const progress = { ...emptyProgress(), collected: [...previous, ...items.slice(1).map((item) => item.id)], banked: previous, positions: { [world.id]: { x: items[0].x - 60, y: items[0].y } } }
    const errors = []; page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript(({ key, backup, value }) => { if (!sessionStorage.getItem('homecoming-seed')) { localStorage.setItem(key, JSON.stringify(value)); localStorage.setItem(backup, JSON.stringify(value)); sessionStorage.setItem('homecoming-seed', 'true') } }, { key: SAVE_KEY, backup: BACKUP_KEY, value: progress })
    await page.goto('/game/treasure-kingdom')
    const enter = () => page.getByRole('button', { name: `${world.short} 이어서 탐험`, exact: true }).click()
    await enter(); await expect(page.locator('.tk-scene-loading')).toHaveCount(0); await page.locator('.tk-canvas-host').focus()
    await page.keyboard.down('ArrowRight')
    await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)).collected, SAVE_KEY)).toContain(items[0].id)
    await page.keyboard.up('ArrowRight')
    await expect(page.locator('.tk-clear-dialog')).toBeVisible({ timeout: 7000 })
    await expect(page.locator('.tk-clear-total')).toContainText('25 / 25')
    const button = page.getByRole('button', { name: /왕국으로 돌아가기/ })
    await expect(button).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('stage-clear.png') })
    if (world.id === 0) { await page.reload(); await enter(); await expect(page.locator('.tk-clear-dialog')).toBeVisible() }
    await button.click()
    const stage = page.locator('.tk-return-stage'), meter = page.getByRole('progressbar', { name: '왕국 복구 연출', exact: true })
    await expect(stage).toHaveAttribute('data-before', String(previous.length))
    await expect(stage).toHaveAttribute('data-after', String(previous.length + 25))
    await expect(page.getByRole('img', { name: '돌아온 탐사자를 환호하며 맞이하는 왕국의 백성들' })).toBeVisible()
    expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).banked.length, SAVE_KEY)).toBe(previous.length + 25)
    await expect.poll(async () => Number(await meter.getAttribute('aria-valuenow'))).toBeGreaterThan(previous.length)
    await page.screenshot({ path: testInfo.outputPath('kingdom-rebuilding.png') })
    await expect(meter).toHaveAttribute('aria-valuenow', String(previous.length + 25), { timeout: 10000 })
    await page.screenshot({ path: testInfo.outputPath('kingdom-welcome.png') })
    await page.getByRole('button', { name: '왕국 확인', exact: true }).click()
    await expect(page.getByRole('progressbar', { name: '왕국 복구', exact: true })).toHaveAttribute('aria-valuenow', String(previous.length + 25))
    if (world.id < 3) await expect(page.getByRole('button', { name: `${WORLDS[world.id + 1].short} 탐험 시작`, exact: true })).toBeEnabled()
    expect(errors).toEqual([])
  })
}
