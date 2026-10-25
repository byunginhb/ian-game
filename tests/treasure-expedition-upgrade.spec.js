import { test, expect } from '@playwright/test'
import { SAVE_KEY, BACKUP_KEY, emptyProgress, treasuresFor, missionChallenge } from '../src/lib/treasureKingdom.js'

const readSave = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), SAVE_KEY)
async function enter(page, progress) {
  await page.addInitScript(({ key, backup, value }) => {
    if (!sessionStorage.getItem('upgrade-seed')) { localStorage.setItem(key, JSON.stringify(value)); localStorage.setItem(backup, JSON.stringify(value)); sessionStorage.setItem('upgrade-seed', 'true') }
  }, { key: SAVE_KEY, backup: BACKUP_KEY, value: progress })
  await page.goto('/game/treasure-kingdom')
  await page.getByRole('button', { name: /^공룡 정글 (탐험 시작|이어서 탐험)$/ }).click()
  await expect(page.locator('.tk-scene-loading')).toHaveCount(0)
}

test('relay timing uses the live signal, Enter saves its record, and the mission log tracks the next site', async ({ page }, testInfo) => {
  const item = treasuresFor(0)[8], target = item.targets[0], challenge = missionChallenge(item, 0)
  await enter(page, { ...emptyProgress(), quests: [item.id], positions: { 0: target } })
  await page.getByRole('button', { name: '현장 조사', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeFocused()
  await page.waitForFunction(({ center, width }) => Math.abs(parseFloat(document.querySelector('.tk-relay-meter i')?.style.left) - center) < width / 4, challenge)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: '기록 저장하고 계속', exact: true })).toBeFocused()
  await page.screenshot({ path: testInfo.outputPath('relay-record-confirm.png') })
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await readSave(page)).questItems).toContain(target.id)
  await page.getByRole('button', { name: '보물 수첩', exact: true }).click()
  await page.getByRole('button', { name: '현장 임무', exact: true }).click()
  await expect(page.locator('.tk-mission-log')).toContainText(`기록 ${target.code}`)
  await page.getByRole('button', { name: '다음 현장 추적', exact: true }).click()
  await expect(page.locator('.tk-map-beacon')).toHaveAttribute('data-treasure-id', item.targets[1].id)
  await expect(page.locator('.tk-map-target')).toContainText('중계기 2')
})

test('a rescued companion must be reported to the contact and completion survives reload', async ({ page }, testInfo) => {
  const item = treasuresFor(0)[15]
  await enter(page, { ...emptyProgress(), quests: [item.id], questItems: item.targets.map((target) => target.id), positions: { 0: item } })
  expect((await readSave(page)).collected).not.toContain(item.id)
  await page.screenshot({ path: testInfo.outputPath('rescue-companion.png') })
  await page.getByRole('button', { name: '말 걸기', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('구출 대원이 안전 지점에 도착했다')
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await readSave(page)).collected).toContain(item.id)
  await page.reload()
  expect((await readSave(page)).collected).toContain(item.id)
})

test('boss warnings release animated water, fire and lightning attacks without runtime errors', async ({ page }, testInfo) => {
  test.setTimeout(45000)
  const item = treasuresFor(0)[12], errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await enter(page, { ...emptyProgress(), collected: treasuresFor(0).slice(0, 10).map((item) => item.id), positions: { 0: { x: item.x + 55, y: item.y } } })
  await page.getByRole('button', { name: '봉인 해제', exact: true }).click()
  for (const element of ['water', 'fire', 'electric']) {
    await expect(page.locator(`.tk-boss-hud .tk-element-${element}`)).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.tk-boss-prompt')).toContainText('공격 진행 중', { timeout: 10000 })
    await page.screenshot({ path: testInfo.outputPath(`${element}-attack.png`) })
    await expect(page.locator('.tk-boss-prompt')).toContainText('코어 노출', { timeout: 5000 })
  }
  expect(errors).toEqual([])
})

test('the final guardian collapses, releases the last three treasures and leads to kingdom restoration', async ({ page }, testInfo) => {
  test.setTimeout(45000)
  const items = treasuresFor(0), item = items[24], errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await enter(page, { ...emptyProgress(), collected: items.slice(0, 22).map((item) => item.id), positions: { 0: { x: item.x + 55, y: item.y } } })
  await expect(page.locator('.tk-field-count')).toContainText('22/25')
  await page.getByRole('button', { name: '봉인 해제', exact: true }).click()
  await expect(page.getByRole('progressbar', { name: '수호자 체력' })).toHaveAttribute('aria-valuemax', '24')
  const missile = page.getByRole('button', { name: '미사일', exact: true })
  for (let volley = 0; volley < 6; volley++) {
    if ((await readSave(page)).collected.length === 25) break
    const before = Number(await page.getByRole('progressbar', { name: '수호자 체력' }).getAttribute('aria-valuenow'))
    await missile.focus(); await page.keyboard.down('Space')
    await expect.poll(async () => Number(await page.getByRole('progressbar', { name: '수호자 체력' }).getAttribute('aria-valuenow')), { timeout: 6000 }).toBeLessThan(before)
    await page.keyboard.up('Space'); await page.waitForTimeout(120)
  }
  await expect.poll(async () => (await readSave(page)).collected).toHaveLength(25)
  await expect(page.locator('.tk-boss-prompt')).toContainText('수호자 격파')
  await page.waitForTimeout(450)
  await page.screenshot({ path: testInfo.outputPath('final-body-treasure-release.png') })
  await expect(page.locator('.tk-acquisition')).toContainText('+3', { timeout: 6000 })
  await page.screenshot({ path: testInfo.outputPath('final-three-treasures.png') })
  await expect(page.locator('.tk-clear-dialog')).toBeVisible({ timeout: 6000 })
  await page.getByRole('button', { name: /왕국으로 돌아가기/ }).click()
  await expect(page.locator('.tk-return-stage')).toHaveAttribute('data-after', '25')
  await expect(page.getByRole('img', { name: '돌아온 탐사자를 환호하며 맞이하는 왕국의 백성들' })).toBeVisible()
  expect((await readSave(page)).banked).toHaveLength(25)
  expect(errors).toEqual([])
})


test('previous final-boss victories receive missing rewards without losing saved progress', async ({ page }) => {
  const items = treasuresFor(0), collected = items.filter((item) => ![22, 23].includes(item.index)).map((item) => item.id)
  await enter(page, { ...emptyProgress(), collected, banked: collected, positions: { 0: items[0] } })
  await expect(page.locator('.tk-clear-dialog')).toBeVisible()
  await page.getByRole('button', { name: /왕국으로 돌아가기/ }).click()
  await expect(page.locator('.tk-return-stage')).toHaveAttribute('data-before', '23')
  await expect(page.locator('.tk-return-stage')).toHaveAttribute('data-after', '25')
  expect((await readSave(page)).collected).toHaveLength(25)
  expect((await readSave(page)).banked).toHaveLength(25)
})
