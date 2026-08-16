import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGameScale } from '../hooks/useGameScale'
import { useTouchLock } from '../hooks/useTouchLock'
import roadArt from '../assets/lava-castle/volcanic-three-gates.webp'
import villainArt from '../assets/lava-castle/villains.webp'
import './LavaCastle.css'

const GAME_W = 480
const FIELD_H = 720
const TOP_H = 76
const BOTTOM_H = 126
const GAME_H = TOP_H + FIELD_H + BOTTOM_H
const TOTAL_STAGES = 15
const SPAWN_SHIELD_DISTANCE = 125
const GATE_MAX_HP = 3

const ROUTE_ORDER = ['left', 'center', 'right']
const ROUTE_COLORS = { left: '#74dcff', center: '#ffd45f', right: '#ff7f9a' }
const ROUTE_POINTS = {
  left: [
    [42, 738], [54, 675], [68, 610], [84, 545], [101, 480],
    [116, 415], [130, 350], [140, 285], [147, 225], [150, 174],
  ],
  center: [
    [235, 738], [235, 675], [235, 610], [235, 545], [235, 480],
    [236, 415], [237, 350], [238, 285], [239, 225], [240, 174],
  ],
  right: [
    [438, 738], [426, 675], [412, 610], [396, 545], [379, 480],
    [363, 415], [349, 350], [338, 285], [331, 225], [328, 174],
  ],
}

function buildRoute(points) {
  const path = points.map(([x, y]) => ({ x, y }))
  const segments = []
  let length = 0
  for (let i = 0; i < path.length - 1; i += 1) {
    const a = path[i]
    const b = path[i + 1]
    const segmentLength = Math.hypot(b.x - a.x, b.y - a.y)
    segments.push({ a, b, start: length, length: segmentLength })
    length += segmentLength
  }
  return { path, segments, length }
}

const ROUTES = Object.fromEntries(
  ROUTE_ORDER.map((key) => [key, { ...buildRoute(ROUTE_POINTS[key]), color: ROUTE_COLORS[key] }]),
)

const WEAPONS = {
  ember: {
    name: '불씨 발사기', short: '불씨', icon: '🔥', color: '#ff8a32', unlock: 0,
    description: '빠르고 균형 잡힌 기본 무기',
    levels: [
      { damage: 26, radius: 31, dps: 8, duration: 1450, cooldown: 280, upgrade: 120 },
      { damage: 37, radius: 36, dps: 14, duration: 1600, cooldown: 245, upgrade: 270 },
      { damage: 51, radius: 41, dps: 20, duration: 1750, cooldown: 215, upgrade: null },
    ],
  },
  mortar: {
    name: '마그마 포', short: '마그마', icon: '🌋', color: '#ffcf4a', unlock: 360,
    description: '넓은 범위를 오래 불태워요',
    levels: [
      { damage: 22, radius: 61, dps: 19, duration: 1800, cooldown: 410, upgrade: 230 },
      { damage: 29, radius: 69, dps: 26, duration: 1900, cooldown: 370, upgrade: 420 },
      { damage: 38, radius: 78, dps: 34, duration: 2000, cooldown: 330, upgrade: null },
    ],
  },
  lance: {
    name: '용의 창', short: '용의 창', icon: '🐉', color: '#ff5964', unlock: 560,
    description: '좁지만 강력한 일격과 치명타',
    levels: [
      { damage: 78, radius: 26, dps: 9, duration: 1100, cooldown: 510, crit: 0.18, upgrade: 330 },
      { damage: 103, radius: 29, dps: 12, duration: 1200, cooldown: 455, crit: 0.24, upgrade: 560 },
      { damage: 138, radius: 32, dps: 16, duration: 1300, cooldown: 400, crit: 0.3, upgrade: null },
    ],
  },
  storm: {
    name: '불벼락 코어', short: '불벼락', icon: '⚡', color: '#71e2ff', unlock: 920,
    description: '가까운 악당에게 불꽃이 연쇄돼요',
    levels: [
      { damage: 43, radius: 43, dps: 15, duration: 1450, cooldown: 390, chains: 2, upgrade: 480 },
      { damage: 55, radius: 48, dps: 20, duration: 1600, cooldown: 345, chains: 3, upgrade: 720 },
      { damage: 72, radius: 54, dps: 27, duration: 1750, cooldown: 295, chains: 4, upgrade: null },
    ],
  },
}
const WEAPON_ORDER = ['ember', 'mortar', 'lance', 'storm']

const ENEMIES = {
  goblin: { name: '킥킥 고블린', hp: 44, speed: 54, reward: 13, damage: 1, radius: 21, crop: [0, 50, 305, 430] },
  brute: { name: '불바위 덩치', hp: 135, speed: 31, reward: 25, damage: 2, radius: 29, crop: [300, 0, 383, 480], armor: 0.12 },
  shade: { name: '푸른 그림자', hp: 78, speed: 78, reward: 19, damage: 1, radius: 22, crop: [0, 500, 315, 524] },
  king: { name: '악당왕', hp: 610, speed: 27, reward: 120, damage: 4, radius: 38, crop: [285, 450, 398, 574], armor: 0.08 },
}

