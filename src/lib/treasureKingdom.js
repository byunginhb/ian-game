import { MAP, WORLDS, RESTORATIONS, clampPosition, distanceToTrail, hazardsFor, heartsFor, sceneryFor, trailsFor, treasuresFor } from './treasureContent.js'
export { MAP, WORLDS, RESTORATIONS, TYPE_LABELS, PROLOGUE, clampPosition, hazardsFor, heartsFor, sceneryFor, trailsFor, treasuresFor, puzzleFor, rotateMask, circuitConnected, routeValid } from './treasureContent.js'
export const SAVE_KEY = 'ian-treasure-kingdom-v1'
export const BACKUP_KEY = `${SAVE_KEY}-backup`
export const ALL_TREASURES = WORLDS.flatMap((world) => treasuresFor(world.id))
const VALID_IDS = new Set(ALL_TREASURES.map((item) => item.id))
const QUEST_IDS = new Set(ALL_TREASURES.filter((item) => item.type === 'friend').map((item) => item.id))
const QUEST_ITEMS = new Set(ALL_TREASURES.flatMap((item) => item.targets.map((target) => target.id)))
const HIDDEN_IDS = new Set(ALL_TREASURES.filter((item) => item.type === 'hidden').map((item) => item.id))
const SCENERY = WORLDS.map((world) => sceneryFor(world.id))
const TRAILS = WORLDS.map((world) => trailsFor(world.id))
const uniqueIds = (value, allowed = VALID_IDS) => Array.isArray(value) ? [...new Set(value.filter((id) => allowed.has(id)))] : []
export const emptyProgress = () => ({ version: 1, collected: [], banked: [], quests: [], questItems: [], revealed: [], positions: {}, lastWorld: 0, revision: 0 })

export function normalizeProgress(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.collected)) return null
  const collected = uniqueIds(value.collected)
  const banked = uniqueIds(value.banked).filter((id) => collected.includes(id))
  const positions = {}
  for (const world of WORLDS) {
    const point = value.positions?.[world.id]
    if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) positions[world.id] = clampPosition(point)
  }
  return { version: 1, collected, banked, quests: uniqueIds(value.quests, QUEST_IDS), questItems: uniqueIds(value.questItems, QUEST_ITEMS), revealed: uniqueIds(value.revealed, HIDDEN_IDS), positions, lastWorld: Number.isInteger(value.lastWorld) && value.lastWorld >= 0 && value.lastWorld < 4 ? value.lastWorld : 0, revision: Number.isSafeInteger(value.revision) && value.revision >= 0 && value.revision < Number.MAX_SAFE_INTEGER ? value.revision : 0 }
}

export function loadProgress(storage) {
  let denied = false
  const candidates = [SAVE_KEY, BACKUP_KEY].map((key) => {
    let raw
    try { raw = storage.getItem(key) } catch { denied = true; return null }
    try { return normalizeProgress(JSON.parse(raw)) } catch { return null }
  }).filter(Boolean).sort((a, b) => b.revision - a.revision)
  let primary
  try { primary = normalizeProgress(JSON.parse(storage.getItem(SAVE_KEY))) } catch { /* Backup recovery. */ }
  return { progress: candidates[0] || emptyProgress(), recovered: Boolean(candidates.length && !primary), unavailable: denied && !candidates.length }
}
export function saveProgress(storage, progress) {
  const serialized = JSON.stringify(progress)
  let saved = false
  for (const key of [SAVE_KEY, BACKUP_KEY]) {
    try { storage.setItem(key, serialized); saved = true } catch { /* Try the second independent save slot. */ }
  }
  return saved
}
export function worldCount(progress, worldId, banked = false) {
  return progress[banked ? 'banked' : 'collected'].filter((id) => id.startsWith(`${worldId}-`)).length
}
export const worldUnlocked = (progress, worldId) => worldId === 0 || worldCount(progress, worldId - 1, true) === 25
export const restorationFor = (count) => RESTORATIONS.filter((step) => count >= step.at).at(-1)
export function progressAction(progress, action) {
  let next = progress
  if (action.type === 'collect' && VALID_IDS.has(action.id) && !progress.collected.includes(action.id)) next = { ...progress, collected: [...progress.collected, action.id] }
  if (action.type === 'quest' && QUEST_IDS.has(action.id) && !progress.quests.includes(action.id)) next = { ...progress, quests: [...progress.quests, action.id] }
  if (action.type === 'questItem' && QUEST_ITEMS.has(action.id) && !progress.questItems.includes(action.id)) next = { ...progress, questItems: [...progress.questItems, action.id] }
  if (action.type === 'reveal' && HIDDEN_IDS.has(action.id) && !progress.revealed.includes(action.id)) next = { ...progress, revealed: [...progress.revealed, action.id] }
  if (action.type === 'deposit') next = { ...progress, banked: [...progress.collected] }
  if (action.type === 'position' && WORLDS[action.worldId] && Number.isFinite(action.position?.x) && Number.isFinite(action.position?.y)) next = { ...progress, positions: { ...progress.positions, [action.worldId]: clampPosition(action.position) }, lastWorld: action.worldId }
  return next === progress ? progress : { ...next, revision: progress.revision + 1 }
}

