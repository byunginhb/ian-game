import { test, expect } from '@playwright/test'

async function startSong(page, mode = '아이') {
  await page.goto('/game/rhythm-party')
  await page.getByRole('button', { name: new RegExp(`^${mode}`) }).click()
  await expect(page.locator('.rp-song')).toHaveCount(11)
  await page.getByRole('button', { name: /When the Saints/ }).click()
  await expect(page.locator('.rp-pad')).toHaveCount(5)
}

const score = (page) => page.locator('.rp-hud-score strong').textContent().then((text) => Number(text.replace(/,/g, '')))

test('C V B N M keys play the lanes', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard layout is for PC')
  await startSong(page)
  await page.keyboard.down('c')
  await expect(page.locator('.rp-lane').first()).toHaveClass(/is-down/)
  await page.keyboard.up('c')
  for (let i = 0; i < 60 && (await score(page)) === 0; i++) {
    for (const key of ['c', 'v', 'b', 'n', 'm']) await page.keyboard.press(key)
    await page.waitForTimeout(40)
  }
  expect(await score(page)).toBeGreaterThan(0)
})

test('rapid taps on the pads never zoom, scroll or select text', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch only')
  await startSong(page)
  const pads = page.locator('.rp-pad')
  const boxes = await Promise.all([0, 1, 2, 3, 4].map((i) => pads.nth(i).boundingBox()))
  for (const end = Date.now() + 12000; Date.now() < end && (await score(page)) === 0;) {
    for (const box of boxes) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
  }
  // Double taps on the highway and pads must not zoom either.
  const highway = await page.locator('.rp-highway').boundingBox()
  for (let i = 0; i < 6; i++) await page.touchscreen.tap(highway.x + highway.width / 2, highway.y + highway.height / 2)
  expect(await score(page)).toBeGreaterThan(0)
  const state = await page.evaluate(() => ({ scale: visualViewport.scale, scrollY, selected: getSelection().toString(), touchAction: getComputedStyle(document.querySelector('.rp-stage')).touchAction }))
  expect(state).toEqual({ scale: 1, scrollY: 0, selected: '', touchAction: 'none' })
})

test('finishing a song saves a record and returns to the list', async ({ page, isMobile }) => {
  test.skip(isMobile, 'one run is enough')
  await page.clock.install()
  await startSong(page, '어른')
  await page.clock.runFor(90000)
  await expect(page.getByRole('button', { name: '한 번 더' })).toBeVisible()
  await page.getByRole('button', { name: '다른 노래' }).click()
  expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('ian-rhythm-best-v1'))))).toEqual(['adult:saints'])
})

test('kid mode stops at a missed note until its pad is pressed', async ({ page }) => {
  await startSong(page)
  const target = page.locator('.rp-pad.is-target')
  await expect(target).toHaveCount(1, { timeout: 8000 })
  await expect(page.locator('.rp-wait')).toBeVisible()
  const frozen = await page.locator('.rp-note').first().getAttribute('style')
  await page.waitForTimeout(500)
  expect(await page.locator('.rp-note').first().getAttribute('style')).toBe(frozen)
  const wrong = page.locator('.rp-pad:not(.is-target)').first()
  await wrong.dispatchEvent('pointerdown')
  await expect(target).toHaveCount(1)
  await target.dispatchEvent('pointerdown')
  await expect.poll(() => score(page)).toBeGreaterThan(0)
  await expect(page.locator('.rp-feedback')).toHaveText(/최고|좋아|잘했어/)
})

test('menu, play and result screens fill the screen below the toolbar', async ({ page }) => {
  await page.goto('/game/rhythm-party')
  const fits = () => page.evaluate(() => {
    const box = document.querySelector('.rp-container').getBoundingClientRect()
    const toolbar = document.querySelector('.session-toolbar').getBoundingClientRect()
    return Math.abs(box.top - toolbar.bottom) < 2 && Math.abs(box.bottom - innerHeight) < 2
  })
  await expect(page.locator('.rp-song').first()).toBeVisible()
  expect(await fits()).toBe(true)
  await page.locator('.rp-song').last().scrollIntoViewIfNeeded()
  await expect(page.locator('.rp-song').last()).toBeInViewport()
  await page.getByRole('button', { name: /When the Saints/ }).click()
  expect(await fits()).toBe(true)
  await expect(page.locator('.rp-pad').first()).toBeInViewport()
})
