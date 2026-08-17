import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import './Fortress.css'

// ── 상수 ─────────────────────────────────────────────────────────────────
const GW = 800
const GH = 460
const GRAVITY = 0.22
const MAX_WIND = 0.05
const TANK_W = 38
const TANK_H = 20
const BARREL_L = 26
const MOVE_BUDGET = 90     // 한 턴에 움직일 수 있는 최대 픽셀
const MOVE_STEP = 3        // 키 한 번 눌렀을 때 이동 거리
const ANGLE_STEP = 2       // 키 한 번 눌렀을 때 각도 변화
const POWER_SPEED = 1.5    // 게이지 속도 (숫자 클수록 빠름)
const P1X = 72
const P2X = GW - 72

const WEAPONS = [
  { id: 'cannon',  name: '일반 포탄',   emoji: '💣', damage: 42, radius: 36, maxAmt: Infinity, desc: '기본 포탄 · 무제한' },
  { id: 'cluster', name: '클러스터',    emoji: '💥', damage: 22, radius: 24, maxAmt: 3,        desc: '공중에서 5발 분열 · 3발' },
  { id: 'banana',  name: '바나나 폭탄', emoji: '🍌', damage: 62, radius: 70, maxAmt: 2,        desc: '초강력 폭발 · 2발' },
  { id: 'missile', name: '유도 미사일', emoji: '🚀', damage: 48, radius: 44, maxAmt: 2,        desc: '목표 추적 · 2발' },
  { id: 'nuke',    name: '핵폭탄',      emoji: '☢️', damage: 85, radius: 98, maxAmt: 1,        desc: '전체 폭발 · 1발' },
]

const BATTLEFIELDS = [
  {
    id: 'sunset', name: '노을빛 바람계곡', icon: '🌅',
    sky: ['#4f46a5', '#ee6677', '#ffc56f'],
    far: '#6e477f', near: '#46365f', soil: ['#9a5b3e', '#5c342d', '#2d2638'],
    grass: '#d8d04b', edge: '#fff083', accent: '#ffdd6e',
  },
  {
    id: 'forest', name: '에메랄드 버섯숲', icon: '🍄',
    sky: ['#103a58', '#278b79', '#9edb88'],
    far: '#24615d', near: '#174b45', soil: ['#49683d', '#294c38', '#17302d'],
    grass: '#8bdf73', edge: '#d0ff8a', accent: '#63f2c2',
  },
  {
    id: 'frost', name: '별빛 얼음행성', icon: '❄️',
    sky: ['#111849', '#4357a6', '#c18ac5'],
    far: '#4b568c', near: '#303761', soil: ['#6d79a3', '#424c75', '#252b50'],
    grass: '#bff3ff', edge: '#ffffff', accent: '#7ee8ff',
  },
]

const TANK_NAMES = ['루비 래빗', '블루 비틀']

function makeAmmo() {
  const a = {}
  WEAPONS.forEach(w => { a[w.id] = w.maxAmt })
  return a
}

// ── 지형 ─────────────────────────────────────────────────────────────────
function genTerrain() {
  const arr = new Float32Array(GW)
  const seed = Math.random() * 100
  for (let x = 0; x < GW; x++) {
    const n = x / GW
    arr[x] = Math.max(155, Math.min(405,
      225 +
      Math.sin(n * Math.PI * 2 * 1.4 + seed) * 80 +
      Math.sin(n * Math.PI * 2 * 3.2 + seed * 1.8) * 42 +
      Math.sin(n * Math.PI * 2 * 0.5 + seed * 2.5) * 88 +
      Math.sin(n * Math.PI * 2 * 6.5 + seed * 0.8) * 16
    ))
  }
  const lh = arr[65], rh = arr[GW - 66]
  for (let x = 0; x < 65; x++) arr[x] = lh
  for (let x = GW - 65; x < GW; x++) arr[x] = rh
  return arr
}

function getH(terrain, x) {
  return terrain[Math.max(0, Math.min(GW - 1, Math.round(x)))]
}

function applyBlast(terrain, cx, cy, r) {
  const next = new Float32Array(terrain)
  for (let x = Math.max(0, (cx - r) | 0); x <= Math.min(GW - 1, (cx + r) | 0); x++) {
    const d = Math.sqrt(Math.max(0, r * r - (x - cx) ** 2))
    const floor = cy + d
    if (floor > next[x]) next[x] = Math.min(GH - 6, floor)
  }
  return next
}

function roundedCloud(ctx, x, y, scale, color) {
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, 16 * scale, Math.PI, 0)
  ctx.arc(x + 20 * scale, y - 7 * scale, 22 * scale, Math.PI, 0)
  ctx.arc(x + 45 * scale, y, 17 * scale, Math.PI, 0)
  ctx.lineTo(x + 62 * scale, y + 12 * scale)
  ctx.lineTo(x - 16 * scale, y + 12 * scale)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawBattlefield(ctx, field, frame) {
  const sky = ctx.createLinearGradient(0, 0, 0, GH)
  field.sky.forEach((color, index) => sky.addColorStop(index / (field.sky.length - 1), color))
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, GW, GH)

  if (field.id === 'sunset') {
    const glow = ctx.createRadialGradient(625, 88, 4, 625, 88, 105)
    glow.addColorStop(0, 'rgba(255,249,190,.95)')
    glow.addColorStop(.22, 'rgba(255,207,101,.75)')
    glow.addColorStop(1, 'rgba(255,154,94,0)')
    ctx.fillStyle = glow; ctx.fillRect(510, -25, 230, 230)
    ctx.fillStyle = '#fff3af'; ctx.beginPath(); ctx.arc(625, 88, 29, 0, Math.PI * 2); ctx.fill()
    roundedCloud(ctx, 72 + Math.sin(frame / 80) * 8, 75, .75, 'rgba(255,235,221,.52)')
    roundedCloud(ctx, 345 + Math.sin(frame / 95) * 10, 122, .55, 'rgba(255,230,225,.35)')
  } else if (field.id === 'forest') {
    const glow = ctx.createRadialGradient(665, 72, 0, 665, 72, 95)
    glow.addColorStop(0, 'rgba(223,255,180,.72)'); glow.addColorStop(1, 'rgba(99,242,194,0)')
    ctx.fillStyle = glow; ctx.fillRect(560, -35, 210, 210)
    ctx.fillStyle = '#dbffb6'; ctx.beginPath(); ctx.arc(665, 72, 23, 0, Math.PI * 2); ctx.fill()
    for (let i = 0; i < 22; i++) {
      const x = (i * 173 + 31) % GW
      const y = 24 + ((i * 53) % 175)
      const a = .25 + (i % 4) * .12
      ctx.fillStyle = `rgba(195,255,205,${a})`
      ctx.beginPath(); ctx.arc(x, y + Math.sin(frame / 18 + i) * 2, 1.2 + i % 3, 0, Math.PI * 2); ctx.fill()
    }
  } else {
    const moon = ctx.createRadialGradient(650, 76, 5, 650, 76, 82)
    moon.addColorStop(0, 'rgba(232,250,255,.95)'); moon.addColorStop(.3, 'rgba(163,221,255,.4)'); moon.addColorStop(1, 'rgba(126,180,255,0)')
    ctx.fillStyle = moon; ctx.fillRect(560, -15, 180, 180)
    ctx.fillStyle = '#eefcff'; ctx.beginPath(); ctx.arc(650, 76, 25, 0, Math.PI * 2); ctx.fill()
    for (let i = 0; i < 72; i++) {
      const x = (i * 137.5 + 19) % GW, y = (i * 71 + 11) % 215
      const twinkle = .35 + Math.sin(frame / 11 + i) * .18
      ctx.fillStyle = `rgba(255,255,255,${twinkle})`
      ctx.beginPath(); ctx.arc(x, y, .7 + (i % 4) * .35, 0, Math.PI * 2); ctx.fill()
    }
  }

  const mountain = (base, color, peaks, snow = false) => {
    ctx.fillStyle = color
    ctx.beginPath(); ctx.moveTo(0, GH)
    peaks.forEach(([x, y]) => ctx.lineTo(x, y + base))
    ctx.lineTo(GW, GH); ctx.closePath(); ctx.fill()
    if (snow) {
      ctx.fillStyle = 'rgba(221,247,255,.38)'
      peaks.filter((_, i) => i % 2 === 1).forEach(([x, y]) => {
        ctx.beginPath(); ctx.moveTo(x, y + base); ctx.lineTo(x - 25, y + base + 38); ctx.lineTo(x, y + base + 27); ctx.lineTo(x + 13, y + base + 38); ctx.lineTo(x + 30, y + base + 43); ctx.closePath(); ctx.fill()
      })
    }
  }
  mountain(22, field.far, [[0,205],[95,105],[168,184],[275,86],[370,177],[485,97],[574,170],[700,92],[800,176]], field.id === 'frost')
  mountain(80, field.near, [[0,206],[115,132],[205,188],[338,115],[460,190],[592,119],[690,171],[800,128]])

  if (field.id === 'forest') {
    for (let i = 0; i < 9; i++) {
      const x = 25 + i * 99, h = 34 + (i % 3) * 15
      ctx.fillStyle = 'rgba(12,49,43,.8)'; ctx.fillRect(x - 4, 230 - h, 8, h)
      ctx.fillStyle = i % 2 ? '#2a7561' : '#3c8b66'
      ctx.beginPath(); ctx.arc(x, 230 - h, 18 + i % 3 * 4, Math.PI, 0); ctx.fill()
      ctx.fillStyle = 'rgba(232,255,181,.55)'
      ctx.beginPath(); ctx.arc(x - 6, 224 - h, 2, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(x + 7, 219 - h, 2, 0, Math.PI * 2); ctx.fill()
    }
  }
}