export const BOSS_PATTERNS = [['ring', 'charge'], ['cone', 'orbs'], ['cross', 'ring'], ['roots', 'cone']]
export function createExpedition(worldId, progress) {
  const saved = progress.positions[worldId] || MAP.spawn
  const position = canWalk(saved, worldId) ? saved : nearestWalkPoint(saved, worldId)
  return { worldId, player: { ...position, jump: 0, facing: 1, hp: 4, stamina: 100, dash: 0, invulnerable: 1.5 }, time: 0, boss: null, cooldown: 0, scan: 0, checkpoint: 0, nearest: null, moving: false, heartTimers: {}, missiles: [], weapon: { charge: 0, held: false, latched: false, cooldown: 0 }, shotSequence: 0 }
}
export function bossZones(boss) {
  const angle = boss.angle || 0
  if (boss.pattern === 'ring') return [{ kind: 'ring', x: boss.x, y: boss.y, radius: 220, inner: 75 }]
  if (boss.pattern === 'cross') return [{ kind: 'rect', x: boss.x - 290, y: boss.y - 30, width: 580, height: 60 }, { kind: 'rect', x: boss.x - 30, y: boss.y - 230, width: 60, height: 460 }]
  if (boss.pattern === 'charge') return [{ kind: 'line', x: boss.x, y: boss.y, angle, length: 340, width: 68 }]
  if (boss.pattern === 'cone') return [{ kind: 'cone', x: boss.x, y: boss.y, angle, radius: 300, spread: .7 }]
  if (boss.pattern === 'roots') return [-1, 0, 1].map((index) => ({ kind: 'circle', x: boss.targetX + index * 100, y: boss.targetY + (index % 2) * 50, radius: 65 }))
  return Array.from({ length: 5 }, (_, i) => ({ kind: 'circle', x: boss.x + Math.cos(angle + i * Math.PI * 2 / 5) * 170, y: boss.y + Math.sin(angle + i * Math.PI * 2 / 5) * 125, radius: 65 }))
}
export function inDangerZone(point, zone) {
  const dx = point.x - zone.x, dy = point.y - zone.y
  if (zone.kind === 'rect') return dx >= 0 && dx <= zone.width && dy >= 0 && dy <= zone.height
  if (zone.kind === 'line') { const along = dx * Math.cos(zone.angle) + dy * Math.sin(zone.angle); return along > 0 && along < zone.length && Math.abs(-dx * Math.sin(zone.angle) + dy * Math.cos(zone.angle)) < zone.width / 2 }
  const distance = Math.hypot(dx, dy / .74)
  if (zone.kind === 'cone') { const angle = Math.atan2(dy, dx) - zone.angle; return Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle))) < zone.spread && Math.hypot(dx, dy) < zone.radius }
  return distance < zone.radius && (zone.kind !== 'ring' || distance > zone.inner)
}
export function canWalk(point, worldId, margin = 0) {
  return point.x >= 160 && point.x <= MAP.width - 160 && point.y >= 175 && point.y <= MAP.height - 160 && TRAILS[worldId].some((trail) => distanceToTrail(point, trail) <= trail.width - 10 - margin) && !SCENERY[worldId].some((object) => Math.hypot(point.x - object.x, (point.y - object.y) * 1.5) < object.radius + 11 + margin)
}
const GRID_SIZE = 24, GRID_COLUMNS = 67, GRID_ROWS = 43
const GRID_POINTS = Array.from({ length: GRID_COLUMNS * GRID_ROWS }, (_, cell) => clampPosition({ x: 160 + cell % GRID_COLUMNS * GRID_SIZE, y: 175 + Math.floor(cell / GRID_COLUMNS) * GRID_SIZE }))
const gridPoint = (cell) => GRID_POINTS[cell]
const WALK_GRIDS = new Map()
function walkGrid(worldId) {
  if (!WALK_GRIDS.has(worldId)) WALK_GRIDS.set(worldId, Array.from({ length: GRID_COLUMNS * GRID_ROWS }, (_, cell) => cell).filter((cell) => canWalk(gridPoint(cell), worldId, 6)))
  return WALK_GRIDS.get(worldId)
}
function nearestCell(position, worldId) {
  return walkGrid(worldId).reduce((best, cell) => Math.hypot(gridPoint(cell).x - position.x, gridPoint(cell).y - position.y) < Math.hypot(gridPoint(best).x - position.x, gridPoint(best).y - position.y) ? cell : best, walkGrid(worldId)[0])
}
function nearestWalkPoint(position, worldId) { return gridPoint(nearestCell(position, worldId)) }
function walkSegment(a, b, worldId, margin = 0) {
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 8)
  for (let i = 1; i <= steps; i++) if (!canWalk({ x: a.x + (b.x - a.x) * i / steps, y: a.y + (b.y - a.y) * i / steps }, worldId, margin)) return false
  return true
}

