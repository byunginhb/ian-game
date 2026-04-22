import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import './Fortress.css'

const GW = 800
const GH = 500
const GRAVITY = 0.18
const WIND_MAX = 0.06
const TANK_W = 44
const TANK_H = 22
const BARREL_LEN = 26

const WEAPONS = [
  { id: 'cannon',    name: '일반 포탄',   emoji: '💣', damage: 35, radius: 45, count: Infinity, desc: '기본 포탄, 무한 사용' },
  { id: 'cluster',   name: '클러스터',    emoji: '💥', damage: 18, radius: 28, count: 3,        desc: '공중에서 5발로 분열' },
  { id: 'banana',    name: '바나나 폭탄', emoji: '🍌', damage: 55, radius: 75, count: 2,        desc: '초강력 폭발 범위' },
  { id: 'missile',   name: '유도 미사일', emoji: '🚀', damage: 40, radius: 50, count: 2,        desc: '목표를 향해 추적' },
  { id: 'airstrike', name: '공중 폭격',   emoji: '✈️', damage: 45, radius: 55, count: 1,        desc: '지정 위치 낙하 폭격' },
]

const COLORS = {
  0: { tank: '#e74c3c', barrel: '#c0392b' },
  1: { tank: '#3498db', barrel: '#2980b9' },
}

// ── 지형 생성 ──
function buildTerrain() {
  const t = new Array(GW).fill(0)
  const seed = Math.random() * 9999
  const r = (n) => Math.sin(n * 127.1 + seed) * 0.5 + 0.5
  for (let x = 0; x < GW; x++) {
    const n = x / GW
    const h = r(n * 1.3) * 80 + r(n * 2.7 + 1) * 50 + r(n * 5.1 + 2) * 30 + r(n * 0.4 + 3) * 100 + 200
    t[x] = Math.max(180, Math.min(430, h))
  }
  // 양쪽 플랫폼 평탄화
  const leftH = t[80]; const rightH = t[GW - 81]
  for (let x = 0; x < 80; x++) t[x] = leftH
  for (let x = GW - 80; x < GW; x++) t[x] = rightH
  return t
}

function getY(terrain, x) {
  const xi = Math.max(0, Math.min(GW - 1, Math.round(x)))
  return terrain[xi]
}

function blastTerrain(terrain, cx, cy, radius) {
  const next = [...terrain]
  for (let x = Math.max(0, cx - radius); x <= Math.min(GW - 1, cx + radius); x++) {
    const dx = x - cx
    const depth = Math.sqrt(Math.max(0, radius * radius - dx * dx))
    const newBottom = cy + depth
    if (newBottom > next[x]) next[x] = Math.min(GH - 10, newBottom)
  }
  return next
}

// ── 초기 무기 세트 ──
function initWeapons() {
  return [
    { cannon: Infinity, cluster: 3, banana: 2, missile: 2, airstrike: 1 },
    { cannon: Infinity, cluster: 3, banana: 2, missile: 2, airstrike: 1 },
  ]
}

let uid = 0

