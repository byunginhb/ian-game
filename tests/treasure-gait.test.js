import test from 'node:test'
import assert from 'node:assert/strict'
import { advanceGait } from '../src/lib/treasureGait.js'
const player = { x: 200, y: 200, jump: 0, dash: 0 }

test('walk poses follow actual distance through opposite contact and passing frames', () => {
  let gait = { distance: 0, direction: 'east' }, current = { ...player }, steps = 0
  const frames = []
  for (let n = 0; n < 8; n++) {
    const next = { ...current, x: current.x + 36 }
    gait = advanceGait(gait, current, next); frames.push(gait.frame); steps += Number(gait.footstep); current = next
  }
  assert.deepEqual(frames, [1, 2, 3, 0, 1, 2, 3, 0]); assert.equal(steps, 4)
  const stopped = advanceGait(gait, current, current)
  assert.equal(stopped.moving, false); assert.equal(stopped.footstep, false); assert.equal(stopped.frame, 0)
  assert.equal(stopped.distance, gait.distance)
})
test('direction selects front/back/side art and jump or dodge has no grounded step effect', () => {
  const empty = { distance: 71, direction: 'east' }
  for (const [dx, dy, direction, row] of [[0, -5, 'north', 1], [0, 5, 'south', 2], [-5, 0, 'west', 0], [5, 0, 'east', 0]]) {
    const next = advanceGait(empty, player, { ...player, x: player.x + dx, y: player.y + dy })
    assert.equal(next.direction, direction); assert.equal(Math.floor(next.frame / 4), row)
  }
  for (const extra of [{ jump: .5 }, { dash: .2 }]) assert.equal(advanceGait(empty, player, { ...player, ...extra, x: 205 }).footstep, false)
})
