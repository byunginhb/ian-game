import { MAP, WORLDS, RESTORATIONS, clampPosition, hazardsFor, sceneryFor, treasuresFor } from './treasureContent.js'
export { MAP, WORLDS, RESTORATIONS, TYPE_LABELS, PROLOGUE, clampPosition, hazardsFor, sceneryFor, treasuresFor, puzzleFor, rotateMask, circuitConnected, routeValid } from './treasureContent.js'
export const SAVE_KEY = 'ian-treasure-kingdom-v1'
export const BACKUP_KEY = `${SAVE_KEY}-backup`
export const ALL_TREASURES = WORLDS.flatMap((world) => treasuresFor(world.id))
const VALID_IDS = new Set(ALL_TREASURES.map((item) => item.id))
const QUEST_IDS = new Set(ALL_TREASURES.filter((item) => item.type === 'friend').map((item) => item.id))
const QUEST_ITEMS = new Set(ALL_TREASURES.flatMap((item) => item.targets.map((target) => target.id)))
const HIDDEN_IDS = new Set(ALL_TREASURES.filter((item) => item.type === 'hidden').map((item) => item.id))
const SCENERY = WORLDS.map((world) => sceneryFor(world.id))
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
  return { worldId, player: { ...(progress.positions[worldId] || MAP.spawn), jump: 0, facing: 1, hp: 4, stamina: 100, dash: 0, invulnerable: 1.5 }, time: 0, boss: null, cooldown: 0, scan: 0, checkpoint: 0, nearest: null, moving: false }
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
function canWalk(point, worldId, jumping) {
  return jumping || !SCENERY[worldId].some((object) => Math.hypot(point.x - object.x, (point.y - object.y) * 1.7) < object.radius + 11)
}

