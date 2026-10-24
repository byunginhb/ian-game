import test from 'node:test'
import assert from 'node:assert/strict'
import { ALL_TREASURES, BACKUP_KEY, MAP, RESTORATIONS, SAVE_KEY, WORLDS, bossZones, canWalk, circuitConnected, createExpedition, emptyProgress, findWalkPath, hazardsFor, heartsFor, inDangerZone, loadProgress, normalizeProgress, progressAction, puzzleFor, restorationFor, rotateMask, routeValid, saveProgress, sceneryFor, stepExpedition, treasuresFor, worldCount, worldUnlocked } from '../src/lib/treasureKingdom.js'

function memoryStorage() { const values = new Map(); return { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value), values } }
function tickAt(item, progress, input = {}, extra = {}) { return stepExpedition({ ...createExpedition(item.worldId, progress), player: { ...createExpedition(item.worldId, progress).player, x: item.x, y: item.y }, ...extra }, input, .016, progress) }
function applyEvents(progress, events) { return events.reduce((next, event) => ['collect', 'reveal', 'questItem'].includes(event.type) ? progressAction(next, event) : next, progress) }
function defeatBoss(item, progress) {
  let state = tickAt(item, progress, { interact: true }).state, result
  assert.ok(state.boss)
  const events = []
  for (let frame = 0; state.boss && frame < 1800; frame++) {
    state = { ...state, player: { ...state.player, invulnerable: 999 } }
    result = stepExpedition(state, { jump: frame % 82 < 74 }, .02, progress)
    state = result.state; events.push(...result.events)
  }
  assert.equal(state.boss, null)
  return { state, events }

}

test('four ordered worlds have 100 unique reachable treasures, 48 mission fragments and eight guardians', () => {
  assert.equal(ALL_TREASURES.length, 100)
  assert.equal(new Set(ALL_TREASURES.map((item) => item.id)).size, 100)
  assert.deepEqual(WORLDS.map((world) => world.theme), ['jungle', 'ocean', 'space', 'garden'])
  assert.equal(ALL_TREASURES.flatMap((item) => item.targets).length, 48)
  for (const world of WORLDS) {
    const items = treasuresFor(world.id)
    assert.equal(items.length, 25)
    assert.equal(items.filter((item) => item.type === 'boss').length, 2)
    assert.equal(new Set(items.map((item) => item.type)).size, 6)
    assert.equal(world.records.length, 3)
    for (const point of items.flatMap((item) => [item, ...item.targets])) {
      assert.ok(point.x >= 160 && point.x <= MAP.width - 160)
      assert.ok(point.y >= 175 && point.y <= MAP.height - 160)
    }
  }
})

test('collect and deposit are immutable, duplicate-safe and unlock worlds only in order', () => {
  const empty = emptyProgress()
  let progress = progressAction(empty, { type: 'collect', id: '0-0' })
  assert.equal(empty.collected.length, 0)
  assert.equal(progress.banked.length, 0)
  assert.equal(progressAction(progress, { type: 'collect', id: '0-0' }), progress)
  assert.equal(progressAction(progress, { type: 'collect', id: 'fake' }), progress)
  for (const item of treasuresFor(0)) progress = progressAction(progress, { type: 'collect', id: item.id })
  assert.equal(worldCount(progress, 0), 25)
  assert.equal(worldUnlocked(progress, 1), false)
  progress = progressAction(progress, { type: 'deposit' })
  assert.equal(worldUnlocked(progress, 1), true)
  assert.equal(worldUnlocked(progress, 2), false)
})

test('save round-trip persists partial missions, scanner discoveries and position', () => {
  const storage = memoryStorage()
  let progress = emptyProgress()
  for (const action of [{ type: 'collect', id: '0-0' }, { type: 'quest', id: '0-4' }, { type: 'questItem', id: '0-4:1' }, { type: 'reveal', id: '0-2' }, { type: 'position', worldId: 0, position: { x: 500, y: 600 } }]) progress = progressAction(progress, action)
  assert.equal(saveProgress(storage, progress), true)
  assert.equal(storage.getItem(SAVE_KEY), storage.getItem(BACKUP_KEY))
  assert.deepEqual(loadProgress(storage).progress, progress)
  assert.equal(createExpedition(0, loadProgress(storage).progress).player.x, 500)
  const legacy = normalizeProgress({ version: 1, collected: ['0-0'], banked: ['0-0'], quests: ['0-4'], positions: { 0: { x: 500, y: 600 } } })
  assert.deepEqual(legacy.collected, ['0-0'])
  assert.deepEqual(legacy.questItems, [])
  assert.deepEqual(legacy.revealed, [])
})