// ── AI 계산 ───────────────────────────────────────────────────────────────
function aiCalc(fromX, fromY, toX, toY, windForce) {
  // 0~85° 각도, P2는 왼쪽(-x)으로 발사
  let bestAngle = 45, bestPower = 60, bestErr = Infinity
  for (let a = 8; a <= 82; a += 4) {
    for (let p = 35; p <= 95; p += 10) {
      const rad = a * Math.PI / 180
      const spd = p * 0.14
      let x = 0, y = 0
      let vx = Math.cos(rad) * spd   // 수평 거리만 시뮬레이션
      let vy = -Math.sin(rad) * spd
      for (let t = 0; t < 500; t++) {
        x += vx; y += vy; vy += GRAVITY; vx -= windForce  // P2 기준 반전
        if (y > 200 || x > Math.abs(toX - fromX) + 150) break
      }
      const err = Math.abs(x - Math.abs(toX - fromX)) + Math.abs(y - (toY - fromY)) * 0.4
      if (err < bestErr) { bestErr = err; bestAngle = a; bestPower = p }
    }
  }
  return {
    angle: Math.max(10, Math.min(80, bestAngle + (Math.random() - 0.5) * 16)),
    power: Math.max(30, Math.min(95, bestPower + (Math.random() - 0.5) * 12)),
  }
}

// ── 포탄 물리 ─────────────────────────────────────────────────────────────
function stepProj(p) {
  const trail = [...(p.trail || []), { x: p.x, y: p.y }].slice(-18)
  return { ...p, trail, x: p.x + p.vx, y: p.y + p.vy, vx: p.vx + p.wf, vy: p.vy + GRAVITY }
}

let uid = 0

