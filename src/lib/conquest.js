export const SAVE_KEY = 'ian-conquest-v1'
export const ADULT_SAVE_KEY = 'ian-conquest-adult-v1'
export const DIFFICULTIES = {
  child: { label: '아이', subtitle: '차근차근 즐기는 모험', description: '군사를 모을 시간은 넉넉하게! 작은 땅부터 하나씩 차지해요.', symbol: '⚑' },
  adult: { label: '어른', subtitle: '빠른 판단, 치열한 승부', description: '빠르게 확장하는 상대와 한판! 공격과 지원의 타이밍을 노려요.', symbol: '♜' },
}
export const progressKey = (difficulty) => difficulty === 'adult' ? ADULT_SAVE_KEY : SAVE_KEY
export const MAX_LEVEL = 20
export const MAX_TROOPS = 150
export const WAVE_SIZE = 5
export const WAVE_INTERVAL = .32
const COLLISION_DISTANCE = 14
const CLASH_LIFETIME = .36

export function islandPath(polygon) {
  const toward = (a, b) => {
    const t = Math.min(.18, 5 / Math.hypot(b[0] - a[0], b[1] - a[1]))
    return `${(a[0] + (b[0] - a[0]) * t).toFixed(2)},${(a[1] + (b[1] - a[1]) * t).toFixed(2)}`
  }
  return `M${toward(polygon[0], polygon.at(-1))} ` + polygon.map((point, index) => `L${toward(point, polygon[(index + polygon.length - 1) % polygon.length])} Q${point[0].toFixed(2)},${point[1].toFixed(2)} ${toward(point, polygon[(index + 1) % polygon.length])}`).join(' ') + 'Z'
}

export function containsPoint(polygon, point) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[i], [bx, by] = polygon[j]
    if ((ay > point.y) !== (by > point.y) && point.x < (bx - ax) * (point.y - ay) / (by - ay) + ax) inside = !inside
  }
  return inside
}

export function territoryAt(world, point) {
  if (!point) return null
  // The number badge remains a forgiving touch target on narrow peninsulas.
  return world.territories.find((land) => Math.abs(land.x - point.x) <= 26 && point.y >= land.y + 5 && point.y <= land.y + 34)
    || world.territories.find((land) => containsPoint(land.polygon, point)) || null
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

export function getLevelConfig(level, difficulty = 'child') {
  const number = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(level) || 1)))
  const config = { level: number, difficulty: 'child', name: NAMES[number - 1], count: 12 + Math.floor((number - 1) * 24 / 19), playerStart: 62 - number, enemyStart: 11 + number, neutralStart: 4 + Math.floor(number * .75), aiInterval: 6.2 - number * .205, grace: 8.5 - number * .3, enemyGrowth: .6 + number * .026, region: ['초록빛 군도', '바람의 해협', '황금빛 산호섬', '왕관의 대륙'][Math.floor((number - 1) / 5)] }
  if (difficulty !== 'adult') return config
  return { ...config, difficulty: 'adult', playerStart: 44 - Math.floor(number * .4), enemyStart: 30 + Math.floor(number * .8), neutralStart: 6 + Math.floor(number * .6), aiInterval: 1.9 - number * .05, grace: 2.6 - number * .065, enemyGrowth: 1.15 + number * .023, aiOrders: 1 + Math.floor((number - 1) / 7) }
}

function randomSequence(seed) {
  let value = seed >>> 0
  return () => { value = (Math.imul(1664525, value) + 1013904223) >>> 0; return value / 4294967296 }
}