test('corrupt or stale primary recovers from backup and denied storage is explicitly reported', () => {
  const storage = memoryStorage(), progress = progressAction(emptyProgress(), { type: 'collect', id: '0-0' })
  saveProgress(storage, progress)
  storage.setItem(SAVE_KEY, '{broken')
  assert.deepEqual(loadProgress(storage).progress, progress)
  assert.equal(loadProgress(storage).recovered, true)
  assert.equal(loadProgress(storage).unavailable, false)
  storage.setItem(SAVE_KEY, JSON.stringify(emptyProgress()))
  assert.deepEqual(loadProgress(storage).progress, progress)
  assert.equal(saveProgress({ setItem: () => { throw new Error('Quota exceeded') } }, progress), false)
  assert.equal(loadProgress({ getItem: () => { throw new Error('SecurityError') } }).unavailable, true)
  assert.equal(saveProgress({ setItem: (key, value) => { if (key === SAVE_KEY) throw new Error('denied'); storage.setItem(key, value) } }, progress), true)
})

test('malformed saves cannot fabricate treasures, bank unfound IDs or move outside the map', () => {
  assert.equal(normalizeProgress({ version: 2, collected: [] }), null)
  assert.equal(normalizeProgress({ version: 1, collected: 'wrong' }), null)
  const value = normalizeProgress({ version: 1, collected: ['0-0', '0-0', 'fake', null], banked: ['0-0', '0-1'], quests: ['0-4', '0-0'], questItems: ['0-4:1', '0-4:99'], revealed: ['0-2', '0-1'], lastWorld: '__proto__', positions: { 0: { x: -100, y: 999999 }, 1: { x: 'x', y: 0 } } })
  assert.deepEqual(value.collected, ['0-0']); assert.deepEqual(value.banked, ['0-0']); assert.deepEqual(value.quests, ['0-4'])
  assert.deepEqual(value.questItems, ['0-4:1']); assert.deepEqual(value.revealed, ['0-2'])
  assert.deepEqual(value.positions, { 0: { x: 160, y: 1160 } }); assert.equal(value.lastWorld, 0)
})

test('movement bounds catch-up, jump ends, dodge consumes stamina and checkpoints are emitted', () => {
  let state = createExpedition(0, emptyProgress())
  const initial = { ...state.player }
  state = stepExpedition(state, { right: true, up: true, jump: true, dash: true }, 100, emptyProgress()).state
  assert.ok(Math.hypot(state.player.x - initial.x, state.player.y - initial.y) < 32)
  assert.equal(state.player.stamina, 70); assert.ok(state.player.invulnerable > 0)
  let checkpoints = 0
  for (let i = 0; i < 120; i++) { const result = stepExpedition(state, {}, .02, emptyProgress()); state = result.state; checkpoints += result.events.filter((event) => event.type === 'position').length }
  assert.equal(state.player.jump, 0); assert.equal(state.player.dash, 0); assert.equal(state.player.stamina, 100); assert.ok(checkpoints > 0)
})

test('hidden records require scanning and elevated records require an airborne approach', () => {
  const items = treasuresFor(0), progress = emptyProgress()
  assert.ok(tickAt(items[0], progress).events.some((event) => event.type === 'collect'))
  assert.ok(!tickAt(items[2], progress).events.some((event) => event.type === 'collect'))
  const scanned = tickAt(items[2], progress, { interact: true })
  assert.ok(scanned.events.some((event) => event.type === 'reveal' && event.id === items[2].id))
  assert.ok(tickAt(items[2], applyEvents(progress, scanned.events)).events.some((event) => event.type === 'collect'))
  assert.ok(!tickAt(items[5], progress).events.some((event) => event.type === 'collect'))
  assert.ok(tickAt(items[5], progress, {}, { player: { ...createExpedition(0, progress).player, x: items[5].x, y: items[5].y, jump: .4 } }).events.some((event) => event.type === 'collect'))
})

test('missions persist three distinct recoveries and reward returning to the contact', () => {
  const item = treasuresFor(0)[4]
  let progress = emptyProgress()
  assert.ok(tickAt(item, progress, { interact: true }).events.some((event) => event.type === 'friend'))
  progress = progressAction(progress, { type: 'quest', id: item.id })
  for (const target of item.targets) {
    const result = tickAt(item, progress, {}, { player: { ...createExpedition(0, progress).player, ...target } })
    assert.ok(result.events.some((event) => event.type === 'questItem' && event.id === target.id))
    progress = applyEvents(progress, result.events)
    assert.ok(!progress.collected.includes(item.id))
  }
  assert.ok(tickAt(item, progress, { interact: true }).events.some((event) => event.type === 'collect' && event.id === item.id))
})

