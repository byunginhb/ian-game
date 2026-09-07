import test from 'node:test'
import assert from 'node:assert/strict'
import { createWorld, FACTIONS, getLevelConfig, getOutcome, MAX_TROOPS, readProgress, recordWin, sendTroops, tickWorld } from '../src/lib/conquest.js'

const advance = (world, seconds) => { for (let step = 0; step < Math.ceil(seconds / .1); step++) world = tickWorld(world, .1); return world }
const isolated = (player = 0) => ({ ...createWorld(1, player), nextAI: Array(6).fill(Infinity) })

test('all 20 maps grow, contain all six factions, and fit desktop and portrait', () => {
  for (const portrait of [false, true]) for (let player = 0; player < 6; player++) {
    let count = 0
    for (let level = 1; level <= 20; level++) {
      const world = createWorld(level, player, portrait)
      assert.ok(world.territories.length > count)
      count = world.territories.length
      for (let owner = 0; owner < 6; owner++) assert.equal(world.territories.filter((land) => land.owner === owner).length, 1)
      for (const land of world.territories) {
        assert.ok(land.polygon.length >= 3)
        assert.ok(!land.path.includes('NaN'))
        assert.ok(land.polygon.every(([x, y]) => x > 0 && x < world.width && y > 0 && y < world.height))
        assert.ok(world.territories.filter((other) => other.id !== land.id).every((other) => Math.hypot(other.x - land.x, other.y - land.y) > 70))
      }
    }
    assert.equal(count, 36)
  }
  assert.ok(getLevelConfig(1).aiInterval > getLevelConfig(20).aiInterval)
  assert.ok(getLevelConfig(1).enemyGrowth < getLevelConfig(20).enemyGrowth)
  assert.deepEqual(createWorld(8), createWorld(8))
})

test('dispatch conserves troops, rejects invalid orders, and does not mutate its input', () => {
  const world = isolated(), before = structuredClone(world)
  const from = world.territories.find((land) => land.owner === 0), to = world.territories.find((land) => land.owner === -1)
  const sent = sendTroops(world, from.id, to.id)
  assert.deepEqual(world, before)
  assert.equal(sent.fleets[0].units + sent.territories[from.id].troops, from.troops)
  for (const ratio of [-1, 0, 2, NaN, Infinity]) assert.equal(sendTroops(world, from.id, to.id, ratio), world)
  assert.equal(sendTroops(world, to.id, from.id), world)
  assert.equal(sendTroops(world, from.id, from.id), world)
  assert.equal(sendTroops(world, 999, from.id), world)
})

test('troops arrive after travel, capture an island, and stay friendly when reinforcing', () => {
  let world = isolated()
  const from = world.territories.find((land) => land.owner === 0), to = world.territories.find((land) => land.owner === -1)
  world = sendTroops(world, from.id, to.id)
  const fleet = world.fleets[0]
  world = advance(world, fleet.duration - .2)
  assert.equal(world.territories[to.id].owner, -1)
  world = advance(world, .3)
  assert.equal(world.territories[to.id].owner, 0)
  assert.equal(world.captures, 1)
  const garrison = world.territories[to.id].troops
  world = sendTroops(world, from.id, to.id, .5)
  world = advance(world, world.fleets[0].duration + .1)
  assert.ok(world.territories[to.id].troops > garrison)
  assert.equal(world.captures, 1)
})

test('a last army can recapture land; victory waits for hostile armies and neutral land', () => {
  let world = isolated()
  const ours = world.territories.find((land) => land.owner === 0), neutral = world.territories.find((land) => land.owner === -1)
  world = sendTroops(world, ours.id, neutral.id, 1)
  world = { ...world, territories: world.territories.map((land) => land.id === ours.id ? { ...land, owner: 1 } : land) }
  assert.equal(getOutcome(world), 'playing')
  world = advance(world, world.fleets[0].duration + .1)
  assert.equal(world.territories[neutral.id].owner, 0)
  assert.equal(getOutcome({ ...world, fleets: [], territories: world.territories.map((land) => ({ ...land, owner: 1 })) }), 'lost')
  const conquered = { ...world, fleets: [], territories: world.territories.map((land) => ({ ...land, owner: 0 })) }
  assert.equal(getOutcome(conquered), 'won')
  assert.equal(getOutcome({ ...conquered, fleets: [{ owner: 1 }] }), 'playing')
  assert.equal(getOutcome({ ...conquered, territories: conquered.territories.map((land, index) => index ? land : { ...land, owner: -1 }) }), 'playing')
})

