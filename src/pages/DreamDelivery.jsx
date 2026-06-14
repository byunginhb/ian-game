import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGameScale } from '../hooks/useGameScale'
import { useTouchLock } from '../hooks/useTouchLock'
import './DreamDelivery.css'

const GAME_W = 420
const GAME_H = 620
const PLAYER_SIZE = 44
const BUBBLE_MIN_Y = 92
const BUBBLE_MAX_Y = 492
const PLAYER_MIN_Y = 88
const PLAYER_MAX_Y = 562
const KEY_SPEED = 5.1
const BURST_LIFE = 640

const DREAM_TYPES = [
  { name: '별꿈', emoji: '⭐', nestEmoji: '🌟', color: '#ffd166', dark: '#c88416' },
  { name: '꽃꿈', emoji: '🌸', nestEmoji: '🌺', color: '#f472b6', dark: '#b83280' },
  { name: '바다꿈', emoji: '🫧', nestEmoji: '🐚', color: '#38bdf8', dark: '#087aa4' },
]

const NESTS = [
  { type: 0, x: 92, y: 552 },
  { type: 1, x: 210, y: 552 },
  { type: 2, x: 328, y: 552 },
]

const STARS = Array.from({ length: 32 }, (_, i) => ({
  left: 18 + ((i * 47) % 372),
  top: 28 + ((i * 71) % 520),
  size: 2 + (i % 4),
  delay: `${((i * 13) % 60) / 10}s`,
}))

