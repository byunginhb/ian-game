import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGameScale } from '../hooks/useGameScale'
import { useTouchLock } from '../hooks/useTouchLock'
import './PoopDodge.css'

const POOP_GAME_W = 400
const POOP_GAME_H = 600

const PLAYER_SIZE = 8
const MOVE_SPEED = 4
const GAME_TICK = 30
const POOP_INTERVAL_INITIAL = 1200
const POOP_INTERVAL_MIN = 400
const SHIELD_INTERVAL = 5000
const SHIELD_DURATION = 3000
const STAR_INTERVAL = 4000
const STAR_SCORE = 5
const FALL_SPEED_INITIAL = 1.5
const FALL_SPEED_INCREMENT = 0.0005
const DIFFICULTY_INTERVAL_DECREMENT = 0.3

const POOP_SIZES = [
  { scale: 0.7, label: 'small' },
  { scale: 1.0, label: 'medium' },
  { scale: 1.3, label: 'large' },
  { scale: 1.7, label: 'xlarge' },
]

function createPoop(id) {
  const sizeIndex = Math.floor(Math.random() * POOP_SIZES.length)
  return {
    id,
    x: Math.random() * 88 + 2,
    y: -5,
    type: 'poop',
    size: POOP_SIZES[sizeIndex],
  }
}

function createShield(id) {
  return {
    id,
    x: Math.random() * 88 + 2,
    y: -5,
    type: 'shield',
    size: { scale: 1.0, label: 'medium' },
  }
}

function createStar(id) {
  return {
    id,
    x: Math.random() * 88 + 2,
    y: -5,
    type: 'star',
    size: { scale: 1.0, label: 'medium' },
  }
}

const FIREWORK_COLORS = ['#ff0', '#f0f', '#0ff', '#f90', '#0f0', '#f44', '#44f']

function createFireworkParticles(x, y) {
  const count = 12
  return Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3
    const speed = 2 + Math.random() * 3
    return {
      id: `fw-${Date.now()}-${i}`,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)],
      life: 1.0,
    }
  })
}

function checkCollision(playerX, itemX, itemY) {
  const hitX = Math.abs(itemX - playerX) < PLAYER_SIZE
  const hitY = itemY > 85 && itemY < 96
  return hitX && hitY
}