const DEFAULT_PROFILE = {
  coins: 0,
  selected: 'ember',
  levels: { ember: 0, mortar: -1, lance: -1, storm: -1 },
  bestStage: 1,
  bestScore: 0,
}

function loadProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem('lava-castle-profile'))
    if (!saved || typeof saved !== 'object') return DEFAULT_PROFILE
    return {
      ...DEFAULT_PROFILE,
      ...saved,
      levels: { ...DEFAULT_PROFILE.levels, ...(saved.levels || {}) },
    }
  } catch {
    return DEFAULT_PROFILE
  }
}

function pointOnRoute(routeKey, distance, lane = 0) {
  const route = ROUTES[routeKey]
  const d = Math.max(0, Math.min(route.length, distance))
  const seg = route.segments.find((item) => d <= item.start + item.length) || route.segments[route.segments.length - 1]
  const t = (d - seg.start) / seg.length
  const baseX = seg.a.x + (seg.b.x - seg.a.x) * t
  const baseY = seg.a.y + (seg.b.y - seg.a.y) * t
  const normalX = -(seg.b.y - seg.a.y) / seg.length
  const normalY = (seg.b.x - seg.a.x) / seg.length
  return { x: baseX + normalX * lane, y: baseY + normalY * lane }
}

function buildStage(stage) {
  const queue = []
  const count = 6 + stage * 2
  for (let i = 0; i < count; i += 1) {
    let type = 'goblin'
    if (stage >= 3 && i % 5 === 3) type = 'shade'
    if (stage >= 2 && i % 6 === 5) type = 'brute'
    if (stage >= 7 && i % 7 === 2) type = 'shade'
    const route = ROUTE_ORDER[(i + stage - 1) % ROUTE_ORDER.length]
    const withinSquad = i % ROUTE_ORDER.length
    const regroupGap = Math.max(590, 1090 - stage * 30)
    queue.push({ type, route, nextDelay: withinSquad < 2 ? 0 : regroupGap })
  }
  if (stage % 5 === 0) {
    queue.push({ type: 'goblin', route: 'left', nextDelay: 0 })
    queue.push({ type: 'king', route: 'center', nextDelay: 0 })
    queue.push({ type: 'goblin', route: 'right', nextDelay: 900 })
  }
  return queue
}

function enemyScale(stage, type) {
  const normal = 1 + (stage - 1) * 0.17 + Math.max(0, stage - 8) * 0.035
  return type === 'king' ? 1 + Math.floor(stage / 5 - 1) * 0.48 : normal
}

function freshGame(profile, stage = 1) {
  // Canvas animation performance를 위해 시뮬레이션 ref만 의도적으로 변경합니다.
  // React로 전달하는 profile/HUD 상태는 항상 새 객체로 갱신합니다.
  return {
    stage,
    phase: 'menu',
    enemies: [], puddles: [], particles: [], floaters: [], arcs: [],
    queue: [], spawnIndex: 0, spawnTimer: 0, ids: 0,
    gateHp: { left: GATE_MAX_HP, center: GATE_MAX_HP, right: GATE_MAX_HP },
    score: 0, coins: profile.coins, combo: 0, comboUntil: 0,
    ultimate: 0, weapon: profile.selected, lastShot: 0, flash: 0, shake: 0,
    stageEarned: 0, lastTime: 0,
  }
}

