import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGameScale } from '../hooks/useGameScale'
import { useTouchLock } from '../hooks/useTouchLock'
import './BrickBreaker.css'

const GAME_W = 400
const GAME_H = 600
const TICK = 16

const PADDLE_W = 70
const PADDLE_H = 12
const PADDLE_Y = GAME_H - 40
const PADDLE_SPEED = 7

const BALL_R = 6
const BALL_SPEED_BASE = 5
const BALL_SPEED_PER_STAGE = 0.3

const BRICK_ROWS = 6
const BRICK_COLS = 8
const BRICK_W = 44
const BRICK_H = 18
const BRICK_GAP = 3
const BRICK_TOP = 50
const BRICK_LEFT = (GAME_W - BRICK_COLS * (BRICK_W + BRICK_GAP) + BRICK_GAP) / 2

const ITEM_SIZE = 20
const ITEM_SPEED = 2.5
const ITEM_DROP_CHANCE = 0.15

const ROW_COLORS = [
  '#cc2222', '#cc6622', '#cc9900', '#228822',
  '#2266cc', '#7722cc', '#cc2288', '#22aaaa',
]

const ROW_GRADIENTS = [
  'linear-gradient(135deg, #ff4444, #cc2222)',
  'linear-gradient(135deg, #ff8844, #cc6622)',
  'linear-gradient(135deg, #ffcc00, #cc9900)',
  'linear-gradient(135deg, #44cc44, #228822)',
  'linear-gradient(135deg, #4488ff, #2266cc)',
  'linear-gradient(135deg, #aa44ff, #7722cc)',
  'linear-gradient(135deg, #ff44aa, #cc2288)',
  'linear-gradient(135deg, #44dddd, #22aaaa)',
]

const ITEM_TYPES = [
  { type: 'wide', emoji: '📏', duration: 8000 },
  { type: 'multi', emoji: '⚡' },
  { type: 'life', emoji: '❤️' },
  { type: 'slow', emoji: '🐢', duration: 6000 },
]

function buildBricks(stage) {
  const bricks = []
  const rows = Math.min(BRICK_ROWS + Math.floor(stage / 2), 10)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      const hp = r < 2 && stage > 1 ? Math.min(1 + Math.floor(stage / 2), 4) : 1
      bricks.push({
        id: `${r}-${c}`,
        row: r,
        col: c,
        x: BRICK_LEFT + c * (BRICK_W + BRICK_GAP),
        y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
        w: BRICK_W,
        h: BRICK_H,
        hp,
        maxHp: hp,
        alive: true,
      })
    }
  }
  return bricks
}

function makeBall(stageNum) {
  const speed = BALL_SPEED_BASE + stageNum * BALL_SPEED_PER_STAGE
  const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6
  return {
    id: Date.now() + Math.random(),
    x: GAME_W / 2,
    y: PADDLE_Y - BALL_R - 2,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    speed,
  }
}

