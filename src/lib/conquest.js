export const SAVE_KEY = 'ian-conquest-v1'
export const MAX_LEVEL = 20
export const MAX_TROOPS = 150

export function islandPath(polygon) {
  const middle = (a, b) => `${((a[0] + b[0]) / 2).toFixed(1)},${((a[1] + b[1]) / 2).toFixed(1)}`
  return `M${middle(polygon.at(-1), polygon[0])} ` + polygon.map((point, index) => `Q${point[0].toFixed(1)},${point[1].toFixed(1)} ${middle(point, polygon[(index + 1) % polygon.length])}`).join(' ') + 'Z'
}

export const FACTIONS = [
  { id: 'ninja', name: '닌자고팀', hero: '로이드', color: '#20885c', light: '#bee2bc', symbol: '✦', tagline: '초록 닌자, 조용하고 빠르게!', trait: '균형 잡힌 닌자 군단', growth: 1.1, speed: 1.12, attack: 1, defense: 1 },
  { id: 'sonic', name: '소닉팀', hero: '소닉', color: '#2674cf', light: '#b8d8f4', symbol: 'ϟ', tagline: '눈 깜짝하면 벌써 도착!', trait: '이동 속도 +45%', growth: 1, speed: 1.45, attack: 1, defense: 1 },
  { id: 'mario', name: '마리오팀', hero: '마리오', color: '#df5748', light: '#f4c1ad', symbol: 'M', tagline: '친구들이 쑥쑥 모여요!', trait: '병력 생산 +20%', growth: 1.2, speed: 1, attack: 1, defense: 1 },
  { id: 'demon', name: '마법천자문 악당팀', hero: '대마왕', color: '#8255a2', light: '#dbc5e7', symbol: '王', tagline: '대마왕의 힘으로 진격!', trait: '공격력 +20%', growth: 1, speed: 0.95, attack: 1.2, defense: 1 },
  { id: 'monkey', name: '마법천자문 손오공팀', hero: '손오공', color: '#d68a1c', light: '#f8dca0', symbol: '悟', tagline: '여의봉 들고, 모험 출발!', trait: '이동 +15% · 공격 +10%', growth: 1, speed: 1.15, attack: 1.1, defense: 1 },
  { id: 'iron', name: '어벤져스팀', hero: '아이언맨', color: '#258e9c', light: '#b6e4e3', symbol: '◈', tagline: '튼튼한 슈트로 땅을 지켜요!', trait: '방어력 +20%', growth: 1, speed: 1, attack: 1, defense: 1.2 },
]

const NAMES = ['첫 번째 깃발', '옆 섬으로 출발', '세 갈래 바닷길', '초록빛 군도', '모험은 지금부터', '바람의 해협', '이어지는 섬들', '작은 땅, 큰 작전', '여섯 깃발의 바다', '반짝이는 수평선', '황금빛 산호섬', '한 걸음 더 멀리', '거대한 군도', '빼앗고 지키고', '용감한 대장', '왕관의 대륙', '끝없는 진격', '마지막 바닷길', '정복왕의 도전', '내가 다 먹었다!']

export function getLevelConfig(level) {
  const number = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(level) || 1)))
  return { level: number, name: NAMES[number - 1], count: 12 + Math.floor((number - 1) * 24 / 19), playerStart: 62 - number, enemyStart: 11 + number, neutralStart: 4 + Math.floor(number * .75), aiInterval: 6.2 - number * .205, grace: 8.5 - number * .3, enemyGrowth: .6 + number * .026, region: ['초록빛 군도', '바람의 해협', '황금빛 산호섬', '왕관의 대륙'][Math.floor((number - 1) / 5)] }
}

function randomSequence(seed) {
  let value = seed >>> 0
  return () => { value = (Math.imul(1664525, value) + 1013904223) >>> 0; return value / 4294967296 }
}

// Clip a convex polygon to the half-plane nearest to this territory's center.
function clipCell(polygon, site, other) {
  const nx = other.x - site.x, ny = other.y - site.y
  const c = (other.x ** 2 + other.y ** 2 - site.x ** 2 - site.y ** 2) / 2
  const distance = (point) => point[0] * nx + point[1] * ny - c
  const output = []
  polygon.forEach((a, index) => {
    const b = polygon[(index + 1) % polygon.length], da = distance(a), db = distance(b)
    if (da <= 0) output.push(a)
    if ((da <= 0) !== (db <= 0)) {
      const t = da / (da - db)
      output.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    }
  })
  return output
}

