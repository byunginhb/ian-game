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

const ATMOSPHERE_STREAKS = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: (i * 29 + 7) % 100,
  delay: -((i * 0.37) % 3.2),
  duration: 1.45 + (i % 5) * 0.18,
  height: 34 + (i % 4) * 14,
}))

const CITY_BUILDINGS = [
  { left: 0, width: 15, height: 92 },
  { left: 12, width: 13, height: 128 },
  { left: 22, width: 18, height: 76 },
  { left: 36, width: 11, height: 146 },
  { left: 45, width: 17, height: 108 },
  { left: 59, width: 13, height: 82 },
  { left: 70, width: 18, height: 136 },
  { left: 86, width: 14, height: 102 },
]

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
    if (!shieldActive) return

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
          setShieldTimeLeft(SHIELD_DURATION)
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

  const hasFireworks = fireworks.length > 0

  // firework particle animation
  useEffect(() => {
    if (!hasFireworks) return

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
  }, [hasFireworks])

  useEffect(() => {
    if (!gameOver || score <= highScore) return

    const timeout = window.setTimeout(() => {
      setHighScore(score)
      localStorage.setItem('poopDodge_highScore', String(score))
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [gameOver, score, highScore])

  useEffect(() => {
    return () => {
      if (shieldTimerRef.current) {
        clearTimeout(shieldTimerRef.current)
      }
    }
  }, [])

  const shieldPercent = (shieldTimeLeft / SHIELD_DURATION) * 100
  const dangerLevel = Math.min(100, 18 + score * 2.6)
  const dangerLabel = score >= 25 ? '극한' : score >= 12 ? '위험' : '경계'

  return (
    <div
      ref={containerRef}
      className={`poop-game-container ${started ? 'is-running' : ''} ${gameOver ? 'is-game-over' : ''} ${shieldActive ? 'is-shielded' : ''}`}
    >
      <div className="poop-page-heading">
        <Link to="/" className="poop-back-button" aria-label="홈으로 돌아가기">
          <span aria-hidden="true">‹</span> 게임 선택
        </Link>
        <div className="poop-page-status"><i /> 기상 특보 발효 중</div>
      </div>

      <div className="poop-game-wrapper" style={{ width: POOP_GAME_W * scale, height: POOP_GAME_H * scale }}>
        <div ref={gameAreaRef} className="poop-game-area" style={{ width: POOP_GAME_W, height: POOP_GAME_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <div className="poop-atmosphere" aria-hidden="true">
          <div className="poop-lightning" />
          <div className="poop-moon"><span /></div>
          <div className="poop-cloud poop-cloud-one" />
          <div className="poop-cloud poop-cloud-two" />
          <div className="poop-rain">
            {ATMOSPHERE_STREAKS.map((streak) => (
              <i
                key={streak.id}
                style={{
                  left: `${streak.left}%`,
                  height: `${streak.height}px`,
                  animationDelay: `${streak.delay}s`,
                  animationDuration: `${streak.duration}s`,
                }}
              />
            ))}
          </div>
          <div className="poop-city">
            {CITY_BUILDINGS.map((building, index) => (
              <i
                key={index}
                style={{
                  left: `${building.left}%`,
                  width: `${building.width}%`,
                  height: `${building.height}px`,
                }}
              />
            ))}
          </div>
          <div className="poop-rooftop">
            <i className="poop-rooftop-vent" />
            <i className="poop-rooftop-antenna" />
          </div>
          <div className="poop-vignette" />
        </div>

        {/* HUD inside game area */}
        <div className="poop-hud">
          <div className="poop-hud-left">
            <span className="poop-hud-label">생존 점수</span>
            <span className="poop-score">{String(score).padStart(3, '0')}</span>
          </div>
          <div className="poop-danger-meter" aria-label={`위험도 ${Math.round(dangerLevel)}퍼센트`}>
            <span className="poop-danger-title"><i /> 위험도 · {dangerLabel}</span>
            <span className="poop-danger-track"><i style={{ width: `${dangerLevel}%` }} /></span>
          </div>
          <div className="poop-hud-right">
            <span className="poop-hud-label">최고 기록</span>
            <span className="poop-high-score">{String(highScore).padStart(3, '0')}</span>
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
            <div className="poop-start-content">
              <span className="poop-start-kicker"><i /> 재난 생존 훈련 07</span>
              <div className="poop-start-emoji" aria-hidden="true">
                <span className="poop-start-halo" />
                <span className="poop-start-poop">💩</span>
              </div>
              <h2><small>OPERATION</small>똥 피하기</h2>
              <p className="poop-start-copy">도시의 마지막 옥상.<br />끝까지 살아남아 전설이 되어라!</p>
              <div className="poop-start-items">
                <span><b>🛡️</b><small>3초 무적</small></span>
                <span><b>⭐</b><small>보너스 +5</small></span>
              </div>
              <button onClick={startGame}><span>생존 시작</span><i aria-hidden="true">▶</i></button>
              <p className="poop-start-key"><kbd>ENTER</kbd> 또는 <kbd>SPACE</kbd></p>
            </div>
          </div>
        )}

        {/* player */}
        <div
          className={`poop-player ${shieldActive ? 'poop-player-shielded' : ''}`}
          style={{ left: `${playerX}%` }}
        >
          <span className="poop-player-trail" aria-hidden="true" />
          <span className="poop-player-shadow" aria-hidden="true" />
          <span className="poop-player-emoji">🏃‍♂️</span>
          {shieldActive && (
            <>
              <span className="poop-shield-bubble" aria-hidden="true" />
              <span className="poop-shield-effect">🛡️</span>
            </>
          )}
        </div>

        {/* falling items */}
        {items.map((item) => (
          <div
            key={item.id}
            className={`poop-falling-item poop-falling-${item.type} poop-size-${item.size.label} ${item.type === 'poop' && item.y > 70 ? 'is-critical' : ''}`}
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              fontSize: `${32 * item.size.scale}px`,
            }}
          >
            <span className="poop-item-trail" aria-hidden="true" />
            <span className="poop-item-core">
              {item.type === 'poop' && '💩'}
              {item.type === 'shield' && '🛡️'}
              {item.type === 'star' && '⭐'}
            </span>
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
              <span className="poop-game-over-kicker">MISSION FAILED</span>
              <div className="poop-game-over-icon">💥</div>
              <h2>옥상이 무너졌다!</h2>
              <p className="poop-final-label">최종 생존 점수</p>
              <p className="poop-final-score">{String(score).padStart(3, '0')}</p>
              {score >= highScore && score > 0 && (
                <p className="poop-new-record">★ 새로운 최고 기록 ★</p>
              )}
              <div className="overlay-btns">
                <button onClick={startGame}>다시 도전 <span>↻</span></button>
                <Link to="/" className="overlay-btn-home">작전 종료</Link>
              </div>
              <p className="poop-start-key"><kbd>ENTER</kbd> 또는 <kbd>SPACE</kbd></p>
            </div>
          </div>
        )}
        </div>
      </div>

      <div className="poop-instructions">
        <span><kbd>←</kbd><kbd>→</kbd> 방향키</span>
        <i />
        <span>화면을 밀어 이동</span>
        <strong>떨어지는 똥을 피하세요!</strong>
      </div>
    </div>
  )
}

export default PoopDodge
