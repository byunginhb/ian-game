import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGameScale } from '../hooks/useGameScale'
import { useTouchLock } from '../hooks/useTouchLock'
import './Suika.css'

const GAME_W = 360
const GAME_H = 500
const DROP_ZONE_H = 60
const LAYOUT_W = GAME_W + 6
const LAYOUT_H = GAME_H + DROP_ZONE_H + 80
const TICK = 16

const WALL_L = 0
const WALL_R = GAME_W
const FLOOR_Y = GAME_H
const DANGER_LINE = 60

const GRAVITY = 0.45
const RESTITUTION = 0.25
const FRICTION = 0.985
const MAX_VEL = 15
const COLLISION_ITERS = 3
const DROP_COOLDOWN = 500

const FRUITS = [
  { level: 0, name: '체리', radius: 14, color: '#ff496a', accent: '#ffd4dc', score: 1 },
  { level: 1, name: '포도', radius: 19, color: '#8b5cf6', accent: '#ddd0ff', score: 3 },
  { level: 2, name: '오렌지', radius: 25, color: '#ff9f1c', accent: '#ffe09b', score: 6 },
  { level: 3, name: '사과', radius: 30, color: '#ef476f', accent: '#ffb4c4', score: 10 },
  { level: 4, name: '배', radius: 36, color: '#a8d840', accent: '#e5f7a1', score: 15 },
  { level: 5, name: '복숭아', radius: 42, color: '#ff8fa3', accent: '#ffd0a8', score: 21 },
  { level: 6, name: '파인애플', radius: 48, color: '#f7c948', accent: '#fff0a6', score: 28 },
  { level: 7, name: '메론', radius: 55, color: '#72c98b', accent: '#d9f3a3', score: 36 },
  { level: 8, name: '수박', radius: 62, color: '#27ae60', accent: '#a7e85b', score: 45 },
]

const DROP_LEVELS = [0, 1, 2, 3, 4]

function randomDropLevel() {
  return DROP_LEVELS[Math.floor(Math.random() * DROP_LEVELS.length)]
}

let fruitIdCounter = 0
function makeFruit(level, x, y) {
  const def = FRUITS[level]
  return {
    id: ++fruitIdCounter,
    level,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: def.radius,
    droppedAt: Date.now(),
    spawnedAt: Date.now(),
    impactUntil: 0,
    isNew: true,
    isImpacting: false,
    rotation: (Math.random() - 0.5) * 10,
  }
}

function clampVel(v) {
  return Math.max(-MAX_VEL, Math.min(MAX_VEL, v))
}

