import { addRunTime, finishRun, normalizeRuns, startRun } from './treasureRuns.js'
import { MAP, WORLDS, RESTORATIONS, clampPosition, hazardsFor, heartsFor, treasuresFor } from './treasureContent.js'
export { MAP, WORLDS, RESTORATIONS, TYPE_LABELS, PROLOGUE, clampPosition, hazardsFor, heartsFor, sceneryFor, trailsFor, treasuresFor, puzzleFor, missionChallenge, rotateMask, circuitConnected, routeValid } from './treasureContent.js'
export const SAVE_KEY = 'ian-treasure-kingdom-v1'
export const BACKUP_KEY = `${SAVE_KEY}-backup`
export const ALL_TREASURES = WORLDS.flatMap((world) => treasuresFor(world.id))
const VALID_IDS = new Set(ALL_TREASURES.map((item) => item.id))
const QUEST_IDS = new Set(ALL_TREASURES.filter((item) => item.type === 'friend').map((item) => item.id))
const QUEST_ITEMS = new Set(ALL_TREASURES.flatMap((item) => item.targets.map((target) => target.id)))
const HIDDEN_IDS = new Set(ALL_TREASURES.filter((item) => item.type === 'hidden').map((item) => item.id))
const uniqueIds = (value, allowed = VALID_IDS) => Array.isArray(value) ? [...new Set(value.filter((id) => allowed.has(id)))] : []
export const emptyProgress = () => ({ version: 1, collected: [], banked: [], quests: [], questItems: [], revealed: [], positions: {}, lastWorld: 0, revision: 0, run: null, history: [] })

export function normalizeProgress(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.collected)) return null
  const collected = uniqueIds(value.collected)
  // A final guardian defeated before the three-reward update also earns its two new relics.
  for (const world of WORLDS) if (collected.includes(`${world.id}-24`)) for (const index of [22, 23]) {
    const id = `${world.id}-${index}`
    if (!collected.includes(id)) collected.push(id)
  }
  const banked = uniqueIds(value.banked).filter((id) => collected.includes(id))
  const positions = {}
  for (const world of WORLDS) {
    const point = value.positions?.[world.id]
    if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) positions[world.id] = clampPosition(point)
  }
  return { ...normalizeRuns(value, banked.length === 100), version: 1, collected, banked, quests: uniqueIds(value.quests, QUEST_IDS), questItems: uniqueIds(value.questItems, QUEST_ITEMS), revealed: uniqueIds(value.revealed, HIDDEN_IDS), positions, lastWorld: Number.isInteger(value.lastWorld) && value.lastWorld >= 0 && value.lastWorld < 4 ? value.lastWorld : 0, revision: Number.isSafeInteger(value.revision) && value.revision >= 0 && value.revision < Number.MAX_SAFE_INTEGER ? value.revision : 0 }
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
  if (action.type === 'collect') {
    const ids = uniqueIds(action.ids || [action.id]).filter((id) => !progress.collected.includes(id))
    if (ids.length) next = { ...progress, collected: [...progress.collected, ...ids] }
  }
  if (action.type === 'quest' && QUEST_IDS.has(action.id) && !progress.quests.includes(action.id)) next = { ...progress, quests: [...progress.quests, action.id] }
  if (action.type === 'questItem' && QUEST_ITEMS.has(action.id) && !progress.questItems.includes(action.id)) next = { ...progress, questItems: [...progress.questItems, action.id] }
  if (action.type === 'reveal' && HIDDEN_IDS.has(action.id) && !progress.revealed.includes(action.id)) next = { ...progress, revealed: [...progress.revealed, action.id] }
  if (action.type === 'startRun') next = startRun(progress, action.now)
  if (action.type === 'elapsed') next = addRunTime(progress, action.deltaMs)
  if (action.type === 'deposit') {
    next = { ...progress, banked: [...progress.collected] }
    if (next.banked.length === 100) next = { ...next, ...finishRun(next, action.now) }
  }
  if (action.type === 'restart' && progress.banked.length === 100) next = { ...emptyProgress(), history: progress.history }
  if (action.type === 'position' && WORLDS[action.worldId] && Number.isFinite(action.position?.x) && Number.isFinite(action.position?.y)) next = { ...progress, positions: { ...progress.positions, [action.worldId]: clampPosition(action.position) }, lastWorld: action.worldId }
  return next === progress ? progress : { ...next, revision: progress.revision + 1 }
}

