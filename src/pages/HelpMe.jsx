import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGameScale } from '../hooks/useGameScale'
import { useTouchLock } from '../hooks/useTouchLock'
import './HelpMe.css'

const GAME_W = 420
const GAME_H = 620
const HAND_BOUNDS = { left: 48, right: 326, top: 132, bottom: 540 }
const CURSOR_START = { x: 202, y: 326 }
const KEY_SPEED = 6
const CLEAN_RADIUS = 24
const BURST_LIFE = 720
const GERM_COLORS = ['#48d15f', '#f65b8b', '#7d63ff', '#ffb43b', '#23c6d4']

const DECORATIVE_BUBBLES = [
  { left: 34, top: 92, size: 10, delay: '0s' },
  { left: 372, top: 88, size: 14, delay: '0.9s' },
  { left: 56, top: 534, size: 16, delay: '1.7s' },
  { left: 338, top: 548, size: 11, delay: '0.4s' },
  { left: 27, top: 312, size: 8, delay: '1.2s' },
  { left: 364, top: 374, size: 10, delay: '2s' },
]

function rand(min, max) {
  return min + Math.random() * (max - min)
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function getLevelConfig(level) {
  const hasBoss = level % 3 === 0
  const baseCount = Math.min(34, 6 + Math.floor(level * 1.7))
  const normalCount = hasBoss ? Math.max(6, baseCount - 4) : baseCount
  const speed = Math.min(3.4, 0.75 + level * 0.16)
  const duration = Math.max(14, 31 - Math.floor(level * 0.9))
  const germSize = Math.max(18, 34 - Math.floor(level * 0.9))
  const bossHp = hasBoss ? Math.min(12, 4 + Math.floor(level / 3) * 2) : 0
  const totalTargets = normalCount + (hasBoss ? 1 : 0)

  return { normalCount, totalTargets, speed, duration, germSize, hasBoss, bossHp }
}

function createGerm(id, config, existing = []) {
  const angle = rand(0, Math.PI * 2)
  const speed = config.speed * rand(0.78, 1.28)
  const size = config.germSize * rand(0.82, 1.18)
  let x = rand(HAND_BOUNDS.left + 24, HAND_BOUNDS.right - 24)
  let y = rand(HAND_BOUNDS.top + 28, HAND_BOUNDS.bottom - 30)

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const crowded = existing.some((germ) => Math.hypot(germ.x - x, germ.y - y) < (germ.size + size) * 0.64)
    if (!crowded) break
    x = rand(HAND_BOUNDS.left + 24, HAND_BOUNDS.right - 24)
    y = rand(HAND_BOUNDS.top + 28, HAND_BOUNDS.bottom - 30)
  }

  return {
    id,
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size,
    color: GERM_COLORS[id % GERM_COLORS.length],
    rotate: rand(-22, 22),
    wobble: rand(1.5, 4.8),
    mood: id % 3,
    hp: 1,
    maxHp: 1,
    isBoss: false,
  }
}

function createLevelGerms(level) {
  const config = getLevelConfig(level)
  const germs = []

  for (let i = 0; i < config.normalCount; i += 1) {
    germs.push(createGerm(i, config, germs))
  }

  if (config.hasBoss) {
    const angle = rand(0, Math.PI * 2)
    const bossSpeed = config.speed * 0.58
    germs.push({
      id: `boss-${level}`,
      x: rand(HAND_BOUNDS.left + 82, HAND_BOUNDS.right - 76),
      y: rand(HAND_BOUNDS.top + 100, HAND_BOUNDS.bottom - 105),
      vx: Math.cos(angle) * bossSpeed,
      vy: Math.sin(angle) * bossSpeed,
      size: Math.max(50, config.germSize * 1.7),
      color: '#7c3aed',
      rotate: rand(-10, 10),
      wobble: 2.4,
      mood: 2,
      hp: config.bossHp,
      maxHp: config.bossHp,
      isBoss: true,
    })
  }

  return germs
}

function moveGerm(germ, delta) {
  const next = { ...germ }
  const scale = Math.min(2.2, delta / 16)
  next.x += next.vx * scale
  next.y += next.vy * scale

  const radius = next.size / 2
  if (next.x < HAND_BOUNDS.left + radius) {
    next.x = HAND_BOUNDS.left + radius
    next.vx = Math.abs(next.vx)
  }
  if (next.x > HAND_BOUNDS.right - radius) {
    next.x = HAND_BOUNDS.right - radius
    next.vx = -Math.abs(next.vx)
  }
  if (next.y < HAND_BOUNDS.top + radius) {
    next.y = HAND_BOUNDS.top + radius
    next.vy = Math.abs(next.vy)
  }
  if (next.y > HAND_BOUNDS.bottom - radius) {
    next.y = HAND_BOUNDS.bottom - radius
    next.vy = -Math.abs(next.vy)
  }

  next.rotate += next.vx * 0.35
  return next
}