function rand(min, max) {
  return min + Math.random() * (max - min)
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function distance(a, b, c, d) {
  return Math.hypot(a - c, b - d)
}

function getLevelConfig(level) {
  return {
    target: Math.min(22, 5 + level * 3),
    duration: Math.max(28, 49 - level * 2),
    bubbleSpeed: Math.min(2.8, 0.78 + level * 0.16),
    maxBubbles: Math.min(12, 4 + Math.floor(level * 0.9)),
    spawnGap: Math.max(560, 1180 - level * 80),
    nightmareChance: Math.min(0.28, level < 2 ? 0 : 0.07 + level * 0.025),
  }
}

function createBubble(level, forceNormal = false) {
  const config = getLevelConfig(level)
  const bad = !forceNormal && Math.random() < config.nightmareChance
  const type = Math.floor(rand(0, DREAM_TYPES.length))
  const angle = rand(0, Math.PI * 2)
  const speed = config.bubbleSpeed * rand(0.74, 1.26)
  const size = bad ? rand(35, 43) : rand(31, 39)

  return {
    id: `dream-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    x: rand(42, GAME_W - 42),
    y: rand(BUBBLE_MIN_Y, BUBBLE_MAX_Y),
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size,
    type,
    bad,
    spin: rand(-18, 18),
    wobble: rand(2.2, 4.8),
  }
}

function createBurst(x, y, color, amount = 12) {
  return Array.from({ length: amount }, (_, i) => {
    const angle = (Math.PI * 2 * i) / amount + rand(-0.18, 0.18)
    const spread = rand(20, 58)

    return {
      id: `burst-${Date.now()}-${Math.random().toString(36).slice(2)}-${i}`,
      x,
      y,
      size: rand(5, 12),
      color: i % 4 === 0 ? '#ffffff' : color,
      dx: Math.cos(angle) * spread,
      dy: Math.sin(angle) * spread,
      delay: `${i * 11}ms`,
    }
  })
}

function isInteractiveTarget(target) {
  return target instanceof HTMLElement && Boolean(target.closest('button, a, input, textarea, select'))
}

function DreamDelivery() {
  const scale = useGameScale(GAME_W, GAME_H, { reservedH: 76 })
  const containerRef = useRef(null)
  const areaRef = useRef(null)
  useTouchLock(containerRef)

  const [phase, setPhase] = useState('menu')
  const [level, setLevel] = useState(1)
  const [timeLeft, setTimeLeft] = useState(getLevelConfig(1).duration)
  const [delivered, setDelivered] = useState(0)
  const [hearts, setHearts] = useState(3)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [best, setBest] = useState(0)
  const [bursts, setBursts] = useState([])
  const [view, setView] = useState({
    player: { x: 210, y: 324, safeUntil: 0 },
    bubbles: [],
    carried: null,
    isStunned: false,
  })

  const config = useMemo(() => getLevelConfig(level), [level])

  const phaseRef = useRef(phase)
  const levelRef = useRef(level)
  const playerRef = useRef({ x: 210, y: 324, targetX: 210, targetY: 324, pointerUntil: 0, safeUntil: 0, boostUntil: 0 })
  const bubblesRef = useRef([])
  const carriedRef = useRef(null)
  const keysRef = useRef(new Set())
  const deliveredRef = useRef(0)
  const heartsRef = useRef(3)
  const scoreRef = useRef(0)
  const comboRef = useRef(0)
  const bestRef = useRef(0)
  const deadlineRef = useRef(0)
  const spawnAtRef = useRef(0)
  const timersRef = useRef([])

  useEffect(() => {
    try {
      bestRef.current = Number(localStorage.getItem('dream-delivery-best')) || 0
      setBest(bestRef.current)
    } catch {
      // localStorage may be unavailable in private contexts.
    }
  }, [])

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    levelRef.current = level
  }, [level])

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer))
      timersRef.current = []
    }
  }, [])

  const addBurst = useCallback((x, y, color, amount) => {
    const nextBursts = createBurst(x, y, color, amount)
    setBursts((current) => [...current, ...nextBursts])
    const timer = setTimeout(() => {
      setBursts((current) => current.filter((burst) => !nextBursts.some((nextBurst) => nextBurst.id === burst.id)))
    }, BURST_LIFE)
    timersRef.current.push(timer)
  }, [])

  const syncScore = useCallback(() => {
    setScore(scoreRef.current)
    setCombo(comboRef.current)
  }, [])

  const updateBest = useCallback(() => {
    if (scoreRef.current <= bestRef.current) return
    bestRef.current = scoreRef.current
    setBest(bestRef.current)
    try {
      localStorage.setItem('dream-delivery-best', String(bestRef.current))
    } catch {
      // Ignore storage failures; score still works for this session.
    }
  }, [])

  const endRound = useCallback((nextPhase) => {
    phaseRef.current = nextPhase
    setPhase(nextPhase)
    updateBest()
  }, [updateBest])

  const startLevel = useCallback((nextLevel, resetScore) => {
    const nextConfig = getLevelConfig(nextLevel)
    const startBubbles = Array.from({ length: Math.min(4, nextConfig.maxBubbles) }, () => createBubble(nextLevel, true))

    levelRef.current = nextLevel
    phaseRef.current = 'playing'
    deliveredRef.current = 0
    heartsRef.current = 3
    carriedRef.current = null
    bubblesRef.current = startBubbles
    playerRef.current = {
      x: 210,
      y: 322,
      targetX: 210,
      targetY: 322,
      pointerUntil: 0,
      safeUntil: 0,
      boostUntil: 0,
    }

    if (resetScore) {
      scoreRef.current = 0
      comboRef.current = 0
    }

    deadlineRef.current = performance.now() + nextConfig.duration * 1000
    spawnAtRef.current = performance.now() + 700
    setLevel(nextLevel)
    setPhase('playing')
    setDelivered(0)
    setHearts(3)
    setTimeLeft(nextConfig.duration)
    syncScore()
    setView({
      player: { ...playerRef.current },
      bubbles: startBubbles,
      carried: null,
      isStunned: false,
    })
  }, [syncScore])

  const startGame = useCallback(() => {
    startLevel(1, true)
  }, [startLevel])

  const nextLevel = useCallback(() => {
    startLevel(levelRef.current + 1, false)
  }, [startLevel])

  const getGamePoint = useCallback((event) => {
    const rect = areaRef.current?.getBoundingClientRect()
    if (!rect) return null

    return {
      x: clamp((event.clientX - rect.left) / scale, PLAYER_SIZE / 2, GAME_W - PLAYER_SIZE / 2),
      y: clamp((event.clientY - rect.top) / scale, PLAYER_MIN_Y, PLAYER_MAX_Y),
    }
  }, [scale])

  const movePointerTarget = useCallback((event) => {
    if (phaseRef.current !== 'playing' || isInteractiveTarget(event.target)) return
    const point = getGamePoint(event)
    if (!point) return

    playerRef.current.targetX = point.x
    playerRef.current.targetY = point.y
    playerRef.current.pointerUntil = performance.now() + 1200
  }, [getGamePoint])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (isInteractiveTarget(event.target) || isInteractiveTarget(document.activeElement)) return

      const key = event.key.toLowerCase()
      const movementKeys = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd']

      if (movementKeys.includes(key) && phaseRef.current === 'playing') {
        event.preventDefault()
        keysRef.current.add(key)
      }

      if (key === ' ' && phaseRef.current === 'playing') {
        event.preventDefault()
        playerRef.current.boostUntil = performance.now() + 260
      }

      if (key === 'enter') {
        if (phaseRef.current === 'menu' || phaseRef.current === 'lost') {
          event.preventDefault()
          startGame()
        } else if (phaseRef.current === 'won') {
          event.preventDefault()
          nextLevel()
        }
      }

      if (key === 'r') {
        event.preventDefault()
        startGame()
      }
    }

    const onKeyUp = (event) => {
      keysRef.current.delete(event.key.toLowerCase())
    }

    const onBlur = () => {
      keysRef.current.clear()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [nextLevel, startGame])

  useEffect(() => {
    if (phase !== 'playing') return undefined

    let frameId = 0
    let last = performance.now()

    function tick(now) {
      if (phaseRef.current !== 'playing') return

      const deltaScale = Math.min(2.2, (now - last) / 16)
      last = now
      const player = playerRef.current
      const keys = keysRef.current
      const right = keys.has('arrowright') || keys.has('d') ? 1 : 0
      const left = keys.has('arrowleft') || keys.has('a') ? 1 : 0
      const down = keys.has('arrowdown') || keys.has('s') ? 1 : 0
      const up = keys.has('arrowup') || keys.has('w') ? 1 : 0
      const inputX = right - left
      const inputY = down - up
      const boost = now < player.boostUntil ? 1.45 : 1
      const stunned = now < player.safeUntil

      if (!stunned && (inputX || inputY)) {
        const length = Math.hypot(inputX, inputY) || 1
        player.x += (inputX / length) * KEY_SPEED * boost * deltaScale
        player.y += (inputY / length) * KEY_SPEED * boost * deltaScale
        player.targetX = player.x
        player.targetY = player.y
      } else if (!stunned && now < player.pointerUntil) {
        const dx = player.targetX - player.x
        const dy = player.targetY - player.y
        const gap = Math.hypot(dx, dy)
        const step = KEY_SPEED * 1.28 * deltaScale

        if (gap <= step) {
          player.x = player.targetX
          player.y = player.targetY
        } else if (gap > 0) {
          player.x += (dx / gap) * step
          player.y += (dy / gap) * step
        }
      }

      player.x = clamp(player.x, PLAYER_SIZE / 2, GAME_W - PLAYER_SIZE / 2)
      player.y = clamp(player.y, PLAYER_MIN_Y, PLAYER_MAX_Y)

      const configNow = getLevelConfig(levelRef.current)
      let nextBubbles = bubblesRef.current.map((bubble) => {
        const nextBubble = { ...bubble }
        nextBubble.x += nextBubble.vx * deltaScale
        nextBubble.y += nextBubble.vy * deltaScale
        nextBubble.spin += nextBubble.vx * 0.6

        const radius = nextBubble.size / 2
        if (nextBubble.x < radius + 14) {
          nextBubble.x = radius + 14
          nextBubble.vx = Math.abs(nextBubble.vx)
        }
        if (nextBubble.x > GAME_W - radius - 14) {
          nextBubble.x = GAME_W - radius - 14
          nextBubble.vx = -Math.abs(nextBubble.vx)
        }
        if (nextBubble.y < BUBBLE_MIN_Y) {
          nextBubble.y = BUBBLE_MIN_Y
          nextBubble.vy = Math.abs(nextBubble.vy)
        }
        if (nextBubble.y > BUBBLE_MAX_Y) {
          nextBubble.y = BUBBLE_MAX_Y
          nextBubble.vy = -Math.abs(nextBubble.vy)
        }

        return nextBubble
      })

      const secondsLeft = Math.max(0, (deadlineRef.current - now) / 1000)
      setTimeLeft(secondsLeft)

      if (secondsLeft <= 0) {
        bubblesRef.current = nextBubbles
        setView({
          player: { ...player },
          bubbles: nextBubbles,
          carried: carriedRef.current,
          isStunned: now < player.safeUntil,
        })
        endRound('lost')
        return
      }

      if (now >= spawnAtRef.current && nextBubbles.length < configNow.maxBubbles) {
        nextBubbles = [...nextBubbles, createBubble(levelRef.current)]
        spawnAtRef.current = now + configNow.spawnGap * rand(0.72, 1.18)
      }

      if (now > player.safeUntil) {
        const nightmare = nextBubbles.find((bubble) => bubble.bad && distance(player.x, player.y, bubble.x, bubble.y) < (PLAYER_SIZE + bubble.size) * 0.42)

        if (nightmare) {
          nextBubbles = nextBubbles.filter((bubble) => bubble.id !== nightmare.id)
          heartsRef.current = Math.max(0, heartsRef.current - 1)
          comboRef.current = 0
          player.safeUntil = now + 1100
          setHearts(heartsRef.current)
          syncScore()
          addBurst(nightmare.x, nightmare.y, '#312442', 16)

          if (heartsRef.current <= 0) {
            bubblesRef.current = nextBubbles
            setView({
              player: { ...player },
              bubbles: nextBubbles,
              carried: carriedRef.current,
              isStunned: now < player.safeUntil,
            })
            endRound('lost')
            return
          }
        }
      }

      if (!carriedRef.current) {
        const caught = nextBubbles.find((bubble) => !bubble.bad && distance(player.x, player.y, bubble.x, bubble.y) < (PLAYER_SIZE + bubble.size) * 0.43)

        if (caught) {
          nextBubbles = nextBubbles.filter((bubble) => bubble.id !== caught.id)
          carriedRef.current = { type: caught.type, color: DREAM_TYPES[caught.type].color, emoji: DREAM_TYPES[caught.type].emoji }
          scoreRef.current += 8
          addBurst(caught.x, caught.y, DREAM_TYPES[caught.type].color, 12)
          syncScore()
        }
      } else {
        const carried = carriedRef.current
        const touchedNest = NESTS.find((nest) => distance(player.x, player.y, nest.x, nest.y) < 45)

        if (touchedNest) {
          const dreamType = DREAM_TYPES[carried.type]
          carriedRef.current = null

          if (touchedNest.type === carried.type) {
            deliveredRef.current += 1
            comboRef.current += 1
            scoreRef.current += 90 + comboRef.current * 18
            setDelivered(deliveredRef.current)
            syncScore()
            addBurst(touchedNest.x, touchedNest.y, dreamType.color, 18)

            if (deliveredRef.current >= configNow.target) {
              bubblesRef.current = nextBubbles
              setView({
                player: { ...player },
                bubbles: nextBubbles,
                carried: carriedRef.current,
                isStunned: now < player.safeUntil,
              })
              endRound('won')
              return
            }
          } else {
            heartsRef.current = Math.max(0, heartsRef.current - 1)
            comboRef.current = 0
            setHearts(heartsRef.current)
            syncScore()
            addBurst(touchedNest.x, touchedNest.y, '#ff6b6b', 14)

            if (heartsRef.current <= 0) {
              bubblesRef.current = nextBubbles
              setView({
                player: { ...player },
                bubbles: nextBubbles,
                carried: carriedRef.current,
                isStunned: now < player.safeUntil,
              })
              endRound('lost')
              return
            }
          }
        }
      }

      bubblesRef.current = nextBubbles
      setView({
        player: { ...player },
        bubbles: nextBubbles,
        carried: carriedRef.current,
        isStunned: now < player.safeUntil,
      })
      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [addBurst, endRound, phase, syncScore])

  const { player, bubbles, carried, isStunned } = view
  const timeRatio = clamp(timeLeft / config.duration, 0, 1)

  return (
    <div className="dd-container" ref={containerRef}>
      <Link to="/" className="dd-back">← 홈으로</Link>

      <div className="dd-wrapper" style={{ width: GAME_W * scale, height: GAME_H * scale }}>
        <div
          ref={areaRef}
          className={`dd-area dd-${phase}`}
          style={{ width: GAME_W, height: GAME_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}
          onPointerDown={movePointerTarget}
          onPointerMove={movePointerTarget}
        >
          <div className="dd-sky">
            {STARS.map((star, index) => (
              <span
                key={`${star.left}-${star.top}-${index}`}
                className="dd-star"
                style={{
                  left: star.left,
                  top: star.top,
                  width: star.size,
                  height: star.size,
                  animationDelay: star.delay,
                }}
              />
            ))}
            <span className="dd-moon">🌙</span>
            <span className="dd-cloud dd-cloud-1">☁️</span>
            <span className="dd-cloud dd-cloud-2">☁️</span>
          </div>

          <div className="dd-hud">
            <div className="dd-chip">LV {level}</div>
            <div className="dd-chip dd-score">점수 {score}</div>
            <div className="dd-chip dd-progress">{delivered}/{config.target}</div>
          </div>

          <div className="dd-side-panel">
            <div className="dd-timer">
              <span style={{ transform: `scaleY(${timeRatio})` }} />
            </div>
            <div className="dd-time">{Math.ceil(timeLeft)}</div>
            <div className="dd-hearts" aria-label={`남은 마음 ${hearts}`}>{'💛'.repeat(hearts)}{'🤍'.repeat(3 - hearts)}</div>
          </div>

          <div className="dd-nests">
            {NESTS.map((nest) => {
              const dream = DREAM_TYPES[nest.type]
              const active = carried?.type === nest.type
              return (
                <div
                  key={nest.type}
                  className={`dd-nest${active ? ' dd-nest-active' : ''}`}
                  style={{
                    left: nest.x,
                    top: nest.y,
                    '--nest-color': dream.color,
                    '--nest-dark': dream.dark,
                  }}
                >
                  <span className="dd-nest-emoji">{dream.nestEmoji}</span>
                  <span className="dd-nest-label">{dream.name}</span>
                </div>
              )
            })}
          </div>

          {bubbles.map((bubble) => {
            const dream = DREAM_TYPES[bubble.type]
            return (
              <div
                key={bubble.id}
                className={`dd-bubble${bubble.bad ? ' dd-nightmare' : ''}`}
                style={{
                  left: bubble.x,
                  top: bubble.y,
                  width: bubble.size,
                  height: bubble.size,
                  '--bubble-color': bubble.bad ? '#2e2542' : dream.color,
                  '--bubble-dark': bubble.bad ? '#171223' : dream.dark,
                  transform: `translate(-50%, -50%) rotate(${bubble.spin}deg)`,
                  animationDuration: `${bubble.wobble}s`,
                }}
              >
                <span>{bubble.bad ? '🌑' : dream.emoji}</span>
              </div>
            )
          })}

          <div
            className={`dd-player${isStunned ? ' dd-player-stunned' : ''}`}
            style={{
              left: player.x,
              top: player.y,
              width: PLAYER_SIZE,
              height: PLAYER_SIZE,
            }}
          >
            <span className="dd-player-cloud">☁️</span>
            <span className="dd-player-face">•ᴗ•</span>
            {carried && (
              <span className="dd-carried" style={{ '--carried-color': carried.color }}>
                {carried.emoji}
              </span>
            )}
          </div>

          {bursts.map((burst) => (
            <span
              key={burst.id}
              className="dd-burst"
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

          {combo > 1 && phase === 'playing' && <div className="dd-combo">COMBO {combo}</div>}

          {phase !== 'playing' && (
            <div className="dd-overlay">
              <div className="dd-modal">
                <div className="dd-modal-icon">{phase === 'won' ? '✨' : phase === 'lost' ? '🌙' : '☁️'}</div>
                <h1>{phase === 'won' ? '꿈 배달 성공!' : phase === 'lost' ? '밤이 깊어졌어요' : '꿈방울 배달'}</h1>
                <p>
                  {phase === 'won'
                    ? `레벨 ${level} 완료 · 점수 ${score}`
                    : phase === 'lost'
                      ? `최고 점수 ${best} · 다시 도전`
                      : '색깔 꿈방울을 같은 둥지에 배달하세요'}
                </p>
                <button type="button" className="dd-primary-button" onClick={phase === 'won' ? nextLevel : startGame}>
                  {phase === 'won' ? '다음 밤' : '시작'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DreamDelivery
