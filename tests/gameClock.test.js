import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGameClock } from '../src/lib/gameClock.js'
import { fitGameScale } from '../src/lib/gameViewport.js'

function harness() {
  let next = 1
  const pending = new Map()
  const clock = createGameClock({ requestFrame(callback) { const id = next++; pending.set(id, callback); return id }, cancelFrame(id) { pending.delete(id) } })
  function frame(time) { const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach((callback) => callback(time)) }
  return { clock, frame, pending }
}

test('simulation speed is independent of 30, 60, 120 and 144 Hz displays', () => {
  for (const hz of [30, 60, 120, 144]) {
    const { clock, frame } = harness()
    let steps = 0
    clock.setInterval(() => steps++, 16)
    frame(0)
    for (let i = 1; i <= hz * 2; i++) frame(i * 2000 / (hz * 2))
    assert.equal(steps, 125, `${hz} Hz`)
  }
})

test('pause preserves both delayed actions and frame-based countdowns', () => {
  const { clock, frame, pending } = harness()
  let fired = false
  let stamp
  clock.setTimeout(() => { fired = true }, 100)
  frame(0); frame(40)
  clock.requestAnimationFrame((value) => { stamp = value })
  const before = clock.now()
  clock.pause()
  assert.equal(pending.size, 0)
  frame(9000)
  assert.equal(clock.now(), before)
  assert.equal(fired, false)
  clock.resume()
  frame(10000)
  assert.equal(stamp, before)
  frame(10040)
  assert.equal(fired, false)
  frame(10060)
  assert.equal(fired, true)
})

test('slow frames have bounded catch-up, and intervals can cancel themselves', () => {
  const { clock, frame } = harness()
  let steps = 0
  clock.setInterval(() => steps++, 16)
  frame(0); frame(10000)
  assert.equal(steps, 3)
  let once = 0
  const id = clock.setInterval(() => { once++; clock.clearInterval(id) }, 1)
  frame(10050)
  assert.equal(once, 1)
})

test('navigation discards old work without letting old cleanup cancel a new session', () => {
  const { clock, frame } = harness()
  let old = 0, fresh = 0
  const oldId = clock.setTimeout(() => old++, 20)
  clock.requestAnimationFrame(() => old++)
  clock.reset()
  clock.setTimeout(() => fresh++, 20)
  clock.clearTimeout(oldId)
  frame(100); frame(130)
  assert.equal(old, 0)
  assert.equal(fresh, 1)
})

test('restart discards delayed actions while retaining live canvas frames', () => {
  const { clock, frame } = harness()
  let delayed = false, drawn = false
  clock.setTimeout(() => { delayed = true }, 5)
  clock.requestAnimationFrame(() => { drawn = true })
  clock.clearTimeouts()
  frame(0); frame(16)
  assert.equal(delayed, false)
  assert.equal(drawn, true)
})

test('portrait, short landscape and small windows keep boards readable and within width', () => {
  for (const [width, height] of [[320,568],[390,844],[844,390],[1440,1000],[320,200]]) {
    for (const [gameW, gameH] of [[400,600],[440,800],[800,700]]) {
      const scale = fitGameScale(gameW, gameH, width, height)
      assert.ok(scale > 0)
      assert.ok(gameW * scale <= width - 24 + .001)
      assert.ok(gameW * scale >= Math.min(340, width - 24) - .001)
    }
  }
})
