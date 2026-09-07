import { test, expect } from '@playwright/test'

async function observeAudio(page) {
  await page.addInitScript(() => {
    const NativeAudio = window.AudioContext || window.webkitAudioContext
    window.audioContexts = []
    window.AudioContext = class extends NativeAudio {
      constructor(...args) {
        super(...args)
        this.started = 0
        this.active = 0
        window.audioContexts.push(this)
      }
      track(node) {
        const start = node.start.bind(node)
        node.start = (...args) => { this.started++; this.active++; start(...args) }
        node.addEventListener('ended', () => { this.active-- })
        return node
      }
      createOscillator() { return this.track(super.createOscillator()) }
      createBufferSource() { return this.track(super.createBufferSource()) }
    }
  })
}

test('sound starts on interaction, follows help and pause, and releases audio on exit', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await observeAudio(page)
  await page.goto('/game/conquest')
  await expect(page.getByRole('button', { name: '소리 끄기' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.ct-sound-bars')).toBeVisible()
  expect(await page.evaluate(() => window.audioContexts.length)).toBe(0)
  await page.getByRole('button', { name: '1탄 출정하기' }).click()
  const active = () => page.evaluate(() => window.audioContexts[0].active)
  await expect.poll(active).toBeGreaterThan(0)
  expect(await page.evaluate(() => window.audioContexts.length)).toBe(1)
  const introCount = await page.evaluate(() => window.audioContexts[0].started)
  await expect.poll(() => page.evaluate(() => window.audioContexts[0].started)).toBeGreaterThan(introCount + 8)

  await page.getByRole('button', { name: '놀이 방법' }).click()
  await expect.poll(active).toBe(0)
  const quietCount = await page.evaluate(() => window.audioContexts[0].started)
  await expect(page.getByText('설명을 읽는 동안 전투는 멈춰 있어요.')).toBeVisible()
  expect(await page.evaluate(() => window.audioContexts[0].started)).toBe(quietCount)
  await page.getByRole('button', { name: '알겠어요' }).click()
  await expect.poll(active).toBeGreaterThan(0)
  await page.getByRole('button', { name: '게임 일시정지' }).click()
  await expect.poll(active).toBe(0)
  await page.getByRole('button', { name: '계속하기' }).click()
  await expect.poll(active).toBeGreaterThan(0)
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await expect.poll(active).toBe(0)
  await page.getByRole('button', { name: '계속하기' }).click()
  await expect.poll(active).toBeGreaterThan(0)
  await page.locator('.session-home').click()
  await expect.poll(() => page.evaluate(() => window.audioContexts[0].state)).toBe('closed')
  expect(errors).toEqual([])
})

test('mute stops every voice immediately, persists, and can be turned back on', async ({ page }) => {
  await observeAudio(page)
  await page.goto('/game/conquest')
  await page.getByRole('button', { name: '1탄 출정하기' }).click()
  await expect.poll(() => page.evaluate(() => window.audioContexts[0].active)).toBeGreaterThan(0)
  await page.getByRole('button', { name: '소리 끄기' }).click()
  await expect.poll(() => page.evaluate(() => window.audioContexts[0].active)).toBe(0)
  await expect(page.getByRole('button', { name: '소리 켜기' })).toHaveAttribute('aria-pressed', 'false')
  await page.reload()
  await expect(page.getByRole('button', { name: '소리 켜기' })).toBeVisible()
  await page.getByRole('button', { name: '1탄 출정하기' }).click()
  expect(await page.evaluate(() => window.audioContexts.length)).toBe(0)
  await page.getByRole('button', { name: '소리 켜기' }).click()
  await expect.poll(() => page.evaluate(() => window.audioContexts[0]?.active || 0)).toBeGreaterThan(0)
  await page.getByRole('button', { name: '팀 · 모험 고르기' }).filter({ visible: true }).click()
  await expect.poll(() => page.evaluate(() => window.audioContexts[0].active)).toBe(0)
})

test('all effects produce bounded audible output and collision bursts are throttled', async ({ page }) => {
  await page.goto('/game/conquest')
  const rendered = await page.evaluate(async () => {
    const { createConquestAudio } = await import('/src/lib/conquestAudio.js')
    const results = []
    for (const event of ['select', 'start', 'dispatch', 'clash', 'capture', 'retreat', 'victory', 'defeat']) {
      const context = new OfflineAudioContext(1, 44100 * 3, 44100)
      let starts = 0
      for (const method of ['createOscillator', 'createBufferSource']) {
        const original = context[method].bind(context)
        context[method] = () => { starts++; return original() }
      }
      const audio = createConquestAudio({ createContext: () => context })
      audio.unlock()
      for (let repeat = 0; repeat < (event === 'clash' ? 100 : 1); repeat++) audio.play(event)
      const samples = (await context.startRendering()).getChannelData(0)
      let peak = 0, energy = 0, tail = 0, audibleEnd = 0
      for (let i = 0; i < samples.length; i++) {
        peak = Math.max(peak, Math.abs(samples[i])); energy += samples[i] ** 2
        if (Math.abs(samples[i]) > .0001) audibleEnd = i
        if (i > samples.length - 4410) tail = Math.max(tail, Math.abs(samples[i]))
      }
      // Measure the sound itself, excluding the deliberately silent end of the render.
      results.push({ event, peak, rms: Math.sqrt(energy / (audibleEnd + 1)), tail, starts })
      audio.dispose()
    }
    return results
  })
  for (const sound of rendered) {
    expect(sound.rms, `${sound.event} is audible`).toBeGreaterThan(.001)
    expect(sound.peak, `${sound.event} does not clip`).toBeLessThan(.65)
    expect(sound.tail, `${sound.event} ends cleanly`).toBeLessThan(.0001)
  }
  expect(rendered.find((sound) => sound.event === 'clash').starts).toBe(2)
})

test('unavailable audio and storage never block the game', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    window.AudioContext = undefined
    window.webkitAudioContext = undefined
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage blocked') } })
  })
  await page.goto('/game/conquest')
  await page.getByRole('button', { name: '1탄 출정하기' }).click()
  await expect(page.locator('.ct-land')).toHaveCount(12)
  await page.getByRole('button', { name: '소리 끄기' }).click()
  await page.getByRole('button', { name: '소리 켜기' }).click()
  await expect(page.getByRole('button', { name: '소리 끄기' })).toBeVisible()
  expect(errors).toEqual([])
})