export default function Fortress() {
  const canvasRef = useRef(null)

  // 게임 상태 (ref로 게임루프에서 접근)
  const gameRef = useRef(null)

  const [screen, setScreen] = useState('menu')
  const [mode, setMode] = useState('2p')
  const [uiState, setUiState] = useState({ angle: 45, power: 60, turn: 0, phase: 'aim' })
  const [hp, setHp] = useState([100, 100])
  const [wind, setWind] = useState(0)
  const [weapons, setWeapons] = useState(initWeapons())
  const [selectedWeapon, setSelectedWeapon] = useState(['cannon', 'cannon'])
  const [message, setMessage] = useState('')
  const [winner, setWinner] = useState(null)
  const [airstrikeMode, setAirstrikeMode] = useState(false)
  const [showWeaponMenu, setShowWeaponMenu] = useState(false)

  // 렌더용 스냅샷 (Canvas 그리기)
  const [renderSnap, setRenderSnap] = useState(null)

  const triggerRender = useCallback(() => {
    if (!gameRef.current) return
    const g = gameRef.current
    setRenderSnap({
      terrain: g.terrain,
      tanks: g.tanks,
      projectiles: [...g.projectiles],
      explosions: [...g.explosions],
      trajectoryDots: [...g.trajectoryDots],
    })
  }, [])

  // ── 초기화 ──
  const initGame = useCallback((gameMode) => {
    const terrain = buildTerrain()
    const p1x = 80, p2x = GW - 80
    const tanks = [
      { x: p1x, y: getY(terrain, p1x) - TANK_H },
      { x: p2x, y: getY(terrain, p2x) - TANK_H },
    ]
    const newWind = (Math.random() - 0.5) * WIND_MAX * 2
    gameRef.current = { terrain, tanks, projectiles: [], explosions: [], trajectoryDots: [], endTurnQueued: false }
    setWind(newWind)
    setHp([100, 100])
    setWeapons(initWeapons())
    setSelectedWeapon(['cannon', 'cannon'])
    setMessage('')
    setWinner(null)
    setAirstrikeMode(false)
    setShowWeaponMenu(false)
    setMode(gameMode)
    setUiState({ angle: 45, power: 60, turn: 0, phase: 'aim' })
    setScreen('game')
    triggerRender()
  }, [triggerRender])

  // ── 궤적 미리보기 ──
  useEffect(() => {
    if (!gameRef.current) return
    const { turn, phase, angle, power } = uiState
    if (phase !== 'aim') { gameRef.current.trajectoryDots = []; triggerRender(); return }
    const tank = gameRef.current.tanks[turn]
    if (!tank) return
    const rad = (angle * Math.PI) / 180
    const dir = turn === 0 ? 1 : -1
    let vx = dir * Math.cos(rad) * power * 0.12
    let vy = -Math.sin(rad) * power * 0.12
    let x = tank.x, y = tank.y - TANK_H / 2
    const dots = []
    const terrain = gameRef.current.terrain
    for (let i = 0; i < 90; i++) {
      x += vx; y += vy; vy += GRAVITY; vx += wind
      if (i % 3 === 0) dots.push({ x, y })
      if (y > GH || x < -20 || x > GW + 20 || y >= getY(terrain, x)) break
    }
    gameRef.current.trajectoryDots = dots
    triggerRender()
  }, [uiState, wind, triggerRender])

  // ── endTurn ──
  const doEndTurn = useCallback((currentTurn, currentMode, currentWind, currentWeapons) => {
    if (!gameRef.current) return
    gameRef.current.projectiles = []
    gameRef.current.endTurnQueued = false

    const nextTurn = 1 - currentTurn
    const newWind = (Math.random() - 0.5) * WIND_MAX * 2
    setWind(newWind)
    setShowWeaponMenu(false)
    setMessage('')

    setUiState(prev => ({ ...prev, turn: nextTurn, phase: 'aim' }))

    // AI 턴
    if (currentMode === 'ai' && nextTurn === 1) {
      const g = gameRef.current
      const aiTank = g.tanks[1]
      const targetTank = g.tanks[0]
      if (!aiTank || !targetTank) return

      const dx = targetTank.x - aiTank.x
      const basePower = Math.min(95, Math.max(35, Math.abs(dx) * 0.09 + 45))
      const baseAngle = dx > 0 ? 42 : 138
      const noisyAngle = Math.max(10, Math.min(170, baseAngle + (Math.random() - 0.5) * 28))
      const noisyPower = Math.max(25, Math.min(100, basePower + (Math.random() - 0.5) * 15))

      setUiState(prev => ({ ...prev, angle: noisyAngle, power: noisyPower }))

      setTimeout(() => {
        if (!gameRef.current) return
        const g2 = gameRef.current
        const rad = (noisyAngle * Math.PI) / 180
        const vx = -Math.cos(rad) * noisyPower * 0.12 // AI는 왼쪽으로
        const vy = -Math.sin(rad) * noisyPower * 0.12
        const proj = { id: uid++, x: g2.tanks[1].x, y: g2.tanks[1].y - TANK_H / 2, vx, vy, wind: newWind, weaponId: 'cannon', owner: 1 }
        g2.projectiles = [proj]
        // AI 무기 소모 없음(cannon은 무한)
        setUiState(prev => ({ ...prev, phase: 'flying' }))
        triggerRender()
      }, 1500)
    }
  }, [triggerRender])

  // ── 발사 ──
  const handleFire = useCallback(() => {
    if (!gameRef.current) return
    const { turn, phase, angle, power } = uiState
    if (phase !== 'aim') return
    const weaponId = selectedWeapon[turn]
    if (weapons[turn][weaponId] !== Infinity && weapons[turn][weaponId] <= 0) {
      setMessage('탄약이 없어요! 다른 무기를 선택하세요.')
      return
    }
    if (weaponId === 'airstrike') {
      setAirstrikeMode(true)
      setMessage('캔버스를 클릭해 폭격 위치를 선택하세요!')
      return
    }
    const g = gameRef.current
    const tank = g.tanks[turn]
    const rad = (angle * Math.PI) / 180
    const dir = turn === 0 ? 1 : -1
    const vx = dir * Math.cos(rad) * power * 0.12
    const vy = -Math.sin(rad) * power * 0.12
    const proj = { id: uid++, x: tank.x, y: tank.y - TANK_H / 2, vx, vy, wind, weaponId, owner: turn }
    g.projectiles = [proj]
    if (weapons[turn][weaponId] !== Infinity) {
      setWeapons(prev => prev.map((ws, i) => i === turn ? { ...ws, [weaponId]: ws[weaponId] - 1 } : ws))
    }
    setUiState(prev => ({ ...prev, phase: 'flying' }))
    setMessage('')
    setShowWeaponMenu(false)
    triggerRender()
  }, [uiState, selectedWeapon, weapons, wind, triggerRender])

  const handleAirstrikeClick = useCallback((e) => {
    if (!airstrikeMode || !canvasRef.current || !gameRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const tx = (e.clientX - rect.left) * (GW / rect.width)
    setAirstrikeMode(false)
    const { turn } = uiState
    setWeapons(prev => prev.map((ws, i) => i === turn ? { ...ws, airstrike: Math.max(0, ws.airstrike - 1) } : ws))
    const proj = { id: uid++, x: tx, y: -30, vx: 0, vy: 4.5, wind: 0, weaponId: 'airstrike', owner: turn }
    gameRef.current.projectiles = [proj]
    setUiState(prev => ({ ...prev, phase: 'flying' }))
    setMessage('')
    triggerRender()
  }, [airstrikeMode, uiState, triggerRender])

  // ── 게임 루프 ──
  useEffect(() => {
    if (screen !== 'game') return
    const interval = setInterval(() => {
      const g = gameRef.current
      if (!g || uiState.phase !== 'flying') return

      const { turn } = uiState
      let terrain = g.terrain
      let tanks = g.tanks
      const newExplosions = []
      const surviving = []
      const newSubProjs = []
      let hpChanges = [0, 0]

      for (const p of g.projectiles) {
        // 물리 스텝
        let nx = p.x + p.vx
        let ny = p.y + p.vy
        let nvx = p.vx + p.wind
        let nvy = p.vy + GRAVITY

        // 유도 미사일
        if (p.weaponId === 'missile') {
          const target = tanks[1 - p.owner]
          if (target) {
            const dx = target.x - nx
            const dy = (target.y - TANK_H) - ny
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist > 5) {
              nvx += (dx / dist) * 0.14
              nvy += (dy / dist) * 0.14
            }
          }
        }

        const np = { ...p, x: nx, y: ny, vx: nvx, vy: nvy }

        // 클러스터 분열
        if (np.weaponId === 'cluster' && np.y > GH * 0.42 && np.vy > 0) {
          const wDef = WEAPONS.find(w => w.id === 'cluster')
          for (let i = 0; i < 5; i++) {
            const a = 15 + i * 35
            const rad = (a * Math.PI) / 180
            const sv = 2.8
            newSubProjs.push({
              id: uid++, x: np.x, y: np.y,
              vx: Math.cos(rad) * sv * (i % 2 === 0 ? 1 : -1),
              vy: -Math.sin(rad) * sv * 0.5,
              wind: np.wind, weaponId: 'sub', owner: np.owner,
              subDamage: wDef.damage, subRadius: wDef.radius,
            })
          }
          continue
        }

        // 범위 밖 제거
        if (np.x < -80 || np.x > GW + 80 || np.y > GH + 80) continue

        // 지형 충돌
        const terrainHit = np.y >= getY(terrain, np.x)
        // 탱크 충돌
        const t0Hit = Math.abs(np.x - tanks[0].x) < TANK_W / 2 + 6 && np.y > tanks[0].y - TANK_H - 4 && np.y < tanks[0].y + 8
        const t1Hit = Math.abs(np.x - tanks[1].x) < TANK_W / 2 + 6 && np.y > tanks[1].y - TANK_H - 4 && np.y < tanks[1].y + 8

        if (terrainHit || t0Hit || t1Hit) {
          const wDef = WEAPONS.find(w => w.id === np.weaponId) || { damage: np.subDamage || 20, radius: np.subRadius || 35 }
          const ex = Math.max(1, Math.min(GW - 1, np.x))
          const ey = terrainHit ? getY(terrain, np.x) : np.y
          newExplosions.push({ id: uid++, x: ex, y: ey, r: wDef.radius, t: 0 })
          terrain = blastTerrain(terrain, ex, ey, wDef.radius)

          // 데미지
          for (let pi = 0; pi < 2; pi++) {
            const tk = tanks[pi]
            const dist = Math.sqrt((tk.x - ex) ** 2 + ((tk.y - TANK_H / 2) - ey) ** 2)
            if (dist < wDef.radius + 22) {
              const dmg = Math.round(wDef.damage * (1.2 - dist / (wDef.radius + 22)))
              hpChanges[pi] += Math.max(0, dmg)
            }
          }
        } else {
          surviving.push(np)
        }
      }

      // 서브 포탄 추가
      g.projectiles = [...surviving, ...newSubProjs]
      g.terrain = terrain

      // 탱크 지형 위로 갱신
      g.tanks = tanks.map(tk => ({ ...tk, y: getY(terrain, tk.x) - TANK_H }))

      // 폭발 추가
      if (newExplosions.length > 0) {
        g.explosions = [...g.explosions, ...newExplosions]
      }

      // 폭발 애니메이션 진행
      g.explosions = g.explosions.map(e => ({ ...e, t: e.t + 1 })).filter(e => e.t < 28)

      triggerRender()

      // HP 업데이트
      if (hpChanges[0] > 0 || hpChanges[1] > 0) {
        setHp(prev => {
          const next = [Math.max(0, prev[0] - hpChanges[0]), Math.max(0, prev[1] - hpChanges[1])]
          if (next[0] <= 0) { setTimeout(() => { setWinner(1); setScreen('over') }, 500) }
          if (next[1] <= 0) { setTimeout(() => { setWinner(0); setScreen('over') }, 500) }
          return next
        })
      }

      // 모든 포탄 소진 → 턴 종료
      if (g.projectiles.length === 0 && !g.endTurnQueued) {
        g.endTurnQueued = true
        setTimeout(() => {
          setUiState(prev => {
            doEndTurn(prev.turn, mode, wind, weapons)
            return prev
          })
        }, 600)
      }
    }, 16)

    return () => clearInterval(interval)
  }, [screen, uiState.phase, mode, wind, weapons, doEndTurn, triggerRender])

  // ── Canvas 렌더링 ──
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !renderSnap) return
    const { terrain, tanks, projectiles, explosions, trajectoryDots } = renderSnap
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, GW, GH)

    // 하늘
    const skyGrad = ctx.createLinearGradient(0, 0, 0, GH)
    skyGrad.addColorStop(0, '#0d0d2b')
    skyGrad.addColorStop(0.7, '#1a0a3e')
    skyGrad.addColorStop(1, '#2d1060')
    ctx.fillStyle = skyGrad
    ctx.fillRect(0, 0, GW, GH)

    // 별
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    for (let i = 0; i < 60; i++) {
      const sx = (i * 137.5) % GW
      const sy = (i * 79.3) % (GH * 0.55)
      ctx.beginPath(); ctx.arc(sx, sy, 0.8 + (i % 3) * 0.4, 0, Math.PI * 2); ctx.fill()
    }

    // 지형
    ctx.beginPath()
    ctx.moveTo(0, GH)
    for (let x = 0; x < GW; x++) ctx.lineTo(x, terrain[x])
    ctx.lineTo(GW, GH)
    ctx.closePath()
    const tGrad = ctx.createLinearGradient(0, 200, 0, GH)
    tGrad.addColorStop(0, '#6d4c41')
    tGrad.addColorStop(0.25, '#4caf50')
    tGrad.addColorStop(1, '#1b5e20')
    ctx.fillStyle = tGrad; ctx.fill()
    ctx.strokeStyle = '#81c784'; ctx.lineWidth = 2; ctx.stroke()

    // 궤적
    ctx.globalAlpha = 0.55
    for (let i = 0; i < trajectoryDots.length; i++) {
      const d = trajectoryDots[i]
      ctx.fillStyle = `rgba(255,235,59,${0.7 - (i / trajectoryDots.length) * 0.6})`
      ctx.beginPath(); ctx.arc(d.x, d.y, 2.5, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1

    // 탱크
    const { turn, angle, phase } = uiState
    tanks.forEach((tank, idx) => {
      const col = COLORS[idx]
      if (turn === idx && phase === 'aim') { ctx.shadowColor = col.tank; ctx.shadowBlur = 14 }
      // 본체
      ctx.fillStyle = col.tank
      ctx.beginPath()
      ctx.rect(tank.x - TANK_W / 2, tank.y - TANK_H, TANK_W, TANK_H)
      ctx.fill()
      ctx.shadowBlur = 0
      // 바퀴
      ctx.fillStyle = '#222'
      for (let w = 0; w < 4; w++) {
        ctx.beginPath()
        ctx.arc(tank.x - TANK_W / 2 + 6 + w * 10, tank.y, 5, 0, Math.PI * 2)
        ctx.fill()
      }
      // 포신
      const rad = (angle * Math.PI) / 180
      const dir = idx === 0 ? 1 : -1
      const bx = tank.x + dir * Math.cos(rad) * BARREL_LEN
      const by = (tank.y - TANK_H / 2) - Math.sin(rad) * BARREL_LEN
      ctx.strokeStyle = col.barrel; ctx.lineWidth = 6; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(tank.x, tank.y - TANK_H / 2); ctx.lineTo(bx, by); ctx.stroke()

      // HP 바
      const barW = 50, barX = tank.x - 25, barY = tank.y - TANK_H - 16
      ctx.fillStyle = '#222'; ctx.fillRect(barX - 1, barY - 1, barW + 2, 10)
      const ratio = hp[idx] / 100
      ctx.fillStyle = ratio > 0.5 ? '#4caf50' : ratio > 0.25 ? '#ff9800' : '#f44336'
      ctx.fillRect(barX, barY, barW * ratio, 8)
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center'
      ctx.fillText(`${hp[idx]}`, tank.x, barY - 3)
    })

    // 포탄
    projectiles.forEach(p => {
      ctx.save()
      if (p.weaponId === 'banana') {
        ctx.font = '16px serif'; ctx.textAlign = 'center'; ctx.fillText('🍌', p.x, p.y)
      } else if (p.weaponId === 'missile') {
        ctx.font = '16px serif'; ctx.textAlign = 'center'; ctx.fillText('🚀', p.x, p.y)
      } else if (p.weaponId === 'airstrike') {
        ctx.font = '18px serif'; ctx.textAlign = 'center'; ctx.fillText('✈️', p.x, p.y)
      } else {
        ctx.fillStyle = '#ffeb3b'; ctx.shadowColor = '#ff9800'; ctx.shadowBlur = 10
        ctx.beginPath(); ctx.arc(p.x, p.y, p.weaponId === 'sub' ? 3.5 : 5, 0, Math.PI * 2); ctx.fill()
      }
      ctx.restore()
    })

    // 폭발
    explosions.forEach(ex => {
      const progress = ex.t / 28
      const r = ex.r * (0.25 + progress * 0.75)
      ctx.save()
      ctx.globalAlpha = Math.max(0, 1 - progress)
      const grad = ctx.createRadialGradient(ex.x, ex.y, 0, ex.x, ex.y, r)
      grad.addColorStop(0, '#fff')
      grad.addColorStop(0.2, '#ffeb3b')
      grad.addColorStop(0.5, '#ff5722')
      grad.addColorStop(1, 'transparent')
      ctx.fillStyle = grad
      ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    })

    ctx.textAlign = 'left'
  }, [renderSnap, uiState, hp])

  const { turn, phase, angle, power } = uiState
  const isHumanTurn = mode === '2p' || (mode === 'ai' && turn === 0)
  const currentLabel = turn === 0 ? '🔴 플레이어 1' : (mode === 'ai' ? '🤖 AI' : '🔵 플레이어 2')
  const currentColor = turn === 0 ? '#e74c3c' : '#3498db'

  // ── 메뉴 ──
  if (screen === 'menu') {
    return (
      <div className="ft-screen ft-menu">
        <Link to="/" className="ft-back">← 홈으로</Link>
        <div className="ft-menu-box">
          <div className="ft-menu-title">
            <span>🚀</span>
            <h1>삐리삐리 날라갑니다</h1>
            <span>💥</span>
          </div>
          <p className="ft-menu-sub">각도와 파워로 포탄을 쏴 상대 탱크를 격파하세요!</p>
          <div className="ft-menu-weapons">
            {WEAPONS.map(w => <span key={w.id} title={w.name}>{w.emoji}</span>)}
          </div>
          <div className="ft-menu-btns">
            <button className="ft-btn ft-btn-2p" onClick={() => initGame('2p')}>👥 2인 대전</button>
            <button className="ft-btn ft-btn-ai" onClick={() => initGame('ai')}>🤖 AI 대전</button>
          </div>
          <div className="ft-menu-guide">
            <p>🎯 슬라이더로 각도/파워 조절 → 발사!</p>
            <p>💣 다양한 무기를 전략적으로 선택</p>
            <p>🌬️ 바람 방향에 주의하세요</p>
          </div>
        </div>
      </div>
    )
  }

  // ── 게임 오버 ──
  if (screen === 'over') {
    const winLabel = winner === 0 ? '🔴 플레이어 1' : (mode === 'ai' ? '🤖 AI' : '🔵 플레이어 2')
    const isHumanWin = winner === 0 || (winner === 1 && mode === '2p')
    return (
      <div className="ft-screen ft-over">
        <div className="ft-over-box">
          <div className="ft-over-icon">{isHumanWin ? '🏆' : '💀'}</div>
          <h2>{winLabel} 승리!</h2>
          <p>{winner === 0 ? '완벽한 포격이었어요!' : mode === 'ai' ? 'AI에게 졌네요! 다시 도전!' : '멋진 승리!'}</p>
          <div className="ft-over-btns">
            <button className="ft-btn ft-btn-2p" onClick={() => initGame(mode)}>다시 시작</button>
            <button className="ft-btn ft-btn-ai" onClick={() => setScreen('menu')}>메뉴로</button>
            <Link to="/" className="ft-btn ft-btn-home">홈으로</Link>
          </div>
        </div>
      </div>
    )
  }

  // ── 게임 ──
  return (
    <div className="ft-container">
      <Link to="/" className="ft-back">← 홈으로</Link>

      {/* HUD */}
      <div className="ft-hud-top">
        <div className="ft-hud-player">
          <span className="ft-hud-tank">🔴 P1</span>
          <div className="ft-hud-hp-bar"><div style={{ width: `${hp[0]}%`, background: '#e74c3c' }} /></div>
          <span className="ft-hud-hp-num">{hp[0]}</span>
        </div>
        <div className="ft-hud-center">
          <div className="ft-hud-turn" style={{ color: currentColor }}>{currentLabel}의 턴</div>
          <div className="ft-hud-wind">🌬️ {wind > 0 ? '→' : '←'} {Math.abs(wind * 200).toFixed(1)}</div>
        </div>
        <div className="ft-hud-player" style={{ justifyContent: 'flex-end' }}>
          <span className="ft-hud-hp-num">{hp[1]}</span>
          <div className="ft-hud-hp-bar"><div style={{ width: `${hp[1]}%`, background: '#3498db' }} /></div>
          <span className="ft-hud-tank">{mode === 'ai' ? '🤖 AI' : '🔵 P2'}</span>
        </div>
      </div>

      {/* 캔버스 */}
      <div className="ft-canvas-wrap">
        <canvas
          ref={canvasRef}
          width={GW}
          height={GH}
          className="ft-canvas"
          onClick={airstrikeMode ? handleAirstrikeClick : undefined}
          style={{ cursor: airstrikeMode ? 'crosshair' : 'default' }}
        />
        {airstrikeMode && <div className="ft-airstrike-hint">✈️ 클릭해서 폭격 위치 선택!</div>}
      </div>

      {/* 컨트롤 */}
      {isHumanTurn && phase === 'aim' && (
        <div className="ft-controls">
          <div className="ft-controls-row">
            <div className="ft-ctrl-group">
              <label>🎯 각도 <strong>{Math.round(angle)}°</strong></label>
              <input type="range" min="5" max="175" value={angle} className="ft-slider ft-slider-angle"
                onChange={e => setUiState(prev => ({ ...prev, angle: Number(e.target.value) }))} />
            </div>
            <div className="ft-ctrl-group">
              <label>💪 파워 <strong>{Math.round(power)}%</strong></label>
              <input type="range" min="10" max="100" value={power} className="ft-slider ft-slider-power"
                onChange={e => setUiState(prev => ({ ...prev, power: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="ft-controls-row ft-controls-actions">
            <div className="ft-weapon-select">
              <button className="ft-weapon-btn" onClick={() => setShowWeaponMenu(v => !v)}>
                {WEAPONS.find(w => w.id === selectedWeapon[turn])?.emoji}
                {' '}{WEAPONS.find(w => w.id === selectedWeapon[turn])?.name}
                <span className="ft-weapon-count">
                  {weapons[turn][selectedWeapon[turn]] === Infinity ? '∞' : weapons[turn][selectedWeapon[turn]]}
                </span>
                {' ▼'}
              </button>
              {showWeaponMenu && (
                <div className="ft-weapon-menu">
                  {WEAPONS.map(w => (
                    <button key={w.id}
                      className={`ft-weapon-option ${selectedWeapon[turn] === w.id ? 'active' : ''} ${weapons[turn][w.id] === 0 ? 'empty' : ''}`}
                      disabled={weapons[turn][w.id] === 0}
                      onClick={() => { setSelectedWeapon(prev => prev.map((s, i) => i === turn ? w.id : s)); setShowWeaponMenu(false) }}>
                      <span className="ft-wo-emoji">{w.emoji}</span>
                      <span className="ft-wo-info">
                        <span className="ft-wo-name">{w.name}</span>
                        <span className="ft-wo-desc">{w.desc}</span>
                      </span>
                      <span className="ft-wo-count">{weapons[turn][w.id] === Infinity ? '∞' : weapons[turn][w.id]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="ft-fire-btn" onClick={handleFire}>🔥 발사!</button>
          </div>
          {message && <div className="ft-message">{message}</div>}
        </div>
      )}

      {phase === 'flying' && <div className="ft-flying-hint">💨 포탄 비행 중...</div>}
      {mode === 'ai' && turn === 1 && phase === 'aim' && <div className="ft-ai-thinking">🤖 AI 조준 중...</div>}
    </div>
  )
}
