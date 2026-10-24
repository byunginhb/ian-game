import { test, expect } from '@playwright/test'
import { SAVE_KEY, BACKUP_KEY, emptyProgress, treasuresFor } from '../src/lib/treasureKingdom.js'

async function startFight(page) {
  const boss = treasuresFor(0)[12], progress = { ...emptyProgress(), collected: treasuresFor(0).slice(0, 8).map((item) => item.id), positions: { 0: { x: boss.x + 55, y: boss.y } } }
  await page.addInitScript(({ key, backup, value }) => { localStorage.setItem(key, JSON.stringify(value)); localStorage.setItem(backup, JSON.stringify(value)) }, { key: SAVE_KEY, backup: BACKUP_KEY, value: progress })
  await page.goto('/game/treasure-kingdom'); await page.getByRole('button', { name: '공룡 정글 이어서 탐험', exact: true }).click()
  await expect(page.locator('.tk-scene-loading')).toHaveCount(0)
  await page.getByRole('button', { name: '봉인 해제', exact: true }).click()
  await expect(page.getByRole('button', { name: '미사일', exact: true })).toBeVisible()
}
const hp = (page) => page.getByRole('progressbar', { name: '수호자 체력', exact: true })

test('normal missiles auto aim, and pause cancels a held Space charge without firing on resume', async ({ page }) => {
  await startFight(page)
  await expect(page.getByRole('button', { name: '점프', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '미사일', exact: true }).click()
  await expect(hp(page)).toHaveAttribute('aria-valuenow', '11')
  const beforeCharge = await hp(page).getAttribute('aria-valuenow')
  await page.locator('.tk-canvas-host').focus(); await page.keyboard.down('Space')
  await expect.poll(async () => Number(await page.getByRole('progressbar', { name: '미사일 충전' }).getAttribute('aria-valuenow'))).toBeGreaterThan(15)
  await page.getByRole('button', { name: '게임 일시정지' }).click()
  await page.keyboard.up('Space')
  await page.getByRole('button', { name: /계속하기/ }).click()
  await expect(page.getByRole('progressbar', { name: '미사일 충전' })).toHaveAttribute('aria-valuenow', '0')
  await page.waitForTimeout(500)
  await expect(hp(page)).toHaveAttribute('aria-valuenow', beforeCharge)
  await page.getByRole('button', { name: '지도', exact: true }).focus(); await page.keyboard.press('Space')
  await page.waitForTimeout(200); await expect(hp(page)).toHaveAttribute('aria-valuenow', beforeCharge)
  await page.getByRole('button', { name: '미사일', exact: true }).focus(); await page.keyboard.press('Enter')
  await expect.poll(async () => Number(await hp(page).getAttribute('aria-valuenow'))).toBeLessThan(Number(beforeCharge))
})

test('holding the missile button fires one charged special and a defeated guardian preserves its reward', async ({ page, browserName, isMobile }, testInfo) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message))
  await startFight(page)
  const button = page.getByRole('button', { name: '미사일', exact: true })
  const cdp = isMobile && browserName === 'chromium' ? await page.context().newCDPSession(page) : null
  const box = await button.boundingBox(), point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const down = async () => { if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] }); else { await page.mouse.move(point.x, point.y); await page.mouse.down() } }
  const up = async () => { if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); else await page.mouse.up() }
  await down()
  await expect.poll(async () => Number(await page.getByRole('progressbar', { name: '미사일 충전' }).getAttribute('aria-valuenow'))).toBeGreaterThan(40)
  await page.screenshot({ path: testInfo.outputPath('charging-special.png') })
  await expect.poll(async () => Number(await hp(page).getAttribute('aria-valuenow'))).toBeLessThanOrEqual(7)
  await up(); await page.screenshot({ path: testInfo.outputPath('special-impact.png') })
  const before = await hp(page).getAttribute('aria-valuenow')
  await page.waitForTimeout(300); await expect(hp(page)).toHaveAttribute('aria-valuenow', before)
  for (let volley = 0; volley < 3; volley++) {
    if (await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).collected.includes('0-12'), SAVE_KEY)) break
    const before = Number(await hp(page).getAttribute('aria-valuenow'))
    await down()
    await expect.poll(async () => Number(await hp(page).getAttribute('aria-valuenow')), { timeout: 6000 }).toBeLessThan(before)
    await up(); await page.waitForTimeout(120)
  }
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)).collected, SAVE_KEY)).toContain('0-12')
  await expect(page.locator('.tk-boss-prompt')).toContainText('수호자 격파')
  await page.screenshot({ path: testInfo.outputPath('guardian-collapse.png') })
  await expect(page.locator('.tk-acquisition-guardian')).toBeVisible()
  expect(errors).toEqual([])
})