// Clip a convex polygon to the half-plane nearest to this territory's center.
function clipCell(polygon, site, other, inset = 0) {
  const nx = other.x - site.x, ny = other.y - site.y
  const c = (other.x ** 2 + other.y ** 2 - site.x ** 2 - site.y ** 2) / 2 - inset * Math.hypot(nx, ny)
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

function createGeography(config, width, height, random) {
  const boundary = [[24, 56], [width * .24, 22], [width * .8, 28], [width - 24, 65], [width - 22, height * .76], [width * .82, height - 24], [width * .28, height - 22], [24, height * .86]]
  const spacing = Math.max(84, Math.min(130, Math.sqrt((width - 140) * (height - 150) / config.count) * .66))
  const points = []
  for (let id = 0; id < config.count; id++) {
    let best, clearance = -1
    for (let attempt = 0; attempt < 1200; attempt++) {
      const candidate = { id, x: 70 + random() * (width - 140), y: 80 + random() * (height - 150) }
      if (!containsPoint(boundary, candidate)) continue
      const distance = Math.min(...points.map((other) => Math.hypot(other.x - candidate.x, other.y - candidate.y)))
      if (distance > clearance) { best = candidate; clearance = distance }
      if (distance >= spacing) break
    }
    points.push(best)
  }
  // Each map has connected countries, separate islands, and differently placed straits.
  const layouts = [
    [[.24, .27], [.76, .3], [.5, .79]],
    [[.22, .3], [.72, .67]],
    [[.2, .24], [.76, .23], [.22, .78], [.77, .77]],
    [[.25, .52], [.74, .22], [.72, .8]],
  ]
  const centers = layouts[(config.level - 1) % layouts.length].map(([x, y]) => ({ x: (x + (random() - .5) * .12) * width, y: (y + (random() - .5) * .12) * height }))
  for (const point of points) point.continent = centers.reduce((best, center, index) => Math.hypot(point.x - center.x, point.y - center.y) < Math.hypot(point.x - centers[best].x, point.y - centers[best].y) ? index : best, 0)
  // An offshore outpost adds a longer crossing even when nearby countries touch.
  points[Math.floor(random() * points.length)].continent = centers.length
  const sea = []
  for (let index = 0; index < 2; index++) {
    let best, clearance = 0
    for (let attempt = 0; attempt < 100; attempt++) {
      const candidate = { x: width * (.16 + random() * .68), y: height * (.16 + random() * .68) }
      const distance = Math.min(...[...points, ...sea].map((other) => Math.hypot(other.x - candidate.x, other.y - candidate.y)))
      if (distance > clearance) { best = candidate; clearance = distance }
    }
    if (clearance > spacing * .95) sea.push(best)
  }
  return points.map((point) => {
    let cell = boundary
    for (const other of points) if (other.id !== point.id) {
      const gap = point.continent === other.continent ? 0 : 9 + ((point.continent + other.continent + config.level) % 4) * 4
      cell = clipCell(cell, point, other, gap)
    }
    for (const water of sea) cell = clipCell(cell, point, water)
    const polygon = []
    const neighbors = []
    for (let index = 0; index < cell.length; index++) {
      const a = cell[index], b = cell[(index + 1) % cell.length]
      const middle = { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 }
      const neighbor = points.find((other) => other.id !== point.id && other.continent === point.continent && Math.abs(Math.hypot(middle.x - point.x, middle.y - point.y) - Math.hypot(middle.x - other.x, middle.y - other.y)) < .001)
      polygon.push(a)
      if (neighbor) { neighbors.push(neighbor.id); continue }
      const length = Math.hypot(b[0] - a[0], b[1] - a[1])
      const sections = Math.max(2, Math.ceil(length / 44))
      for (let part = 1; part < sections; part++) {
        const t = part / sections
        const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t
        const distance = Math.hypot(point.x - x, point.y - y)
        const indent = Math.min(distance * .1, 3 + random() * 10)
        polygon.push([x + (point.x - x) * indent / distance, y + (point.y - y) * indent / distance])
      }
    }
    return { ...point, polygon, neighbors, path: islandPath(polygon) }
  })
}

export function createWorld(level, player = 0, portrait = false, difficulty = 'child') {
  const config = getLevelConfig(level, difficulty)
  const width = portrait ? 660 : 960, height = portrait ? 860 : 660
  const random = randomSequence(config.level * 7919)
  const points = createGeography(config, width, height, random)
  const anchors = [[.15, .8], [.15, .2], [.5, .13], [.85, .2], [.85, .8], [.5, .88]]
  const starts = []
  for (const [x, y] of anchors) {
    const point = points.filter((point) => !starts.includes(point.id)).sort((a, b) => Math.hypot(a.x - x * width, a.y - y * height) - Math.hypot(b.x - x * width, b.y - y * height))[0]
    starts.push(point.id)
  }
  const territories = points.map((point) => {
    const start = starts.indexOf(point.id)
    const owner = start < 0 ? -1 : (player + start) % FACTIONS.length
    return { ...point, owner, troops: owner === player ? config.playerStart : owner === -1 ? config.neutralStart + Math.floor(random() * 5) : config.enemyStart, capturedAt: -10 }
  })
  return { config, player, width, height, territories, fleets: [], clashes: [], time: 0, nextFleetId: 1, nextAI: FACTIONS.map((_, index) => config.grace + index * .43), status: 'playing', captures: 0 }
}

export function sendTroops(world, fromId, toId, owner = world.player) {
  if (world.status !== 'playing' || fromId === toId || !Number.isInteger(owner) || !FACTIONS[owner]) return world
  const source = world.territories.find((item) => item.id === fromId)
  const target = world.territories.find((item) => item.id === toId)
  if (!source || !target || source.owner !== owner || owner < 0) return world
  const units = Math.floor(source.troops)
  if (units < 1 || world.fleets.length >= 180) return world
  const duration = Math.hypot(source.x - target.x, source.y - target.y) / (100 * FACTIONS[owner].speed) + .3
  const readyAt = Math.max(world.time, ...world.fleets.filter((fleet) => fleet.fromId === fromId && fleet.owner === owner).map((fleet) => fleet.departure + Math.ceil(fleet.totalUnits / WAVE_SIZE) * WAVE_INTERVAL))
  return { ...world, nextFleetId: world.nextFleetId + 1, territories: world.territories.map((item) => item.id === fromId ? { ...item, troops: item.troops - units } : item), fleets: [...world.fleets, { id: world.nextFleetId, owner, fromId, toId, x: source.x, y: source.y, units, totalUnits: units, arrived: 0, casualties: [], departure: readyAt, duration }] }
}

function soldierPosition(fleet, target, index, time) {
  const dx = target.x - fleet.x, dy = target.y - fleet.y, distance = Math.hypot(dx, dy) || 1
  const wave = Math.floor(index / WAVE_SIZE)
  const progress = Math.max(0, Math.min(1, (time - fleet.departure - wave * WAVE_INTERVAL) / fleet.duration))
  const rowSize = Math.min(WAVE_SIZE, fleet.totalUnits - wave * WAVE_SIZE)
  const spread = .8 + .2 * Math.sin(progress * Math.PI)
  const offset = (index % WAVE_SIZE - (rowSize - 1) / 2) * 18 * spread
  return { id: index, wave, x: fleet.x + dx * progress - dy / distance * offset, y: fleet.y + dy * progress + dx / distance * offset }
}

export function marchingSoldiers(fleet, target, time) {
  const soldiers = []
  const casualties = new Set(fleet.casualties)
  for (let index = fleet.arrived; index < fleet.totalUnits; index++) {
    if (casualties.has(index)) continue
    const wave = Math.floor(index / WAVE_SIZE)
    const progress = (time - fleet.departure - wave * WAVE_INTERVAL) / fleet.duration
    if (progress < 0) break
    if (progress >= 1) continue
    soldiers.push(soldierPosition(fleet, target, index, time))
  }
  return soldiers
}

function contactDuringStep(a, b) {
  const start = Math.max(a.start, b.start), end = Math.min(a.end, b.end)
  if (end <= start) return null
  const at = (soldier, time) => {
    const t = (time - soldier.start) / (soldier.end - soldier.start)
    return { x: soldier.from.x + (soldier.to.x - soldier.from.x) * t, y: soldier.from.y + (soldier.to.y - soldier.from.y) * t }
  }
  const a0 = at(a, start), b0 = at(b, start), a1 = at(a, end), b1 = at(b, end)
  const rx = a0.x - b0.x, ry = a0.y - b0.y
  const vx = a1.x - a0.x - b1.x + b0.x, vy = a1.y - a0.y - b1.y + b0.y
  const c = rx * rx + ry * ry - COLLISION_DISTANCE ** 2
  let t = 0
  if (c > 0) {
    const speed = vx * vx + vy * vy
    if (speed < 1e-12) return null
    const dot = rx * vx + ry * vy, discriminant = dot * dot - speed * c
    if (discriminant < 0) return null
    t = (-dot - Math.sqrt(discriminant)) / speed
    if (t < 0 || t > 1) return null
  }
  const time = start + (end - start) * t
  if (time >= a.arrival || time >= b.arrival) return null
  return { a, b, time, x: (a0.x + b0.x + (a1.x - a0.x + b1.x - b0.x) * t) / 2, y: (a0.y + b0.y + (a1.y - a0.y + b1.y - b0.y) * t) / 2 }
}

function collideArmies(world, since) {
  const clashes = (world.clashes || []).filter((clash) => world.time - clash.time < CLASH_LIFETIME)
  if (new Set(world.fleets.map((fleet) => fleet.owner)).size < 2) return { ...world, clashes }
  const grid = new Map(), contacts = [], losses = new Map()
  const cellSize = 48
  // Index swept positions, not just this frame's endpoints, so fast armies cannot tunnel through each other.
  for (const fleet of [...world.fleets].sort((a, b) => a.id - b.id)) {
    const target = world.territories[fleet.toId], casualties = new Set(fleet.casualties)
    for (let index = fleet.arrived; index < fleet.totalUnits; index++) {
      if (casualties.has(index)) continue
      const departure = fleet.departure + Math.floor(index / WAVE_SIZE) * WAVE_INTERVAL
      if (departure >= world.time) break
      const arrival = departure + fleet.duration, start = Math.max(since, departure), end = Math.min(world.time, arrival)
      if (end <= start) continue
      const soldier = { fleet, index, start, end, arrival, from: soldierPosition(fleet, target, index, start), to: soldierPosition(fleet, target, index, end) }
      const minX = Math.min(soldier.from.x, soldier.to.x), maxX = Math.max(soldier.from.x, soldier.to.x)
      const minY = Math.min(soldier.from.y, soldier.to.y), maxY = Math.max(soldier.from.y, soldier.to.y)
      const checked = new Set()
      for (let x = Math.floor((minX - COLLISION_DISTANCE) / cellSize); x <= Math.floor((maxX + COLLISION_DISTANCE) / cellSize); x++) {
        for (let y = Math.floor((minY - COLLISION_DISTANCE) / cellSize); y <= Math.floor((maxY + COLLISION_DISTANCE) / cellSize); y++) {
          for (const other of grid.get(`${x},${y}`) || []) {
            if (other.fleet.owner === fleet.owner || checked.has(other)) continue
            checked.add(other)
            const contact = contactDuringStep(other, soldier)
            if (contact) contacts.push(contact)
          }
        }
      }
      for (let x = Math.floor(minX / cellSize); x <= Math.floor(maxX / cellSize); x++) for (let y = Math.floor(minY / cellSize); y <= Math.floor(maxY / cellSize); y++) {
        const key = `${x},${y}`
        if (!grid.has(key)) grid.set(key, [])
        grid.get(key).push(soldier)
      }
    }
  }
  // Resolve each encounter once in time order; a soldier cannot cancel two opponents in a crowded crossing.
  contacts.sort((a, b) => a.time - b.time || a.a.fleet.id - b.a.fleet.id || a.a.index - b.a.index || a.b.fleet.id - b.b.fleet.id || a.b.index - b.b.index)
  for (const { a, b, time, x, y } of contacts) {
    if (losses.get(a.fleet.id)?.has(a.index) || losses.get(b.fleet.id)?.has(b.index)) continue
    for (const soldier of [a, b]) {
      if (!losses.has(soldier.fleet.id)) losses.set(soldier.fleet.id, new Set())
      losses.get(soldier.fleet.id).add(soldier.index)
    }
    clashes.push({ id: `${a.fleet.id}-${a.index}:${b.fleet.id}-${b.index}`, x, y, time, owners: [a.fleet.owner, b.fleet.owner] })
  }
  const fleets = world.fleets.map((fleet) => {
    const lost = losses.get(fleet.id)
    return lost ? { ...fleet, casualties: [...(fleet.casualties || []), ...lost], units: fleet.units - lost.size } : fleet
  }).filter((fleet) => fleet.units > 0)
  return { ...world, fleets, clashes: clashes.slice(-120) }
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
      const strength = Math.floor(from.troops) * FACTIONS[owner].attack
      if (strength < needed + 2 || needed === 0 && incoming(to.id, true) > 0) continue
      const score = 110 - distance * .13 - needed * .7 + (to.owner === -1 ? 12 : 18)
      if (!best || score > best.score) best = { from, to, score }
    }
  }
  if (best) return sendTroops(world, best.from.id, best.to.id, owner)
  // A quiet rear island can reinforce the frontier instead of hoarding soldiers.
  const enemies = world.territories.filter((item) => item.owner !== owner)
  if (!enemies.length || own.length < 2) return world
  const frontier = (item) => Math.min(...enemies.map((enemy) => Math.hypot(item.x - enemy.x, item.y - enemy.y)))
  const sorted = [...own].sort((a, b) => frontier(a) - frontier(b))
  const rear = sorted.at(-1), front = sorted[0]
  if (rear.troops >= 24 && front.troops < 100 && incoming(front.id, true) < 40) return sendTroops(world, rear.id, front.id, owner)
  return world
}