test('faction traits affect travel, production, attack and defense', () => {
  const base = isolated()
  const from = base.territories.find((land) => land.owner === 0), to = base.territories.find((land) => land.owner === -1)
  const duration = (player) => sendTroops({ ...base, player, territories: base.territories.map((land) => land.id === from.id ? { ...land, owner: player } : land) }, from.id, to.id).fleets[0].duration
  assert.ok(duration(1) < duration(0))
  const production = (owner) => {
    const world = { ...base, player: owner, territories: base.territories.map((land) => land.id === from.id ? { ...land, owner, troops: 10 } : land) }
    return advance(world, 1).territories[from.id].troops - 10
  }
  assert.ok(production(2) > production(0))
  const battle = (attacker, defender) => {
    const world = { ...base, player: attacker, time: 0, territories: base.territories.map((land) => land.id === to.id ? { ...land, owner: defender, troops: 20 } : land), fleets: [{ id: 1, owner: attacker, toId: to.id, units: 18, departure: 0, duration: .01 }] }
    return tickWorld(world, .1).territories[to.id]
  }
  assert.equal(battle(0, 2).owner, 2)
  assert.equal(battle(3, 2).owner, 3)
  assert.equal(battle(3, 5).owner, 5)
})

test('AI has a grace period and all five opponents act without invalid armies', () => {
  const world = createWorld(20)
  assert.equal(advance(world, world.config.grace - .2).fleets.length, 0)
  let live = world
  const acted = new Set()
  for (let step = 0; step < 1000 && live.status === 'playing'; step++) {
    live = tickWorld(live, .1)
    live.fleets.forEach((fleet) => acted.add(fleet.owner))
    assert.ok(live.territories.every((land) => Number.isFinite(land.troops) && land.troops >= 0 && land.troops <= MAX_TROOPS))
    assert.ok(live.fleets.every((fleet) => Number.isInteger(fleet.units) && fleet.units > 0))
  }
  assert.deepEqual([...acted].sort(), [1, 2, 3, 4, 5])
})

test('completed games stop, empty dispatches do not move, and storage is defensive', () => {
  const won = { ...createWorld(1), status: 'won' }
  assert.equal(tickWorld(won, .1), won)
  const empty = readProgress(null)
  assert.deepEqual(readProgress({ getItem() { throw Error('blocked') } }), empty)
  assert.deepEqual(readProgress({ getItem: () => '{broken' }), empty)
  const data = readProgress({ getItem: () => JSON.stringify({ selected: 99, cleared: [200, -4, '3'], stars: { '0-1': 3, evil: 3, '5-21': 2, '0-2': '5' } }) })
  assert.deepEqual(data.cleared, [20, 0, 3, 0, 0, 0])
  assert.deepEqual(data.stars, { '0-1': 3 })
  const saved = recordWin(empty, { ...won, time: 20 })
  assert.deepEqual(saved.cleared, [1, 0, 0, 0, 0, 0])
  assert.equal(saved.stars['0-1'], 3)
  assert.equal(recordWin(saved, { ...won, time: 900 }).stars['0-1'], 3)
  const last = recordWin(saved, { ...createWorld(20, 5), status: 'won' })
  assert.equal(last.cleared[5], 20)
  assert.equal(last.cleared[0], 1)
})

test('expansion and choosing how many troops to leave behind can complete all 20 levels', () => {
  for (let level = 1; level <= 20; level++) {
    let won = false
    for (const ratio of [.75, .5, 1]) {
      let world = createWorld(level)
      for (let step = 0; step < 6000 && world.status === 'playing'; step++) {
        if (step % 10 === 0) for (const from of world.territories.filter((land) => land.owner === world.player && land.troops > 12)) {
          const incoming = world.fleets.filter((fleet) => fleet.owner !== world.player && fleet.toId === from.id).reduce((sum, fleet) => sum + fleet.units, 0)
          if (incoming > from.troops * (1 - ratio)) continue
          const target = world.territories.filter((land) => land.owner !== world.player && !world.fleets.some((fleet) => fleet.owner === world.player && fleet.toId === land.id) && from.troops * ratio > land.troops * (FACTIONS[land.owner]?.defense || 1) + 5).sort((a, b) => Math.hypot(from.x - a.x, from.y - a.y) + a.troops * 3 - Math.hypot(from.x - b.x, from.y - b.y) - b.troops * 3)[0]
          if (target) world = sendTroops(world, from.id, target.id, ratio)
        }
        world = tickWorld(world, .1)
      }
      if (world.status === 'won') { won = true; break }
    }
    assert.ok(won, `level ${level} should be completable`)
  }
})
