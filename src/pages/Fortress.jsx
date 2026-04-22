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
  return { ...p, x: p.x + p.vx, y: p.y + p.vy, vx: p.vx + p.wf, vy: p.vy + GRAVITY }
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
    gRef.current = {
      terrain,
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
    setBanner('🔴 플레이어 1의 턴!')
    setScreen('game')
    redraw()
    setTimeout(() => { setBanner(''); setPhase('aim'); phaseRef.current = 'aim' }, 1800)
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

    const onKeyDown = (e) => {
      if (!isHuman() || phaseRef.current !== 'aim') return

      // 방향키는 기본 스크롤 막기
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) {
        e.preventDefault()
      }

      if (keysRef.current.has(e.key)) return  // 반복 입력 방지 (한 번만)
      keysRef.current.add(e.key)

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
      if (keysRef.current.has('ArrowLeft'))  moveTank(-1)
      if (keysRef.current.has('ArrowRight')) moveTank(1)
      if (keysRef.current.has('ArrowUp'))
        setAngle(prev => { const v = Math.min(85, prev + ANGLE_STEP); angleRef.current = v; return v })
      if (keysRef.current.has('ArrowDown'))
        setAngle(prev => { const v = Math.max(0, prev - ANGLE_STEP); angleRef.current = v; return v })
    }, 80)

    const onKeyUp = (e) => keysRef.current.delete(e.key)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      clearInterval(holdInterval)
      keysRef.current.clear()
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
          newExps.push({ id: uid++, x: ex, y: ey, r: wDef.radius, t: 0 })
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

    // 하늘
    const sky = ctx.createLinearGradient(0, 0, 0, GH)
    sky.addColorStop(0, '#09090e')
    sky.addColorStop(0.55, '#10103a')
    sky.addColorStop(1, '#1a0e38')
    ctx.fillStyle = sky; ctx.fillRect(0, 0, GW, GH)

    // 별
    for (let i = 0; i < 90; i++) {
      const sx = (i * 137.5) % GW, sy = (i * 79.3) % (GH * 0.52)
      ctx.fillStyle = `rgba(255,255,255,${0.35 + (i % 5) * 0.1})`
      ctx.beginPath(); ctx.arc(sx, sy, 0.7 + (i % 3) * 0.35, 0, Math.PI * 2); ctx.fill()
    }

    // 지형
    const terrain = g.terrain
    ctx.beginPath(); ctx.moveTo(0, GH)
    for (let x = 0; x < GW; x++) ctx.lineTo(x, terrain[x])
    ctx.lineTo(GW, GH); ctx.closePath()
    const tg = ctx.createLinearGradient(0, 155, 0, GH)
    tg.addColorStop(0, '#5d4037')
    tg.addColorStop(0.15, '#388e3c')
    tg.addColorStop(0.5, '#2e7d32')
    tg.addColorStop(1, '#1b5e20')
    ctx.fillStyle = tg; ctx.fill()
    ctx.strokeStyle = '#66bb6a'; ctx.lineWidth = 2
    ctx.beginPath()
    for (let x = 0; x < GW; x++) {
      if (x === 0) ctx.moveTo(0, terrain[0]); else ctx.lineTo(x, terrain[x])
    }
    ctx.stroke()

    // 바람 표시 (상단 중앙)
    {
      const cx = GW / 2, cy = 22
      const mag = Math.abs(wind) / MAX_WIND
      const dir = wind > 0 ? 1 : -1
      const len = 20 + mag * 60
      ctx.save()
      ctx.strokeStyle = `rgba(100,210,255,${0.5 + mag * 0.4})`
      ctx.lineWidth = 2.5; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(cx - dir * len / 2, cy); ctx.lineTo(cx + dir * len / 2, cy); ctx.stroke()
      const ax = cx + dir * len / 2
      ctx.beginPath()
      ctx.moveTo(ax, cy); ctx.lineTo(ax - dir * 9, cy - 5)
      ctx.moveTo(ax, cy); ctx.lineTo(ax - dir * 9, cy + 5)
      ctx.stroke()
      ctx.fillStyle = 'rgba(150,230,255,0.8)'
      ctx.font = '10px Arial'; ctx.textAlign = 'center'
      ctx.fillText(`🌬️ ${wind > 0 ? '→' : '←'} ${(mag * 100).toFixed(0)}%`, cx, cy + 15)
      ctx.restore()
    }

    // 궤적 미리보기
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
        let wi = windRef.current
        for (let i = 0; i < 110; i++) {
          x += vx; y += vy; vy += GRAVITY; vx += wi
          if (i % 4 === 0) {
            const a = Math.max(0, 0.6 - i / 110)
            ctx.fillStyle = `rgba(255,230,60,${a})`
            ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill()
          }
          if (y > GH || x < -40 || x > GW + 40 || y >= getH(terrain, x)) break
        }
      }
    }

    // 탱크
    g.tanks.forEach((tank, idx) => {
      const tc = idx === 0 ? '#e74c3c' : '#3498db'
      const dc = idx === 0 ? '#c0392b' : '#2980b9'
      const isCur = idx === turnRef.current && phaseRef.current === 'aim'

      if (isCur) { ctx.shadowColor = tc; ctx.shadowBlur = 20 }

      // 트랙
      ctx.fillStyle = '#2a2a2a'
      ctx.fillRect(tank.x - TANK_W / 2 - 2, tank.y - 7, TANK_W + 4, 9)
      ctx.fillStyle = '#111'
      for (let w = 0; w < 4; w++) {
        ctx.beginPath(); ctx.arc(tank.x - TANK_W / 2 + 5 + w * 9, tank.y + 1, 4.5, 0, Math.PI * 2); ctx.fill()
      }
      // 포탑
      ctx.fillStyle = tc
      ctx.fillRect(tank.x - TANK_W / 2, tank.y - TANK_H, TANK_W, TANK_H * 0.85)
      ctx.beginPath(); ctx.arc(tank.x, tank.y - TANK_H + 1, TANK_H * 0.65, Math.PI, 0); ctx.fill()

      ctx.shadowBlur = 0

      // 포신
      const rad = angleRef.current * Math.PI / 180
      const dir = idx === 0 ? 1 : -1
      const bx = tank.x + dir * Math.cos(rad) * BARREL_L
      const by = tank.y - TANK_H + 1 - Math.sin(rad) * BARREL_L
      ctx.strokeStyle = dc; ctx.lineWidth = 7; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(tank.x, tank.y - TANK_H + 1); ctx.lineTo(bx, by); ctx.stroke()
      ctx.strokeStyle = '#aaa'; ctx.lineWidth = 3
      ctx.beginPath(); ctx.moveTo(tank.x, tank.y - TANK_H + 1); ctx.lineTo(bx, by); ctx.stroke()

      // HP 바
      const bw = 52, bx0 = tank.x - 26, by0 = tank.y - TANK_H - 20
      ctx.fillStyle = '#111'; ctx.fillRect(bx0 - 1, by0 - 1, bw + 2, 11)
      const ratio = hpRef.current[idx] / 100
      ctx.fillStyle = ratio > 0.5 ? '#4caf50' : ratio > 0.25 ? '#ff9800' : '#f44336'
      ctx.fillRect(bx0, by0, bw * ratio, 9)
      ctx.fillStyle = '#fff'; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center'
      ctx.fillText(`HP ${hpRef.current[idx]}`, tank.x, by0 - 3)
      ctx.fillText(idx === 0 ? 'P1' : (modeRef.current === 'ai' ? 'AI' : 'P2'), tank.x, by0 - 14)
    })

    // 포탄
    g.projs.forEach(p => {
      ctx.save()
      if (p.weaponId === 'banana') {
        ctx.font = '18px serif'; ctx.textAlign = 'center'; ctx.fillText('🍌', p.x, p.y)
      } else if (p.weaponId === 'missile') {
        const ang = Math.atan2(p.vy, p.vx)
        ctx.translate(p.x, p.y); ctx.rotate(ang)
        ctx.font = '18px serif'; ctx.textAlign = 'center'; ctx.fillText('🚀', 0, 0)
      } else if (p.weaponId === 'airstrike') {
        ctx.font = '20px serif'; ctx.textAlign = 'center'; ctx.fillText('✈️', p.x, p.y)
      } else if (p.weaponId === 'nuke') {
        ctx.font = '20px serif'; ctx.textAlign = 'center'; ctx.fillText('☢️', p.x, p.y)
      } else {
        ctx.fillStyle = '#ffeb3b'; ctx.shadowColor = '#ff9800'; ctx.shadowBlur = 10
        ctx.beginPath(); ctx.arc(p.x, p.y, p.weaponId === 'sub' ? 3 : 5.5, 0, Math.PI * 2); ctx.fill()
      }
      ctx.restore()
    })

    // 폭발
    g.exps.forEach(ex => {
      const prog = ex.t / 34
      const r = ex.r * (0.15 + prog * 0.85)
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - prog * prog)
      const eg = ctx.createRadialGradient(ex.x, ex.y, 0, ex.x, ex.y, r)
      eg.addColorStop(0, '#fff')
      eg.addColorStop(0.18, '#fffde7')
      eg.addColorStop(0.45, '#ff9800')
      eg.addColorStop(0.75, '#e53935')
      eg.addColorStop(1, 'rgba(80,0,0,0)')
      ctx.fillStyle = eg
      ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    })

    // 플로팅 데미지 숫자
    dmgNums.forEach(n => {
      ctx.save()
      ctx.globalAlpha = Math.max(0, 1 - n.t / 48)
      ctx.font = `bold ${13 + Math.min(n.val / 5, 9)}px Arial`
      ctx.textAlign = 'center'
      ctx.strokeStyle = '#000'; ctx.lineWidth = 3
      ctx.strokeText(`-${n.val}`, n.x, n.y)
      ctx.fillStyle = '#ff5252'; ctx.fillText(`-${n.val}`, n.x, n.y)
      ctx.restore()
    })

    ctx.textAlign = 'left'
  }, [tick, powerOsc, angle, dmgNums])

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
        <div className="ft-menu-box">
          <div className="ft-menu-title">
            <span>🚀</span><h1>삐리삐리 날라갑니다</h1><span>💥</span>
          </div>
          <p className="ft-menu-sub">각도·파워를 맞춰 상대 탱크를 격파하세요!</p>
          <div className="ft-menu-weapons">
            {WEAPONS.map(w => <span key={w.id} title={w.name}>{w.emoji}</span>)}
          </div>
          <div className="ft-menu-btns">
            <button className="ft-btn ft-btn-2p" onClick={() => startGame('2p')}>👥 2인 대전</button>
            <button className="ft-btn ft-btn-ai" onClick={() => startGame('ai')}>🤖 AI 대전</button>
          </div>
          <div className="ft-menu-guide">
            <div>⬅ ➡ 방향키 : 탱크 이동 (한 턴에 제한)</div>
            <div>⬆ ⬇ 방향키 : 각도 조절</div>
            <div>⎵ Space / 🔥 발사 버튼 : 파워 게이지 타이밍에 발사!</div>
            <div>💣 무기를 골라 전략적으로 공격!</div>
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
    <div className="ft-container">
      <Link to="/" className="ft-back">← 홈으로</Link>

      {/* HUD */}
      <div className="ft-hud">
        <div className="ft-hud-side">
          <span className="ft-hud-name" style={{ color: '#e74c3c' }}>🔴 {mode === '2p' ? 'P1' : '나'}</span>
          <div className="ft-hpbar"><div className="ft-hpfill" style={{ width: `${hp[0]}%`, background: '#e74c3c' }} /></div>
          <span className="ft-hpnum">{hp[0]}</span>
        </div>
        <div className="ft-hud-mid">
          <div className="ft-turn-tag" style={{ color: curColor }}>{curLabel}의 턴</div>
        </div>
        <div className="ft-hud-side" style={{ justifyContent: 'flex-end' }}>
          <span className="ft-hpnum">{hp[1]}</span>
          <div className="ft-hpbar"><div className="ft-hpfill" style={{ width: `${hp[1]}%`, background: '#3498db' }} /></div>
          <span className="ft-hud-name" style={{ color: '#3498db' }}>{mode === 'ai' ? '🤖 AI' : '🔵 P2'}</span>
        </div>
      </div>

      {/* 캔버스 */}
      <div className="ft-cw">
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