// Count only surviving soldiers that can arrive within the forecast, including queued waves.
function arrivingUnits(fleet, time) {
  const end = Math.min(fleet.totalUnits, Math.max(0, Math.floor((time - fleet.departure - fleet.duration) / WAVE_INTERVAL) + 1) * WAVE_SIZE)
  return Math.max(0, end - fleet.arrived - fleet.casualties.filter((index) => index >= fleet.arrived && index < end).length)
}

function runAdultAI(world, owner) {
  const own = world.territories.filter((land) => land.owner === owner)
  const opponents = world.territories.filter((land) => land.owner !== owner)
  if (!own.length || !opponents.length) return world
  const incoming = (land, horizon, friendly) => world.fleets.filter((fleet) => fleet.toId === land.id && (fleet.owner === land.owner) === friendly)
    .reduce((power, fleet) => power + arrivingUnits(fleet, world.time + horizon) * (friendly ? FACTIONS[land.owner]?.defense || 1 : FACTIONS[fleet.owner].attack), 0)
  const growth = (land) => land.owner < 0 ? 0 : (land.owner === world.player ? 1.25 : world.config.enemyGrowth) * FACTIONS[land.owner].growth
  const defenseAt = (land, horizon) => (land.troops + growth(land) * horizon) * (FACTIONS[land.owner]?.defense || 1) + incoming(land, horizon, true) - incoming(land, horizon, false)
  const frontier = (land) => Math.min(...opponents.map((other) => Math.hypot(land.x - other.x, land.y - other.y)))
  let best = null
  for (const from of own.filter((land) => land.troops >= 8)) {
    // All-in orders must not abandon a home that visible enemy soldiers will reach soon.
    if (incoming(from, 4.5, false) > growth(from) * 4.5 * FACTIONS[owner].defense + incoming(from, 4.5, true)) continue
    const departure = Math.max(world.time, ...world.fleets.filter((fleet) => fleet.fromId === from.id && fleet.owner === owner).map((fleet) => fleet.departure + Math.ceil(fleet.totalUnits / WAVE_SIZE) * WAVE_INTERVAL))
    for (const to of world.territories) {
      if (from.id === to.id) continue
      const travel = Math.hypot(from.x - to.x, from.y - to.y) / (100 * FACTIONS[owner].speed) + .3
      const eta = departure - world.time + travel + (Math.ceil(Math.floor(from.troops) / WAVE_SIZE) - 1) * WAVE_INTERVAL / 2
      let score
      if (to.owner === owner) {
        const threatened = incoming(to, 6, false) > 0 && defenseAt(to, 6) < 6
        if (threatened && eta < 6) score = 200 - eta * 8
        else if (from.troops >= 16 && frontier(from) - frontier(to) > 60 && to.troops + incoming(to, eta, true) < 100) score = 25 + (frontier(from) - frontier(to)) * .04 - eta * 4
        else continue
      } else {
        const needed = Math.max(0, defenseAt(to, eta))
        // Do not send a second army after a target already covered by arriving allies.
        if (needed === 0 && world.fleets.some((fleet) => fleet.owner === owner && fleet.toId === to.id)) continue
        if (Math.floor(from.troops) * FACTIONS[owner].attack < needed + 3) continue
        score = 90 - eta * 7 - needed * .55 + (to.owner < 0 ? 8 : 14)
      }
      if (!best || score > best.score) best = { from, to, score }
    }
  }
  return best ? sendTroops(world, best.from.id, best.to.id, owner) : world
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
  world = collideArmies(world, previous.time)
  const arriving = []
  world.fleets = world.fleets.map((fleet) => {
    const elapsed = world.time - fleet.departure - fleet.duration
    const arrived = Math.min(fleet.totalUnits, Math.max(0, Math.floor((elapsed + 1e-9) / WAVE_INTERVAL) + 1) * WAVE_SIZE)
    const casualties = new Set(fleet.casualties)
    for (let index = fleet.arrived; index < arrived; index += WAVE_SIZE) {
      let survivors = 0
      for (let soldier = index; soldier < Math.min(index + WAVE_SIZE, arrived); soldier++) if (!casualties.has(soldier)) survivors++
      if (survivors) arriving.push({ ...fleet, units: survivors, arrival: fleet.departure + fleet.duration + Math.floor(index / WAVE_SIZE) * WAVE_INTERVAL })
    }
    const pendingLosses = [...casualties].filter((index) => index >= arrived).length
    return { ...fleet, arrived, units: fleet.totalUnits - arrived - pendingLosses }
  }).filter((fleet) => fleet.units > 0)
  arriving.sort((a, b) => a.arrival - b.arrival || a.id - b.id)
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
    if (world.config.difficulty === 'adult') {
      for (let order = 0; order < world.config.aiOrders; order++) world = runAdultAI(world, owner)
    } else world = runAI(world, owner)
  }
  return world
}

export function readProgress(storage, difficulty = 'child') {
  const empty = { selected: 0, cleared: Array(6).fill(0), stars: {} }
  try {
    const data = JSON.parse(storage.getItem(progressKey(difficulty)))
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
