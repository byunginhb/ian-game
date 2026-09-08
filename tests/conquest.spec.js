import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => { await page.clock.install() })

async function start(page) {
  await page.goto('/game/conquest')
  await page.getByRole('button', { name: '아이 모드로 시작', exact: true }).click()
  await page.getByRole('button', { name: '1탄 출정하기' }).click()
  await expect(page.locator('.ct-land')).toHaveCount(12)
}

async function center(land) {
  return land.evaluate((element) => {
    const label = element.querySelector('.ct-troop-count'), box = label.getBoundingClientRect()
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  })
}

test('six teams, sequential locks, returning team progress and narrow layout', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/game/conquest')
  await page.getByRole('button', { name: '아이 모드로 시작', exact: true }).click()
  await expect(page.locator('.ct-team-card')).toHaveCount(6)
  for (const name of ['로이드', '소닉', '마리오', '대마왕', '손오공', '아이언맨']) await expect(page.locator('.ct-team-card').getByRole('img', { name, exact: true })).toBeVisible()
  await page.getByRole('button', { name: '소닉팀, 소닉', exact: true }).click()
  await expect(page.getByRole('button', { name: '소닉팀, 소닉', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.locator('.ct-level-picker summary').click()
  await expect(page.getByRole('button', { name: '2탄, 잠김', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: '1탄', exact: true }).click()
  await page.getByRole('button', { name: '1탄 출정하기' }).click()
  await expect(page.locator('.ct-land[data-owner="1"]')).toHaveCount(1)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.reload()
  await page.getByRole('button', { name: '아이 모드로 시작', exact: true }).click()
  await expect(page.getByRole('button', { name: '소닉팀, 소닉', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(errors).toEqual([])
})

test('dragging sends a distinct army, captures land, and retry resets the round', async ({ page }) => {
  await start(page)
  const from = page.locator('.ct-land[data-owner="0"]').first(), to = page.locator('.ct-land[data-owner="-1"]').first()
  const targetId = await to.getAttribute('data-land')
  await from.scrollIntoViewIfNeeded()
  const a = await center(from), b = await center(to)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 8 })
  await expect(page.locator('.ct-land-target')).toHaveCount(1)
  await page.mouse.up()
  await expect(page.locator('.ct-fleet[data-owner="0"]')).toHaveCount(1)
  await expect(page.locator('.ct-map-notice')).toContainText('출발!')
  await page.clock.runFor(7500)
  await expect(page.locator(`[data-land="${targetId}"]`)).toHaveAttribute('data-owner', '0')
  await expect(page.getByTestId('ct-owned')).toHaveText('2')
  await page.getByRole('button', { name: '이번 탄 다시 시작' }).click()
  await expect(page.getByTestId('ct-owned')).toHaveText('1')
  await expect(page.locator('.ct-fleet')).toHaveCount(0)
  await expect(page.locator('.ct-battle-clock')).toContainText('0:00')
})

test('tap or keyboard orders work, pause and help freeze production', async ({ page, isMobile }) => {
  await start(page)
  const from = page.locator('.ct-land[data-owner="0"]').first(), to = page.locator('.ct-land[data-owner="-1"]').first()
  if (isMobile) {
    await from.tap()
    await to.tap()
  } else {
    await from.focus(); await page.keyboard.press('Enter')
    await to.focus(); await page.keyboard.press('Enter')
  }
  await expect(page.locator('.ct-fleet[data-owner="0"]')).toHaveCount(1)
  await page.getByRole('button', { name: '놀이 방법' }).click()
  const time = await page.locator('.ct-battle-clock').textContent()
  const troops = await from.getAttribute('data-troops')
  await page.clock.runFor(6000)
  await expect(from).toHaveAttribute('data-troops', troops)
  await expect(page.locator('.ct-battle-clock')).toHaveText(time)
  await page.getByRole('button', { name: '알겠어요' }).click()
  await page.getByRole('button', { name: '게임 일시정지' }).click()
  await page.clock.runFor(6000)
  await expect(page.locator('.ct-battle-clock')).toHaveText(time)
  await page.getByRole('button', { name: '계속하기' }).click()
  await page.clock.runFor(2000)
  await expect(page.locator('.ct-battle-clock')).not.toHaveText(time)
})

test('cancelled and outside drops never send troops', async ({ page }) => {
  await start(page)
  const from = page.locator('.ct-land[data-owner="0"]').first()
  const a = await center(from)
  await page.mouse.move(a.x, a.y); await page.mouse.down()
  await page.mouse.move(2, 2, { steps: 3 }); await page.mouse.up()
  await expect(page.locator('.ct-fleet')).toHaveCount(0)
  await expect(page.locator('.ct-land-selected')).toHaveCount(0)
  await page.mouse.move(a.x, a.y); await page.mouse.down()
  await from.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', isPrimary: true })
  await page.mouse.up()
  await expect(page.locator('.ct-fleet')).toHaveCount(0)
})

test('all soldiers march in five-person waves with no moving counts or ratio controls', async ({ page }) => {
  await start(page)
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  await expect(page.getByRole('group', { name: '출정 비율' })).toHaveCount(0)
  const from = page.locator('.ct-land[data-owner="0"]').first(), to = page.locator('.ct-land[data-owner="-1"]').first()
  const troops = Number(await from.getAttribute('data-troops'))
  await from.focus(); await page.keyboard.press('Enter')
  await to.focus(); await page.keyboard.press('Enter')
  const fleet = page.locator('.ct-fleet[data-owner="0"]').first()
  await expect(fleet).toHaveAttribute('data-dispatched', String(troops))
  await expect(from).toHaveAttribute('data-troops', '0')
  await expect(fleet.locator('text')).toHaveCount(0)
  await expect(fleet.locator('.ct-soldier')).toHaveCount(5)
  await page.clock.runFor(200)
  await expect(fleet.locator('.ct-soldier')).toHaveCount(5)
  await page.clock.runFor(200)
  await expect(fleet.locator('.ct-soldier')).toHaveCount(10)
  const seen = new Set()
  for (let tick = 0; tick < 48; tick++) {
    if (!await fleet.count()) break
    const soldiers = await fleet.locator('.ct-soldier').evaluateAll((elements) => elements.map((element) => ({ id: Number(element.dataset.soldier), wave: element.dataset.wave })))
    for (const soldier of soldiers) seen.add(soldier.id)
    const waves = new Map()
    for (const soldier of soldiers) waves.set(soldier.wave, (waves.get(soldier.wave) || 0) + 1)
    expect([...waves.values()].every((count) => count <= 5)).toBe(true)
    await page.clock.runFor(250)
  }
  expect(seen.size).toBe(troops)
  await expect(page.locator('.ct-fleet text')).toHaveCount(0)
})

test('dropping in the sea inside the board cancels the order', async ({ page }) => {
  await start(page)
  const from = page.locator('.ct-land[data-owner="0"]').first()
  await from.scrollIntoViewIfNeeded()
  const a = await center(from)
  const sea = await page.locator('.ct-map').evaluate((svg) => {
    const point = svg.createSVGPoint()
    point.x = 20; point.y = 20
    const screen = point.matrixTransform(svg.getScreenCTM())
    return { x: screen.x, y: screen.y }
  })
  await page.mouse.move(a.x, a.y); await page.mouse.down()
  await page.mouse.move(sea.x, sea.y, { steps: 5 }); await page.mouse.up()
  await expect(page.locator('.ct-fleet')).toHaveCount(0)
  await expect(page.locator('.ct-land-selected')).toHaveCount(0)
})

test('saved stages unlock per faction, including all 36 lands in the finale', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ian-conquest-v1', JSON.stringify({ selected: 3, cleared: [0, 0, 0, 19, 0, 0], stars: { '3-19': 2 } })))
  await page.goto('/game/conquest')
  await page.getByRole('button', { name: '아이 모드로 시작', exact: true }).click()
  await page.getByRole('button', { name: '20탄 출정하기' }).click()
  await expect(page.locator('.ct-land')).toHaveCount(36)
  await expect(page.locator('.ct-land[data-owner="3"]')).toHaveCount(1)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.getByRole('button', { name: '팀 · 모험 고르기' }).filter({ visible: true }).click()
  await page.getByRole('button', { name: '닌자고팀, 로이드', exact: true }).click()
  await expect(page.getByRole('button', { name: '1탄 출정하기' })).toBeVisible()
})

test('winning through real controls unlocks the next stage and persists across reloads', async ({ page }) => {
  test.setTimeout(60000)
  await start(page)
  // Read the visible board and issue the same two-key orders available to a player.
  // No simulation state injection or special production test hooks.
  for (let second = 0; second < 150; second++) {
    if (await page.locator('.ct-result-overlay').count()) break
    const snapshot = await page.locator('.ct-land').evaluateAll((elements) => elements.map((element) => {
      const center = element.querySelector('g[transform]').transform.baseVal.getItem(0).matrix
      return { id: Number(element.dataset.land), owner: Number(element.dataset.owner), troops: Number(element.dataset.troops), x: center.e, y: center.f }
    }))
    const traveling = new Set(await page.locator('.ct-fleet[data-owner="0"]').evaluateAll((elements) => elements.map((element) => Number(element.dataset.target))))
    for (const from of snapshot.filter((land) => land.owner === 0 && land.troops > 12)) {
      const target = snapshot.filter((land) => land.owner !== 0 && !traveling.has(land.id) && from.troops > land.troops * (land.owner === 5 ? 1.2 : 1) + 5).sort((a, b) => Math.hypot(from.x - a.x, from.y - a.y) + a.troops * 3 - Math.hypot(from.x - b.x, from.y - b.y) - b.troops * 3)[0]
      if (!target) continue
      await page.locator(`[data-land="${from.id}"]`).focus(); await page.keyboard.press('Enter')
      await page.locator(`[data-land="${target.id}"]`).focus(); await page.keyboard.press('Enter')
      traveling.add(target.id)
    }
    await page.clock.runFor(1000)
  }
  await expect(page.getByRole('heading', { name: '내가 다 먹었다!', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '2탄으로 출발' })).toBeFocused()
  await page.getByRole('button', { name: '2탄으로 출발' }).click()
  await expect(page.locator('.ct-land')).toHaveCount(13)
  await page.reload()
  await page.getByRole('button', { name: '아이 모드로 시작', exact: true }).click()
  await expect(page.getByRole('button', { name: '2탄 출정하기' })).toBeVisible()
  await page.getByRole('button', { name: '소닉팀, 소닉', exact: true }).click()
  await expect(page.getByRole('button', { name: '1탄 출정하기' })).toBeVisible()
})