test('all sixteen devices have valid circuit, memory, output and routing solutions', () => {
  for (const item of ALL_TREASURES.filter((item) => item.type === 'puzzle')) {
    const puzzle = puzzleFor(item)
    assert.ok(tickAt(item, emptyProgress(), { interact: true }).events.some((event) => event.type === 'puzzle'))
    if (puzzle.mode === 'circuit') {
      assert.equal(circuitConnected(puzzle.tiles.map((tile) => tile.mask)), true)
      assert.equal(circuitConnected(puzzle.tiles.map((tile) => rotateMask(tile.mask, tile.turns))), false)
      assert.equal(rotateMask(3, 4), 3)
    }
    if (puzzle.mode === 'sequence') { assert.equal(puzzle.sequence.length, 6); assert.ok(puzzle.sequence.every((value) => value >= 0 && value < 4)) }
    if (puzzle.mode === 'balance') assert.equal(puzzle.weights[0] + puzzle.weights[2] + puzzle.weights[4], puzzle.target)
    if (puzzle.mode === 'route') {
      const route = item.worldId % 2 ? [0, 1, 5, 9, 10, 11, 15] : [0, 1, 5, 9, 13, 14, 15]
      assert.equal(routeValid(puzzle, route), true)
      assert.equal(routeValid(puzzle, [0, 15]), false)
    }
  }
})

test('six guardian patterns share visual danger geometry and enforce invulnerability', () => {
  const boss = { x: 900, y: 600, angle: 0, targetX: 900, targetY: 700 }
  for (const pattern of ['ring', 'cross', 'charge', 'cone', 'roots', 'orbs']) assert.ok(bossZones({ ...boss, pattern }).length > 0)
  assert.equal(inDangerZone({ x: 1050, y: 600 }, bossZones({ ...boss, pattern: 'charge' })[0]), true)
  assert.equal(inDangerZone({ x: 1050, y: 700 }, bossZones({ ...boss, pattern: 'charge' })[0]), false)
  assert.equal(inDangerZone({ x: 900, y: 600 }, bossZones({ ...boss, pattern: 'ring' })[0]), false)
  let progress = emptyProgress()
  for (const item of treasuresFor(0).slice(0, 8)) progress = progressAction(progress, { type: 'collect', id: item.id })
  const item = treasuresFor(0)[12], state = tickAt(item, progress, { interact: true }).state
  const exposed = { ...state, boss: { ...state.boss, pattern: 'cross', timer: .001 }, player: { ...state.player, x: item.x + 100, y: item.y, invulnerable: 0 } }
  assert.equal(stepExpedition(exposed, {}, .016, progress).state.player.hp, 3)
  assert.equal(stepExpedition({ ...exposed, player: { ...exposed.player, jump: .4 } }, {}, .016, progress).state.player.hp, 4)
})

test('guardians reject early challenges, escalate patterns, reward wins and permit retreat', () => {
  const item = treasuresFor(0)[12]
  assert.equal(tickAt(item, emptyProgress(), { interact: true }).state.boss, null)
  const progress = { ...emptyProgress(), collected: treasuresFor(0).slice(0, 8).map((value) => value.id) }
  const result = defeatBoss(item, progress)
  assert.ok(result.events.some((event) => event.type === 'collect' && event.id === item.id))
  const state = tickAt(item, progress, { interact: true }).state
  assert.equal(stepExpedition({ ...state, player: { ...state.player, x: 160, y: 1160 } }, {}, .016, progress).state.boss, null)
})

test('mouse routing finds a bounded walkable route and physics respects scenery trunks', () => {
  for (const world of WORLDS) {
    const path = findWalkPath(MAP.spawn, { x: 1600, y: 240 }, world.id)
    assert.ok(path.length > 0)
    assert.ok(path.every((point) => point.x >= 160 && point.x <= 1740 && point.y >= 175 && point.y <= 1160))
    const object = sceneryFor(world.id).find((value) => value.x > 250 && value.x < 1650 && value.y > 230 && value.y < 1080)
    if (object) {
      const state = createExpedition(world.id, emptyProgress())
      state.player = { ...state.player, x: object.x - object.radius - 12, y: object.y }
      const result = stepExpedition(state, { right: true }, .04, emptyProgress())
      assert.ok(result.state.player.x <= state.player.x + 1)
    }
  }
})