export function createWorld(level, player = 0, portrait = false) {
  const config = getLevelConfig(level)
  const width = portrait ? 660 : 960, height = portrait ? 860 : 660
  const random = randomSequence(config.level * 7919)
  const rows = Math.round(Math.sqrt(config.count * height / width))
  const points = []
  for (let row = 0; row < rows; row++) {
    const columns = Math.floor(config.count / rows) + (row < config.count % rows ? 1 : 0)
    for (let column = 0; column < columns; column++) points.push({ id: points.length, x: 24 + (column + .5 + (random() - .5) * .33) * (width - 48) / columns, y: 24 + (row + .5 + (random() - .5) * .28) * (height - 48) / rows })
  }
  const anchors = [[.15, .8], [.15, .2], [.5, .13], [.85, .2], [.85, .8], [.5, .88]]
  const starts = []
  for (const [x, y] of anchors) {
    const point = points.filter((point) => !starts.includes(point.id)).sort((a, b) => Math.hypot(a.x - x * width, a.y - y * height) - Math.hypot(b.x - x * width, b.y - y * height))[0]
    starts.push(point.id)
  }
  const territories = points.map((point) => {
    let polygon = [[18, 18], [width - 18, 18], [width - 18, height - 18], [18, height - 18]]
    for (const other of points) if (other.id !== point.id) polygon = clipCell(polygon, point, other)
    polygon = polygon.map(([x, y]) => [point.x + (x - point.x) * .89, point.y + (y - point.y) * .89])
    const start = starts.indexOf(point.id)
    const owner = start < 0 ? -1 : (player + start) % FACTIONS.length
    return { ...point, polygon, path: islandPath(polygon), owner, troops: owner === player ? config.playerStart : owner === -1 ? config.neutralStart + Math.floor(random() * 5) : config.enemyStart, capturedAt: -10 }
  })
  return { config, player, width, height, territories, fleets: [], time: 0, nextFleetId: 1, nextAI: FACTIONS.map((_, index) => config.grace + index * .43), status: 'playing', captures: 0 }
}

export function sendTroops(world, fromId, toId, ratio = .75, owner = world.player) {
  if (world.status !== 'playing' || fromId === toId || !Number.isFinite(ratio) || ratio <= 0 || ratio > 1) return world
  const source = world.territories.find((item) => item.id === fromId)
  const target = world.territories.find((item) => item.id === toId)
  if (!source || !target || source.owner !== owner || owner < 0) return world
  const units = Math.floor(source.troops * ratio)
  if (units < 1 || world.fleets.length >= 180) return world
  const duration = Math.hypot(source.x - target.x, source.y - target.y) / (100 * FACTIONS[owner].speed) + .3
  return { ...world, nextFleetId: world.nextFleetId + 1, territories: world.territories.map((item) => item.id === fromId ? { ...item, troops: item.troops - units } : item), fleets: [...world.fleets, { id: world.nextFleetId, owner, fromId, toId, x: source.x, y: source.y, units, departure: world.time, duration }] }
}

function runAI(world, owner) {
  const own = world.territories.filter((item) => item.owner === owner && item.troops >= 8)
  if (!own.length) return world
  const incoming = (id, friendly) => world.fleets.filter((fleet) => fleet.toId === id && (fleet.owner === owner) === friendly).reduce((total, fleet) => total + fleet.units, 0)
  let best = null
  for (const from of own) {
    for (const to of world.territories) {
      if (to.owner === owner) continue
      const distance = Math.hypot(from.x - to.x, from.y - to.y)
      const defense = to.owner < 0 ? 1 : FACTIONS[to.owner].defense
      const needed = Math.max(0, to.troops * defense - incoming(to.id, true) * FACTIONS[owner].attack)
      const strength = from.troops * .75 * FACTIONS[owner].attack
      if (strength < needed + 2 || needed === 0 && incoming(to.id, true) > 0) continue
      const score = 110 - distance * .13 - needed * .7 + (to.owner === -1 ? 12 : 18)
      if (!best || score > best.score) best = { from, to, score }
    }
  }
  if (best) return sendTroops(world, best.from.id, best.to.id, .75, owner)
  // A quiet rear island can reinforce the frontier instead of hoarding soldiers.
  const enemies = world.territories.filter((item) => item.owner !== owner)
  if (!enemies.length || own.length < 2) return world
  const frontier = (item) => Math.min(...enemies.map((enemy) => Math.hypot(item.x - enemy.x, item.y - enemy.y)))
  const sorted = [...own].sort((a, b) => frontier(a) - frontier(b))
  const rear = sorted.at(-1), front = sorted[0]
  if (rear.troops >= 24 && front.troops < 100 && incoming(front.id, true) < 40) return sendTroops(world, rear.id, front.id, .5, owner)
  return world
}