function LavaCastle() {
  const scale = useGameScale(GAME_W, GAME_H, { reservedH: 18, padding: 16, maxScale: 1.15 })
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const imagesRef = useRef({ background: null, villains: null })
  const audioRef = useRef(null)
  const mutedRef = useRef(false)
  const [profile, setProfile] = useState(loadProfile)
  const profileRef = useRef(profile)
  const [initialGame] = useState(() => freshGame(profile))
  const gameRef = useRef(initialGame)
  useTouchLock(containerRef)

  const [phase, setPhase] = useState('menu')
  const [stage, setStage] = useState(1)
  const [muted, setMuted] = useState(false)
  const [hud, setHud] = useState({
    gateHp: [GATE_MAX_HP, GATE_MAX_HP, GATE_MAX_HP],
    coins: profile.coins, score: 0, combo: 0, ultimate: 0, remaining: 0, earned: 0, routes: [0, 0, 0],
  })
  const [toast, setToast] = useState('')

  const persist = useCallback((next) => {
    profileRef.current = next
    setProfile(next)
    try { localStorage.setItem('lava-castle-profile', JSON.stringify(next)) } catch { /* 저장 불가 환경 */ }
  }, [])

  useEffect(() => { mutedRef.current = muted }, [muted])

  useEffect(() => {
    const background = new Image()
    const villains = new Image()
    background.src = roadArt
    villains.src = villainArt
    imagesRef.current = { background, villains }
  }, [])

  const playSound = useCallback((kind) => {
    if (mutedRef.current) return
    const ac = audioRef.current
    if (!ac) return
    try {
      if (ac.state === 'suspended') ac.resume()
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      const now = ac.currentTime
      const sounds = {
        shoot: [155, 65, 0.12, 'sawtooth', 0.1],
        hit: [330, 190, 0.07, 'triangle', 0.08],
        coin: [620, 980, 0.1, 'square', 0.07],
        leak: [190, 75, 0.3, 'sawtooth', 0.12],
        win: [520, 940, 0.42, 'triangle', 0.1],
        eruption: [100, 36, 0.7, 'sawtooth', 0.16],
      }
      const [from, to, duration, type, volume] = sounds[kind] || sounds.hit
      osc.type = type
      osc.frequency.setValueAtTime(from, now)
      osc.frequency.exponentialRampToValueAtTime(to, now + duration)
      gain.gain.setValueAtTime(volume, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
      osc.connect(gain); gain.connect(ac.destination)
      osc.start(now); osc.stop(now + duration + 0.02)
    } catch { /* 오디오 미지원 */ }
  }, [])

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      try { audioRef.current = new (window.AudioContext || window.webkitAudioContext)() } catch { /* 오디오 미지원 */ }
    }
  }, [])

  const syncHud = useCallback(() => {
    const g = gameRef.current
    setHud({
      gateHp: ROUTE_ORDER.map((route) => g.gateHp[route]),
      coins: g.coins,
      score: g.score,
      combo: g.combo,
      ultimate: g.ultimate,
      earned: g.stageEarned,
      remaining: Math.max(0, g.queue.length - g.spawnIndex + g.enemies.filter((e) => !e.dead && !e.leaked).length),
      routes: ROUTE_ORDER.map((route) => (
        g.queue.slice(g.spawnIndex).filter((entry) => entry.route === route).length
        + g.enemies.filter((enemy) => !enemy.dead && !enemy.leaked && enemy.route === route).length
      )),
    })
  }, [])

  const saveRun = useCallback((g, cleared = false) => {
    const next = {
      ...profileRef.current,
      coins: g.coins,
      bestStage: Math.max(profileRef.current.bestStage, cleared ? Math.min(TOTAL_STAGES, g.stage + 1) : g.stage),
      bestScore: Math.max(profileRef.current.bestScore, g.score),
      selected: g.weapon,
    }
    persist(next)
  }, [persist])

  const startStage = useCallback((stageNumber) => {
    ensureAudio()
    const nextStage = Math.max(1, Math.min(TOTAL_STAGES, stageNumber))
    const g = freshGame(profileRef.current, nextStage)
    g.phase = 'playing'
    g.queue = buildStage(nextStage)
    g.spawnTimer = 650
    gameRef.current = g
    setStage(nextStage)
    setPhase('playing')
    setToast(nextStage % 5 === 0 ? '👑 세 갈래 보스 부대 출현!' : nextStage >= 3 ? '⚠️ 세 방향 동시 습격!' : `STAGE ${nextStage} · 세 갈래 방어`)
    window.setTimeout(() => setToast(''), 1700)
    syncHud()
  }, [ensureAudio, syncHud])

  const finishStage = useCallback(() => {
    const g = gameRef.current
    if (g.phase !== 'playing') return
    const remainingGateHp = Object.values(g.gateHp).reduce((sum, hp) => sum + hp, 0)
    const bonus = 65 + g.stage * 18 + remainingGateHp * 7
    g.coins += bonus
    g.stageEarned += bonus
    g.score += bonus * 5
    g.phase = g.stage >= TOTAL_STAGES ? 'victory' : 'clear'
    saveRun(g, true)
    syncHud()
    setPhase(g.phase)
    playSound('win')
  }, [playSound, saveRun, syncHud])

  const loseGame = useCallback(() => {
    const g = gameRef.current
    if (g.phase !== 'playing') return
    g.phase = 'gameover'
    saveRun(g, false)
    syncHud()
    setPhase('gameover')
  }, [saveRun, syncHud])

  const addParticles = useCallback((x, y, count, color = '#ffb12b') => {
    const g = gameRef.current
    for (let i = 0; i < count && g.particles.length < 150; i += 1) {
      const angle = Math.random() * Math.PI * 2
      const speed = 25 + Math.random() * 85
      g.particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 35,
        life: 0.45 + Math.random() * 0.45, maxLife: 0.9, size: 2 + Math.random() * 4, color,
      })
    }
  }, [])

  const killEnemy = useCallback((enemy, now) => {
    const g = gameRef.current
    if (enemy.dead || enemy.leaked) return
    enemy.dead = true
    const chain = now < g.comboUntil ? Math.min(8, g.combo + 1) : 1
    g.combo = chain
    g.comboUntil = now + 2400
    const reward = Math.round(enemy.reward * (1 + (chain - 1) * 0.08))
    g.coins += reward
    g.stageEarned += reward
    g.score += reward * 10 * chain
    g.ultimate = Math.min(100, g.ultimate + (enemy.type === 'king' ? 34 : 8))
    g.floaters.push({ x: enemy.x, y: enemy.y - enemy.radius, text: `+${reward}`, life: 1, color: '#ffd75b' })
    addParticles(enemy.x, enemy.y, enemy.type === 'king' ? 30 : 12, enemy.type === 'shade' ? '#62d9ff' : '#ff9a35')
    playSound('coin')
  }, [addParticles, playSound])

  const damageEnemy = useCallback((enemy, amount, now, ignoreShield = false) => {
    if (enemy.dead || enemy.leaked) return 0
    if (!ignoreShield && enemy.distance < SPAWN_SHIELD_DISTANCE) return 0
    const dealt = amount * (1 - (enemy.armor || 0))
    enemy.hp -= dealt
    enemy.hit = 0.13
    if (enemy.hp <= 0) killEnemy(enemy, now)
    return dealt
  }, [killEnemy])

  useEffect(() => {
    if (phase !== 'playing') return undefined
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = GAME_W * dpr
    canvas.height = FIELD_H * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    let raf = 0
    let lastHud = 0

    const drawBackground = (g) => {
      const bg = imagesRef.current.background
      if (bg?.complete && bg.naturalWidth) ctx.drawImage(bg, 0, 0, GAME_W, FIELD_H)
      else {
        const gradient = ctx.createLinearGradient(0, 0, 0, FIELD_H)
        gradient.addColorStop(0, '#2c1238'); gradient.addColorStop(1, '#120c20')
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, GAME_W, FIELD_H)
      }
      const vignette = ctx.createLinearGradient(0, 0, 0, 115)
      vignette.addColorStop(0, 'rgba(20,5,29,.48)'); vignette.addColorStop(1, 'rgba(20,5,29,0)')
      ctx.fillStyle = vignette; ctx.fillRect(0, 0, GAME_W, 115)
      if (g.flash > 0) {
        ctx.fillStyle = `rgba(255,92,23,${Math.min(0.5, g.flash)})`
        ctx.fillRect(0, 0, GAME_W, FIELD_H)
      }
    }

    const drawPuddle = (p, now) => {
      const life = Math.max(0, (p.until - now) / p.duration)
      const wobble = 1 + Math.sin(now * 0.009 + p.seed) * 0.05
      const gradient = ctx.createRadialGradient(p.x - 5, p.y - 6, 2, p.x, p.y, p.radius * wobble)
      gradient.addColorStop(0, `rgba(255,245,157,${0.9 * life})`)
      gradient.addColorStop(0.2, `rgba(255,174,28,${0.92 * life})`)
      gradient.addColorStop(0.62, `rgba(240,61,12,${0.78 * life})`)
      gradient.addColorStop(1, 'rgba(81,7,13,0)')
      ctx.fillStyle = gradient
      ctx.beginPath(); ctx.ellipse(p.x, p.y, p.radius * wobble, p.radius * 0.72, 0, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = `rgba(255,224,92,${0.7 * life})`; ctx.lineWidth = 1.4
      for (let i = 0; i < 4; i += 1) {
        const a = p.seed + i * 1.7
        ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * 6, p.y + Math.sin(a) * 4)
        ctx.lineTo(p.x + Math.cos(a + 0.2) * p.radius * 0.68, p.y + Math.sin(a + 0.2) * p.radius * 0.46); ctx.stroke()
      }
    }

    const drawRoutePortals = (now) => {
      ROUTE_ORDER.forEach((routeKey, index) => {
        const point = pointOnRoute(routeKey, 34)
        const pulse = 0.55 + Math.sin(now * 0.004 + index * 2) * 0.18
        const gradient = ctx.createRadialGradient(point.x, point.y, 1, point.x, point.y, 31)
        gradient.addColorStop(0, `rgba(255, 245, 184, ${pulse})`)
        gradient.addColorStop(0.28, `${ROUTES[routeKey].color}80`)
        gradient.addColorStop(1, 'rgba(17, 7, 29, 0)')
        ctx.fillStyle = gradient
        ctx.beginPath(); ctx.ellipse(point.x, point.y, 31, 15, 0, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = ROUTES[routeKey].color
        ctx.globalAlpha = pulse
        ctx.lineWidth = 2
        ctx.beginPath(); ctx.ellipse(point.x, point.y, 21, 8, 0, 0, Math.PI * 2); ctx.stroke()
        ctx.globalAlpha = 1
      })
    }

    const drawEnemy = (enemy, now) => {
      const art = imagesRef.current.villains
      const bob = Math.sin(now * 0.008 + enemy.id) * 2
      const r = enemy.radius
      const shielded = enemy.distance < SPAWN_SHIELD_DISTANCE
      if (shielded) {
        ctx.fillStyle = `${ROUTES[enemy.route].color}22`
        ctx.strokeStyle = ROUTES[enemy.route].color
        ctx.lineWidth = 2
        ctx.setLineDash([5, 3])
        ctx.beginPath(); ctx.arc(enemy.x, enemy.y + bob, r * 1.48, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
        ctx.setLineDash([])
      }
      ctx.save()
      ctx.translate(enemy.x, enemy.y + bob)
      ctx.fillStyle = 'rgba(14,4,22,.52)'
      ctx.beginPath(); ctx.ellipse(0, r * 0.66, r * 1.15, r * 0.42, 0, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.22, r * 1.35, 0, 0, Math.PI * 2); ctx.clip()
      if (enemy.hit > 0) ctx.filter = 'brightness(1.9) saturate(1.2)'
      if (art?.complete && art.naturalWidth) {
        const [sx, sy, sw, sh] = enemy.crop
        ctx.drawImage(art, sx, sy, sw, sh, -r * 1.25, -r * 1.55, r * 2.5, r * 3.1)
      } else {
        ctx.fillStyle = enemy.type === 'shade' ? '#40b9ef' : '#d84c37'
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill()
      }
      ctx.restore()
      const hp = Math.max(0, enemy.hp / enemy.maxHp)
      const barW = r * 2.15
      ctx.fillStyle = 'rgba(20,7,24,.84)'; ctx.fillRect(enemy.x - barW / 2, enemy.y - r * 1.65, barW, 5)
      ctx.fillStyle = enemy.type === 'king' ? '#ffd447' : hp > 0.45 ? '#64e572' : '#ff5757'
      ctx.fillRect(enemy.x - barW / 2 + 1, enemy.y - r * 1.65 + 1, (barW - 2) * hp, 3)
      if (enemy.type === 'king') {
        ctx.font = '700 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe780'
        ctx.fillText('BOSS', enemy.x, enemy.y - r * 1.83)
      }
    }

    const draw = (g, now) => {
      ctx.save()
      if (g.shake > 0) ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake)
      drawBackground(g)
      drawRoutePortals(now)
      g.puddles.forEach((p) => drawPuddle(p, now))
      g.enemies.filter((e) => !e.dead && !e.leaked).forEach((e) => drawEnemy(e, now))
      g.arcs.forEach((arc) => {
        const life = arc.life / arc.maxLife
        ctx.strokeStyle = `rgba(113,226,255,${life})`; ctx.lineWidth = 3 * life
        ctx.shadowColor = '#ff7837'; ctx.shadowBlur = 8
        ctx.beginPath(); ctx.moveTo(arc.x1, arc.y1)
        ctx.lineTo((arc.x1 + arc.x2) / 2 + Math.sin(arc.id) * 11, (arc.y1 + arc.y2) / 2)
        ctx.lineTo(arc.x2, arc.y2); ctx.stroke(); ctx.shadowBlur = 0
      })
      g.particles.forEach((p) => {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife)
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill()
      })
      ctx.globalAlpha = 1
      g.floaters.forEach((f) => {
        ctx.globalAlpha = Math.max(0, f.life)
        ctx.font = '900 15px "Arial Rounded MT Bold", sans-serif'; ctx.textAlign = 'center'
        ctx.fillStyle = f.color; ctx.strokeStyle = '#3a1221'; ctx.lineWidth = 3
        ctx.strokeText(f.text, f.x, f.y); ctx.fillText(f.text, f.x, f.y)
      })
      ctx.restore(); ctx.globalAlpha = 1
    }

    const loop = (now) => {
      const g = gameRef.current
      const dt = Math.min(0.034, (now - (g.lastTime || now)) / 1000)
      g.lastTime = now
      if (g.phase !== 'playing') return

      g.spawnTimer -= dt * 1000
      while (g.spawnIndex < g.queue.length && g.spawnTimer <= 0) {
        const entry = g.queue[g.spawnIndex]
        const { type, route } = entry
        const base = ENEMIES[type]
        const hp = Math.round(base.hp * enemyScale(g.stage, type))
        const lane = (Math.random() * 2 - 1) * 12
        const pos = pointOnRoute(route, 0, lane)
        g.enemies.push({
          ...base, type, id: ++g.ids, distance: 0, x: pos.x, y: pos.y,
          hp, maxHp: hp, dead: false, leaked: false, hit: 0, lane, route, lastShieldHit: 0,
        })
        g.spawnIndex += 1
        g.spawnTimer = entry.nextDelay * (type === 'king' ? 1.35 : 1)
      }

      g.enemies.forEach((enemy) => {
        if (enemy.dead || enemy.leaked) return
        const mercy = g.gateHp[enemy.route] <= 1 ? 0.9 : 1
        enemy.distance += enemy.speed * (1 + (g.stage - 1) * 0.018) * mercy * dt
        const pos = pointOnRoute(enemy.route, enemy.distance, enemy.lane)
        enemy.x = pos.x; enemy.y = pos.y; enemy.hit = Math.max(0, enemy.hit - dt)
        if (enemy.distance >= ROUTES[enemy.route].length) {
          enemy.leaked = true
          const gateDamage = Math.min(g.gateHp[enemy.route], enemy.damage)
          g.gateHp[enemy.route] -= gateDamage
          g.combo = 0; g.shake = 10; g.flash = 0.35
          const gate = pointOnRoute(enemy.route, ROUTES[enemy.route].length)
          g.floaters.push({ x: gate.x, y: gate.y - 18, text: `성문 -${gateDamage}`, life: 1.1, color: '#ff6868' })
          playSound('leak')
          if (g.gateHp[enemy.route] <= 0) loseGame()
        }
      })

      g.puddles.forEach((puddle) => {
        g.enemies.forEach((enemy) => {
          if (!enemy.dead && !enemy.leaked && Math.hypot(enemy.x - puddle.x, enemy.y - puddle.y) <= puddle.radius + enemy.radius * 0.35) {
            damageEnemy(enemy, puddle.dps * dt, now)
          }
        })
      })

      if (now > g.comboUntil) g.combo = 0
      g.puddles = g.puddles.filter((p) => p.until > now)
      g.enemies = g.enemies.filter((e) => !(e.dead || e.leaked) || now - (e.goneAt || (e.goneAt = now)) < 180)
      g.particles.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 95 * dt; p.life -= dt })
      g.particles = g.particles.filter((p) => p.life > 0)
      g.floaters.forEach((f) => { f.y -= 25 * dt; f.life -= dt })
      g.floaters = g.floaters.filter((f) => f.life > 0)
      g.arcs.forEach((a) => { a.life -= dt })
      g.arcs = g.arcs.filter((a) => a.life > 0)
      g.flash = Math.max(0, g.flash - dt * 1.7); g.shake = Math.max(0, g.shake - dt * 38)

      if (g.spawnIndex >= g.queue.length && !g.enemies.some((e) => !e.dead && !e.leaked)) finishStage()
      if (now - lastHud > 100) { lastHud = now; syncHud() }
      draw(g, now)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [damageEnemy, finishStage, loseGame, phase, playSound, syncHud])

  const shoot = useCallback((event) => {
    const g = gameRef.current
    if (g.phase !== 'playing') return
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = (event.clientX - rect.left) * (GAME_W / rect.width)
    const y = (event.clientY - rect.top) * (FIELD_H / rect.height)
    const now = performance.now()
    const level = profileRef.current.levels[g.weapon]
    const weapon = WEAPONS[g.weapon]
    const stats = weapon.levels[Math.max(0, level)]
    if (now - g.lastShot < stats.cooldown) return
    let directDamage = stats.damage
    const critical = stats.crit && Math.random() < stats.crit
    if (critical) directDamage *= 1.75
    const candidates = g.enemies
      .filter((enemy) => !enemy.dead && !enemy.leaked && Math.hypot(enemy.x - x, enemy.y - y) <= stats.radius + enemy.radius * 0.45)
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))
    const targets = candidates.filter((enemy) => enemy.distance >= SPAWN_SHIELD_DISTANCE)
    g.lastShot = now + (targets.length > 0 ? 0 : 260)
    const nearbyPuddle = g.puddles.find((puddle) => Math.hypot(puddle.x - x, puddle.y - y) < Math.min(puddle.radius, stats.radius) * 0.65)
    if (nearbyPuddle) {
      nearbyPuddle.until = now + stats.duration
      nearbyPuddle.dps = Math.max(nearbyPuddle.dps, stats.dps)
    } else {
      g.puddles.push({ x, y, radius: stats.radius, dps: stats.dps, duration: stats.duration, until: now + stats.duration, seed: Math.random() * 10 })
    }
    targets.forEach((enemy) => damageEnemy(enemy, directDamage, now))
    if (targets.length === 0 && candidates[0] && now - candidates[0].lastShieldHit > 500) {
      candidates[0].lastShieldHit = now
      g.floaters.push({ x: candidates[0].x, y: candidates[0].y - 25, text: '입구 보호막!', life: 0.85, color: '#8be8ff' })
      addParticles(candidates[0].x, candidates[0].y, 6, '#75ddff')
    }
    if (critical && targets[0]) g.floaters.push({ x: targets[0].x, y: targets[0].y - 20, text: '치명타!', life: 0.9, color: '#fff072' })
    if (stats.chains && targets[0]) {
      let current = targets[0]
      const chained = new Set([current.id])
      for (let i = 0; i < stats.chains; i += 1) {
        const next = g.enemies
          .filter((e) => !e.dead && !e.leaked && !chained.has(e.id) && Math.hypot(e.x - current.x, e.y - current.y) < 105)
          .sort((a, b) => Math.hypot(a.x - current.x, a.y - current.y) - Math.hypot(b.x - current.x, b.y - current.y))[0]
        if (!next) break
        damageEnemy(next, directDamage * 0.62, now)
        g.arcs.push({ id: ++g.ids, x1: current.x, y1: current.y, x2: next.x, y2: next.y, life: 0.23, maxLife: 0.23 })
        chained.add(next.id); current = next
      }
    }
    addParticles(x, y, 10, weapon.color)
    g.flash = Math.max(g.flash, 0.08); g.shake = Math.min(6, stats.radius / 15)
    playSound('shoot'); syncHud()
  }, [addParticles, damageEnemy, playSound, syncHud])

  const useEruption = useCallback(() => {
    const g = gameRef.current
    if (g.phase !== 'playing' || g.ultimate < 100) return
    const now = performance.now()
    g.ultimate = 0; g.flash = 0.65; g.shake = 18
    g.enemies.forEach((enemy) => {
      if (!enemy.dead && !enemy.leaked) {
        damageEnemy(enemy, enemy.type === 'king' ? 180 : 230, now, true)
        g.puddles.push({ x: enemy.x, y: enemy.y, radius: 37, dps: 30, duration: 1500, until: now + 1500, seed: Math.random() * 10 })
      }
    })
    playSound('eruption'); syncHud()
  }, [damageEnemy, playSound, syncHud])

  const selectWeapon = useCallback((key) => {
    if (profileRef.current.levels[key] < 0) return
    const next = { ...profileRef.current, selected: key }
    gameRef.current.weapon = key
    persist(next)
  }, [persist])

  const unlockWeapon = useCallback((key) => {
    const def = WEAPONS[key]
    const current = profileRef.current
    if (current.levels[key] >= 0 || current.coins < def.unlock) return
    const next = { ...current, coins: current.coins - def.unlock, selected: key, levels: { ...current.levels, [key]: 0 } }
    gameRef.current.coins = next.coins; gameRef.current.weapon = key
    persist(next); syncHud(); setToast(`${def.icon} ${def.name} 해금!`); window.setTimeout(() => setToast(''), 1400)
  }, [persist, syncHud])

  const upgradeWeapon = useCallback((key) => {
    const current = profileRef.current
    const level = current.levels[key]
    if (level < 0) return
    const cost = WEAPONS[key].levels[level].upgrade
    if (!cost || current.coins < cost) return
    const next = { ...current, coins: current.coins - cost, levels: { ...current.levels, [key]: level + 1 } }
    gameRef.current.coins = next.coins
    persist(next); syncHud(); setToast(`⬆ ${WEAPONS[key].name} Lv.${level + 2}`); window.setTimeout(() => setToast(''), 1400)
  }, [persist, syncHud])

  const selectedDef = WEAPONS[profile.selected]
  const selectedLevel = Math.max(0, profile.levels[profile.selected])
  const selectedStats = selectedDef.levels[selectedLevel]

  return (
    <div className="lc-container" ref={containerRef}>
      <Link className="lc-back" to="/">← 게임 목록</Link>
      <div className="lc-shell" style={{ width: GAME_W * scale, height: GAME_H * scale }}>
        <div className="lc-game" style={{ width: GAME_W, height: GAME_H, transform: `scale(${scale})` }}>
          <header className="lc-hud" style={{ height: TOP_H }}>
            <div className="lc-brand"><span className="lc-brand-mark">🌋</span><div><b>용암 수호대</b><small>CASTLE GUARD</small></div></div>
            <div className="lc-stat"><small>세 성문</small><strong className="lc-gate-total">
              {hud.gateHp.map((hp, index) => (
                <span key={ROUTE_ORDER[index]} style={{ '--route': ROUTE_COLORS[ROUTE_ORDER[index]] }}><i>{index === 0 ? '좌' : index === 1 ? '중' : '우'}</i>{hp}</span>
              ))}
            </strong></div>
            <div className="lc-stat"><small>스테이지</small><strong>{stage}<em>/{TOTAL_STAGES}</em></strong></div>
            <div className="lc-stat lc-coin"><small>보유</small><strong>◆ {hud.coins}</strong></div>
            <button className="lc-sound" onClick={() => setMuted((value) => !value)} aria-label="소리 켜기/끄기">{muted ? '🔇' : '🔊'}</button>
          </header>

          <main
            className="lc-field"
            style={{ height: FIELD_H, backgroundImage: `url(${roadArt})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
          >
            <canvas ref={canvasRef} className="lc-canvas" style={{ width: GAME_W, height: FIELD_H }} onPointerDown={shoot} />
            {phase === 'playing' && (
              <>
                <div className="lc-wave-chip">남은 <b>{hud.remaining}</b></div>
                <div className="lc-route-radar" aria-label="길마다 남은 악당 수와 성문 내구도">
                  {ROUTE_ORDER.map((route, index) => (
                    <span key={route} style={{ '--route': ROUTE_COLORS[route] }}>
                      <i>{index === 0 ? '↖' : index === 1 ? '↑' : '↗'}</i>
                      <b>{hud.routes[index]}</b>
                      <small>🛡️{hud.gateHp[index]}</small>
                    </span>
                  ))}
                </div>
                {hud.combo > 1 && <div className="lc-combo"><b>{hud.combo}</b> COMBO!</div>}
                <button className={`lc-eruption${hud.ultimate >= 100 ? ' ready' : ''}`} onClick={useEruption}>
                  <span>🌋</span><div><b>{hud.ultimate >= 100 ? '대분화!' : '분화 충전'}</b><i><em style={{ width: `${hud.ultimate}%` }} /></i></div>
                </button>
                <div className="lc-guide">⚠️ 성문 하나라도 무너지면 패배!</div>
              </>
            )}

            {(phase === 'menu' || phase === 'clear' || phase === 'gameover' || phase === 'victory') && (
              <div className="lc-overlay">
                <section className="lc-panel">
                  {phase === 'menu' && (
                    <>
                      <div className="lc-kicker">IAN'S VOLCANIC DEFENSE</div>
                      <h1><span>용암</span> 수호대</h1>
                      <p>서로 만나지 않는 세 길과 세 성문을<br />뜨거운 용암으로 모두 지켜내세요!</p>
                      <div className="lc-how"><span>🏰<b>3개 성문</b></span><span>🔥<b>터치 발사</b></span><span>◆<b>무기 강화</b></span></div>
                    </>
                  )}
                  {phase === 'clear' && (
                    <><div className="lc-result-icon">🏆</div><h2>스테이지 {stage} 방어 성공!</h2><p>세 성문을 지키고 <b>◆ {hud.earned}</b>을 모았어요.</p></>
                  )}
                  {phase === 'gameover' && (
                    <><div className="lc-result-icon">🚪</div><h2>성문이 뚫렸어요!</h2><p>세 길을 골고루 지키며 스테이지 {stage}에 다시 도전해요.</p></>
                  )}
                  {phase === 'victory' && (
                    <><div className="lc-result-icon">👑</div><h2>전설의 수호자!</h2><p>모든 악당을 물리치고 화산 왕국을 지켰어요!</p></>
                  )}

                  <div className="lc-loadout">
                    <div className="lc-loadout-head"><span>대장간</span><b>◆ {profile.coins}</b></div>
                    <div className="lc-weapon-tabs">
                      {WEAPON_ORDER.map((key) => {
                        const def = WEAPONS[key]
                        const level = profile.levels[key]
                        return (
                          <button key={key} className={`${profile.selected === key ? 'active' : ''}${level < 0 ? ' locked' : ''}`} style={{ '--weapon': def.color }} onClick={() => level < 0 ? unlockWeapon(key) : selectWeapon(key)}>
                            <span>{level < 0 ? '🔒' : def.icon}</span><b>{def.short}</b><small>{level < 0 ? `${def.unlock}◆` : `Lv.${level + 1}`}</small>
                          </button>
                        )
                      })}
                    </div>
                    <div className="lc-weapon-detail">
                      <div className="lc-weapon-orb" style={{ '--weapon': selectedDef.color }}>{selectedDef.icon}</div>
                      <div><b>{selectedDef.name} <em>Lv.{selectedLevel + 1}</em></b><p>{selectedDef.description}</p><small>위력 {selectedStats.damage} · 범위 {selectedStats.radius}</small></div>
                      {selectedStats.upgrade ? (
                        <button disabled={profile.coins < selectedStats.upgrade} onClick={() => upgradeWeapon(profile.selected)}>강화<br /><b>{selectedStats.upgrade}◆</b></button>
                      ) : <span className="lc-max">MAX</span>}
                    </div>
                  </div>

                  <button className="lc-start" onClick={() => startStage(phase === 'clear' ? stage + 1 : phase === 'gameover' ? stage : 1)}>
                    {phase === 'menu' ? '수호 작전 시작' : phase === 'clear' ? '다음 스테이지' : phase === 'victory' ? '처음부터 다시' : '다시 도전'} <span>→</span>
                  </button>
                  {profile.bestScore > 0 && <small className="lc-record">최고 기록 {profile.bestScore.toLocaleString()}점 · 최고 스테이지 {profile.bestStage}</small>}
                </section>
              </div>
            )}
            {toast && <div className="lc-toast">{toast}</div>}
          </main>

          <footer className="lc-toolbar" style={{ height: BOTTOM_H }}>
            <div className="lc-score"><small>SCORE</small><b>{hud.score.toLocaleString()}</b></div>
            <div className="lc-live-weapons">
              {WEAPON_ORDER.map((key) => {
                const def = WEAPONS[key]
                const level = profile.levels[key]
                return <button key={key} disabled={level < 0 || phase !== 'playing'} className={profile.selected === key ? 'active' : ''} style={{ '--weapon': def.color }} onClick={() => selectWeapon(key)}><span>{level < 0 ? '🔒' : def.icon}</span><b>{def.short}</b><small>{level < 0 ? `${def.unlock}◆` : `LV ${level + 1}`}</small></button>
              })}
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}

export default LavaCastle