test('world hazards telegraph before activating and defeated explorers retain all discoveries', () => {
  for (const world of WORLDS) {
    assert.ok(hazardsFor(world.id, 4.5).every((hazard) => hazard.warning && !hazard.active))
    assert.ok(hazardsFor(world.id, 6).every((hazard) => hazard.active))
  }
  const progress = { ...emptyProgress(), collected: ['0-0'] }, hazard = hazardsFor(0, 6)[0]
  const state = createExpedition(0, progress)
  state.time = 6; state.player = { ...state.player, x: hazard.x, y: hazard.y, hp: 1, invulnerable: 0 }
  const result = stepExpedition(state, {}, .016, progress)
  assert.equal(result.state.player.hp, 4)
  assert.deepEqual({ x: result.state.player.x, y: result.state.player.y }, MAP.spawn)
  assert.deepEqual(progress.collected, ['0-0'])
})

test('the complete 100-record expedition is earnable through every rule and survives save/reload', () => {
  const storage = memoryStorage(), reached = new Set([0])
  let progress = emptyProgress()
  for (const world of WORLDS) {
    assert.equal(worldUnlocked(progress, world.id), true)
    const items = treasuresFor(world.id).toSorted((a, b) => Number(a.type === 'boss') - Number(b.type === 'boss'))
    for (const item of items) {
      let result
      if (item.type === 'explore') result = tickAt(item, progress)
      if (item.type === 'hidden') { progress = applyEvents(progress, tickAt(item, progress, { interact: true }).events); result = tickAt(item, progress) }
      if (item.type === 'jump') result = tickAt(item, progress, {}, { player: { ...createExpedition(world.id, progress).player, x: item.x, y: item.y, jump: .4 } })
      if (item.type === 'friend') {
        progress = progressAction(progress, { type: 'quest', id: item.id })
        for (const target of item.targets) progress = applyEvents(progress, tickAt(item, progress, {}, { player: { ...createExpedition(world.id, progress).player, ...target } }).events)
        result = tickAt(item, progress, { interact: true })
      }
      if (item.type === 'puzzle') { assert.ok(puzzleFor(item)); result = { events: [{ type: 'collect', id: item.id }] } }
      if (item.type === 'boss') result = defeatBoss(item, progress)
      assert.ok(result.events.some((event) => event.type === 'collect' && event.id === item.id), `Record ${item.id} must be earnable`)
      progress = applyEvents(progress, result.events)
      progress = progressAction(progress, { type: 'deposit' }); reached.add(restorationFor(progress.banked.length).at)
      saveProgress(storage, progress); assert.deepEqual(loadProgress(storage).progress, progress)
    }
  }
  assert.equal(progress.collected.length, 100); assert.equal(progress.banked.length, 100)
  assert.deepEqual([...reached], RESTORATIONS.map((step) => step.at))
})

test('painted trails connect every record, mission fragment and healing pickup without crossing solid roots', () => {
  for (const world of WORLDS) {
    const points = [...treasuresFor(world.id).flatMap((item) => [item, ...item.targets]), ...heartsFor(world.id)]
    for (const point of points) {
      const path = findWalkPath(MAP.spawn, point, world.id)
      assert.ok(path.length, `World ${world.id}: route to ${point.id}`)
      assert.ok(Math.hypot(path.at(-1).x - point.x, path.at(-1).y - point.y) < 32, `Target ${point.id} is reachable`)
      let state = createExpedition(world.id, emptyProgress()), target = path.shift()
      for (let tick = 0; target && tick < 3000; tick++) {
        state = { ...state, player: { ...state.player, invulnerable: 999 } }
        const result = stepExpedition(state, { target }, .04, emptyProgress()); state = result.state
        if (result.events.some((event) => event.type === 'arrived')) target = path.shift()
      }
      assert.ok(!target, `Character walks the entire route to ${point.id}`)
    }
  }
})

test('jump and dodge cannot bypass roots, off-trail edges or leave a saved character inside scenery', () => {
  for (const world of WORLDS) {
    const tree = sceneryFor(world.id).find((object) => object.variant !== 2)
    const state = createExpedition(world.id, emptyProgress())
    state.player = { ...state.player, x: tree.x - tree.radius - 12, y: tree.y }
    for (const input of [{ right: true }, { right: true, jump: true }, { right: true, dash: true }]) {
      const next = stepExpedition(state, input, .04, emptyProgress()).state
      assert.ok(next.player.x <= state.player.x + 1)
    }
    const resumed = createExpedition(world.id, { ...emptyProgress(), positions: { [world.id]: { x: tree.x, y: tree.y } } })
    assert.equal(canWalk(resumed.player, world.id), true)
  }
})

