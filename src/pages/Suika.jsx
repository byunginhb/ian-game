import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGameScale } from '../hooks/useGameScale'
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
  { level: 0, emoji: '🍒', radius: 14, color: '#fca5a5', score: 1 },
  { level: 1, emoji: '🍇', radius: 19, color: '#c4b5fd', score: 3 },
  { level: 2, emoji: '🍊', radius: 25, color: '#fdba74', score: 6 },
  { level: 3, emoji: '🍎', radius: 30, color: '#fca5a5', score: 10 },
  { level: 4, emoji: '🍐', radius: 36, color: '#bbf7d0', score: 15 },
  { level: 5, emoji: '🍑', radius: 42, color: '#fde68a', score: 21 },
  { level: 6, emoji: '🍍', radius: 48, color: '#fef08a', score: 28 },
  { level: 7, emoji: '🍈', radius: 55, color: '#a7f3d0', score: 36 },
  { level: 8, emoji: '🍉', radius: 62, color: '#fecaca', score: 45 },
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
    merged: false,
  }
}

function clampVel(v) {
  return Math.max(-MAX_VEL, Math.min(MAX_VEL, v))
}

function Suika() {
  const scale = useGameScale(LAYOUT_W, LAYOUT_H)

  const [gameState, setGameState] = useState('menu')
  const [renderTick, setRenderTick] = useState(0)

  const fruitsRef = useRef([])
  const scoreRef = useRef(0)
  const bestRef = useRef(() => {
    try { return Number(localStorage.getItem('suika-best')) || 0 } catch { return 0 }
  })
  const dropXRef = useRef(GAME_W / 2)
  const dropLevelRef = useRef(randomDropLevel())
  const nextLevelRef = useRef(randomDropLevel())
  const canDropRef = useRef(true)
  const keysRef = useRef({})
  const gameStateRef = useRef('menu')
  const particlesRef = useRef([])
  const scorePopRef = useRef([])
  const overLineTimerRef = useRef(0)
  const gameAreaRef = useRef(null)

  // init best score
  useEffect(() => {
    try {
      bestRef.current = Number(localStorage.getItem('suika-best')) || 0
    } catch { /* noop */ }
  }, [])

  const startGame = useCallback(() => {
    fruitIdCounter = 0
    fruitsRef.current = []
    scoreRef.current = 0
    dropXRef.current = GAME_W / 2
    dropLevelRef.current = randomDropLevel()
    nextLevelRef.current = randomDropLevel()
    canDropRef.current = true
    particlesRef.current = []
    scorePopRef.current = []
    overLineTimerRef.current = 0
    gameStateRef.current = 'playing'
    setGameState('playing')
    setRenderTick((t) => t + 1)
  }, [])

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

    setTimeout(() => { canDropRef.current = true }, DROP_COOLDOWN)
  }, [])

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
        f.vy += GRAVITY
        f.vx *= FRICTION
        f.vy *= FRICTION
        f.vx = clampVel(f.vx)
        f.vy = clampVel(f.vy)
        f.x += f.vx
        f.y += f.vy
      }

      // wall/floor collision
      for (let i = 0; i < fruits.length; i++) {
        const f = fruits[i]
        // floor
        if (f.y + f.radius > FLOOR_Y) {
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

              // particles
              const emoji = FRUITS[a.level].emoji
              for (let p = 0; p < 5; p++) {
                const angle = (Math.PI * 2 * p) / 5
                particlesRef.current.push({
                  id: Date.now() + Math.random() + p,
                  x: mx + Math.cos(angle) * 15,
                  y: my + Math.sin(angle) * 15,
                  emoji,
                  born: Date.now(),
                })
              }

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
                  x: mx + Math.cos(angle) * 20,
                  y: my + Math.sin(angle) * 20,
                  emoji: '🍉',
                  born: Date.now(),
                })
              }
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
      const now = Date.now()
      particlesRef.current = particlesRef.current.filter((p) => now - p.born < 500)
      scorePopRef.current = scorePopRef.current.filter((p) => now - p.born < 600)

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
          setRenderTick((t) => t + 1)
          return
        }
      } else {
        overLineTimerRef.current = 0
      }

      setRenderTick((t) => t + 1)
    }, TICK)

    return () => clearInterval(loop)
  }, [gameState])

  // render data from refs
  const fruits = fruitsRef.current
  const score = scoreRef.current
  const best = bestRef.current
  const dropX = dropXRef.current
  const dropLevel = dropLevelRef.current
  const nextLevel = nextLevelRef.current
  const particles = particlesRef.current
  const scorePops = scorePopRef.current
  const dropDef = FRUITS[dropLevel]

  return (
    <div className="sk-container">
      <Link to="/" className="sk-back">← 홈으로</Link>

      <div className="sk-game-wrapper" style={{ width: LAYOUT_W * scale, height: LAYOUT_H * scale }}>
        <div style={{ width: LAYOUT_W, height: LAYOUT_H, transform: `scale(${scale})`, transformOrigin: 'top left', padding: '0 3px' }}>

          {/* HUD */}
          <div className="sk-hud" style={{ width: GAME_W }}>
            <span className="sk-hud-score">점수: {score}</span>
            {best > 0 && <span style={{ color: '#ffd700', fontSize: 13, fontWeight: 'bold' }}>BEST {best}</span>}
            <div className="sk-hud-next">
              다음: <span className="sk-hud-next-fruit">{FRUITS[nextLevel].emoji}</span>
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
                    className="sk-drop-fruit"
                    style={{
                      left: dropX,
                      width: dropDef.radius * 2,
                      height: dropDef.radius * 2,
                      borderRadius: '50%',
                      background: dropDef.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: dropDef.radius * 1.2,
                      opacity: canDropRef.current ? 1 : 0.4,
                    }}
                  >
                    {dropDef.emoji}
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
                    className="sk-fruit"
                    style={{
                      left: f.x - f.radius,
                      top: f.y - f.radius,
                      width: f.radius * 2,
                      height: f.radius * 2,
                      background: def.color,
                      fontSize: f.radius * 1.1,
                    }}
                  >
                    {def.emoji}
                  </div>
                )
              })}

              {/* particles */}
              {particles.map((p) => (
                <div
                  key={p.id}
                  className="sk-particle"
                  style={{ left: p.x, top: p.y }}
                >
                  {p.emoji}
                </div>
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
                    <div className="sk-menu-icon">🍉</div>
                    <h2>수박 게임</h2>
                    <p>같은 과일을 합쳐 수박을 만드세요!</p>
                    <p className="sk-menu-controls">← → 이동 · Space 드롭</p>
                    <button onClick={startGame}>게임 시작</button>
                    <div className="sk-fruit-list">
                      {FRUITS.map((f) => <span key={f.level}>{f.emoji}</span>)}
                    </div>
                    <p className="sk-menu-hint">터치/마우스로도 조작 가능</p>
                  </div>
                </div>
              )}

              {/* gameover overlay */}
              {gameState === 'gameover' && (
                <div className="sk-overlay">
                  <div className="sk-gameover">
                    <h2>게임 오버</h2>
                    <p>최종 점수: {score}</p>
                    {best > 0 && <p>최고 기록: {best}</p>}
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
