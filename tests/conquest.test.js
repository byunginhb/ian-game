import test from 'node:test'
import assert from 'node:assert/strict'
import { containsPoint, createWorld, FACTIONS, getLevelConfig, getOutcome, marchingSoldiers, MAX_TROOPS, readProgress, recordWin, sendTroops, territoryAt, tickWorld, WAVE_INTERVAL, WAVE_SIZE } from '../src/lib/conquest.js'

const advance = (world, seconds) => { for (let remaining = seconds; remaining > 1e-8; remaining -= .05) world = tickWorld(world, Math.min(.05, remaining)); return world }
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
        assert.ok(!/NaN|Infinity/.test(land.path))
        assert.ok(containsPoint(land.polygon, land), `stage ${level}: a commander must stand on their land`)
        assert.equal(territoryAt(world, land)?.id, land.id)
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
  assert.equal(sent.fleets[0].totalUnits, Math.floor(from.troops))
  assert.ok(sent.territories[from.id].troops < 1)
  for (const owner of [-1, 6, 1.5, NaN, Infinity]) assert.equal(sendTroops(world, from.id, to.id, owner), world)
  assert.equal(sendTroops(sent, from.id, to.id), sent)
  assert.equal(sendTroops(world, to.id, from.id), world)
  assert.equal(sendTroops(world, from.id, from.id), world)
  assert.equal(sendTroops(world, 999, from.id), world)
})

test('maps mix shared borders, offshore islands, different sizes and real water hit areas', () => {
  const area = (polygon) => Math.abs(polygon.reduce((sum, [x, y], index) => { const [nx, ny] = polygon[(index + 1) % polygon.length]; return sum + x * ny - y * nx }, 0)) / 2
  for (const portrait of [false, true]) for (let level = 1; level <= 20; level++) {
    const world = createWorld(level, 0, portrait)
    const sizes = world.territories.map((land) => area(land.polygon))
    assert.ok(Math.max(...sizes) / Math.min(...sizes) > 1.5)
    assert.ok(world.territories.some((land) => land.neighbors.length > 0))
    assert.ok(world.territories.some((land) => land.neighbors.length === 0))
    assert.equal(territoryAt(world, { x: 20, y: 20 }), null)
    assert.equal(territoryAt(world, { x: -20, y: world.height / 2 }), null)
    let ocean = 0
    for (let x = 40; x < world.width - 40; x += 40) for (let y = 40; y < world.height - 40; y += 40) {
      const hits = world.territories.filter((land) => containsPoint(land.polygon, { x, y }))
      assert.ok(hits.length <= 1, 'territory interiors must never overlap')
      if (!territoryAt(world, { x, y })) ocean++
    }
    assert.ok(ocean > 5, 'each map must have playable sea gaps')
  }
})

test('five soldiers arrive at a time, the last partial wave reinforces, and arrivals happen only once', () => {
  let world = isolated()
  const from = world.territories.find((land) => land.owner === 0), to = world.territories.find((land) => land.owner === -1)
  world = { ...world, territories: world.territories.map((land) => land.id === from.id ? { ...land, troops: 18.75 } : land.id === to.id ? { ...land, troops: 8 } : land) }
  world = sendTroops(world, from.id, to.id)
  const fleet = world.fleets[0]
  assert.equal(fleet.units, 18)
  assert.equal(world.territories[from.id].troops, .75)
  world = advance(world, fleet.duration - .01)
  assert.equal(world.territories[to.id].troops, 8)
  world = advance(world, .02)
  assert.equal(world.territories[to.id].owner, -1)
  assert.equal(world.territories[to.id].troops, 3)
  assert.equal(world.fleets[0].units, 13)
  world = advance(world, WAVE_INTERVAL)
  assert.equal(world.territories[to.id].owner, 0)
  assert.equal(world.captures, 1)
  assert.equal(world.fleets[0].units, 8)
  world = advance(world, WAVE_INTERVAL * 2)
  assert.equal(world.fleets.length, 0)
  assert.ok(world.territories[to.id].troops >= 10 && world.territories[to.id].troops < 12)
  const garrison = world.territories[to.id].troops
  world = advance(world, .1)
  assert.ok(world.territories[to.id].troops - garrison < .2)
  assert.equal(world.captures, 1)
})