function createBurst(germ) {
  return Array.from({ length: 14 }, (_, i) => {
    const angle = (Math.PI * 2 * i) / 14 + rand(-0.22, 0.22)
    const distance = rand(20, 54)
    return {
      id: `${germ.id}-${Date.now()}-${i}`,
      x: germ.x,
      y: germ.y,
      size: rand(6, 15),
      color: i % 3 === 0 ? '#ffffff' : germ.color,
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      delay: `${i * 12}ms`,
    }
  })
}

function HelpMe() {
  const scale = useGameScale(GAME_W, GAME_H, { reservedH: 76 })
  const containerRef = useRef(null)
  const areaRef = useRef(null)
  useTouchLock(containerRef)

  const [phase, setPhase] = useState('menu')
  const [level, setLevel] = useState(1)
  const [germs, setGerms] = useState([])
  const [bursts, setBursts] = useState([])
  const [cursorPos, setCursorPos] = useState(CURSOR_START)
  const [timeLeft, setTimeLeft] = useState(getLevelConfig(1).duration)
  const [soapPulse, setSoapPulse] = useState(false)
  const [lastClear, setLastClear] = useState(0)

  const levelConfig = useMemo(() => getLevelConfig(level), [level])
  const germsRef = useRef(germs)
  const cursorRef = useRef(cursorPos)
  const phaseRef = useRef(phase)
  const levelRef = useRef(level)
  const keysRef = useRef(new Set())
  const deadlineRef = useRef(0)
  const timersRef = useRef([])
  const burstSerialRef = useRef(0)

  useEffect(() => { germsRef.current = germs }, [germs])
  useEffect(() => { cursorRef.current = cursorPos }, [cursorPos])
  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { levelRef.current = level }, [level])

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      timers.length = 0
    }
  }, [])

  const scheduleBurstCleanup = useCallback((ids) => {
    const timer = setTimeout(() => {
      setBursts((prev) => prev.filter((burst) => !ids.includes(burst.id)))
    }, BURST_LIFE)
    timersRef.current.push(timer)
  }, [])

  const startLevel = useCallback((targetLevel) => {
    const nextLevel = targetLevel || 1
    const nextConfig = getLevelConfig(nextLevel)
    const nextGerms = createLevelGerms(nextLevel)

    levelRef.current = nextLevel
    germsRef.current = nextGerms
    cursorRef.current = CURSOR_START
    deadlineRef.current = Date.now() + nextConfig.duration * 1000
    keysRef.current.clear()

    setLevel(nextLevel)
    setGerms(nextGerms)
    setBursts([])
    setCursorPos(CURSOR_START)
    setTimeLeft(nextConfig.duration)
    setLastClear(0)
    setSoapPulse(false)
    setPhase('playing')
  }, [])

  const loseGame = useCallback(() => {
    if (phaseRef.current !== 'playing') return
    keysRef.current.clear()
    setTimeLeft(0)
    setPhase('lost')
  }, [])

  const winLevel = useCallback(() => {
    if (phaseRef.current !== 'playing') return
    keysRef.current.clear()
    setLastClear(levelRef.current)
    setPhase('won')
  }, [])

  const nextLevel = useCallback(() => {
    startLevel(levelRef.current + 1)
  }, [startLevel])

  const scrubAt = useCallback((x, y) => {
    if (phaseRef.current !== 'playing') return

    const current = germsRef.current
    const target = current.reduce((closest, germ) => {
      const dx = germ.x - x
      const dy = germ.y - y
      const distance = Math.hypot(dx, dy)
      const hitRadius = CLEAN_RADIUS + germ.size * 0.28
      if (distance > hitRadius) return closest
      if (!closest || distance < closest.distance) {
        return { germ, distance }
      }
      return closest
    }, null)

    setSoapPulse(true)
    const pulseTimer = setTimeout(() => setSoapPulse(false), 160)
    timersRef.current.push(pulseTimer)

    if (!target) return

    const hitGerm = target.germ
    const shouldRemove = !hitGerm.isBoss || hitGerm.hp <= 1
    const nextGerms = shouldRemove
      ? current.filter((germ) => germ.id !== hitGerm.id)
      : current.map((germ) => {
          if (germ.id !== hitGerm.id) return germ
          return {
            ...germ,
            hp: germ.hp - 1,
            vx: -germ.vx * 1.04,
            vy: -germ.vy * 1.04,
            rotate: germ.rotate + 18,
          }
        })

    const nextBursts = createBurst({ ...hitGerm, id: `${hitGerm.id}-${burstSerialRef.current++}` })
    germsRef.current = nextGerms
    setGerms(nextGerms)
    setBursts((prev) => [...prev, ...nextBursts])
    scheduleBurstCleanup(nextBursts.map((burst) => burst.id))

    if (nextGerms.length === 0) {
      winLevel()
    }
  }, [scheduleBurstCleanup, winLevel])

  const updateCursorFromPointer = useCallback((event) => {
    if (!areaRef.current) return CURSOR_START
    const rect = areaRef.current.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * GAME_W
    const y = ((event.clientY - rect.top) / rect.height) * GAME_H
    const next = {
      x: clamp(x, 16, GAME_W - 18),
      y: clamp(y, 16, GAME_H - 16),
    }
    cursorRef.current = next
    setCursorPos(next)
    return next
  }, [])

  const handlePointerMove = useCallback((event) => {
    if (phaseRef.current !== 'playing') return
    updateCursorFromPointer(event)
  }, [updateCursorFromPointer])

  const handlePointerDown = useCallback((event) => {
    if (phaseRef.current !== 'playing') return
    event.preventDefault()
    const next = updateCursorFromPointer(event)
    scrubAt(next.x, next.y)
  }, [scrubAt, updateCursorFromPointer])

  useEffect(() => {
    const handleKeyDown = (event) => {
      const key = event.key.toLowerCase()
      const target = event.target
      const activeTarget = document.activeElement
      const eventInteractive = target instanceof Element && !!target.closest('a, button, input, textarea, select')
      const activeInteractive = activeTarget instanceof Element && !!activeTarget.closest('a, button, input, textarea, select')
      const isInteractiveTarget = eventInteractive || activeInteractive

      if (isInteractiveTarget) return

      if (phaseRef.current === 'playing' && ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's', 'shift'].includes(key)) {
        event.preventDefault()
        keysRef.current.add(key)
      }

      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        if (phaseRef.current === 'playing') {
          const { x, y } = cursorRef.current
          scrubAt(x, y)
        } else if (phaseRef.current === 'won') {
          nextLevel()
        } else {
          startLevel(phaseRef.current === 'lost' ? 1 : levelRef.current)
        }
      }

      if (key === 'r' && phaseRef.current !== 'playing') {
        startLevel(1)
      }
    }

    const handleKeyUp = (event) => {
      keysRef.current.delete(event.key.toLowerCase())
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [nextLevel, scrubAt, startLevel])

  useEffect(() => {
    if (phase !== 'playing') return

    let rafId
    let lastTime = performance.now()

    const loop = (now) => {
      const delta = now - lastTime
      lastTime = now

      setGerms((prev) => {
        const moved = prev.map((germ) => moveGerm(germ, delta))
        germsRef.current = moved
        return moved
      })

      setCursorPos((prev) => {
        let dx = 0
        let dy = 0
        const keys = keysRef.current
        const keySpeed = keys.has('shift') ? KEY_SPEED * 0.45 : KEY_SPEED
        if (keys.has('arrowleft') || keys.has('a')) dx -= keySpeed
        if (keys.has('arrowright') || keys.has('d')) dx += keySpeed
        if (keys.has('arrowup') || keys.has('w')) dy -= keySpeed
        if (keys.has('arrowdown') || keys.has('s')) dy += keySpeed
        if (dx === 0 && dy === 0) return prev

        const next = {
          x: clamp(prev.x + dx, 18, GAME_W - 20),
          y: clamp(prev.y + dy, 18, GAME_H - 18),
        }
        cursorRef.current = next
        return next
      })

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [phase])

  useEffect(() => {
    if (phase !== 'playing') return

    const timer = setInterval(() => {
      const remaining = Math.max(0, (deadlineRef.current - Date.now()) / 1000)
      setTimeLeft(remaining)
      if (remaining <= 0) loseGame()
    }, 80)

    return () => clearInterval(timer)
  }, [loseGame, phase])

  const timeRatio = levelConfig.duration === 0 ? 0 : clamp(timeLeft / levelConfig.duration, 0, 1)
  const remainingGerms = germs.length
  const totalGerms = levelConfig.totalTargets

  return (
    <div ref={containerRef} className="hm-container">
      <Link to="/" className="hm-back">← 홈으로</Link>

      <div className="hm-wrapper" style={{ width: GAME_W * scale, height: GAME_H * scale }}>
        <div
          ref={areaRef}
          className={`hm-area hm-${phase}`}
          style={{ width: GAME_W, height: GAME_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
        >
          <div className="hm-hospital-layer">
            <div className="hm-hospital-cross">+</div>
            <div className="hm-hospital-bed">
              <span>🤒</span>
            </div>
            <div className="hm-hospital-iv" />
            <div className="hm-hospital-monitor">
              <span />
            </div>
          </div>

          <div className="hm-play-layer">
            {DECORATIVE_BUBBLES.map((bubble) => (
              <span
                key={`${bubble.left}-${bubble.top}`}
                className="hm-bg-bubble"
                style={{
                  left: bubble.left,
                  top: bubble.top,
                  width: bubble.size,
                  height: bubble.size,
                  animationDelay: bubble.delay,
                }}
              />
            ))}

            <div className="hm-tiles" />

            <div className="hm-hud">
              <div className="hm-level-chip">LV {level}</div>
              <div className="hm-germ-count">
                <span className="hm-germ-dot" />
                {remainingGerms}/{totalGerms}
              </div>
            </div>

            <div className="hm-hourglass-panel">
              <div className="hm-hourglass">
                <div className="hm-hourglass-top">
                  <span style={{ height: `${timeRatio * 76}%` }} />
                </div>
                <div className="hm-hourglass-neck" />
                <div className="hm-hourglass-bottom">
                  <span style={{ height: `${(1 - timeRatio) * 76}%` }} />
                </div>
              </div>
              <div className="hm-time">{Math.ceil(timeLeft)}</div>
            </div>

            <svg className="hm-hand-svg" viewBox="0 0 320 500" aria-hidden="true">
              <defs>
                <linearGradient id="hmSkin" x1="64" y1="30" x2="250" y2="470" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#ffe1c2" />
                  <stop offset="0.48" stopColor="#f3ab7b" />
                  <stop offset="1" stopColor="#dd7f61" />
                </linearGradient>
                <linearGradient id="hmSkinSoft" x1="75" y1="0" x2="270" y2="360" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#ffe8cf" />
                  <stop offset="1" stopColor="#efa071" />
                </linearGradient>
                <radialGradient id="hmPalmGlow" cx="39%" cy="34%" r="68%">
                  <stop offset="0" stopColor="#fff1df" stopOpacity="0.7" />
                  <stop offset="0.54" stopColor="#ffd4aa" stopOpacity="0.14" />
                  <stop offset="1" stopColor="#b95842" stopOpacity="0.16" />
                </radialGradient>
                <filter id="hmHandShadow" x="-20%" y="-16%" width="140%" height="138%">
                  <feDropShadow dx="0" dy="18" stdDeviation="12" floodColor="#8e5238" floodOpacity="0.24" />
                </filter>
              </defs>

              <g filter="url(#hmHandShadow)">
                <path
                  className="hm-hand-part"
                  d="M79 181 C68 168 69 145 72 119 L80 52 C83 26 99 11 120 14 C141 17 153 36 151 61 L144 178 Z"
                  fill="url(#hmSkinSoft)"
                />
                <path
                  className="hm-hand-part"
                  d="M132 177 L134 42 C135 17 151 1 173 2 C196 3 211 22 209 48 L200 180 Z"
                  fill="url(#hmSkinSoft)"
                />
                <path
                  className="hm-hand-part"
                  d="M191 183 L198 61 C200 36 216 21 237 24 C258 27 270 47 266 72 L251 197 Z"
                  fill="url(#hmSkinSoft)"
                />
                <path
                  className="hm-hand-part"
                  d="M244 215 L268 104 C273 82 288 71 304 77 C321 83 327 101 321 123 L289 256 Z"
                  fill="url(#hmSkinSoft)"
                />

                <path
                  className="hm-thumb-shape"
                  d="M70 261 C43 271 15 295 14 323 C13 348 34 366 63 360 C84 356 105 341 120 322 C127 312 124 298 113 292 C96 283 88 268 70 261 Z"
                  fill="url(#hmSkinSoft)"
                />

                <path
                  className="hm-palm-shape"
                  d="M84 170 C119 157 185 157 230 179 C269 198 293 236 295 288 C298 358 284 429 236 466 C202 493 131 493 91 467 C55 443 39 402 39 348 L39 290 C39 267 54 251 73 254 C89 257 99 269 103 287 L110 319 L98 204 C96 185 72 176 84 170 Z"
                  fill="url(#hmSkin)"
                />
                <path
                  className="hm-palm-glow"
                  d="M84 170 C119 157 185 157 230 179 C269 198 293 236 295 288 C298 358 284 429 236 466 C202 493 131 493 91 467 C55 443 39 402 39 348 L39 290 C39 267 54 251 73 254 C89 257 99 269 103 287 L110 319 L98 204 C96 185 72 176 84 170 Z"
                  fill="url(#hmPalmGlow)"
                />

                <path className="hm-hand-line" d="M112 255 C145 267 184 273 235 258" />
                <path className="hm-hand-line" d="M112 319 C154 304 202 306 252 329" />
                <path className="hm-hand-line" d="M126 385 C158 373 198 375 232 393" />
                <path className="hm-hand-line hm-hand-line-soft" d="M86 205 C91 232 94 257 103 287" />
                <path className="hm-hand-line hm-hand-line-soft" d="M135 190 C151 198 173 199 193 191" />

                <ellipse className="hm-fingernail" cx="111" cy="42" rx="18" ry="10" />
                <ellipse className="hm-fingernail" cx="173" cy="29" rx="19" ry="10" />
                <ellipse className="hm-fingernail" cx="235" cy="51" rx="17" ry="9" />
                <ellipse className="hm-fingernail" cx="300" cy="103" rx="13" ry="8" transform="rotate(12 300 103)" />
              </g>
            </svg>

            {germs.map((germ) => (
              <button
                key={germ.id}
                type="button"
                aria-label={germ.isBoss ? '보스 세균 공격' : '세균 없애기'}
                className={`hm-germ hm-germ-${germ.mood}${germ.isBoss ? ' hm-germ-boss' : ''}`}
                style={{
                  left: germ.x,
                  top: germ.y,
                  width: germ.size,
                  height: germ.size,
                  background: germ.color,
                  transform: `translate(-50%, -50%) rotate(${germ.rotate}deg)`,
                  animationDuration: `${germ.wobble}s`,
                }}
                onPointerDown={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  scrubAt(germ.x, germ.y)
                }}
              >
                {germ.isBoss && (
                  <span className="hm-boss-energy">
                    <span style={{ width: `${(germ.hp / germ.maxHp) * 100}%` }} />
                  </span>
                )}
                <span className="hm-germ-eye hm-germ-eye-left" />
                <span className="hm-germ-eye hm-germ-eye-right" />
                <span className="hm-germ-mouth" />
                <span className="hm-germ-spike hm-germ-spike-1" />
                <span className="hm-germ-spike hm-germ-spike-2" />
                <span className="hm-germ-spike hm-germ-spike-3" />
                <span className="hm-germ-spike hm-germ-spike-4" />
              </button>
            ))}

            {bursts.map((burst) => (
              <span
                key={burst.id}
                className="hm-burst"
                style={{
                  left: burst.x,
                  top: burst.y,
                  width: burst.size,
                  height: burst.size,
                  background: burst.color,
                  '--burst-x': `${burst.dx}px`,
                  '--burst-y': `${burst.dy}px`,
                  animationDelay: burst.delay,
                }}
              />
            ))}

            {phase === 'playing' && (
              <div
                className={`hm-soap-cursor${soapPulse ? ' hm-soap-cursor-pulse' : ''}`}
                style={{ left: cursorPos.x, top: cursorPos.y }}
              >
                <span className="hm-soap-bar" />
                <span className="hm-soap-foam hm-soap-foam-1" />
                <span className="hm-soap-foam hm-soap-foam-2" />
                <span className="hm-soap-foam hm-soap-foam-3" />
              </div>
            )}
          </div>

          {phase === 'menu' && (
            <div className="hm-overlay">
              <div className="hm-card">
                <div className="hm-card-icon">🧼</div>
                <h1>도와줘</h1>
                <p>손바닥을 깨끗하게 구해 주세요</p>
                <button className="hm-primary" onClick={() => startLevel(1)}>시작하기</button>
              </div>
            </div>
          )}

          {phase === 'won' && (
            <div className="hm-overlay hm-overlay-clear">
              <div className="hm-card">
                <div className="hm-card-icon">✨</div>
                <h2>깨끗해졌어요!</h2>
                <p>레벨 {lastClear} 성공</p>
                <button className="hm-primary" onClick={nextLevel}>다음 레벨</button>
              </div>
            </div>
          )}

          {phase === 'lost' && (
            <div className="hm-overlay hm-overlay-lost">
              <div className="hm-card hm-card-lost">
                <div className="hm-card-icon">🏥</div>
                <h2>세균 승리</h2>
                <p>손 씻기 작전이 늦었어요</p>
                <div className="hm-overlay-actions">
                  <button className="hm-primary" onClick={() => startLevel(1)}>다시 도전</button>
                  <Link to="/" className="hm-secondary-link">홈으로</Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default HelpMe