export function findWalkPath(start, target, worldId) {
  const size = GRID_SIZE, columns = GRID_COLUMNS, rows = GRID_ROWS, point = gridPoint
  const nearest = (position) => nearestCell(position, worldId)
  const first = nearest(start), last = nearest(clampPosition(target)), previous = new Map([[first, null]]), costs = new Map([[first, 0]]), open = [first]
  while (open.length) {
    let best = 0
    for (let i = 1; i < open.length; i++) if (costs.get(open[i]) + Math.hypot(point(open[i]).x - point(last).x, point(open[i]).y - point(last).y) < costs.get(open[best]) + Math.hypot(point(open[best]).x - point(last).x, point(open[best]).y - point(last).y)) best = i
    const cell = open.splice(best, 1)[0]
    if (cell === last) {
      const route = []
      for (let current = last; current !== null; current = previous.get(current)) route.unshift(point(current))
      if (canWalk(clampPosition(target), worldId) && walkSegment(route.at(-1), clampPosition(target), worldId)) route.push(clampPosition(target))
      // Eliminate grid zig-zags, but never cut across a root or off the painted trail.
      const smooth = []; let anchor = start
      for (let i = 0; i < route.length; i++) if (i === route.length - 1 || !walkSegment(anchor, route[i + 1], worldId, 6)) { smooth.push(route[i]); anchor = route[i] }
      return smooth.map((point) => ({ ...point }))
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const x = cell % columns + dx, y = Math.floor(cell / columns) + dy, next = y * columns + x
      if (x < 0 || x >= columns || y < 0 || y >= rows || !canWalk(point(next), worldId, 6)) continue
      const midpoint = { x: (point(cell).x + point(next).x) / 2, y: (point(cell).y + point(next).y) / 2 }
      if (!canWalk(midpoint, worldId, 6) || !walkSegment(point(cell), point(next), worldId, 6)) continue
      const cost = costs.get(cell) + Math.hypot(dx, dy) * size
      if (!costs.has(next) || cost < costs.get(next)) { costs.set(next, cost); previous.set(next, cell); if (!open.includes(next)) open.push(next) }
    }
  }
  return []
}