function FruitArt({ level, className = '', label, style }) {
  const commonProps = {
    className: `sk-fruit-art sk-fruit-art-${level} ${className}`.trim(),
    viewBox: '0 0 100 100',
    role: label ? 'img' : undefined,
    'aria-label': label,
    'aria-hidden': label ? undefined : true,
    style,
  }

  if (level === 0) {
    return (
      <svg {...commonProps}>
        <path className="sk-stem" d="M50 39C51 25 59 15 72 10" />
        <path className="sk-leaf" d="M69 10c10-4 17 0 18 8-10 3-16 0-18-8Z" />
        <circle className="sk-skin" cx="49" cy="61" r="29" />
        <path className="sk-shade" d="M67 38c15 12 15 38-2 48 7-15 7-33 2-48Z" />
        <ellipse className="sk-shine" cx="38" cy="49" rx="8" ry="11" />
      </svg>
    )
  }

  if (level === 1) {
    return (
      <svg {...commonProps}>
        <path className="sk-stem" d="M53 29C53 19 59 14 67 10" />
        <path className="sk-leaf" d="M51 25c-13-9-24-3-25 9 13 5 21 1 25-9Z" />
        <g className="sk-skin">
          <circle cx="39" cy="43" r="16" /><circle cx="60" cy="43" r="16" />
          <circle cx="29" cy="62" r="15" /><circle cx="50" cy="62" r="16" /><circle cx="71" cy="62" r="15" />
          <circle cx="40" cy="79" r="14" /><circle cx="61" cy="79" r="14" />
        </g>
        <circle className="sk-shine" cx="34" cy="38" r="5" />
        <circle className="sk-dot" cx="56" cy="57" r="3" />
      </svg>
    )
  }

  if (level === 2) {
    return (
      <svg {...commonProps}>
        <path className="sk-stem" d="M50 25c3-8 8-12 13-14" />
        <path className="sk-leaf" d="M57 17c10-7 20-3 21 6-9 7-17 5-21-6Z" />
        <circle className="sk-skin" cx="50" cy="57" r="38" />
        <ellipse className="sk-shine" cx="36" cy="42" rx="9" ry="12" />
        <g className="sk-pore"><circle cx="70" cy="42" r="2" /><circle cx="75" cy="60" r="2" /><circle cx="57" cy="76" r="2" /><circle cx="27" cy="64" r="2" /></g>
      </svg>
    )
  }

  if (level === 3) {
    return (
      <svg {...commonProps}>
        <path className="sk-stem" d="M50 29c0-10 3-16 9-21" />
        <path className="sk-leaf" d="M57 17c12-9 22-4 23 6-11 6-19 4-23-6Z" />
        <path className="sk-skin" d="M50 29c12-9 32-3 38 13 8 23-9 48-28 51-4 1-7-3-10-3s-6 4-10 3C21 90 4 65 12 42c6-16 26-22 38-13Z" />
        <path className="sk-shade" d="M75 35c18 17 7 44-9 53 9-18 10-36 9-53Z" />
        <ellipse className="sk-shine" cx="32" cy="42" rx="8" ry="12" />
      </svg>
    )
  }

  if (level === 4) {
    return (
      <svg {...commonProps}>
        <path className="sk-stem" d="M49 23c1-8 5-13 11-17" />
        <path className="sk-leaf" d="M57 15c12-8 22-3 22 7-11 6-18 3-22-7Z" />
        <path className="sk-skin" d="M50 21c14 0 19 14 19 26 0 8 18 17 18 31 0 15-16 18-37 18S13 93 13 78c0-14 18-23 18-31 0-12 5-26 19-26Z" />
        <path className="sk-shade" d="M64 34c4 18 17 37 5 54 15-8 20-17 15-26-5-10-14-14-20-28Z" />
        <ellipse className="sk-shine" cx="36" cy="55" rx="8" ry="14" />
      </svg>
    )
  }

  if (level === 5) {
    return (
      <svg {...commonProps}>
        <path className="sk-stem" d="M51 26c0-9 5-15 12-19" />
        <path className="sk-leaf" d="M58 17c13-8 23-3 23 8-11 6-19 3-23-8Z" />
        <path className="sk-skin" d="M50 26c21-14 39 3 39 27 0 23-22 41-39 43-17-2-39-20-39-43 0-24 18-41 39-27Z" />
        <path className="sk-crease" d="M51 28c-8 19-7 43 0 62" />
        <path className="sk-shade" d="M71 30c20 16 8 44-9 57 9-21 10-39 9-57Z" />
        <ellipse className="sk-shine" cx="32" cy="43" rx="8" ry="12" />
      </svg>
    )
  }

  if (level === 6) {
    return (
      <svg {...commonProps}>
        <g className="sk-crown">
          <path d="M49 30 37 4l13 11L55 1l5 16L76 8 66 33Z" />
        </g>
        <path className="sk-skin" d="M50 25c25 0 37 16 35 39-2 22-15 33-35 33S17 86 15 64c-2-23 10-39 35-39Z" />
        <path className="sk-shade" d="M70 31c17 13 14 43-1 58 8-19 7-40 1-58Z" />
        <g className="sk-lattice"><path d="M22 45h56M17 62h66M21 79h58M30 31l40 58M17 45l35 49M70 31 30 89M83 45 48 94" /></g>
        <ellipse className="sk-shine" cx="30" cy="42" rx="7" ry="10" />
      </svg>
    )
  }

  if (level === 7) {
    return (
      <svg {...commonProps}>
        <path className="sk-stem" d="M50 21c0-8 4-13 10-17" />
        <circle className="sk-skin" cx="50" cy="58" r="40" />
        <path className="sk-shade" d="M73 27c18 18 15 45-3 62 9-19 11-42 3-62Z" />
        <g className="sk-net"><path d="M23 38c18 11 36 11 54 0M14 57c24 12 48 12 72 0M19 76c21 10 41 10 62 0M35 21c-8 24-8 49 0 72M52 18c-6 26-6 52 0 78M68 23c9 22 9 44 1 66" /></g>
        <ellipse className="sk-shine" cx="31" cy="36" rx="8" ry="11" />
      </svg>
    )
  }

  return (
    <svg {...commonProps}>
      <path className="sk-stem" d="M50 20c0-8 4-13 10-17" />
      <circle className="sk-skin" cx="50" cy="57" r="41" />
      <path className="sk-rind" d="M31 22c-10 17-11 47 1 68M49 16c-8 23-8 55 0 82M68 22c11 18 12 47 1 68M18 42c20 7 44 7 64 0M12 62c24 8 51 8 76 0" />
      <path className="sk-shade" d="M74 25c20 17 18 48-1 66 9-21 10-45 1-66Z" />
      <ellipse className="sk-shine" cx="30" cy="35" rx="8" ry="12" />
    </svg>
  )
}