export function findWalkPath(start, target, worldId) {
  const size = 32, columns = 50, rows = 31
  const point = (cell) => clampPosition({ x: 160 + cell % columns * size, y: 175 + Math.floor(cell / columns) * size })
  const nearest = (position) => Array.from({ length: columns * rows }, (_, cell) => cell).filter((cell) => canWalk(point(cell), worldId, false)).reduce((best, cell) => Math.hypot(point(cell).x - position.x, point(cell).y - position.y) < Math.hypot(point(best).x - position.x, point(best).y - position.y) ? cell : best, 0)
  const first = nearest(start), last = nearest(clampPosition(target)), previous = new Map([[first, null]]), costs = new Map([[first, 0]]), open = [first]
  while (open.length) {
    let best = 0
    for (let i = 1; i < open.length; i++) if (costs.get(open[i]) + Math.hypot(point(open[i]).x - point(last).x, point(open[i]).y - point(last).y) < costs.get(open[best]) + Math.hypot(point(open[best]).x - point(last).x, point(open[best]).y - point(last).y)) best = i
    const cell = open.splice(best, 1)[0]
    if (cell === last) {
      const route = []
      for (let current = last; current !== null; current = previous.get(current)) route.unshift(point(current))
      if (canWalk(clampPosition(target), worldId, false)) route.push(clampPosition(target))
      return route
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const x = cell % columns + dx, y = Math.floor(cell / columns) + dy, next = y * columns + x
      if (x < 0 || x >= columns || y < 0 || y >= rows || !canWalk(point(next), worldId, false)) continue
      const midpoint = { x: (point(cell).x + point(next).x) / 2, y: (point(cell).y + point(next).y) / 2 }
      if (!canWalk(midpoint, worldId, false)) continue
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
  let cooldown = Math.max(0, state.cooldown - dt), scan = Math.max(0, state.scan - dt)
  player.jump = Math.max(0, player.jump - dt)
  player.dash = Math.max(0, player.dash - dt)
  player.invulnerable = Math.max(0, player.invulnerable - dt)
  player.stamina = Math.min(100, player.stamina + dt * 24)
  let dx = Number(Boolean(input.right)) - Number(Boolean(input.left)), dy = Number(Boolean(input.down)) - Number(Boolean(input.up))
  if (input.target && !dx && !dy) {
    const distance = Math.hypot(input.target.x - player.x, input.target.y - player.y)
    if (distance > 13) { dx = (input.target.x - player.x) / distance; dy = (input.target.y - player.y) / distance }
    else events.push({ type: 'arrived' })
  }
  const magnitude = Math.hypot(dx, dy)
  if (magnitude) { dx /= magnitude; dy /= magnitude }
  if (input.dash && !player.dash && cooldown === 0 && player.stamina >= 30) { player.dash = .23; player.stamina -= 30; player.invulnerable = .35; cooldown = .45; events.push({ type: 'dash' }) }
  if (input.jump && player.jump === 0) player.jump = state.worldId === 2 ? 1.05 : .76
  const speed = player.dash ? 680 : 255
  const nextX = clampPosition({ x: player.x + dx * speed * dt, y: player.y })
  const nextY = clampPosition({ x: player.x, y: player.y + dy * speed * .82 * dt })
  if (canWalk(nextX, state.worldId, player.jump > .1 || player.dash > 0)) player.x = nextX.x
  if (canWalk({ x: player.x, y: nextY.y }, state.worldId, player.jump > .1 || player.dash > 0)) player.y = nextY.y
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
  if (!boss) for (const hazard of hazardsFor(state.worldId, time)) if (hazard.active && Math.hypot((player.x - hazard.x) / hazard.rx, (player.y - hazard.y) / hazard.ry) < 1) hurt(`${hazard.kind}에 휩쓸렸다. 도약 또는 회피로 통과할 수 있다.`)
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
        const hp = nearest.index === 24 ? 6 : 4
        boss = { id: nearest.id, x: nearest.x, y: nearest.y, hp, maxHp: hp, phase: 'warning', timer: 1.8, round: 0, pattern: BOSS_PATTERNS[state.worldId][0], angle: Math.atan2(player.y - nearest.y, player.x - nearest.x), targetX: player.x, targetY: player.y }
        events.push({ type: 'notice', message: '봉인 반응 감지. 경고 영역을 회피하고 노출된 코어를 공격하라.' })
      } else events.push({ type: 'notice', message: `봉인 해제에 이 구역의 기록핵 ${needed}개가 필요하다.` })
    } else if (scan === 0) {
      scan = 2.5
      const hidden = items.filter((item) => item.type === 'hidden' && !progress.revealed.includes(item.id) && Math.hypot(item.x - player.x, item.y - player.y) < 210)
      hidden.forEach((item) => events.push({ type: 'reveal', id: item.id }))
      events.push({ type: 'scan', message: hidden.length ? '매몰된 기록의 위치를 감지했다.' : '탐지 펄스 발사. 근처에 추가 신호가 없다.' })
    }
  }
  if (boss) {
    boss.timer -= dt
    if (boss.timer <= 0) {
      if (boss.phase === 'warning') {
        const danger = bossZones(boss).some((zone) => inDangerZone(player, zone))
        if (danger) hurt('수호자의 공격에 적중했다. 경고의 형태를 읽고 회피하라.')
        if (boss) { boss.phase = 'attack'; boss.timer = .32 }
      } else if (boss.phase === 'attack') { boss.phase = 'vulnerable'; boss.timer = boss.hp <= boss.maxHp / 2 ? 2.1 : 2.6 }
      else {
        boss.round++; boss.phase = 'warning'; boss.timer = boss.hp <= boss.maxHp / 2 ? 1.2 : 1.8
        boss.pattern = BOSS_PATTERNS[state.worldId][boss.round % 2]
        boss.angle = Math.atan2(player.y - boss.y, player.x - boss.x); boss.targetX = player.x; boss.targetY = player.y
      }
    }
    if (boss && input.interact && cooldown === 0 && boss.phase === 'vulnerable' && Math.hypot(player.x - boss.x, player.y - boss.y) < 280) {
      boss.hp--; cooldown = .5; events.push({ type: 'hit' })
      if (boss.hp === 0) { events.push({ type: 'collect', id: boss.id, message: '봉인 해제. 수호자의 기억이 기록에 추가됐다.' }); boss = null }
      else { boss.phase = 'warning'; boss.timer = boss.hp <= boss.maxHp / 2 ? 1.2 : 1.8; boss.round++; boss.pattern = BOSS_PATTERNS[state.worldId][boss.round % 2]; boss.angle = Math.atan2(player.y - boss.y, player.x - boss.x); boss.targetX = player.x; boss.targetY = player.y }
    }
    if (boss && Math.hypot(player.x - boss.x, player.y - boss.y) > 500) { boss = null; events.push({ type: 'notice', message: '전투 구역 이탈. 봉인에 다시 접근하면 재도전할 수 있다.' }) }
  }
  const checkpoint = state.checkpoint + dt
  if (checkpoint >= 2) events.push({ type: 'position', position: { x: player.x, y: player.y } })
  return { state: { ...state, player, boss, cooldown, scan, nearest: nearest ? { ...nearest, distance: undefined } : null, time, moving: magnitude > 0, checkpoint: checkpoint >= 2 ? 0 : checkpoint }, events }
}
