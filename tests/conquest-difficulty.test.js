import test from 'node:test'
import assert from 'node:assert/strict'
import { ADULT_SAVE_KEY, createWorld, FACTIONS, getLevelConfig, MAX_TROOPS, readProgress, recordWin, SAVE_KEY, sendTroops, tickWorld } from '../src/lib/conquest.js'

test('adult stages preserve the map and factions while providing progressively stronger opposition', () => {
  for (const portrait of [false, true]) for (let level = 1; level <= 20; level++) {
    const child = createWorld(level, 0, portrait), adult = createWorld(level, 0, portrait, 'adult')
    assert.deepEqual(child, createWorld(level, 0, portrait, 'child'))
    assert.ok(adult.config.playerStart < child.config.playerStart)
    assert.ok(adult.config.enemyStart > child.config.enemyStart)
    assert.ok(adult.config.enemyGrowth > child.config.enemyGrowth)
    assert.ok(adult.config.grace < child.config.grace)
    assert.ok(adult.config.aiInterval < child.config.aiInterval)
    assert.deepEqual(adult.territories.map(({ id, owner, polygon }) => ({ id, owner, polygon })), child.territories.map(({ id, owner, polygon }) => ({ id, owner, polygon })))
    for (let owner = 0; owner < 6; owner++) assert.equal(adult.territories.filter((land) => land.owner === owner).length, 1)
    if (level > 1) {
      const previous = getLevelConfig(level - 1, 'adult')
      assert.ok(adult.config.aiInterval < previous.aiInterval)
      assert.ok(adult.config.enemyGrowth > previous.enemyGrowth)
      assert.ok(adult.config.aiOrders >= previous.aiOrders)
    }
  }
  assert.deepEqual(getLevelConfig(1, 'unknown'), getLevelConfig(1, 'child'))
})

// Small public worlds isolate decisions without bypassing the real simulation or dispatch rules.
function scenario(lands, difficulty = 'adult', level = 1) {
  const world = createWorld(level, 0, false, difficulty)
  return { ...world, time: 1, nextAI: [Infinity, 0, Infinity, Infinity, Infinity, Infinity], territories: lands.map((land, id) => ({ ...world.territories[id], id, y: 300, ...land })) }
}

test('adult commanders hold a threatened home instead of abandoning it for an easy conquest', () => {
  let world = scenario([{ x: 100, owner: 0, troops: 12 }, { x: 280, owner: 1, troops: 50 }, { x: 350, owner: -1, troops: 5 }])
  world = sendTroops(world, 0, 1)
  const before = structuredClone(world)
  const after = tickWorld(world, .05)
  assert.deepEqual(world, before)
  assert.equal(after.fleets.filter((fleet) => fleet.owner === 1).length, 0)
  const child = tickWorld({ ...world, config: getLevelConfig(1) }, .05)
  assert.ok(child.fleets.some((fleet) => fleet.owner === 1))
})

test('adult commanders urgently reinforce a threatened ally before taking a neutral land', () => {
  let world = scenario([{ x: 450, owner: 0, troops: 30 }, { x: 220, owner: 1, troops: 5 }, { x: 100, owner: 1, troops: 35 }, { x: 70, owner: -1, troops: 4 }])
  world = sendTroops(world, 0, 1)
  const after = tickWorld(world, .05)
  const reinforcement = after.fleets.find((fleet) => fleet.owner === 1)
  assert.equal(reinforcement.fromId, 2)
  assert.equal(reinforcement.toId, 1)
  assert.equal(reinforcement.totalUnits, 35)
})

test('adult attacks account for defenders produced during the journey', () => {
  const world = scenario([{ x: 520, owner: 0, troops: 10 }, { x: 100, owner: 1, troops: 13 }])
  assert.equal(tickWorld(world, .05).fleets.length, 0)
  assert.equal(tickWorld({ ...world, config: getLevelConfig(1) }, .05).fleets.length, 1)
})

test('later adult armies can issue multiple all-in orders without duplicating a covered target', () => {
  const world = scenario([{ x: 900, owner: 0, troops: 100 }, { x: 100, owner: 1, troops: 40 }, { x: 140, owner: 1, troops: 40 }, { x: 300, owner: -1, troops: 4 }, { x: 350, owner: -1, troops: 4 }], 'adult', 20)
  const after = tickWorld(world, .05)
  const orders = after.fleets.filter((fleet) => fleet.owner === 1)
  assert.equal(orders.length, 2)
  assert.equal(new Set(orders.map((fleet) => fleet.toId)).size, 2)
  assert.equal(new Set(orders.map((fleet) => fleet.fromId)).size, 2)
  assert.ok(orders.every((fleet) => fleet.totalUnits === 40))
})

test('both modes retain five-person marching, production limits and faction traits', () => {
  for (const difficulty of ['child', 'adult']) {
    let world = createWorld(20, 1, false, difficulty)
    const from = world.territories.find((land) => land.owner === 1), to = world.territories.find((land) => land.owner < 0)
    world = sendTroops(world, from.id, to.id)
    assert.equal(world.fleets[0].totalUnits, Math.floor(from.troops))
    assert.equal(world.fleets[0].duration, Math.hypot(from.x - to.x, from.y - to.y) / (100 * FACTIONS[1].speed) + .3)
    const acted = new Set()
    for (let step = 0; step < 900 && world.status === 'playing'; step++) {
      world = tickWorld(world, .1)
      world.fleets.forEach((fleet) => acted.add(fleet.owner))
      assert.ok(world.territories.every((land) => Number.isFinite(land.troops) && land.troops >= 0 && land.troops <= MAX_TROOPS))
      assert.ok(world.fleets.every((fleet) => Number.isInteger(fleet.units) && fleet.units > 0))
    }
    assert.equal(acted.size, 6)
  }
})

test('legacy records stay in child mode and adult clears and stars remain independent', () => {
  const legacy = { selected: 3, cleared: [0, 0, 0, 12, 0, 0], stars: { '3-12': 3 } }
  const data = new Map([[SAVE_KEY, JSON.stringify(legacy)]])
  const storage = { getItem: (key) => data.get(key) || null }
  const child = readProgress(storage, 'child'), adult = readProgress(storage, 'adult')
  assert.deepEqual(child, legacy)
  assert.deepEqual(adult.cleared, [0, 0, 0, 0, 0, 0])
  const won = recordWin(adult, { ...createWorld(1, 5, false, 'adult'), status: 'won', time: 60 })
  data.set(ADULT_SAVE_KEY, JSON.stringify(won))
  assert.equal(readProgress(storage, 'adult').cleared[5], 1)
  assert.equal(readProgress(storage, 'adult').stars['5-1'], 3)
  assert.deepEqual(readProgress(storage, 'child'), legacy)
  data.set(ADULT_SAVE_KEY, '{broken')
  assert.deepEqual(readProgress(storage, 'adult'), adult)
  assert.deepEqual(readProgress(storage, 'child'), legacy)
})