function Suika() {
  const scale = useGameScale(LAYOUT_W, LAYOUT_H)
  const containerRef = useRef(null)
  useTouchLock(containerRef)

  const [gameState, setGameState] = useState('menu')

  const fruitsRef = useRef([])
  const scoreRef = useRef(0)
  const bestRef = useRef(0)
  const dropXRef = useRef(GAME_W / 2)
  const dropLevelRef = useRef(randomDropLevel())
  const nextLevelRef = useRef(randomDropLevel())
  const canDropRef = useRef(true)
  const keysRef = useRef({})
  const gameStateRef = useRef('menu')
  const particlesRef = useRef([])
  const mergeBurstsRef = useRef([])
  const scorePopRef = useRef([])
  const overLineTimerRef = useRef(0)
  const gameAreaRef = useRef(null)
  const [view, setView] = useState({
    fruits: [],
    score: 0,
    best: 0,
    dropX: GAME_W / 2,
    dropLevel: 0,
    nextLevel: 0,
    canDrop: true,
    particles: [],
    mergeBursts: [],
    scorePops: [],
  })

  const syncView = useCallback(() => {
    setView({
      fruits: fruitsRef.current.map((fruit) => ({ ...fruit })),
      score: scoreRef.current,
      best: bestRef.current,
      dropX: dropXRef.current,
      dropLevel: dropLevelRef.current,
      nextLevel: nextLevelRef.current,
      canDrop: canDropRef.current,
      particles: particlesRef.current.map((particle) => ({ ...particle })),
      mergeBursts: mergeBurstsRef.current.map((burst) => ({ ...burst })),
      scorePops: scorePopRef.current.map((pop) => ({ ...pop })),
    })
  }, [])

  // init best score
  useEffect(() => {
    try {
      bestRef.current = Number(localStorage.getItem('suika-best')) || 0
    } catch { /* noop */ }
    syncView()
  }, [syncView])

  const startGame = useCallback(() => {
    fruitIdCounter = 0
    fruitsRef.current = []
    scoreRef.current = 0
    dropXRef.current = GAME_W / 2
    dropLevelRef.current = randomDropLevel()
    nextLevelRef.current = randomDropLevel()
    canDropRef.current = true
    particlesRef.current = []
    mergeBurstsRef.current = []
    scorePopRef.current = []
    overLineTimerRef.current = 0
    gameStateRef.current = 'playing'
    setGameState('playing')
    syncView()
  }, [syncView])

  const dropFruit = useCallback(() => {
    if (!canDropRef.current || gameStateRef.current !== 'playing') return
    const level = dropLevelRef.current
    const def = FRUITS[level]
    const x = Math.max(WALL_L + def.radius, Math.min(WALL_R - def.radius, dropXRef.current))
    const fruit = makeFruit(level, x, 0)
    fruit.vx = (Math.random() - 0.5) * 1.5
    fruitsRef.current.push(fruit)
    canDropRef.current = false

    dropLevelRef.current = nextLevelRef.current
    nextLevelRef.current = randomDropLevel()

    setTimeout(() => {
      canDropRef.current = true
      syncView()
    }, DROP_COOLDOWN)
    syncView()
  }, [syncView])

  // keyboard
  useEffect(() => {
    const onDown = (e) => {
      if (['ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault()
        keysRef.current[e.key] = true
        if (e.key === ' ') dropFruit()
      }
    }
    const onUp = (e) => { keysRef.current[e.key] = false }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [dropFruit])

  // mouse/touch on drop zone
  const handlePointerMove = useCallback((e) => {
    if (gameStateRef.current !== 'playing') return
    const rect = gameAreaRef.current?.getBoundingClientRect()
    if (!rect) return
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const x = (clientX - rect.left) / scale
    dropXRef.current = Math.max(10, Math.min(GAME_W - 10, x))
  }, [scale])

  const handlePointerUp = useCallback(() => {
    if (gameStateRef.current !== 'playing') return
    dropFruit()
  }, [dropFruit])

  // game loop
  useEffect(() => {
    if (gameState !== 'playing') return

    const loop = setInterval(() => {
      if (gameStateRef.current !== 'playing') return
      const now = Date.now()

      // drop position
      if (keysRef.current['ArrowLeft']) {
        dropXRef.current = Math.max(10, dropXRef.current - 4)
      }
      if (keysRef.current['ArrowRight']) {
        dropXRef.current = Math.min(GAME_W - 10, dropXRef.current + 4)
      }

      const fruits = fruitsRef.current

      // apply gravity + friction
      for (let i = 0; i < fruits.length; i++) {
        const f = fruits[i]
        f.isNew = now - f.spawnedAt < 260
        f.isImpacting = f.impactUntil > now
        f.vy += GRAVITY
        f.vx *= FRICTION
        f.vy *= FRICTION
        f.vx = clampVel(f.vx)
        f.vy = clampVel(f.vy)
        f.x += f.vx
        f.y += f.vy
        f.rotation += f.vx * 0.7
      }

      // wall/floor collision
      for (let i = 0; i < fruits.length; i++) {
        const f = fruits[i]
        // floor
        if (f.y + f.radius > FLOOR_Y) {
          if (f.vy > 3.8) {
            f.impactUntil = now + 180
            f.isImpacting = true
          }
          f.y = FLOOR_Y - f.radius
          f.vy = -f.vy * RESTITUTION
          if (Math.abs(f.vy) < 0.5) f.vy = 0
        }
        // left wall
        if (f.x - f.radius < WALL_L) {
          f.x = WALL_L + f.radius
          f.vx = -f.vx * RESTITUTION
          if (Math.abs(f.vx) < 0.5) f.vx = 0
        }
        // right wall
        if (f.x + f.radius > WALL_R) {
          f.x = WALL_R - f.radius
          f.vx = -f.vx * RESTITUTION
          if (Math.abs(f.vx) < 0.5) f.vx = 0
        }
      }

      // circle-circle collision (multiple iterations)
      for (let iter = 0; iter < COLLISION_ITERS; iter++) {
        for (let i = 0; i < fruits.length; i++) {
          for (let j = i + 1; j < fruits.length; j++) {
            const a = fruits[i]
            const b = fruits[j]
            const dx = b.x - a.x
            const dy = b.y - a.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            const minDist = a.radius + b.radius

            if (dist < minDist) {
              // prevent perfect vertical stacking: jitter when nearly overlapping
              let nx, ny, overlap
              if (dist < 0.1) {
                const angle = Math.random() * Math.PI * 2
                nx = Math.cos(angle)
                ny = Math.sin(angle)
                overlap = minDist
              } else {
                nx = dx / dist
                ny = dy / dist
                overlap = minDist - dist
                // add horizontal bias when nearly vertical (abs(nx) very small)
                if (Math.abs(nx) < 0.15) {
                  nx += (Math.random() - 0.5) * 0.3
                  const len = Math.sqrt(nx * nx + ny * ny)
                  nx /= len
                  ny /= len
                }
              }

              // position correction
              const totalMass = a.radius * a.radius + b.radius * b.radius
              const ratioA = (b.radius * b.radius) / totalMass
              const ratioB = (a.radius * a.radius) / totalMass
              a.x -= nx * overlap * ratioA
              a.y -= ny * overlap * ratioA
              b.x += nx * overlap * ratioB
              b.y += ny * overlap * ratioB

              // impulse (only on first iteration)
              if (iter === 0) {
                const relVx = a.vx - b.vx
                const relVy = a.vy - b.vy
                const relDotN = relVx * nx + relVy * ny
                if (relDotN > 0) {
                  const mA = a.radius * a.radius
                  const mB = b.radius * b.radius
                  const impulse = (-(1 + RESTITUTION) * relDotN) / (1 / mA + 1 / mB)
                  a.vx += (impulse / mA) * nx
                  a.vy += (impulse / mA) * ny
                  b.vx -= (impulse / mB) * nx
                  b.vy -= (impulse / mB) * ny
                }
              }
            }
          }
        }
      }

      // merge detection
      const mergedSet = new Set()
      const toAdd = []

      for (let i = 0; i < fruits.length; i++) {
        if (mergedSet.has(i)) continue
        for (let j = i + 1; j < fruits.length; j++) {
          if (mergedSet.has(j)) continue
          const a = fruits[i]
          const b = fruits[j]
          if (a.level !== b.level) continue

          const dx = b.x - a.x
          const dy = b.y - a.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const minDist = a.radius + b.radius

          if (dist < minDist * 1.05) {
            mergedSet.add(i)
            mergedSet.add(j)

            const mx = (a.x + b.x) / 2
            const my = (a.y + b.y) / 2

            if (a.level < FRUITS.length - 1) {
              const newLevel = a.level + 1
              const newFruit = makeFruit(newLevel, mx, my)
              newFruit.vx = (a.vx + b.vx) / 2
              newFruit.vy = (a.vy + b.vy) / 2 - 2
              newFruit.droppedAt = 0 // not a player drop
              toAdd.push(newFruit)

              scoreRef.current += FRUITS[newLevel].score

              // color-matched merge sparks
              for (let p = 0; p < 8; p++) {
                const angle = (Math.PI * 2 * p) / 8 + Math.random() * 0.2
                const distance = 24 + Math.random() * 24
                particlesRef.current.push({
                  id: Date.now() + Math.random() + p,
                  x: mx,
                  y: my,
                  level: newLevel,
                  dx: Math.cos(angle) * distance,
                  dy: Math.sin(angle) * distance,
                  size: 3 + Math.random() * 4,
                  born: Date.now(),
                })
              }

              mergeBurstsRef.current.push({
                id: Date.now() + Math.random(),
                x: mx,
                y: my,
                level: newLevel,
                born: Date.now(),
              })

              // score popup
              scorePopRef.current.push({
                id: Date.now() + Math.random(),
                x: mx,
                y: my,
                value: FRUITS[newLevel].score,
                born: Date.now(),
              })
            } else {
              // watermelon merge → both disappear, bonus
              scoreRef.current += 100

              scorePopRef.current.push({
                id: Date.now() + Math.random(),
                x: mx,
                y: my,
                value: 100,
                born: Date.now(),
              })

              for (let p = 0; p < 8; p++) {
                const angle = (Math.PI * 2 * p) / 8
                particlesRef.current.push({
                  id: Date.now() + Math.random() + p,
                  x: mx,
                  y: my,
                  level: 8,
                  dx: Math.cos(angle) * 65,
                  dy: Math.sin(angle) * 65,
                  size: 6,
                  born: Date.now(),
                })
              }

              mergeBurstsRef.current.push({
                id: Date.now() + Math.random(),
                x: mx,
                y: my,
                level: 8,
                born: Date.now(),
                finale: true,
              })
            }
            break // one merge per fruit per frame
          }
        }
      }

      // remove merged, add new
      if (mergedSet.size > 0) {
        fruitsRef.current = fruits.filter((_, i) => !mergedSet.has(i))
        fruitsRef.current.push(...toAdd)
      }

      // expire particles & score pops
      particlesRef.current = particlesRef.current.filter((p) => now - p.born < 650)
      mergeBurstsRef.current = mergeBurstsRef.current.filter((p) => now - p.born < 520)
      scorePopRef.current = scorePopRef.current.filter((p) => now - p.born < 800)

      // game over check: fruit above danger line and settled
      let anyOverLine = false
      for (const f of fruitsRef.current) {
        if (f.y - f.radius < DANGER_LINE && now - f.droppedAt > 2000 && Math.abs(f.vy) < 2) {
          anyOverLine = true
          break
        }
      }

      if (anyOverLine) {
        overLineTimerRef.current += TICK
        if (overLineTimerRef.current > 800) {
          // game over
          if (scoreRef.current > bestRef.current) {
            bestRef.current = scoreRef.current
            try { localStorage.setItem('suika-best', String(scoreRef.current)) } catch { /* noop */ }
          }
          gameStateRef.current = 'gameover'
          setGameState('gameover')
          syncView()
          return
        }
      } else {
        overLineTimerRef.current = 0
      }

      syncView()
    }, TICK)

    return () => clearInterval(loop)
  }, [gameState, syncView])

  const {
    fruits,
    score,
    best,
    dropX,
    dropLevel,
    nextLevel,
    canDrop,
    particles,
    mergeBursts,
    scorePops,
  } = view
  const dropDef = FRUITS[dropLevel]

  return (
    <div ref={containerRef} className="sk-container">
      <Link to="/" className="sk-back">← 홈으로</Link>

      <div className="sk-game-wrapper" style={{ width: LAYOUT_W * scale, height: LAYOUT_H * scale }}>
        <div style={{ width: LAYOUT_W, height: LAYOUT_H, transform: `scale(${scale})`, transformOrigin: 'top left', padding: '0 3px' }}>

          {/* HUD */}
          <div className="sk-hud" style={{ width: GAME_W }}>
            <div className="sk-hud-score">
              <span className="sk-hud-label">SCORE</span>
              <strong>{score.toLocaleString()}</strong>
            </div>
            {best > 0 && <span className="sk-hud-best"><small>BEST</small>{best.toLocaleString()}</span>}
            <div className="sk-hud-next">
              <span>다음</span>
              <span className="sk-hud-next-fruit">
                <FruitArt level={nextLevel} label={`다음 과일 ${FRUITS[nextLevel].name}`} />
              </span>
            </div>
          </div>

          <div
            ref={gameAreaRef}
            style={{ position: 'relative', width: GAME_W }}
            onMouseMove={handlePointerMove}
            onTouchMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onTouchEnd={handlePointerUp}
          >
            {/* drop zone */}
            <div className="sk-drop-zone" style={{ width: GAME_W, height: DROP_ZONE_H }}>
              {/* drop preview fruit */}
              {gameState === 'playing' && (
                <>
                  <div
                    className={`sk-drop-fruit${canDrop ? '' : ' is-cooling'}`}
                    style={{
                      left: dropX,
                      width: dropDef.radius * 2,
                      height: dropDef.radius * 2,
                    }}
                  >
                    <FruitArt level={dropLevel} label={`떨어뜨릴 ${dropDef.name}`} />
                  </div>
                  {/* guide line into game area */}
                  <div
                    className="sk-drop-guide"
                    style={{ left: dropX - 1 }}
                  />
                </>
              )}
            </div>

            {/* game area */}
            <div className="sk-game-area" style={{ width: GAME_W, height: GAME_H }}>
              {/* danger line */}
              <div className="sk-danger-line" style={{ top: DANGER_LINE }} />

              {/* guide line extends into game area */}
              {gameState === 'playing' && (
                <div
                  className="sk-guide-line"
                  style={{ left: dropX - 1, height: GAME_H }}
                />
              )}

              {/* fruits */}
              {fruits.map((f) => {
                const def = FRUITS[f.level]
                return (
                  <div
                    key={f.id}
                    className={`sk-fruit${f.isNew ? ' is-new' : ''}${f.isImpacting ? ' is-impacting' : ''}`}
                    style={{
                      left: f.x - f.radius,
                      top: f.y - f.radius,
                      width: f.radius * 2,
                      height: f.radius * 2,
                      '--fruit-color': def.color,
                      '--fruit-accent': def.accent,
                    }}
                  >
                    <div className="sk-fruit-body">
                      <FruitArt
                        level={f.level}
                        label={def.name}
                        className="sk-fruit-rotator"
                        style={{ transform: `rotate(${f.rotation}deg)` }}
                      />
                    </div>
                  </div>
                )
              })}

              {/* merge shockwaves */}
              {mergeBursts.map((burst) => {
                const def = FRUITS[burst.level]
                return (
                  <div
                    key={burst.id}
                    className={`sk-merge-burst${burst.finale ? ' is-finale' : ''}`}
                    style={{ left: burst.x, top: burst.y, '--burst-color': def.color }}
                  >
                    <span />
                  </div>
                )
              })}

              {/* particles */}
              {particles.map((p) => (
                <div
                  key={p.id}
                  className="sk-particle"
                  style={{
                    left: p.x,
                    top: p.y,
                    width: p.size,
                    height: p.size,
                    '--spark-x': `${p.dx}px`,
                    '--spark-y': `${p.dy}px`,
                    '--spark-color': FRUITS[p.level].color,
                  }}
                />
              ))}

              {/* score pops */}
              {scorePops.map((p) => (
                <div
                  key={p.id}
                  className="sk-score-pop"
                  style={{ left: p.x, top: p.y }}
                >
                  +{p.value}
                </div>
              ))}

              {/* menu overlay */}
              {gameState === 'menu' && (
                <div className="sk-overlay">
                  <div className="sk-menu">
                    <div className="sk-menu-icon"><FruitArt level={8} /></div>
                    <span className="sk-menu-kicker">FRUIT LAB</span>
                    <h2>수박 게임</h2>
                    <p>같은 과일이 만나면<br />더 큰 과일로 진화해요.</p>
                    <p className="sk-menu-controls"><kbd>←</kbd><kbd>→</kbd> 이동 <span /> <kbd>SPACE</kbd> 놓기</p>
                    <button onClick={startGame}><span>게임 시작</span><i aria-hidden="true">→</i></button>
                    <div className="sk-fruit-list">
                      {FRUITS.map((f) => (
                        <span key={f.level} title={f.name}>
                          <FruitArt level={f.level} />
                        </span>
                      ))}
                    </div>
                    <p className="sk-menu-hint">화면을 움직이고 손을 떼어도 놓을 수 있어요</p>
                  </div>
                </div>
              )}

              {/* gameover overlay */}
              {gameState === 'gameover' && (
                <div className="sk-overlay">
                  <div className="sk-gameover">
                    <span className="sk-menu-kicker">HARVEST COMPLETE</span>
                    <h2>과일 탑 완성!</h2>
                    <div className="sk-result-score"><small>최종 점수</small><strong>{score.toLocaleString()}</strong></div>
                    {best > 0 && <p className="sk-result-best">최고 기록 {best.toLocaleString()}</p>}
                    <div className="overlay-btns">
                      <button onClick={startGame}>다시 시작</button>
                      <Link to="/" className="overlay-btn-home">홈으로</Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="sk-instructions">← → 이동 · Space 드롭 · 같은 과일끼리 합치세요</div>
    </div>
  )
}

export default Suika