export const BOSS_PATTERNS = [['ring', 'charge', 'cone', 'orbs', 'cross', 'roots'], ['cone', 'orbs', 'charge', 'cross', 'ring', 'roots'], ['cross', 'ring', 'roots', 'orbs', 'cone', 'charge'], ['roots', 'cone', 'ring', 'charge', 'cross', 'orbs']]
export const bossElement = (worldId, rank, round) => ['water', 'fire', 'electric'][(worldId + rank + round) % 3]
export function createExpedition(worldId, progress) {
  const saved = progress.positions[worldId] || MAP.spawn
  const position = clampPosition(saved)
  return { worldId, player: { ...position, jump: 0, facing: 1, hp: 4, stamina: 100, dash: 0, invulnerable: 1.5 }, time: 0, boss: null, cooldown: 0, scan: 0, checkpoint: 0, nearest: null, moving: false, heartTimers: {}, missiles: [], weapon: { charge: 0, held: false, latched: false, cooldown: 0 }, shotSequence: 0, escorts: {}, breadcrumbs: [] }
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
// All terrain and scenery inside the map are passable. Hazards only deal damage.
export function canWalk(point) {
  return Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 160 && point.x <= MAP.width - 160 && point.y >= 175 && point.y <= MAP.height - 160
}
export function findWalkPath(_start, target) {
  return [clampPosition(target)]
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
  const next = clampPosition({ x: player.x + dx * speed * dt, y: player.y + dy * speed * .82 * dt })
  player.x = next.x; player.y = next.y
  if (dx) player.facing = Math.sign(dx)
  if (magnitude > 0) player.movingNorth = dy < -.2
  const worldItems = treasuresFor(state.worldId)
  const items = worldItems.filter((item) => !progress.collected.includes(item.id) && item.type !== 'bossReward')
  const breadcrumbs = [...(state.breadcrumbs || []).filter((point) => point.time >= time - .8), { x: player.x, y: player.y, time }]
  const escorts = {}
  for (const item of worldItems.filter((item) => item.missionMode === 'rescue' && progress.quests.includes(item.id) && !progress.collected.includes(item.id) && item.targets.every((target) => progress.questItems.includes(target.id)))) {
    const point = (state.escorts?.[item.id] && breadcrumbs.find((point) => point.time >= time - .25)) || player
    escorts[item.id] = { x: point.x, y: point.y }
  }
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
  let nearest = items.reduce((found, item) => {
    const distance = Math.hypot(item.x - player.x, item.y - player.y)
    if (item.type === 'hidden' && !progress.revealed.includes(item.id)) return found
    return distance < 105 && (!found || distance < found.distance) ? { ...item, distance } : found
  }, null)
  for (const quest of worldItems.filter((item) => item.type === 'friend' && progress.quests.includes(item.id) && !progress.collected.includes(item.id))) {
    const step = quest.targets.findIndex((target) => !progress.questItems.includes(target.id)), target = quest.targets[step]
    if (target && Math.hypot(target.x - player.x, target.y - player.y) < 85) nearest = { ...target, type: 'missionSite', quest, step }
  }
  for (const item of items) {
    const distance = Math.hypot(item.x - player.x, item.y - player.y)
    if ((item.type === 'explore' || (item.type === 'hidden' && progress.revealed.includes(item.id))) && distance < 34) events.push({ type: 'collect', id: item.id, message: `기록핵 확보 · ${item.name}` })
    if (item.type === 'jump' && distance < 44 && airborne) events.push({ type: 'collect', id: item.id, message: `상층 기록 회수 · ${item.name}` })
  }
  if (input.interact && cooldown === 0 && !boss) {
    cooldown = .5
    if (nearest?.type === 'missionSite') events.push({ type: 'missionSite', item: nearest.quest, step: nearest.step })
    else if (nearest?.type === 'puzzle') events.push({ type: 'puzzle', item: nearest })
    else if (nearest?.type === 'friend') {
      const escort = escorts[nearest.id]
      events.push({ type: 'friend', item: nearest, escortReady: Boolean(escort && Math.hypot(escort.x - nearest.x, escort.y - nearest.y) < 180) })
    } else if (nearest?.type === 'boss') {
      const needed = nearest.required
      if (worldCount(progress, state.worldId) >= needed) {
        const hp = [12, 18, 24][nearest.bossRank]
        boss = { id: nearest.id, rank: nearest.bossRank, element: bossElement(state.worldId, nearest.bossRank, 0), x: nearest.x, y: nearest.y, hp, maxHp: hp, phase: 'warning', timer: 1.8, round: 0, pattern: BOSS_PATTERNS[state.worldId][nearest.bossRank * 2], angle: Math.atan2(player.y - nearest.y, player.x - nearest.x), targetX: player.x, targetY: player.y }
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
        boss.pattern = BOSS_PATTERNS[state.worldId][(boss.round + (boss.rank || 0) * 2) % 6]
        boss.element = bossElement(state.worldId, boss.rank || 0, boss.round)
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
        const ids = (boss.rank === 2 ? [22, 23, 24].map((index) => `${state.worldId}-${index}`) : [boss.id]).filter((id) => !progress.collected.includes(id))
        events.push({ type: 'bossDefeated', boss: { ...boss } }, { type: 'collect', id: boss.id, ids, amount: ids.length, message: `수호자 격파. 보물 ${ids.length}개를 확보했다.` })
      }
      return false
    }
    missile.x += dx / distance * travel; missile.y += dy / distance * travel
    return missile.age < 3
  })
  if (boss?.phase === 'defeated') {
    boss.timer -= dt
    if (!boss.landed && boss.timer <= .95) { boss.landed = true; events.push({ type: 'bossFall', x: boss.x, y: boss.y, rewardCount: boss.rank === 2 ? 3 : 1 }) }
    if (boss.timer <= 0) boss = null
  }
  if (!boss) { missiles = []; weapon = { charge: 0, held: false, latched: false, cooldown: 0 } }
  const checkpoint = state.checkpoint + dt
  if (checkpoint >= 2) events.push({ type: 'position', position: { x: player.x, y: player.y } })
  return { state: { ...state, player, heartTimers, boss, missiles, weapon, shotSequence, escorts, breadcrumbs, cooldown, scan, nearest: nearest ? { ...nearest, distance: undefined } : null, time, moving: Math.hypot(player.x - state.player.x, player.y - state.player.y) > .1, checkpoint: checkpoint >= 2 ? 0 : checkpoint }, events }
}