// ── 컴포넌트 ─────────────────────────────────────────────────────────────
export default function Fortress() {
  const canvasRef = useRef(null)
  const gRef = useRef(null)           // 뮤터블 게임 데이터

  const [screen, setScreen] = useState('menu')
  const [mode, setMode] = useState('2p')

  // 턴 상태
  const [turn, setTurn] = useState(0)
  const [phase, setPhase] = useState('aim')  // aim | flying | banner
  const [hp, setHp] = useState([100, 100])
  const [wind, setWind] = useState(0)
  const [ammo, setAmmo] = useState([makeAmmo(), makeAmmo()])
  const [selW, setSelW] = useState(['cannon', 'cannon'])
  const [showWMenu, setShowWMenu] = useState(false)
  const [winner, setWinner] = useState(null)
  const [banner, setBanner] = useState('')
  const [dmgNums, setDmgNums] = useState([])

  // 조준 상태
  const [angle, setAngle] = useState(45)     // 0~85° (0=수평, 85=수직)
  const [moveBudget, setMoveBudget] = useState(MOVE_BUDGET)
  const [powerOsc, setPowerOsc] = useState(0)  // 자동으로 왔다갔다 하는 파워 게이지

  // airMode
  const [airMode, setAirMode] = useState(false)

  // refs (루프 내 최신 값 접근용)
  const phaseRef = useRef('aim')
  const turnRef = useRef(0)
  const modeRef = useRef('2p')
  const hpRef = useRef([100, 100])
  const windRef = useRef(0)
  const powerOscRef = useRef(0)
  const angleRef = useRef(45)
  const moveBudgetRef = useRef(MOVE_BUDGET)
  const selWRef = useRef(['cannon', 'cannon'])
  const ammoRef = useRef([makeAmmo(), makeAmmo()])
  const powerDirRef = useRef(1)   // 파워 게이지 방향

  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { turnRef.current = turn }, [turn])
  useEffect(() => { modeRef.current = mode }, [mode])
  useEffect(() => { hpRef.current = hp }, [hp])
  useEffect(() => { windRef.current = wind }, [wind])
  useEffect(() => { powerOscRef.current = powerOsc }, [powerOsc])
  useEffect(() => { angleRef.current = angle }, [angle])
  useEffect(() => { moveBudgetRef.current = moveBudget }, [moveBudget])
  useEffect(() => { selWRef.current = selW }, [selW])
  useEffect(() => { ammoRef.current = ammo }, [ammo])

  // 렌더 트리거
  const [tick, setTick] = useState(0)
  const redraw = useCallback(() => setTick(t => t + 1), [])

  // ── 게임 초기화 ────────────────────────────────────────────────────────
  const startGame = useCallback((gMode) => {
    const terrain = genTerrain()
    const newWind = (Math.random() - 0.5) * MAX_WIND * 2
    const battlefield = BATTLEFIELDS[Math.floor(Math.random() * BATTLEFIELDS.length)]
    gRef.current = {
      terrain,
      battlefield,
      tanks: [
        { x: P1X, y: getH(terrain, P1X) - TANK_H },
        { x: P2X, y: getH(terrain, P2X) - TANK_H },
      ],
      projs: [], exps: [], endQueued: false,
    }
    setMode(gMode)
    setTurn(0); turnRef.current = 0
    setPhase('banner'); phaseRef.current = 'banner'
    setAngle(45); angleRef.current = 45
    setMoveBudget(MOVE_BUDGET); moveBudgetRef.current = MOVE_BUDGET
    setPowerOsc(0); powerOscRef.current = 0
    powerDirRef.current = 1
    setHp([100, 100]); hpRef.current = [100, 100]
    setWind(newWind); windRef.current = newWind
    setAmmo([makeAmmo(), makeAmmo()])
    setSelW(['cannon', 'cannon'])
    setWinner(null)
    setDmgNums([])
    setAirMode(false)
    setShowWMenu(false)
    setBanner(`${battlefield.icon} ${battlefield.name}`)
    setScreen('game')
    redraw()
    setTimeout(() => { setBanner(''); setPhase('aim'); phaseRef.current = 'aim' }, 1900)
  }, [redraw])

  // ── 턴 종료 ────────────────────────────────────────────────────────────
  const doEndTurn = useCallback((curTurn, curMode) => {
    if (!gRef.current) return
    gRef.current.projs = []
    gRef.current.endQueued = false

    const nextTurn = 1 - curTurn
    const newWind = (Math.random() - 0.5) * MAX_WIND * 2

    setWind(newWind); windRef.current = newWind
    setTurn(nextTurn); turnRef.current = nextTurn
    setAngle(45); angleRef.current = 45
    setMoveBudget(MOVE_BUDGET); moveBudgetRef.current = MOVE_BUDGET
    setPowerOsc(0); powerOscRef.current = 0
    powerDirRef.current = 1
    setAirMode(false)
    setShowWMenu(false)

    const bText = nextTurn === 0
      ? '🔴 플레이어 1의 턴!'
      : (curMode === 'ai' ? '🤖 AI의 턴!' : '🔵 플레이어 2의 턴!')
    setBanner(bText)
    setPhase('banner'); phaseRef.current = 'banner'
    setTimeout(() => {
      setBanner('')
      setPhase('aim'); phaseRef.current = 'aim'

      // AI 자동 실행
      if (curMode === 'ai' && nextTurn === 1) {
        setTimeout(() => {
          const g = gRef.current
          if (!g) return
          const { angle: aiAngle, power: aiPower } = aiCalc(
            g.tanks[1].x, g.tanks[1].y,
            g.tanks[0].x, g.tanks[0].y,
            newWind,
          )
          setAngle(aiAngle); angleRef.current = aiAngle
          setTimeout(() => {
            if (phaseRef.current !== 'aim') return
            const g2 = gRef.current
            if (!g2) return
            const rad = aiAngle * Math.PI / 180
            const spd = aiPower * 0.14
            const proj = {
              id: uid++,
              x: g2.tanks[1].x - Math.cos(rad) * BARREL_L,
              y: g2.tanks[1].y - TANK_H / 2 - Math.sin(rad) * BARREL_L,
              vx: -Math.cos(rad) * spd,
              vy: -Math.sin(rad) * spd,
              wf: newWind,
              weaponId: 'cannon',
              owner: 1,
            }
            g2.projs = [proj]
            setPhase('flying'); phaseRef.current = 'flying'
            redraw()
          }, 1000)
        }, 500)
      }
    }, 1800)
  }, [redraw])

  // ── 파워 게이지 자동 진동 ─────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'game') return
    const isHuman = modeRef.current === '2p' || turnRef.current === 0
    if (!isHuman) return

    const interval = setInterval(() => {
      if (phaseRef.current !== 'aim') return
      setPowerOsc(prev => {
        const next = prev + powerDirRef.current * POWER_SPEED
        if (next >= 100) { powerDirRef.current = -1; return 100 }
        if (next <= 0)   { powerDirRef.current = 1;  return 0 }
        return next
      })
    }, 16)
    return () => clearInterval(interval)
  }, [screen, turn])

  // ── 실제 발사 ─────────────────────────────────────────────────────────
  const fireProjectile = useCallback(() => {
    const g = gRef.current
    if (!g || phaseRef.current !== 'aim') return
    const t = turnRef.current
    const weaponId = selWRef.current[t]
    const curAmmo = ammoRef.current[t][weaponId]
    if (curAmmo !== Infinity && curAmmo <= 0) return

    if (weaponId === 'airstrike') {
      setAirMode(true)
      return
    }

    const tank = g.tanks[t]
    const curAngle = angleRef.current
    const curPower = powerOscRef.current
    const rad = curAngle * Math.PI / 180
    const spd = curPower * 0.14
    const dir = t === 0 ? 1 : -1  // P1=오른쪽, P2=왼쪽

    const proj = {
      id: uid++,
      x: tank.x + dir * Math.cos(rad) * BARREL_L,
      y: tank.y - TANK_H / 2 - Math.sin(rad) * BARREL_L,
      vx: dir * Math.cos(rad) * spd,
      vy: -Math.sin(rad) * spd,
      wf: windRef.current,
      weaponId,
      owner: t,
    }
    g.projs = [proj]

    if (curAmmo !== Infinity) {
      setAmmo(prev => prev.map((a, i) => i === t ? { ...a, [weaponId]: a[weaponId] - 1 } : a))
    }
    setPhase('flying'); phaseRef.current = 'flying'
    setShowWMenu(false)
    redraw()
  }, [redraw])

  // ── 탱크 이동 ─────────────────────────────────────────────────────────
  const moveTank = useCallback((dir) => {
    if (phaseRef.current !== 'aim') return
    const g = gRef.current
    if (!g) return
    const t = turnRef.current
    const budget = moveBudgetRef.current
    if (budget <= 0) return

    const tank = g.tanks[t]
    const newX = Math.max(15, Math.min(GW - 15, tank.x + dir * MOVE_STEP))
    const newY = getH(g.terrain, newX) - TANK_H
    const spent = Math.abs(newX - tank.x)
    g.tanks = g.tanks.map((tk, i) => i === t ? { ...tk, x: newX, y: newY } : tk)
    const newBudget = Math.max(0, budget - spent)
    setMoveBudget(newBudget)
    moveBudgetRef.current = newBudget
    redraw()
  }, [redraw])

  // ── 키보드 이벤트 ─────────────────────────────────────────────────────
  const keysRef = useRef(new Set())
  useEffect(() => {
    if (screen !== 'game') return
    const isHuman = () => modeRef.current === '2p' || turnRef.current === 0
    const pressedKeys = keysRef.current

    const onKeyDown = (e) => {
      if (!isHuman() || phaseRef.current !== 'aim') return

      // 방향키는 기본 스크롤 막기
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) {
        e.preventDefault()
      }

      if (pressedKeys.has(e.key)) return  // 반복 입력 방지 (한 번만)
      pressedKeys.add(e.key)

      switch (e.key) {
        case 'ArrowLeft':  moveTank(-1); break
        case 'ArrowRight': moveTank(1);  break
        case 'ArrowUp':
          setAngle(prev => { const v = Math.min(85, prev + ANGLE_STEP); angleRef.current = v; return v })
          break
        case 'ArrowDown':
          setAngle(prev => { const v = Math.max(0, prev - ANGLE_STEP); angleRef.current = v; return v })
          break
        case ' ':
        case 'Enter':
          fireProjectile()
          break
        default: break
      }
    }

    // 키 누르고 있으면 연속 이동
    const holdInterval = setInterval(() => {
      if (!isHuman() || phaseRef.current !== 'aim') return
      if (pressedKeys.has('ArrowLeft'))  moveTank(-1)
      if (pressedKeys.has('ArrowRight')) moveTank(1)
      if (pressedKeys.has('ArrowUp'))
        setAngle(prev => { const v = Math.min(85, prev + ANGLE_STEP); angleRef.current = v; return v })
      if (pressedKeys.has('ArrowDown'))
        setAngle(prev => { const v = Math.max(0, prev - ANGLE_STEP); angleRef.current = v; return v })
    }, 80)

    const onKeyUp = (e) => pressedKeys.delete(e.key)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      clearInterval(holdInterval)
      pressedKeys.clear()
    }
  }, [screen, moveTank, fireProjectile])

  // ── 에어스트라이크 클릭 ───────────────────────────────────────────────
  const handleCanvasClick = useCallback((e) => {
    if (!airMode || !canvasRef.current || !gRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const clickX = (e.clientX - rect.left) * (GW / rect.width)
    const g = gRef.current
    const t = turnRef.current
    const proj = {
      id: uid++,
      x: clickX, y: -40, vx: 0, vy: 5.5, wf: 0,
      weaponId: 'airstrike', owner: t,
    }
    g.projs = [proj]
    setAmmo(prev => prev.map((a, i) => i === t ? { ...a, airstrike: Math.max(0, a.airstrike - 1) } : a))
    setAirMode(false)
    setPhase('flying'); phaseRef.current = 'flying'
    redraw()
  }, [airMode, redraw])

  // ── 게임 루프 (포탄 물리) ────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'game') return
    const interval = setInterval(() => {
      if (phaseRef.current !== 'flying') return
      const g = gRef.current
      if (!g) return

      let terrain = g.terrain
      const tanks = g.tanks
      const surviving = []
      const newExps = []
      const newSubs = []
      const dmgMap = [0, 0]

      for (const p of g.projs) {
        let np = stepProj(p)

        // 유도 미사일
        if (np.weaponId === 'missile') {
          const target = tanks[1 - np.owner]
          if (target) {
            const dx = target.x - np.x, dy = (target.y - TANK_H / 2) - np.y
            const d = Math.sqrt(dx * dx + dy * dy)
            if (d > 8) { np = { ...np, vx: np.vx + (dx / d) * 0.13, vy: np.vy + (dy / d) * 0.13 } }
          }
        }

        // 클러스터 분열
        if (np.weaponId === 'cluster' && np.y > GH * 0.43 && np.vy > 0) {
          for (let i = 0; i < 5; i++) {
            const a = -25 + i * 12
            const rad = a * Math.PI / 180
            newSubs.push({
              id: uid++, x: np.x, y: np.y,
              vx: Math.cos(rad + 0.3) * 3.2 * (i % 2 === 0 ? 1 : -0.7),
              vy: -Math.sin(rad) * 1.5 + 0.5,
              wf: np.wf, weaponId: 'sub', owner: np.owner,
              subDmg: 22, subR: 24,
            })
          }
          continue
        }

        // 범위 밖
        if (np.x < -120 || np.x > GW + 120 || np.y > GH + 80) continue

        // 충돌 감지
        const ty = getH(terrain, np.x)
        const hitGround = np.y >= ty
        let hitTankIdx = -1
        for (let ti = 0; ti < 2; ti++) {
          const tk = tanks[ti]
          if (Math.abs(np.x - tk.x) < TANK_W / 2 + 4 &&
              np.y >= tk.y - TANK_H - 2 && np.y <= tk.y + 5) {
            hitTankIdx = ti; break
          }
        }

        if (hitGround || hitTankIdx >= 0) {
          const wDef = WEAPONS.find(w => w.id === np.weaponId) ||
            { damage: np.subDmg || 22, radius: np.subR || 24 }
          const ex = Math.max(2, Math.min(GW - 2, np.x))
          const ey = hitGround ? ty : np.y
          newExps.push({ id: uid++, x: ex, y: ey, r: wDef.radius, t: 0, weaponId: np.weaponId })
          terrain = applyBlast(terrain, ex, ey, wDef.radius)

          // 상대 탱크 데미지 (자기 자신 제외)
          for (let ti = 0; ti < 2; ti++) {
            if (ti === np.owner) continue
            const tk = tanks[ti]
            const dist = Math.sqrt((tk.x - ex) ** 2 + ((tk.y - TANK_H / 2) - ey) ** 2)
            if (dist < wDef.radius + 14) {
              const factor = Math.max(0, 1.1 - dist / (wDef.radius + 14))
              dmgMap[ti] += Math.round(wDef.damage * factor)
            }
          }
        } else {
          surviving.push(np)
        }
      }

      g.projs = [...surviving, ...newSubs]

      if (newExps.length > 0) {
        g.exps = [...g.exps, ...newExps]
        g.terrain = terrain
        g.tanks = tanks.map(tk => ({ ...tk, y: getH(terrain, tk.x) - TANK_H }))

        if (dmgMap[0] > 0 || dmgMap[1] > 0) {
          const prev = hpRef.current
          const next = [Math.max(0, prev[0] - dmgMap[0]), Math.max(0, prev[1] - dmgMap[1])]
          setHp(next); hpRef.current = next
          const nums = []
          for (let ti = 0; ti < 2; ti++) {
            if (dmgMap[ti] > 0) {
              nums.push({ id: uid++, x: tanks[ti].x, y: tanks[ti].y - TANK_H - 8, val: dmgMap[ti], t: 0 })
            }
          }
          if (nums.length > 0) setDmgNums(p => [...p, ...nums])
          if (next[0] <= 0) setTimeout(() => { setWinner(1); setScreen('over') }, 800)
          if (next[1] <= 0) setTimeout(() => { setWinner(0); setScreen('over') }, 800)
        }
      }

      g.exps = g.exps.map(e => ({ ...e, t: e.t + 1 })).filter(e => e.t < 34)
      redraw()

      if (g.projs.length === 0 && !g.endQueued) {
        g.endQueued = true
        const ct = turnRef.current, cm = modeRef.current
        setTimeout(() => doEndTurn(ct, cm), 750)
      }
    }, 16)
    return () => clearInterval(interval)
  }, [screen, doEndTurn, redraw])

  // 플로팅 데미지
  useEffect(() => {
    if (dmgNums.length === 0) return
    const t = setInterval(() => {
      setDmgNums(p => p.map(n => ({ ...n, t: n.t + 1, y: n.y - 1.2 })).filter(n => n.t < 48))
    }, 30)
    return () => clearInterval(t)
  }, [dmgNums.length])

  // ── Canvas 렌더링 ─────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !gRef.current) return
    const g = gRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, GW, GH)

    // ── 매 판 달라지는 포트리스풍 전장
    const field = g.battlefield || BATTLEFIELDS[0]
    drawBattlefield(ctx, field, tick)

    // ── 지형
    const terrain = g.terrain

    // 지형 그림자
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.beginPath(); ctx.moveTo(0, GH)
    for (let x = 0; x < GW; x++) ctx.lineTo(x, terrain[x] + 6)
    ctx.lineTo(GW, GH); ctx.closePath(); ctx.fill()
    ctx.restore()

    // 지형 본체
    ctx.beginPath(); ctx.moveTo(0, GH)
    for (let x = 0; x < GW; x++) ctx.lineTo(x, terrain[x])
    ctx.lineTo(GW, GH); ctx.closePath()
    const tg = ctx.createLinearGradient(0, 140, 0, GH)
    tg.addColorStop(0, field.soil[0])
    tg.addColorStop(0.22, field.soil[1])
    tg.addColorStop(1, field.soil[2])
    ctx.fillStyle = tg; ctx.fill()

    // 토양 단면 줄무늬와 자갈
    ctx.save()
    ctx.globalAlpha = .16
    ctx.strokeStyle = field.accent; ctx.lineWidth = 2
    for (let y = 320; y < GH; y += 26) {
      ctx.beginPath()
      for (let x = 0; x <= GW; x += 20) {
        const yy = y + Math.sin(x * .035 + y) * 4
        if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy)
      }
      ctx.stroke()
    }
    for (let i = 0; i < 45; i++) {
      const x = (i * 97 + 23) % GW
      const y = Math.max(getH(terrain, x) + 14, 290 + (i * 41) % 155)
      ctx.fillStyle = i % 2 ? field.accent : '#ffffff'
      ctx.beginPath(); ctx.ellipse(x, y, 2 + i % 4, 1.2 + i % 2, i, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()

    // 지형 상단 엣지 (밝은 선)
    ctx.strokeStyle = field.grass; ctx.lineWidth = 6
    ctx.shadowColor = field.edge; ctx.shadowBlur = 8
    ctx.beginPath()
    for (let x = 0; x < GW; x++) {
      if (x === 0) ctx.moveTo(0, terrain[0]); else ctx.lineTo(x, terrain[x])
    }
    ctx.stroke()
    ctx.shadowBlur = 0

    // 잔디/눈 결정 장식
    ctx.strokeStyle = field.edge; ctx.lineWidth = 1.4; ctx.globalAlpha = .75
    for (let x = 8; x < GW; x += 19) {
      const y = terrain[x]
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y - 7 - (x % 5)); ctx.moveTo(x, y); ctx.lineTo(x + 4, y - 5); ctx.stroke()
    }
    ctx.globalAlpha = 1

    // ── 바람 표시
    {
      const cx = GW / 2, cy = 20
      const mag = Math.abs(wind) / MAX_WIND
      const dir = wind > 0 ? 1 : -1
      const len = 18 + mag * 55
      ctx.save()
      // 화살표
      const wAlpha = 0.4 + mag * 0.55
      ctx.strokeStyle = `rgba(0,200,255,${wAlpha})`
      ctx.shadowColor = `rgba(0,200,255,${wAlpha})`
      ctx.shadowBlur = mag > 0.5 ? 8 : 3
      ctx.lineWidth = 2; ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(cx - dir * len / 2, cy); ctx.lineTo(cx + dir * len / 2, cy); ctx.stroke()
      const ax = cx + dir * len / 2
      ctx.beginPath()
      ctx.moveTo(ax, cy); ctx.lineTo(ax - dir * 8, cy - 5)
      ctx.moveTo(ax, cy); ctx.lineTo(ax - dir * 8, cy + 5)
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.fillStyle = `rgba(100,220,255,${wAlpha})`
      ctx.font = '500 10px system-ui'; ctx.textAlign = 'center'
      ctx.fillText(`WIND  ${wind > 0 ? '▶' : '◀'}  ${(mag * 100).toFixed(0)}%`, cx, cy + 14)
      ctx.restore()
    }

    // ── 궤적 미리보기 (현재 파워 기반)
    if (phaseRef.current === 'aim') {
      const t = turnRef.current
      const tank = g.tanks[t]
      if (tank) {
        const rad = angleRef.current * Math.PI / 180
        const spd = powerOsc * 0.14
        const dir = t === 0 ? 1 : -1
        let x = tank.x + dir * Math.cos(rad) * BARREL_L
        let y = tank.y - TANK_H / 2 - Math.sin(rad) * BARREL_L
        let vx = dir * Math.cos(rad) * spd
        let vy = -Math.sin(rad) * spd
        const wi = windRef.current
        for (let i = 0; i < 120; i++) {
          x += vx; y += vy; vy += GRAVITY; vx += wi
          if (i % 5 === 0) {
            const alpha = Math.max(0, 0.55 - i / 120 * 0.5)
            const size = Math.max(1.5, 3 - i / 120 * 1.5)
            ctx.fillStyle = `rgba(255,220,30,${alpha})`
            ctx.shadowColor = 'rgba(255,200,0,0.4)'; ctx.shadowBlur = 4
            ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill()
          }
          if (y > GH || x < -40 || x > GW + 40 || y >= getH(terrain, x)) break
        }
        ctx.shadowBlur = 0
      }
    }

    // ── 탱크
    const P1C = '#ff3b5c', P2C = '#00c8ff'
    const P1D = '#c0392b', P2D = '#0099cc'

    g.tanks.forEach((tank, idx) => {
      const tc = idx === 0 ? P1C : P2C
      const dc = idx === 0 ? P1D : P2D
      const isCur = idx === turnRef.current && phaseRef.current === 'aim'
      const rad = angleRef.current * Math.PI / 180
      const dir = idx === 0 ? 1 : -1

      ctx.save()

      // 땅에 닿는 부드러운 그림자
      const groundShadow = ctx.createRadialGradient(tank.x, tank.y + 4, 1, tank.x, tank.y + 4, 28)
      groundShadow.addColorStop(0, 'rgba(13,17,28,.48)'); groundShadow.addColorStop(1, 'rgba(13,17,28,0)')
      ctx.fillStyle = groundShadow; ctx.fillRect(tank.x - 34, tank.y - 2, 68, 16)

      // 선택된 탱크 외부 링 (플레이어 인디케이터)
      if (isCur) {
        ctx.strokeStyle = '#fff6a8'; ctx.lineWidth = 2.5
        ctx.globalAlpha = 0.7 + Math.sin(Date.now() / 280) * 0.18
        ctx.shadowColor = field.accent; ctx.shadowBlur = 18
        ctx.beginPath()
        ctx.arc(tank.x, tank.y - TANK_H / 2, TANK_W * 0.93, Math.PI * .15, Math.PI * .85)
        ctx.stroke()
        ctx.fillStyle = '#fff6a8'
        ctx.beginPath(); ctx.moveTo(tank.x, tank.y - TANK_H - 31); ctx.lineTo(tank.x - 6, tank.y - TANK_H - 40); ctx.lineTo(tank.x + 6, tank.y - TANK_H - 40); ctx.closePath(); ctx.fill()
        ctx.globalAlpha = 1; ctx.shadowBlur = 0
      }

      // 트랙 (그림자)
      ctx.fillStyle = 'rgba(0,0,0,0.4)'
      ctx.beginPath()
      ctx.ellipse(tank.x, tank.y + 3, TANK_W / 2 + 2, 5, 0, 0, Math.PI * 2)
      ctx.fill()

      // 트랙 본체
      const trackGrad = ctx.createLinearGradient(tank.x - TANK_W / 2, 0, tank.x + TANK_W / 2, 0)
      trackGrad.addColorStop(0, '#1a1a1a')
      trackGrad.addColorStop(0.5, '#333')
      trackGrad.addColorStop(1, '#1a1a1a')
      ctx.fillStyle = trackGrad
      ctx.beginPath()
      ctx.roundRect(tank.x - TANK_W / 2 - 2, tank.y - 8, TANK_W + 4, 10, 4)
      ctx.fill(); ctx.strokeStyle = '#101522'; ctx.lineWidth = 2; ctx.stroke()

      // 바퀴
      for (let w = 0; w < 4; w++) {
        const wx = tank.x - TANK_W / 2 + 4 + w * 9
        ctx.fillStyle = '#111'
        ctx.beginPath(); ctx.arc(wx, tank.y, 5, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#444'
        ctx.beginPath(); ctx.arc(wx, tank.y, 2.5, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#9aa4af'
        ctx.beginPath(); ctx.arc(wx, tank.y, .9, 0, Math.PI * 2); ctx.fill()
      }

      // 포탑 본체
      if (isCur) { ctx.shadowColor = tc; ctx.shadowBlur = 18 }
      const turrGrad = ctx.createLinearGradient(tank.x - TANK_W / 2, tank.y - TANK_H, tank.x + TANK_W / 2, tank.y)
      turrGrad.addColorStop(0, tc)
      turrGrad.addColorStop(1, dc)
      ctx.fillStyle = turrGrad
      ctx.beginPath()
      ctx.roundRect(tank.x - TANK_W / 2, tank.y - TANK_H, TANK_W, TANK_H * 0.9, [4, 4, 0, 0])
      ctx.fill(); ctx.strokeStyle = '#273047'; ctx.lineWidth = 2; ctx.stroke()

      // 포탑 돔
      ctx.beginPath()
      ctx.ellipse(tank.x, tank.y - TANK_H + 1, TANK_W * 0.38, TANK_H * 0.5, 0, Math.PI, 0)
      ctx.fill(); ctx.strokeStyle = '#273047'; ctx.lineWidth = 2; ctx.stroke()

      // 포탑 하이라이트
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      ctx.beginPath()
      ctx.ellipse(tank.x - 3, tank.y - TANK_H + 1, TANK_W * 0.22, TANK_H * 0.28, -0.3, Math.PI, 0)
      ctx.fill()

      ctx.shadowBlur = 0

      // 각 탱크의 캐릭터 정체성: 토끼 정찰차 / 장수풍뎅이 중전차
      if (idx === 0) {
        ctx.fillStyle = tc; ctx.strokeStyle = '#273047'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.ellipse(tank.x - 7, tank.y - TANK_H - 8, 3.5, 9, -.22, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
        ctx.beginPath(); ctx.ellipse(tank.x + 4, tank.y - TANK_H - 9, 3.5, 9, .18, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
        ctx.fillStyle = '#ffd3d9'
        ctx.beginPath(); ctx.ellipse(tank.x - 7, tank.y - TANK_H - 8, 1.2, 5.5, -.22, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.ellipse(tank.x + 4, tank.y - TANK_H - 9, 1.2, 5.5, .18, 0, Math.PI * 2); ctx.fill()
      } else {
        ctx.strokeStyle = '#273047'; ctx.lineWidth = 2; ctx.lineCap = 'round'
        ctx.beginPath(); ctx.moveTo(tank.x - 5, tank.y - TANK_H - 2); ctx.quadraticCurveTo(tank.x - 12, tank.y - TANK_H - 11, tank.x - 17, tank.y - TANK_H - 9); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(tank.x + 5, tank.y - TANK_H - 2); ctx.quadraticCurveTo(tank.x + 12, tank.y - TANK_H - 11, tank.x + 17, tank.y - TANK_H - 9); ctx.stroke()
        ctx.fillStyle = '#9af2ff'
        ctx.beginPath(); ctx.arc(tank.x - 17, tank.y - TANK_H - 9, 2.5, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(tank.x + 17, tank.y - TANK_H - 9, 2.5, 0, Math.PI * 2); ctx.fill()
      }

      // 표정과 장갑 리벳
      ctx.fillStyle = '#172033'
      ctx.beginPath(); ctx.arc(tank.x - 6, tank.y - TANK_H + 1, 1.8, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(tank.x + 6, tank.y - TANK_H + 1, 1.8, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(tank.x, tank.y - TANK_H + 4, 4, .15, Math.PI - .15); ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,.55)'
      ctx.beginPath(); ctx.arc(tank.x - 14, tank.y - 9, 1.4, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(tank.x + 14, tank.y - 9, 1.4, 0, Math.PI * 2); ctx.fill()

      // 포신
      const bx = tank.x + dir * Math.cos(rad) * BARREL_L
      const by = tank.y - TANK_H + 1 - Math.sin(rad) * BARREL_L
      // 포신 그림자
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 9; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(tank.x + 1, tank.y - TANK_H + 2); ctx.lineTo(bx + 1, by + 2); ctx.stroke()
      // 포신 본체
      ctx.strokeStyle = dc; ctx.lineWidth = 8
      ctx.beginPath(); ctx.moveTo(tank.x, tank.y - TANK_H + 1); ctx.lineTo(bx, by); ctx.stroke()
      // 포신 하이라이트
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 3
      ctx.beginPath(); ctx.moveTo(tank.x, tank.y - TANK_H + 1); ctx.lineTo(bx, by); ctx.stroke()
      // 포신 끝 원
      ctx.fillStyle = dc
      ctx.beginPath(); ctx.arc(bx, by, 5, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#273047'; ctx.lineWidth = 1.5; ctx.stroke()

      // HP 바
      const bw = 56, bx0 = tank.x - bw / 2, by0 = tank.y - TANK_H - 24
      // 배경
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.beginPath(); ctx.roundRect(bx0 - 1, by0 - 1, bw + 2, 11, 5); ctx.fill()
      // HP fill
      const ratio = hpRef.current[idx] / 100
      const hpG = ctx.createLinearGradient(bx0, 0, bx0 + bw, 0)
      if (ratio > 0.5) { hpG.addColorStop(0, '#2ecc71'); hpG.addColorStop(1, '#27ae60') }
      else if (ratio > 0.25) { hpG.addColorStop(0, '#f39c12'); hpG.addColorStop(1, '#e67e22') }
      else { hpG.addColorStop(0, '#ff3b5c'); hpG.addColorStop(1, '#c0392b') }
      ctx.fillStyle = hpG
      ctx.shadowColor = ratio > 0.5 ? '#2ecc71' : ratio > 0.25 ? '#f39c12' : '#ff3b5c'
      ctx.shadowBlur = 4
      ctx.beginPath(); ctx.roundRect(bx0, by0, bw * ratio, 9, [4, ratio > 0.9 ? 4 : 0, ratio > 0.9 ? 4 : 0, 4]); ctx.fill()
      ctx.shadowBlur = 0

      // HP 텍스트
      ctx.fillStyle = '#fff'
      ctx.font = '700 9px system-ui'; ctx.textAlign = 'center'
      ctx.fillText(`HP ${hpRef.current[idx]}`, tank.x, by0 - 4)
      // 플레이어 레이블
      ctx.fillStyle = tc
      ctx.font = '800 10px system-ui'
      ctx.fillText(idx === 0 ? TANK_NAMES[0] : (modeRef.current === 'ai' ? 'AI · 블루 비틀' : TANK_NAMES[1]), tank.x, by0 - 15)

      ctx.restore()
    })

    // ── 포탄
    g.projs.forEach(p => {
      ctx.save()
      // 무기별 잔상과 불꽃 가루
      const trailColor = p.weaponId === 'missile' ? [93, 226, 255]
        : p.weaponId === 'banana' ? [255, 235, 70]
          : p.weaponId === 'nuke' ? [115, 255, 99] : [255, 132, 50]
      ;(p.trail || []).forEach((point, index, points) => {
        const ratio = (index + 1) / points.length
        ctx.globalAlpha = ratio * .58
        ctx.fillStyle = `rgb(${trailColor.join(',')})`
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10
        ctx.beginPath(); ctx.arc(point.x, point.y, .8 + ratio * 3.2, 0, Math.PI * 2); ctx.fill()
        if (index % 3 === 0) {
          ctx.globalAlpha *= .55
          ctx.beginPath(); ctx.arc(point.x, point.y + Math.sin(index * 4) * 5, 1.5, 0, Math.PI * 2); ctx.fill()
        }
      })
      ctx.globalAlpha = 1; ctx.shadowBlur = 0
      if (p.weaponId === 'banana') {
        const spin = tick * .16
        ctx.translate(p.x, p.y); ctx.rotate(spin)
        ctx.shadowColor = '#fff26a'; ctx.shadowBlur = 14
        ctx.font = '20px serif'; ctx.textAlign = 'center'; ctx.fillText('🍌', 0, 6)
      } else if (p.weaponId === 'missile') {
        const ang = Math.atan2(p.vy, p.vx)
        ctx.translate(p.x, p.y); ctx.rotate(ang)
        ctx.fillStyle = '#ff6b48'; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-21, -5); ctx.lineTo(-18, 0); ctx.lineTo(-21, 5); ctx.closePath(); ctx.fill()
        ctx.fillStyle = '#f3f6ff'; ctx.strokeStyle = '#26304b'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.roundRect(-9, -5, 20, 10, 5); ctx.fill(); ctx.stroke()
        ctx.fillStyle = '#57d9ff'; ctx.beginPath(); ctx.arc(6, 0, 3, 0, Math.PI * 2); ctx.fill()
      } else if (p.weaponId === 'airstrike') {
        ctx.font = '20px serif'; ctx.textAlign = 'center'; ctx.fillText('✈️', p.x, p.y)
      } else if (p.weaponId === 'nuke') {
        // 핵폭탄 - 네온 초록 빛남
        ctx.shadowColor = '#39ff14'; ctx.shadowBlur = 16
        ctx.fillStyle = '#39ff14'
        ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill()
      } else {
        // 일반/서브 포탄 - 주황 불꽃 느낌
        ctx.shadowColor = '#ffb02e'; ctx.shadowBlur = 20
        const pg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.weaponId === 'sub' ? 3.5 : 6)
        pg.addColorStop(0, '#fff')
        pg.addColorStop(0.4, '#ffeb3b')
        pg.addColorStop(1, '#ff6600')
        ctx.fillStyle = pg
        ctx.beginPath(); ctx.arc(p.x, p.y, p.weaponId === 'sub' ? 3.5 : 6, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1; ctx.stroke()
      }
      ctx.restore()
    })

    // ── 폭발 (다층 렌더링)
    g.exps.forEach(ex => {
      const prog = ex.t / 34
      ctx.save()

      // 충격파 링
      ctx.globalAlpha = Math.max(0, 1 - prog * 1.3)
      ctx.strokeStyle = ex.weaponId === 'nuke' ? '#9bff6a' : '#fff6c4'
      ctx.lineWidth = Math.max(1, 7 * (1 - prog))
      ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 16
      ctx.beginPath(); ctx.arc(ex.x, ex.y, ex.r * (.25 + prog * 1.18), 0, Math.PI * 2); ctx.stroke()
      ctx.shadowBlur = 0

      // 외곽 연기
      const smokeAlpha = Math.max(0, (1 - prog) * 0.48)
      const smokeR = ex.r * (0.5 + prog * 1.2)
      ctx.globalAlpha = smokeAlpha
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * Math.PI * 2 + ex.id
        const rr = smokeR * (.35 + (i % 3) * .13)
        ctx.fillStyle = i % 2 ? '#4b4452' : '#766269'
        ctx.beginPath(); ctx.arc(ex.x + Math.cos(a) * smokeR * .38, ex.y + Math.sin(a) * smokeR * .3 - prog * 12, rr, 0, Math.PI * 2); ctx.fill()
      }

      // 화염 본체
      ctx.globalAlpha = Math.max(0, 1 - prog * prog * 1.2)
      const fireR = ex.r * (0.2 + prog * 0.8)
      const fg = ctx.createRadialGradient(ex.x, ex.y, 0, ex.x, ex.y, fireR)
      fg.addColorStop(0,    '#ffffff')
      fg.addColorStop(0.1,  '#ffffcc')
      fg.addColorStop(0.3,  '#ffeb3b')
      fg.addColorStop(0.55, '#ff6600')
      fg.addColorStop(0.8,  '#c62828')
      fg.addColorStop(1,    'transparent')
      ctx.fillStyle = fg
      ctx.beginPath(); ctx.arc(ex.x, ex.y, fireR, 0, Math.PI * 2); ctx.fill()

      // 바깥으로 튀는 불꽃 파편
      ctx.globalAlpha = Math.max(0, 1 - prog * 1.15)
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + ex.id * .2
        const dist = ex.r * prog * (1 + (i % 4) * .13)
        const sx = ex.x + Math.cos(a) * dist
        const sy = ex.y + Math.sin(a) * dist - prog * 6
        ctx.strokeStyle = i % 3 === 0 ? '#fff6b0' : '#ff7b22'
        ctx.lineWidth = 2.5
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - Math.cos(a) * 8, sy - Math.sin(a) * 8); ctx.stroke()
      }

      // 중심 섬광
      if (prog < 0.25) {
        ctx.globalAlpha = (0.25 - prog) / 0.25
        ctx.fillStyle = '#fff'
        ctx.shadowColor = '#fff'; ctx.shadowBlur = 20
        ctx.beginPath(); ctx.arc(ex.x, ex.y, ex.r * 0.15, 0, Math.PI * 2); ctx.fill()
      }
      ctx.restore()
    })

    // ── 플로팅 데미지
    dmgNums.forEach(n => {
      ctx.save()
      const alpha = Math.max(0, 1 - n.t / 48)
      ctx.globalAlpha = alpha
      const fontSize = 13 + Math.min(n.val / 6, 8)
      ctx.font = `900 ${fontSize}px system-ui`
      ctx.textAlign = 'center'
      // 외곽선
      ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 4
      ctx.strokeText(`-${n.val}`, n.x, n.y)
      // 텍스트
      const dg = ctx.createLinearGradient(n.x - 20, n.y - fontSize, n.x + 20, n.y)
      dg.addColorStop(0, '#ff6b6b')
      dg.addColorStop(1, '#ff3b5c')
      ctx.fillStyle = dg
      ctx.shadowColor = '#ff3b5c'; ctx.shadowBlur = 8
      ctx.fillText(`-${n.val}`, n.x, n.y)
      ctx.restore()
    })

    ctx.textAlign = 'left'
  }, [tick, powerOsc, angle, dmgNums, wind])

  // ── 파생 값 ──────────────────────────────────────────────────────────
  const isHumanTurn = mode === '2p' || (mode === 'ai' && turn === 0)
  const curColor = turn === 0 ? '#e74c3c' : '#3498db'
  const curLabel = turn === 0 ? '🔴 플레이어 1' : (mode === 'ai' ? '🤖 AI' : '🔵 플레이어 2')
  const curWeapon = WEAPONS.find(w => w.id === selW[turn])
  const curAmmoCount = ammo[turn][selW[turn]]

  // ── 메뉴 화면 ─────────────────────────────────────────────────────────
  if (screen === 'menu') {
    return (
      <div className="ft-screen ft-menu">
        <Link to="/" className="ft-back">← 홈으로</Link>
        <div className="ft-menu-cloud ft-cloud-one" />
        <div className="ft-menu-cloud ft-cloud-two" />
        <div className="ft-menu-sun" />
        <div className="ft-menu-box">
          <div className="ft-kicker">IAN'S BATTLE CLUB · 01</div>
          <div className="ft-menu-title">
            <h1><span>삐리삐리</span> 날라갑니다!</h1>
          </div>
          <p className="ft-menu-sub">바람을 읽고, 각도를 맞추고, 한 방에 날려버려!</p>
          <div className="ft-menu-battle" aria-hidden="true">
            <div className="ft-showcase-tank ft-showcase-ruby"><i className="ft-ear a" /><i className="ft-ear b" /><b>•‿•</b><span /></div>
            <div className="ft-versus">VS</div>
            <div className="ft-showcase-tank ft-showcase-blue"><i className="ft-feeler a" /><i className="ft-feeler b" /><b>•ᴗ•</b><span /></div>
          </div>
          <div className="ft-menu-weapons">
            {WEAPONS.map(w => <span key={w.id} title={w.name}><b>{w.emoji}</b><small>{w.name}</small></span>)}
          </div>
          <div className="ft-menu-btns">
            <button className="ft-btn ft-btn-2p" onClick={() => startGame('2p')}><small>친구와 한판</small>👥 2인 대전</button>
            <button className="ft-btn ft-btn-ai" onClick={() => startGame('ai')}><small>혼자서 도전</small>🤖 AI 대전</button>
          </div>
          <div className="ft-menu-guide">
            <div><kbd>← →</kbd><span>탱크 이동</span></div>
            <div><kbd>↑ ↓</kbd><span>포신 각도</span></div>
            <div><kbd>SPACE</kbd><span>파워 타이밍 발사!</span></div>
          </div>
        </div>
      </div>
    )
  }

  // ── 게임 오버 ─────────────────────────────────────────────────────────
  if (screen === 'over') {
    const wLabel = winner === 0 ? '🔴 플레이어 1' : (mode === 'ai' ? '🤖 AI' : '🔵 플레이어 2')
    return (
      <div className="ft-screen ft-over">
        <div className="ft-over-box">
          <div className="ft-over-icon">{winner === 0 || (winner === 1 && mode === '2p') ? '🏆' : '💀'}</div>
          <h2>{wLabel} 승리!</h2>
          <p>{winner === 0 ? '완벽한 포격!' : mode === 'ai' ? 'AI에게 졌어요. 다시 도전!' : '멋진 대전!'}</p>
          <div className="ft-over-btns">
            <button className="ft-btn ft-btn-2p" onClick={() => startGame(mode)}>다시 시작</button>
            <button className="ft-btn" onClick={() => setScreen('menu')}>모드 선택</button>
            <Link to="/" className="ft-btn ft-btn-home">홈으로</Link>
          </div>
        </div>
      </div>
    )
  }

  // ── 게임 화면 ─────────────────────────────────────────────────────────
  return (
    <div className={`ft-container ft-field-${gRef.current?.battlefield?.id || 'sunset'}`}>
      <Link to="/" className="ft-back">← 홈으로</Link>

      <div className="ft-game-heading">
        <strong>삐리삐리 날라갑니다!</strong>
        <span>{gRef.current?.battlefield?.icon} {gRef.current?.battlefield?.name}</span>
      </div>

      {/* HUD */}
      <div className="ft-hud">
        <div className="ft-hud-side">
          <span className="ft-hud-avatar ruby">🐰</span>
          <span className="ft-hud-name"><small>{mode === '2p' ? 'PLAYER 1' : 'MY TANK'}</small>{TANK_NAMES[0]}</span>
          <div className="ft-hpbar"><div className="ft-hpfill" style={{ width: `${hp[0]}%`, background: 'linear-gradient(90deg,#ff445f,#ff8c79)' }} /></div>
          <span className="ft-hpnum">{hp[0]}</span>
        </div>
        <div className="ft-hud-mid">
          <span>TURN</span>
          <div className="ft-turn-tag" style={{ color: curColor }}>{curLabel}</div>
        </div>
        <div className="ft-hud-side" style={{ justifyContent: 'flex-end' }}>
          <span className="ft-hpnum">{hp[1]}</span>
          <div className="ft-hpbar"><div className="ft-hpfill" style={{ width: `${hp[1]}%`, background: 'linear-gradient(90deg,#34d3ff,#3485e8)' }} /></div>
          <span className="ft-hud-name right"><small>{mode === 'ai' ? 'CPU' : 'PLAYER 2'}</small>{TANK_NAMES[1]}</span>
          <span className="ft-hud-avatar blue">{mode === 'ai' ? '🤖' : '🪲'}</span>
        </div>
      </div>

      {/* 캔버스 */}
      <div className={`ft-cw ${gRef.current?.exps?.length ? 'is-impact' : ''}`}>
        <canvas ref={canvasRef} width={GW} height={GH} className="ft-canvas"
          onClick={airMode ? handleCanvasClick : undefined}
          style={{ cursor: airMode ? 'crosshair' : 'default' }} />
        {banner && <div className="ft-banner"><span>{banner}</span></div>}
        {airMode && <div className="ft-air-hint">✈️ 클릭해서 폭격 위치 지정!</div>}
      </div>

      {/* 컨트롤 (내 턴 + aim 상태) */}
      {isHumanTurn && phase === 'aim' && !banner && (
        <div className="ft-ctrl">

          {/* 파워 게이지 (핵심!) */}
          <div className="ft-power-section">
            <div className="ft-power-label">
              <span>💪 파워</span>
              <strong style={{ color: `hsl(${120 - powerOsc * 1.2},100%,55%)` }}>
                {Math.round(powerOsc)}%
              </strong>
            </div>
            <div className="ft-powerbar">
              <div className="ft-powerbar-fill"
                style={{
                  width: `${powerOsc}%`,
                  background: `linear-gradient(90deg, #4caf50, hsl(${120 - powerOsc * 1.2},100%,45%))`
                }}
              />
              <div className="ft-powerbar-cursor" style={{ left: `${powerOsc}%` }} />
            </div>
            <div className="ft-power-hint">Space 또는 🔥 발사 버튼으로 고정!</div>
          </div>

          {/* 이동 예산 */}
          <div className="ft-move-section">
            <div className="ft-move-label">
              <span>🚶 이동</span>
              <span className="ft-move-remain">{Math.round(moveBudget / MOVE_BUDGET * 100)}% 남음</span>
            </div>
            <div className="ft-movebar">
              <div className="ft-movebar-fill" style={{ width: `${moveBudget / MOVE_BUDGET * 100}%` }} />
            </div>
          </div>

          {/* 각도 + 이동 버튼 */}
          <div className="ft-ctrl-row">
            {/* 이동 버튼 */}
            <div className="ft-move-btns">
              <button className="ft-move-btn" onPointerDown={() => moveTank(-1)}
                disabled={moveBudget <= 0}>◀</button>
              <span className="ft-angle-disp">
                🎯 {Math.round(angle)}°
              </span>
              <button className="ft-move-btn" onPointerDown={() => moveTank(1)}
                disabled={moveBudget <= 0}>▶</button>
            </div>

            {/* 각도 버튼 */}
            <div className="ft-angle-btns">
              <button className="ft-angle-btn" onPointerDown={() => setAngle(a => { const v = Math.max(0, a - ANGLE_STEP); angleRef.current = v; return v })}>
                ↓ 수평
              </button>
              <button className="ft-angle-btn" onPointerDown={() => setAngle(a => { const v = Math.min(85, a + ANGLE_STEP); angleRef.current = v; return v })}>
                ↑ 수직
              </button>
            </div>

            {/* 무기 선택 */}
            <div className="ft-wsect">
              <button className="ft-wbtn" onClick={() => setShowWMenu(v => !v)}>
                {curWeapon?.emoji} {curWeapon?.name}
                <span className="ft-wammo">{curAmmoCount === Infinity ? '∞' : curAmmoCount}</span>
                ▼
              </button>
              {showWMenu && (
                <div className="ft-wmenu">
                  {WEAPONS.map(w => {
                    const a = ammo[turn][w.id]
                    return (
                      <button key={w.id}
                        className={`ft-wopt ${selW[turn] === w.id ? 'active' : ''} ${a === 0 ? 'empty' : ''}`}
                        disabled={a === 0}
                        onClick={() => { setSelW(p => p.map((s, i) => i === turn ? w.id : s)); setShowWMenu(false) }}>
                        <span>{w.emoji}</span>
                        <span className="ft-wopt-info">
                          <span className="ft-wopt-name">{w.name}</span>
                          <span className="ft-wopt-desc">{w.desc}</span>
                        </span>
                        <span className="ft-wopt-amt">{a === Infinity ? '∞' : a}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 발사 버튼 */}
          <button className="ft-fire" onClick={fireProjectile}>
            🔥 발사! (Space)
          </button>
        </div>
      )}

      {phase === 'flying' && <div className="ft-status">💨 포탄 비행 중...</div>}
      {mode === 'ai' && turn === 1 && phase === 'aim' && !banner && (
        <div className="ft-status">🤖 AI 조준 중...</div>
      )}
    </div>
  )
}