export function stepExpedition(state, input, delta, progress) {
  const dt = Math.min(Math.max(delta, 0), .045), time = state.time + dt
  const events = []
  let player = { ...state.player }, boss = state.boss ? { ...state.boss } : null
  let missiles = (state.missiles || []).map((missile) => ({ ...missile })), shotSequence = state.shotSequence || 0
  let weapon = { charge: 0, held: false, latched: false, cooldown: 0, ...state.weapon }
  weapon.cooldown = Math.max(0, weapon.cooldown - dt)
  let cooldown = Math.max(0, state.cooldown - dt), scan = Math.max(0, state.scan - dt)
  player.jump = Math.max(0, player.jump - dt)
  player.dash = Math.max(0, player.dash - dt)
  player.invulnerable = Math.max(0, player.invulnerable - dt)
  player.stamina = Math.min(100, player.stamina + dt * 24)
  let dx = Number(Boolean(input.right)) - Number(Boolean(input.left)), dy = Number(Boolean(input.down)) - Number(Boolean(input.up))
  let targetDistance = Infinity
  if (input.target && !dx && !dy) {
    const distance = Math.hypot(input.target.x - player.x, input.target.y - player.y)
    targetDistance = distance
    if (distance > 3) { dx = (input.target.x - player.x) / distance; dy = (input.target.y - player.y) / distance / .82 }
    else events.push({ type: 'arrived' })
  }
  const magnitude = Math.hypot(dx, dy)
  if (magnitude) { dx /= magnitude; dy /= magnitude }
  if (input.dash && !player.dash && cooldown === 0 && player.stamina >= 30) { player.dash = .23; player.stamina -= 30; player.invulnerable = .35; cooldown = .45; events.push({ type: 'dash' }) }
  if (!boss && (input.jump || input.primaryTap) && player.jump === 0) player.jump = state.worldId === 2 ? 1.05 : .76
  const speed = Math.min(player.dash ? 680 : 255, targetDistance / Math.max(dt, .000001))
  const nextX = clampPosition({ x: player.x + dx * speed * dt, y: player.y })
  const nextY = clampPosition({ x: player.x, y: player.y + dy * speed * .82 * dt })
  const next = { x: nextX.x, y: nextY.y }
  if (walkSegment(player, next, state.worldId)) { player.x = next.x; player.y = next.y }
  else {
    if (walkSegment(player, nextX, state.worldId)) player.x = nextX.x
    if (walkSegment(player, { x: player.x, y: nextY.y }, state.worldId)) player.y = nextY.y
  }
  if (dx) player.facing = Math.sign(dx)
  if (magnitude > 0) player.movingNorth = dy < -.2
  if (boss) {
    const separation = Math.hypot(player.x - boss.x, player.y - boss.y)
    if (separation < 52) { const angle = separation ? Math.atan2(player.y - boss.y, player.x - boss.x) : 0; player.x = boss.x + Math.cos(angle) * 52; player.y = boss.y + Math.sin(angle) * 52 }
  }
  const items = treasuresFor(state.worldId).filter((item) => !progress.collected.includes(item.id))
  const airborne = player.jump > .1 && player.jump < (state.worldId === 2 ? .96 : .69)
  const hurt = (message) => {
    if (player.invulnerable > 0 || airborne) return
    player.hp--; player.invulnerable = 1.6
    events.push({ type: 'hurt', message })
    if (player.hp <= 0) { player = { ...player, ...MAP.spawn, hp: 4, stamina: 100, invulnerable: 3 }; boss = null; events.push({ type: 'notice', message: '확보한 기록은 보존됐다. 탐사 캠프에서 다시 출발한다.' }) }
  }
  if (!boss) for (const hazard of hazardsFor(state.worldId, time)) if (hazard.active && Math.hypot((player.x - hazard.x) / hazard.rx, (player.y - hazard.y) / hazard.ry) < 1) hurt(`${hazard.kind}에 휩쓸렸다. 점프 또는 회피로 통과할 수 있다.`)
  const heartTimers = { ...state.heartTimers }
  for (const heart of heartsFor(state.worldId)) if (player.hp < 4 && time >= (heartTimers[heart.id] || 0) && Math.hypot(player.x - heart.x, player.y - heart.y) < 35) {
    player.hp = Math.min(4, player.hp + 1); heartTimers[heart.id] = time + 30
    events.push({ type: 'heal', message: '하트 획득 · 체력 +1' })
  }
  const nearest = items.reduce((found, item) => {
    const distance = Math.hypot(item.x - player.x, item.y - player.y)
    if (item.type === 'hidden' && !progress.revealed.includes(item.id)) return found
    return distance < 105 && (!found || distance < found.distance) ? { ...item, distance } : found
  }, null)
  for (const item of items) {
    const distance = Math.hypot(item.x - player.x, item.y - player.y)
    if ((item.type === 'explore' || (item.type === 'hidden' && progress.revealed.includes(item.id))) && distance < 34) events.push({ type: 'collect', id: item.id, message: `기록핵 확보 · ${item.name}` })
    if (item.type === 'jump' && distance < 44 && airborne) events.push({ type: 'collect', id: item.id, message: `상층 기록 회수 · ${item.name}` })
    if (item.type === 'friend' && progress.quests.includes(item.id)) for (const target of item.targets) if (!progress.questItems.includes(target.id) && Math.hypot(target.x - player.x, target.y - player.y) < 35) events.push({ type: 'questItem', id: target.id, message: `${WORLDS[state.worldId].item} 회수. 임무 담당자에게 돌아가라.` })
  }
  if (input.interact && cooldown === 0 && !boss) {
    cooldown = .5
    if (nearest?.type === 'puzzle') events.push({ type: 'puzzle', item: nearest })
    else if (nearest?.type === 'friend') {
      if (nearest.targets.every((target) => progress.questItems.includes(target.id))) events.push({ type: 'collect', id: nearest.id, message: '현장 임무 완료. 새로운 기록핵과 탐사 자료를 확보했다.' })
      else events.push({ type: 'friend', item: nearest })
    } else if (nearest?.type === 'boss') {
      const needed = nearest.index === 12 ? 8 : 18
      if (worldCount(progress, state.worldId) >= needed) {
        const hp = nearest.index === 24 ? 18 : 12
        boss = { id: nearest.id, x: nearest.x, y: nearest.y, hp, maxHp: hp, phase: 'warning', timer: 1.8, round: 0, pattern: BOSS_PATTERNS[state.worldId][0], angle: Math.atan2(player.y - nearest.y, player.x - nearest.x), targetX: player.x, targetY: player.y }
        player.jump = 0
        events.push({ type: 'notice', message: '봉인 반응 감지. 경고 영역을 회피하고 노출된 코어를 공격하라.' })
      } else events.push({ type: 'notice', message: `봉인 해제에 이 구역의 기록핵 ${needed}개가 필요하다.` })
    } else if (scan === 0) {
      scan = 2.5
      const hidden = items.filter((item) => item.type === 'hidden' && !progress.revealed.includes(item.id) && Math.hypot(item.x - player.x, item.y - player.y) < 210)
      hidden.forEach((item) => events.push({ type: 'reveal', id: item.id }))
      events.push({ type: 'scan', message: hidden.length ? '매몰된 기록의 위치를 감지했다.' : '탐지 펄스 발사. 근처에 추가 신호가 없다.' })
    }
  }
  const launch = (charged) => {
    if (!boss || boss.phase === 'defeated' || weapon.cooldown > 0) return
    player.facing = Math.sign(boss.x - player.x) || player.facing
    missiles.push({ id: ++shotSequence, x: player.x, y: player.y - 45, targetId: boss.id, charged, age: 0 })
    weapon.cooldown = charged ? .8 : .4
    events.push({ type: 'missileLaunch', charged })
  }
  if (boss && boss.phase !== 'defeated' && !input.cancelShot) {
    if (input.jump && !weapon.latched) {
      weapon.held = true; weapon.charge = Math.min(1.35, weapon.charge + dt)
      if (weapon.charge >= 1.35) { launch(true); weapon.latched = true; weapon.charge = 0 }
    } else if (!input.jump) {
      if ((weapon.held || input.primaryTap) && !weapon.latched) launch(false)
      weapon.held = false; weapon.latched = false; weapon.charge = 0
    }
  } else weapon = { ...weapon, charge: 0, held: false, latched: false }
  if (boss && boss.phase !== 'defeated') {
    boss.timer -= dt
    if (boss.timer <= 0) {
      if (boss.phase === 'warning') {
        const danger = bossZones(boss).some((zone) => inDangerZone(player, zone))
        if (danger) hurt('수호자의 공격에 적중했다. 경고의 형태를 읽고 회피하라.')
        if (boss) { boss.phase = 'attack'; boss.timer = .55; events.push({ type: 'bossAttack', boss: { ...boss }, zones: bossZones(boss) }) }
      } else if (boss.phase === 'attack') { boss.phase = 'vulnerable'; boss.timer = boss.hp <= boss.maxHp / 2 ? 2.1 : 2.6 }
      else {
        boss.round++; boss.phase = 'warning'; boss.timer = boss.hp <= boss.maxHp / 2 ? 1.2 : 1.8
        boss.pattern = BOSS_PATTERNS[state.worldId][boss.round % 2]
        boss.angle = Math.atan2(player.y - boss.y, player.x - boss.x); boss.targetX = player.x; boss.targetY = player.y
      }
    }
    if (boss && Math.hypot(player.x - boss.x, player.y - boss.y) > 500) { boss = null; events.push({ type: 'notice', message: '전투 구역 이탈. 봉인에 다시 접근하면 재도전할 수 있다.' }) }
  }
  missiles = missiles.filter((missile) => {
    if (!boss || boss.phase === 'defeated' || missile.targetId !== boss.id) return false
    missile.age += dt
    const target = { x: boss.x, y: boss.y - 65 }, dx = target.x - missile.x, dy = target.y - missile.y, distance = Math.hypot(dx, dy)
    const travel = (missile.charged ? 760 : 580) * dt
    if (distance <= travel + 16) {
      const damage = missile.charged ? (boss.phase === 'vulnerable' ? 7 : 5) : (boss.phase === 'vulnerable' ? 2 : 1)
      boss.hp = Math.max(0, boss.hp - damage)
      events.push({ type: 'missileImpact', x: target.x, y: target.y, charged: missile.charged, damage })
      if (boss.hp === 0) {
        boss.phase = 'defeated'; boss.timer = 1.9; boss.landed = false
        events.push({ type: 'bossDefeated', boss: { ...boss } }, { type: 'collect', id: boss.id, message: '수호자 격파. 봉인의 기록을 확보했다.' })
      }
      return false
    }
    missile.x += dx / distance * travel; missile.y += dy / distance * travel
    return missile.age < 3
  })
  if (boss?.phase === 'defeated') {
    boss.timer -= dt
    if (!boss.landed && boss.timer <= .95) { boss.landed = true; events.push({ type: 'bossFall', x: boss.x, y: boss.y }) }
    if (boss.timer <= 0) boss = null
  }
  if (!boss) { missiles = []; weapon = { charge: 0, held: false, latched: false, cooldown: 0 } }
  const checkpoint = state.checkpoint + dt
  if (checkpoint >= 2) events.push({ type: 'position', position: { x: player.x, y: player.y } })
  return { state: { ...state, player, heartTimers, boss, missiles, weapon, shotSequence, cooldown, scan, nearest: nearest ? { ...nearest, distance: undefined } : null, time, moving: Math.hypot(player.x - state.player.x, player.y - state.player.y) > .1, checkpoint: checkpoint >= 2 ? 0 : checkpoint }, events }
}