test('hearts restore one health, remain at full health, and respawn on the simulation timeline', () => {
  const progress = emptyProgress(), heart = heartsFor(0)[0]
  let state = createExpedition(0, progress)
  state.player = { ...state.player, ...heart }
  const full = stepExpedition(state, {}, .04, progress)
  assert.equal(full.events.some((event) => event.type === 'heal'), false)
  assert.equal(full.state.heartTimers[heart.id], undefined)
  state = { ...full.state, player: { ...full.state.player, hp: 2 } }
  const healed = stepExpedition(state, {}, .04, progress)
  assert.equal(healed.state.player.hp, 3)
  assert.equal(healed.events.filter((event) => event.type === 'heal').length, 1)
  assert.equal(stepExpedition(healed.state, {}, .04, progress).state.player.hp, 3)
  const later = stepExpedition({ ...healed.state, time: healed.state.time + 30 }, {}, .04, progress)
  assert.equal(later.state.player.hp, 4)
  assert.deepEqual(progress, emptyProgress())
})

test('zero-time pointer frames never corrupt the player coordinates', () => {
  const state = createExpedition(0, emptyProgress())
  const next = stepExpedition(state, { target: { x: state.player.x, y: state.player.y } }, 0, emptyProgress()).state
  assert.equal(Number.isFinite(next.player.x) && Number.isFinite(next.player.y), true)
  assert.deepEqual({ x: next.player.x, y: next.player.y }, MAP.spawn)
})

function combatState() {
  const item = treasuresFor(0)[12], progress = { ...emptyProgress(), collected: treasuresFor(0).slice(0, 8).map((value) => value.id) }
  const state = tickAt(item, progress, { interact: true }).state
  return { state: { ...state, player: { ...state.player, x: item.x + 190, invulnerable: 999 } }, progress }
}

test('a short Space press launches a real automatically targeted missile without jumping', () => {
  const { state, progress } = combatState()
  let result = stepExpedition(state, { jump: true }, .04, progress)
  assert.equal(result.state.player.jump, 0)
  assert.equal(result.state.missiles.length, 0)
  result = stepExpedition(result.state, {}, .04, progress)
  assert.equal(result.state.missiles.length, 1)
  assert.equal(result.state.missiles[0].targetId, state.boss.id)
  assert.equal(result.state.missiles[0].charged, false)
  const initial = result.state.missiles[0].x
  result = stepExpedition(result.state, {}, .04, progress)
  assert.ok(result.state.missiles[0].x < initial)
  for (let i = 0; i < 30 && !result.events.some((event) => event.type === 'missileImpact'); i++) result = stepExpedition(result.state, {}, .04, progress)
  assert.equal(result.state.boss.hp, state.boss.hp - 1)
})

test('holding Space charges one special until release, cancelled input never fires', () => {
  const { state, progress } = combatState()
  let current = state, launches = []
  for (let i = 0; i < 100; i++) { const r = stepExpedition(current, { jump: true }, .04, progress); current = r.state; launches.push(...r.events.filter((event) => event.type === 'missileLaunch')) }
  assert.equal(launches.length, 1); assert.equal(launches[0].charged, true)
  assert.ok(current.boss.hp <= state.boss.hp - 5)
  let charging = stepExpedition(state, { jump: true }, .04, progress).state
  charging = stepExpedition(charging, { cancelShot: true }, .04, progress).state
  assert.equal(stepExpedition(charging, {}, .04, progress).state.missiles.length, 0)
})

test('defeat saves the record immediately and emits exactly one landing impact before removing the guardian', () => {
  const { state, progress } = combatState()
  let current = { ...state, boss: { ...state.boss, hp: 1 }, missiles: [{ id: 1, x: state.boss.x, y: state.boss.y - 65, targetId: state.boss.id, charged: false, age: 0 }] }
  let result = stepExpedition(current, {}, .04, progress)
  assert.equal(result.state.boss.phase, 'defeated')
  assert.ok(result.events.some((event) => event.type === 'collect' && event.id === state.boss.id))
  assert.equal(result.events.some((event) => event.type === 'bossFall'), false)
  const saved = applyEvents(progress, result.events), impacts = []
  current = result.state
  for (let i = 0; i < 60; i++) { result = stepExpedition(current, {}, .04, saved); current = result.state; impacts.push(...result.events.filter((event) => event.type === 'bossFall')) }
  assert.equal(impacts.length, 1); assert.equal(current.boss, null)
  assert.ok(saved.collected.includes(state.boss.id))
})