function BrickBreaker() {
  const scale = useGameScale(GAME_W, GAME_H)
  const containerRef = useRef(null)
  useTouchLock(containerRef)

  const [gameState, setGameState] = useState('menu')
  const [stageBanner, setStageBanner] = useState(false)
  const [renderTick, setRenderTick] = useState(0)

  // all game data lives in refs
  const stageRef = useRef(1)
  const scoreRef = useRef(0)
  const livesRef = useRef(3)
  const paddleXRef = useRef((GAME_W - PADDLE_W) / 2)
  const ballsRef = useRef([])
  const bricksRef = useRef([])
  const itemsRef = useRef([])
  const particlesRef = useRef([])
  const keysRef = useRef({})
  const wideRef = useRef(false)
  const slowRef = useRef(false)
  const wideTimerRef = useRef(null)
  const slowTimerRef = useRef(null)
  const gameStateRef = useRef('menu')

  const pw = () => wideRef.current ? PADDLE_W * 1.5 : PADDLE_W

  const startGame = useCallback(() => {
    stageRef.current = 1
    scoreRef.current = 0
    livesRef.current = 3
    paddleXRef.current = (GAME_W - PADDLE_W) / 2
    bricksRef.current = buildBricks(1)
    ballsRef.current = [makeBall(1)]
    itemsRef.current = []
    particlesRef.current = []
    wideRef.current = false
    slowRef.current = false
    gameStateRef.current = 'playing'
    setGameState('playing')
    setStageBanner(true)
    setTimeout(() => setStageBanner(false), 1500)
  }, [])

  const startStage = useCallback((stageNum) => {
    stageRef.current = stageNum
    bricksRef.current = buildBricks(stageNum)
    ballsRef.current = [makeBall(stageNum)]
    itemsRef.current = []
    particlesRef.current = []
    paddleXRef.current = (GAME_W - PADDLE_W) / 2
    gameStateRef.current = 'playing'
    setGameState('playing')
    setStageBanner(true)
    setTimeout(() => setStageBanner(false), 1500)
  }, [])

  // keyboard
  useEffect(() => {
    const onDown = (e) => {
      if (['ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        keysRef.current[e.key] = true
      }
    }
    const onUp = (e) => { keysRef.current[e.key] = false }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

  // touch controls
  const touchTargetXRef = useRef(null)
  const gameAreaRef = useRef(null)

  useEffect(() => {
    const area = gameAreaRef.current
    if (!area) return

    const handleTouch = (e) => {
      e.preventDefault()
      const rect = area.getBoundingClientRect()
      const touchX = e.touches[0].clientX
      const x = (touchX - rect.left) / (rect.width / GAME_W) - pw() / 2
      touchTargetXRef.current = Math.max(0, Math.min(GAME_W - pw(), x))
    }
    const handleTouchEnd = () => { touchTargetXRef.current = null }

    area.addEventListener('touchstart', handleTouch, { passive: false })
    area.addEventListener('touchmove', handleTouch, { passive: false })
    area.addEventListener('touchend', handleTouchEnd)
    area.addEventListener('touchcancel', handleTouchEnd)
    return () => {
      area.removeEventListener('touchstart', handleTouch)
      area.removeEventListener('touchmove', handleTouch)
      area.removeEventListener('touchend', handleTouchEnd)
      area.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [])

  // game loop - all logic on refs, single render trigger
  useEffect(() => {
    if (gameState !== 'playing') return

    const loop = setInterval(() => {
      if (gameStateRef.current !== 'playing') return

      // paddle
      const padW = pw()
      let px = paddleXRef.current
      if (keysRef.current['ArrowLeft']) px = Math.max(0, px - PADDLE_SPEED)
      if (keysRef.current['ArrowRight']) px = Math.min(GAME_W - padW, px + PADDLE_SPEED)

      // touch: move toward touch position
      if (touchTargetXRef.current !== null) {
        const diff = touchTargetXRef.current - px
        if (Math.abs(diff) < PADDLE_SPEED * 2) {
          px = touchTargetXRef.current
        } else {
          px = px + (diff > 0 ? PADDLE_SPEED * 2 : -PADDLE_SPEED * 2)
        }
      }

      paddleXRef.current = px

      const speedMult = slowRef.current ? 0.6 : 1
      const balls = ballsRef.current
      const bricks = bricksRef.current
      let bricksChanged = false
      const newItems = []
      const newParticles = []

      // update each ball
      for (let bi = 0; bi < balls.length; bi++) {
        const ball = balls[bi]
        let { x, y, vx, vy, speed } = ball
        x += vx * speedMult
        y += vy * speedMult

        // wall bounce
        if (x - BALL_R <= 0) { x = BALL_R; vx = Math.abs(vx) }
        if (x + BALL_R >= GAME_W) { x = GAME_W - BALL_R; vx = -Math.abs(vx) }
        if (y - BALL_R <= 0) { y = BALL_R; vy = Math.abs(vy) }

        // paddle bounce
        if (
          vy > 0 &&
          y + BALL_R >= PADDLE_Y &&
          y + BALL_R <= PADDLE_Y + PADDLE_H + 4 &&
          x >= px - BALL_R &&
          x <= px + padW + BALL_R
        ) {
          const hitPos = (x - px) / padW
          const angle = -Math.PI / 2 + (hitPos - 0.5) * 1.2
          vx = Math.cos(angle) * speed
          vy = Math.sin(angle) * speed
          y = PADDLE_Y - BALL_R
        }

        // brick collision
        for (let i = 0; i < bricks.length; i++) {
          const b = bricks[i]
          if (!b.alive) continue

          if (x + BALL_R > b.x && x - BALL_R < b.x + b.w &&
              y + BALL_R > b.y && y - BALL_R < b.y + b.h) {
            // bounce direction
            const overlapL = (x + BALL_R) - b.x
            const overlapR = (b.x + b.w) - (x - BALL_R)
            const overlapT = (y + BALL_R) - b.y
            const overlapB = (b.y + b.h) - (y - BALL_R)
            const minOverlap = Math.min(overlapL, overlapR, overlapT, overlapB)

            if (minOverlap === overlapT || minOverlap === overlapB) {
              vy = -vy
            } else {
              vx = -vx
            }

            bricks[i] = { ...b, hp: b.hp - 1, alive: b.hp - 1 > 0 }
            bricksChanged = true

            if (b.hp - 1 <= 0) {
              scoreRef.current += 10 * b.maxHp
              const cx = b.x + b.w / 2
              const cy = b.y + b.h / 2
              const color = ROW_COLORS[b.row % ROW_COLORS.length]
              for (let pi = 0; pi < 4; pi++) {
                newParticles.push({
                  id: Date.now() + Math.random() + pi,
                  x: cx + (Math.random() - 0.5) * b.w,
                  y: cy + (Math.random() - 0.5) * b.h,
                  color,
                  size: 3 + Math.random() * 4,
                  born: Date.now(),
                })
              }
              if (Math.random() < ITEM_DROP_CHANCE) {
                const itemDef = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)]
                newItems.push({
                  id: Date.now() + Math.random(),
                  x: cx - ITEM_SIZE / 2,
                  y: cy,
                  type: itemDef.type,
                  emoji: itemDef.emoji,
                  duration: itemDef.duration || 0,
                })
              }
            }
            break // one brick per ball per tick
          }
        }

        balls[bi] = { ...ball, x, y, vx, vy }
      }

      // remove fallen balls
      const aliveBalls = balls.filter((b) => b.y - BALL_R < GAME_H)
      if (aliveBalls.length === 0 && balls.length > 0) {
        livesRef.current -= 1
        if (livesRef.current <= 0) {
          gameStateRef.current = 'gameover'
          setGameState('gameover')
          ballsRef.current = []
          setRenderTick((t) => t + 1)
          return
        }
        ballsRef.current = [makeBall(stageRef.current)]
      } else {
        ballsRef.current = aliveBalls
      }

      if (bricksChanged) {
        bricksRef.current = [...bricks]
      }

      // add new particles & items
      if (newParticles.length > 0) {
        particlesRef.current = [...particlesRef.current, ...newParticles]
      }
      if (newItems.length > 0) {
        itemsRef.current = [...itemsRef.current, ...newItems]
      }

      // expire old particles
      const now = Date.now()
      particlesRef.current = particlesRef.current.filter((p) => now - p.born < 400)

      // items fall & collect
      itemsRef.current = itemsRef.current.filter((item) => {
        item.y += ITEM_SPEED
        if (item.y > GAME_H) return false

        const padLeft = paddleXRef.current
        if (
          item.y + ITEM_SIZE >= PADDLE_Y &&
          item.y <= PADDLE_Y + PADDLE_H &&
          item.x + ITEM_SIZE >= padLeft &&
          item.x <= padLeft + padW
        ) {
          if (item.type === 'wide') {
            wideRef.current = true
            if (wideTimerRef.current) clearTimeout(wideTimerRef.current)
            wideTimerRef.current = setTimeout(() => { wideRef.current = false }, item.duration)
          } else if (item.type === 'multi') {
            const base = ballsRef.current[0]
            if (base) {
              ballsRef.current = [
                ...ballsRef.current,
                { ...base, id: Date.now() + 1, vx: -base.vx, vy: base.vy - 1 },
                { ...base, id: Date.now() + 2, vx: base.vx * 0.5, vy: -Math.abs(base.vy) },
              ]
            }
          } else if (item.type === 'life') {
            livesRef.current = Math.min(livesRef.current + 1, 5)
          } else if (item.type === 'slow') {
            slowRef.current = true
            if (slowTimerRef.current) clearTimeout(slowTimerRef.current)
            slowTimerRef.current = setTimeout(() => { slowRef.current = false }, item.duration)
          }
          scoreRef.current += 5
          return false
        }
        return true
      })

      // stage clear
      if (bricksRef.current.length > 0 && bricksRef.current.every((b) => !b.alive)) {
        const next = stageRef.current + 1
        stageRef.current = next
        gameStateRef.current = 'clear'
        setGameState('clear')
        setTimeout(() => startStage(next), 1000)
        setRenderTick((t) => t + 1)
        return
      }

      // single render trigger
      setRenderTick((t) => t + 1)
    }, TICK)

    return () => clearInterval(loop)
  }, [gameState, startStage])

  // cleanup timers
  useEffect(() => {
    return () => {
      if (wideTimerRef.current) clearTimeout(wideTimerRef.current)
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current)
    }
  }, [])

  // read from refs for render
  const score = scoreRef.current
  const stage = stageRef.current
  const lives = livesRef.current
  const paddleX = paddleXRef.current
  const balls = ballsRef.current
  const bricks = bricksRef.current
  const items = itemsRef.current
  const particles = particlesRef.current
  const currentPaddleW = wideRef.current ? PADDLE_W * 1.5 : PADDLE_W

  return (
    <div ref={containerRef} className="bb-container">
      <Link to="/" className="bb-back">← 홈으로</Link>

      <div className="bb-game-wrapper" style={{ width: GAME_W * scale, height: GAME_H * scale }}>
        <div
          ref={gameAreaRef}
          className="bb-game-area"
          style={{ width: GAME_W, height: GAME_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
          {/* HUD */}
          <div className="bb-hud">
            <span className="bb-hud-score">점수: {score}</span>
            <span className="bb-hud-stage">STAGE {stage}</span>
            <span className="bb-hud-lives">
              {Array.from({ length: lives }, () => '❤️').join('')}
            </span>
          </div>

          {/* bricks */}
          {bricks.map((b) =>
            b.alive ? (
              <div
                key={b.id}
                className={`bb-brick${b.hp < b.maxHp ? ' bb-brick-crack' : ''}`}
                style={{
                  left: b.x,
                  top: b.y,
                  width: b.w,
                  height: b.h,
                  background: ROW_GRADIENTS[b.row % ROW_GRADIENTS.length],
                }}
              >
                {b.maxHp > 1 ? b.hp : ''}
              </div>
            ) : null
          )}

          {/* balls */}
          {balls.map((ball) => (
            <div
              key={ball.id}
              className="bb-ball"
              style={{
                left: ball.x - BALL_R,
                top: ball.y - BALL_R,
                width: BALL_R * 2,
                height: BALL_R * 2,
              }}
            />
          ))}

          {/* paddle */}
          <div
            className={`bb-paddle${wideRef.current ? ' bb-paddle-wide' : ''}`}
            style={{
              left: paddleX,
              top: PADDLE_Y,
              width: currentPaddleW,
              height: PADDLE_H,
            }}
          />

          {/* items */}
          {items.map((item) => (
            <div
              key={item.id}
              className="bb-item"
              style={{ left: item.x, top: item.y, width: ITEM_SIZE, height: ITEM_SIZE }}
            >
              {item.emoji}
            </div>
          ))}

          {/* particles */}
          {particles.map((p) => (
            <div
              key={p.id}
              className="bb-particle"
              style={{ left: p.x, top: p.y, width: p.size, height: p.size, background: p.color }}
            />
          ))}

          {/* stage banner */}
          {stageBanner && (
            <div className="bb-stage-banner">
              <span>STAGE {stage}</span>
            </div>
          )}

          {/* menu */}
          {gameState === 'menu' && (
            <div className="bb-overlay">
              <div className="bb-menu">
                <div className="bb-menu-icon">🧱</div>
                <h2>벽돌깨기</h2>
                <p>공을 튕겨서 벽돌을 모두 부수세요!</p>
                <p className="bb-menu-controls">← → 패들 이동</p>
                <button onClick={startGame}>게임 시작</button>
                <p className="bb-menu-hint">아이템: 📏확장 ⚡멀티볼 ❤️생명 🐢슬로우</p>
              </div>
            </div>
          )}

          {/* clear */}
          {gameState === 'clear' && (
            <div className="bb-overlay">
              <div className="bb-clear">
                <h2>🎉 STAGE {stage - 1} 클리어!</h2>
                <p>점수: {score}</p>
              </div>
            </div>
          )}

          {/* gameover */}
          {gameState === 'gameover' && (
            <div className="bb-overlay">
              <div className="bb-gameover">
                <h2>게임 오버</h2>
                <p>최종 점수: {score}</p>
                <p>도달 스테이지: {stage}</p>
                <div className="overlay-btns">
                  <button onClick={startGame}>다시 시작</button>
                  <Link to="/" className="overlay-btn-home">홈으로</Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bb-instructions">← → 방향키 또는 터치로 패들을 움직이세요</div>
    </div>
  )
}

export default BrickBreaker