test('one visible character represents one soldier, in rows of up to five including the remainder', () => {
  const world = isolated(), from = world.territories.find((land) => land.owner === 0)
  const target = [...world.territories].sort((a, b) => Math.hypot(b.x - from.x, b.y - from.y) - Math.hypot(a.x - from.x, a.y - from.y))[0]
  for (const units of [1, 4, 5, 6, 23, 150]) {
    const sent = sendTroops({ ...world, territories: world.territories.map((land) => land.id === from.id ? { ...land, troops: units } : land) }, from.id, target.id)
    const fleet = sent.fleets[0], seen = new Set()
    const end = fleet.duration + Math.floor((units - 1) / WAVE_SIZE) * WAVE_INTERVAL
    assert.equal(marchingSoldiers(fleet, target, 0).length, Math.min(units, 5))
    assert.equal(marchingSoldiers(fleet, target, WAVE_INTERVAL - .001).length, Math.min(units, 5))
    assert.equal(marchingSoldiers(fleet, target, WAVE_INTERVAL + .001).length, Math.min(units, 10))
    for (let time = 0; time < end + .1; time += .1) {
      const visible = marchingSoldiers(fleet, target, time)
      const waves = new Map()
      for (const soldier of visible) {
        assert.ok(Number.isFinite(soldier.x) && Number.isFinite(soldier.y))
        seen.add(soldier.id)
        waves.set(soldier.wave, (waves.get(soldier.wave) || 0) + 1)
      }
      assert.ok([...waves.values()].every((count) => count <= 5))
      assert.equal(new Set(visible.map((soldier) => soldier.id)).size, visible.length)
    }
    assert.equal(seen.size, units)
    assert.equal(marchingSoldiers(fleet, target, end + .01).length, 0)
    assert.equal(advance(sent, end + .1).fleets.length, 0)
  }
})

test('repeated orders queue behind the last row, preserve committed armies and cannot duplicate soldiers', () => {
  let world = isolated()
  const from = world.territories.find((land) => land.owner === 0), to = world.territories.find((land) => land.owner === -1)
  world = sendTroops(world, from.id, to.id)
  const first = world.fleets[0]
  assert.equal(sendTroops(world, from.id, to.id), world)
  world = advance(world, 1)
  const recruits = Math.floor(world.territories[from.id].troops)
  world = sendTroops(world, from.id, to.id)
  const next = world.fleets.at(-1)
  assert.notEqual(next.id, first.id)
  assert.equal(next.totalUnits, recruits)
  assert.ok(next.departure >= first.departure + Math.ceil(first.totalUnits / 5) * WAVE_INTERVAL)
  assert.equal(marchingSoldiers(next, to, world.time).length, 0)
})

test('a last army can recapture land; victory waits for hostile armies and neutral land', () => {
  let world = isolated()
  const ours = world.territories.find((land) => land.owner === 0), neutral = world.territories.find((land) => land.owner === -1)
  world = sendTroops(world, ours.id, neutral.id)
  world = { ...world, territories: world.territories.map((land) => land.id === ours.id ? { ...land, owner: 1 } : land) }
  assert.equal(getOutcome(world), 'playing')
  world = advance(world, world.fleets[0].duration + WAVE_INTERVAL * 2 + .1)
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
    const world = { ...base, player: attacker, time: 0, territories: base.territories.map((land) => land.id === to.id ? { ...land, owner: defender, troops: 20 } : land), fleets: [{ id: 1, owner: attacker, toId: to.id, units: 18, totalUnits: 18, arrived: 0, departure: 0, duration: .01 }] }
    return advance(world, 1.05).territories[to.id]
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

test('all-in expansion can complete all 20 levels', () => {
  for (let level = 1; level <= 20; level++) {
    let won = false
    for (const minimum of [12, 20, 30]) {
      let world = createWorld(level)
      for (let step = 0; step < 6000 && world.status === 'playing'; step++) {
        if (step % 10 === 0) for (const from of world.territories.filter((land) => land.owner === world.player && land.troops > minimum)) {
          const incoming = world.fleets.filter((fleet) => fleet.owner !== world.player && fleet.toId === from.id).reduce((sum, fleet) => sum + fleet.units, 0)
          if (incoming > 0) continue
          const target = world.territories.filter((land) => land.owner !== world.player && !world.fleets.some((fleet) => fleet.owner === world.player && fleet.toId === land.id) && from.troops > land.troops * (FACTIONS[land.owner]?.defense || 1) + 5).sort((a, b) => Math.hypot(from.x - a.x, from.y - a.y) + a.troops * 3 - Math.hypot(from.x - b.x, from.y - b.y) - b.troops * 3)[0]
          if (target) world = sendTroops(world, from.id, target.id)
        }
        world = tickWorld(world, .1)
      }
      if (world.status === 'won') { won = true; break }
    }
    assert.ok(won, `level ${level} should be completable`)
  }
})