function PoopDodge() {
  const [playerX, setPlayerX] = useState(50)
  const [items, setItems] = useState([])
  const [score, setScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [started, setStarted] = useState(false)
  const [shieldActive, setShieldActive] = useState(false)
  const [shieldTimeLeft, setShieldTimeLeft] = useState(0)
  const [fireworks, setFireworks] = useState([])
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('poopDodge_highScore')
    return saved ? Number(saved) : 0
  })

  const scale = useGameScale(POOP_GAME_W, POOP_GAME_H)
  const containerRef = useRef(null)
  useTouchLock(containerRef)

  const keysPressed = useRef(new Set())
  const gameTickRef = useRef(0)
  const fallSpeedRef = useRef(FALL_SPEED_INITIAL)
  const nextItemId = useRef(0)
  const shieldTimerRef = useRef(null)

  const startGame = useCallback(() => {
    setPlayerX(50)
    setItems([])
    setScore(0)
    setGameOver(false)
    setStarted(true)
    setShieldActive(false)
    setShieldTimeLeft(0)
    setFireworks([])
    keysPressed.current.clear()
    gameTickRef.current = 0
    fallSpeedRef.current = FALL_SPEED_INITIAL
    nextItemId.current = 0
    if (shieldTimerRef.current) {
      clearTimeout(shieldTimerRef.current)
      shieldTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        keysPressed.current.add(e.key)
      }
      if (e.key === ' ' || e.key === 'Enter') {
        if (!started || gameOver) {
          startGame()
        }
      }
    }

    const handleKeyUp = (e) => {
      keysPressed.current.delete(e.key)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [started, gameOver, startGame])

  useEffect(() => {
    if (!shieldActive) {
      setShieldTimeLeft(0)
      return
    }

    setShieldTimeLeft(SHIELD_DURATION)
    const start = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - start
      const remaining = Math.max(0, SHIELD_DURATION - elapsed)
      setShieldTimeLeft(remaining)
      if (remaining <= 0) {
        clearInterval(interval)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [shieldActive])

  // touch controls: track touch X to move player
  const touchTargetRef = useRef(null)
  const gameAreaRef = useRef(null)

  useEffect(() => {
    if (!started || gameOver) return
    const area = gameAreaRef.current
    if (!area) return

    const handleTouchMove = (e) => {
      e.preventDefault()
      const rect = area.getBoundingClientRect()
      const touchX = e.touches[0].clientX
      const pct = ((touchX - rect.left) / rect.width) * 100
      touchTargetRef.current = Math.max(4, Math.min(96, pct))
    }
    const handleTouchEnd = () => { touchTargetRef.current = null }

    area.addEventListener('touchmove', handleTouchMove, { passive: false })
    area.addEventListener('touchend', handleTouchEnd)
    area.addEventListener('touchcancel', handleTouchEnd)
    return () => {
      area.removeEventListener('touchmove', handleTouchMove)
      area.removeEventListener('touchend', handleTouchEnd)
      area.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [started, gameOver])

  useEffect(() => {
    if (!started || gameOver) return

    const interval = setInterval(() => {
      gameTickRef.current += 1
      const tick = gameTickRef.current

      if (keysPressed.current.has('ArrowLeft')) {
        setPlayerX((prev) => Math.max(4, prev - MOVE_SPEED))
      }
      if (keysPressed.current.has('ArrowRight')) {
        setPlayerX((prev) => Math.min(96, prev + MOVE_SPEED))
      }

      // touch: move toward touch position
      if (touchTargetRef.current !== null) {
        setPlayerX((prev) => {
          const diff = touchTargetRef.current - prev
          if (Math.abs(diff) < MOVE_SPEED) return touchTargetRef.current
          return prev + (diff > 0 ? MOVE_SPEED : -MOVE_SPEED)
        })
      }

      fallSpeedRef.current = FALL_SPEED_INITIAL + tick * FALL_SPEED_INCREMENT
      const currentPoopInterval = Math.max(
        POOP_INTERVAL_MIN,
        POOP_INTERVAL_INITIAL - tick * DIFFICULTY_INTERVAL_DECREMENT
      )

      const poopSpawnTick = Math.round(currentPoopInterval / GAME_TICK)
      if (tick % poopSpawnTick === 0) {
        const id = nextItemId.current++
        setItems((prev) => [...prev, createPoop(id)])
      }

      const shieldSpawnTick = Math.round(SHIELD_INTERVAL / GAME_TICK)
      if (tick % shieldSpawnTick === 0) {
        const id = nextItemId.current++
        setItems((prev) => [...prev, createShield(id)])
      }

      const starSpawnTick = Math.round(STAR_INTERVAL / GAME_TICK)
      if (tick % starSpawnTick === 0) {
        const id = nextItemId.current++
        setItems((prev) => [...prev, createStar(id)])
      }

      setItems((prev) => {
        const speed = fallSpeedRef.current
        return prev.map((item) => ({
          ...item,
          y: item.y + speed,
        }))
      })
    }, GAME_TICK)

    return () => clearInterval(interval)
  }, [started, gameOver])

  useEffect(() => {
    if (!started || gameOver) return

    const interval = setInterval(() => {
      setItems((prev) => {
        let hitPoop = false
        let gotShield = false
        const starHits = []

        const remaining = prev.filter((item) => {
          if (item.y > 105) {
            if (item.type === 'poop') {
              setScore((s) => s + 1)
            }
            return false
          }

          if (checkCollision(playerX, item.x, item.y)) {
            if (item.type === 'poop' && !shieldActive) {
              hitPoop = true
            }
            if (item.type === 'poop' && shieldActive) {
              setScore((s) => s + 3)
              return false
            }
            if (item.type === 'shield') {
              gotShield = true
              return false
            }
            if (item.type === 'star') {
              starHits.push({ x: item.x, y: item.y })
              setScore((s) => s + STAR_SCORE)
              return false
            }
          }

          return true
        })

        if (hitPoop) {
          setGameOver(true)
        }

        if (gotShield) {
          setShieldActive(true)
          if (shieldTimerRef.current) {
            clearTimeout(shieldTimerRef.current)
          }
          shieldTimerRef.current = setTimeout(() => {
            setShieldActive(false)
            shieldTimerRef.current = null
          }, SHIELD_DURATION)
        }

        if (starHits.length > 0) {
          setFireworks((fw) => [
            ...fw,
            ...starHits.flatMap((pos) => createFireworkParticles(pos.x, pos.y)),
          ])
        }

        return remaining
      })
    }, GAME_TICK)

    return () => clearInterval(interval)
  }, [started, gameOver, playerX, shieldActive])

  // firework particle animation
  useEffect(() => {
    if (fireworks.length === 0) return

    const interval = setInterval(() => {
      setFireworks((prev) => {
        const updated = prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx * 0.3,
            y: p.y + p.vy * 0.3,
            vy: p.vy + 0.08,
            life: p.life - 0.04,
          }))
          .filter((p) => p.life > 0)
        return updated
      })
    }, GAME_TICK)

    return () => clearInterval(interval)
  }, [fireworks.length > 0])

  useEffect(() => {
    if (gameOver && score > highScore) {
      setHighScore(score)
      localStorage.setItem('poopDodge_highScore', String(score))
    }
  }, [gameOver, score, highScore])

  useEffect(() => {
    return () => {
      if (shieldTimerRef.current) {
        clearTimeout(shieldTimerRef.current)
      }
    }
  }, [])

  const shieldPercent = (shieldTimeLeft / SHIELD_DURATION) * 100

  return (
    <div ref={containerRef} className="poop-game-container">
      <Link to="/" className="poop-back-button">← 홈으로</Link>

      <div className="poop-game-wrapper" style={{ width: POOP_GAME_W * scale, height: POOP_GAME_H * scale }}>
        <div ref={gameAreaRef} className="poop-game-area" style={{ width: POOP_GAME_W, height: POOP_GAME_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        {/* HUD inside game area */}
        <div className="poop-hud">
          <div className="poop-hud-left">
            <span className="poop-score">점수: {score}</span>
          </div>
          <div className="poop-hud-right">
            <span className="poop-high-score">최고: {highScore}</span>
          </div>
        </div>

        {/* shield timer bar inside game area */}
        {shieldActive && (
          <div className="poop-shield-bar">
            <span className="poop-shield-label">🛡️ 보호막</span>
            <div className="poop-shield-timer">
              <div
                className="poop-shield-timer-fill"
                style={{ width: `${shieldPercent}%` }}
              />
            </div>
            <span className="poop-shield-time">
              {(shieldTimeLeft / 1000).toFixed(1)}s
            </span>
          </div>
        )}

        {/* start screen */}
        {!started && !gameOver && (
          <div className="poop-start-screen">
            <div className="poop-start-emoji">💩</div>
            <h2>똥 피하기</h2>
            <p>하늘에서 내리는 똥을 피하세요!</p>
            <p className="poop-start-hint">🛡️ 보호막 = 무적 | ⭐ 별 = +5점</p>
            <button onClick={startGame}>시작하기</button>
            <p className="poop-start-key">Enter 또는 Space로 시작</p>
          </div>
        )}

        {/* player */}
        <div
          className={`poop-player ${shieldActive ? 'poop-player-shielded' : ''}`}
          style={{ left: `${playerX}%` }}
        >
          <span className="poop-player-emoji">🏃</span>
          {shieldActive && <span className="poop-shield-effect">🛡️</span>}
        </div>

        {/* falling items */}
        {items.map((item) => (
          <div
            key={item.id}
            className={`poop-falling-item poop-falling-${item.type} poop-size-${item.size.label}`}
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              fontSize: `${32 * item.size.scale}px`,
            }}
          >
            {item.type === 'poop' && '💩'}
            {item.type === 'shield' && '🛡️'}
            {item.type === 'star' && '⭐'}
          </div>
        ))}

        {/* firework particles */}
        {fireworks.map((p) => (
          <div
            key={p.id}
            className="poop-firework-particle"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              backgroundColor: p.color,
              opacity: p.life,
              transform: `scale(${p.life})`,
            }}
          />
        ))}

        {/* game over overlay inside game area */}
        {gameOver && (
          <div className="poop-game-over-overlay">
            <div className="poop-game-over">
              <h2>💩 게임 오버!</h2>
              <p className="poop-final-score">점수: {score}</p>
              {score >= highScore && score > 0 && (
                <p className="poop-new-record">🎉 새로운 최고 기록!</p>
              )}
              <div className="overlay-btns">
                <button onClick={startGame}>다시 시작</button>
                <Link to="/" className="overlay-btn-home">홈으로</Link>
              </div>
              <p className="poop-start-key">Enter 또는 Space로 재시작</p>
            </div>
          </div>
        )}
        </div>
      </div>

      <div className="poop-instructions">← → 방향키 또는 터치로 이동 | 🛡️ 보호막 | ⭐ 별 +5점</div>
    </div>
  )
}

export default PoopDodge
