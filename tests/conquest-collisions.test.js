import test from 'node:test'
import assert from 'node:assert/strict'
import { createWorld, FACTIONS, marchingSoldiers, tickWorld } from '../src/lib/conquest.js'

const advance = (world, seconds, step = .05) => {
  for (let remaining = seconds; remaining > 1e-8; remaining -= step) world = tickWorld(world, Math.min(step, remaining))
  return world
}

function battlefield(armies) {
  const points = [[100, 200], [500, 200], [300, 50], [300, 350], [50, 50], [550, 350]]
  const base = createWorld(1)
  const territories = points.map(([x, y], id) => ({ ...base.territories[id], id, x, y, owner: id, troops: 0 }))
  return { ...base, width: 600, height: 400, territories, nextAI: Array(6).fill(Infinity), fleets: armies.map(({ from, to, units, owner = from, departure = 0, duration = 4 }, index) => ({ id: index + 1, owner, fromId: from, toId: to, x: territories[from].x, y: territories[from].y, totalUnits: units, units, casualties: [], arrived: 0, departure, duration })) }
}

const opposing = (a = 5, b = 5) => battlefield([{ from: 0, to: 1, units: a }, { from: 1, to: 0, units: b }])

test('opposing five-person rows cancel one for one in the road without mutating their input', () => {
  const original = opposing(), before = structuredClone(original)
  const world = advance(original, 2.1)
  assert.deepEqual(original, before)
  assert.equal(world.fleets.length, 0)
  assert.equal(world.clashes.length, 5)
  assert.equal(world.captures, 0)
  assert.ok(world.clashes.every((clash) => Math.abs(clash.x - 300) < 1 && clash.owners.includes(0) && clash.owners.includes(1)))
})

test('crossing paths collide only while soldiers are actually at the crossing together', () => {
  const simultaneous = battlefield([{ from: 0, to: 1, units: 1 }, { from: 2, to: 3, units: 1 }])
  assert.equal(advance(simultaneous, 2.1).fleets.length, 0)
  const staggered = battlefield([{ from: 0, to: 1, units: 1 }, { from: 2, to: 3, units: 1, departure: 3 }])
  let world = staggered
  for (let i = 0; i < 145; i++) {
    world = tickWorld(world, .05)
    assert.equal(world.clashes.length, 0)
    assert.ok(world.fleets.every((fleet) => fleet.casualties.length === 0))
  }
})

test('friendly soldiers pass through one another and opponents on separated roads do not collide', () => {
  const friendly = opposing()
  friendly.fleets = friendly.fleets.map((fleet) => ({ ...fleet, owner: 0 }))
  assert.equal(advance(friendly, 2.1).fleets.reduce((sum, fleet) => sum + fleet.units, 0), 10)
  assert.equal(advance(friendly, 2.1).clashes.length, 0)
  const separate = opposing(1, 1)
  separate.territories = separate.territories.map((land) => land.id === 2 ? { ...land, x: 100, y: 240 } : land)
  separate.fleets[1] = { ...separate.fleets[1], y: 240, toId: 2 }
  assert.equal(advance(separate, 2.1).fleets.length, 2)
  assert.equal(advance(separate, 2.1).clashes.length, 0)
})

test('collisions cancel enemy teams too, independent of faction attack and defense bonuses', () => {
  const world = battlefield([{ from: 2, to: 3, owner: 3, units: 5 }, { from: 3, to: 2, owner: 5, units: 5 }])
  const result = advance(world, 2.1)
  assert.equal(result.fleets.length, 0)
  assert.equal(result.clashes.length, 5)
  assert.ok(result.clashes.every((clash) => clash.owners.includes(3) && clash.owners.includes(5)))
})

test('survivors keep their identities and only surviving soldiers reinforce the destination', () => {
  let world = opposing(8, 3)
  world.territories = world.territories.map((land) => land.id === 1 ? { ...land, owner: 0 } : land)
  world = advance(world, 2.1)
  assert.equal(world.fleets.length, 1)
  assert.equal(world.fleets[0].units, 5)
  assert.equal(world.fleets[0].casualties.length, 3)
  const dead = new Set(world.fleets[0].casualties)
  const visible = marchingSoldiers(world.fleets[0], world.territories[1], world.time)
  assert.equal(visible.length, 5)
  assert.ok(visible.every((soldier) => !dead.has(soldier.id)))
  world = advance(world, 1.95)
  assert.equal(world.fleets[0].arrived, 5)
  assert.equal(world.fleets[0].units, 3)
  world = advance(world, .55)
  assert.equal(world.fleets.length, 0)
  assert.ok(Math.abs(world.territories[1].troops - (5 + 4.6 * 1.25 * FACTIONS[0].growth)) < 1e-7)
  assert.equal(world.clashes.length, 0, 'the collision effect expires')
})

test('swept collision checks catch fast soldiers even when both have already passed the crossing at frame end', () => {
  const world = opposing(1, 1)
  world.fleets = world.fleets.map((fleet) => ({ ...fleet, duration: .04 }))
  const result = tickWorld(world, .1)
  assert.equal(result.fleets.length, 0)
  assert.equal(result.clashes.length, 1)
  assert.equal(result.captures, 0)
})

test('unlaunched rows survive an earlier clash and keep a landless team in the game', () => {
  let world = opposing(10, 5)
  world.territories = world.territories.map((land) => ({ ...land, owner: 1, troops: 0 }))
  world.fleets = world.fleets.map((fleet) => ({ ...fleet, duration: .08 }))
  world = tickWorld(world, .1)
  assert.equal(world.status, 'playing')
  assert.equal(world.fleets.length, 1)
  assert.equal(world.fleets[0].units, 5)
  assert.ok(world.fleets[0].casualties.every((index) => index < 5))
  assert.equal(marchingSoldiers(world.fleets[0], world.territories[1], world.time).length, 0)
  world = advance(world, .4)
  assert.equal(world.territories[1].owner, 0)
  assert.equal(world.fleets.length, 0)
})

test('a soldier cancels at most one opponent in a three-team crossing, regardless of fleet array order', () => {
  const world = battlefield([{ from: 0, to: 1, units: 1 }, { from: 1, to: 0, units: 1 }, { from: 2, to: 3, units: 1 }])
  const a = advance(world, 2.1)
  const b = advance({ ...world, fleets: [...world.fleets].reverse() }, 2.1)
  assert.equal(a.fleets.reduce((sum, fleet) => sum + fleet.units, 0), 1)
  assert.deepEqual(a.fleets, b.fleets)
  assert.equal(a.clashes.length, 1)
})

test('the last hostile army can be cancelled for victory, and losing the last army triggers defeat', () => {
  const world = opposing()
  const won = advance({ ...world, territories: world.territories.map((land) => ({ ...land, owner: 0 })) }, 2.1)
  assert.equal(won.status, 'won')
  const lost = advance({ ...world, territories: world.territories.map((land) => ({ ...land, owner: 1 })) }, 2.1)
  assert.equal(lost.status, 'lost')
})

test('pause cannot cause a collision and different update rates preserve survivor counts', () => {
  const world = opposing(8, 3)
  assert.equal(tickWorld(world, 0), world)
  const outcomes = [1 / 60, 1 / 30, .1].map((step) => advance(world, 2.1, step).fleets.map((fleet) => ({ id: fleet.id, units: fleet.units, casualties: fleet.casualties.length })))
  assert.deepEqual(outcomes[0], outcomes[1])
  assert.deepEqual(outcomes[1], outcomes[2])
})