export function getOutcome(world) {
  const hasLand = world.territories.some((item) => item.owner === world.player)
  const hasArmy = world.fleets.some((fleet) => fleet.owner === world.player)
  if (!hasLand && !hasArmy) return 'lost'
  if (world.territories.every((item) => item.owner === world.player) && !world.fleets.some((fleet) => fleet.owner !== world.player)) return 'won'
  return 'playing'
}

export function tickWorld(previous, delta) {
  if (previous.status !== 'playing' || !Number.isFinite(delta) || delta <= 0) return previous
  const dt = Math.min(delta, .1)
  let world = { ...previous, time: previous.time + dt, territories: previous.territories.map((item) => item.owner < 0 ? item : { ...item, troops: Math.min(MAX_TROOPS, item.troops + dt * (item.owner === previous.player ? 1.25 : previous.config.enemyGrowth) * FACTIONS[item.owner].growth) }), nextAI: [...previous.nextAI] }
  const arriving = world.fleets.filter((fleet) => world.time >= fleet.departure + fleet.duration).sort((a, b) => a.departure + a.duration - b.departure - b.duration || a.id - b.id)
  world.fleets = world.fleets.filter((fleet) => world.time < fleet.departure + fleet.duration)
  for (const fleet of arriving) {
    const target = world.territories.find((item) => item.id === fleet.toId)
    let replacement
    if (target.owner === fleet.owner) replacement = { ...target, troops: Math.min(MAX_TROOPS, target.troops + fleet.units) }
    else {
      const defense = target.owner < 0 ? 1 : FACTIONS[target.owner].defense
      const attack = FACTIONS[fleet.owner].attack
      const remaining = target.troops * defense - fleet.units * attack
      replacement = remaining < 0 ? { ...target, owner: fleet.owner, troops: Math.min(MAX_TROOPS, -remaining / attack), capturedAt: world.time } : { ...target, troops: remaining / defense }
      if (remaining < 0 && fleet.owner === world.player) world.captures++
    }
    world.territories = world.territories.map((item) => item.id === target.id ? replacement : item)
  }
  world.status = getOutcome(world)
  if (world.status !== 'playing') return world
  for (let owner = 0; owner < FACTIONS.length; owner++) {
    if (owner === world.player || world.time < world.nextAI[owner]) continue
    world.nextAI[owner] = world.time + world.config.aiInterval + ((owner + world.config.level) % 3) * .17
    world = runAI(world, owner)
  }
  return world
}

export function readProgress(storage) {
  const empty = { selected: 0, cleared: Array(6).fill(0), stars: {} }
  try {
    const data = JSON.parse(storage.getItem(SAVE_KEY))
    if (!data || typeof data !== 'object') return empty
    return { selected: Number.isInteger(data.selected) && data.selected >= 0 && data.selected < 6 ? data.selected : 0, cleared: empty.cleared.map((_, i) => Math.max(0, Math.min(20, Math.floor(Number(data.cleared?.[i]) || 0)))), stars: Object.fromEntries(Object.entries(data.stars || {}).filter(([key, value]) => /^[0-5]-(?:[1-9]|1[0-9]|20)$/.test(key) && Number.isInteger(value) && value >= 1 && value <= 3)) }
  } catch { return empty }
}

export function recordWin(progress, world) {
  if (world.status !== 'won') return progress
  const key = `${world.player}-${world.config.level}`
  const stars = world.time < 80 + world.config.level * 10 ? 3 : world.time < 160 + world.config.level * 15 ? 2 : 1
  return { ...progress, selected: world.player, cleared: progress.cleared.map((value, index) => index === world.player ? Math.max(value, world.config.level) : value), stars: { ...progress.stars, [key]: Math.max(progress.stars[key] || 0, stars) } }
}
