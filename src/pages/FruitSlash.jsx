import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGameScale } from '../hooks/useGameScale'
import { useTouchLock } from '../hooks/useTouchLock'
import './FruitSlash.css'

const GAME_W = 420
const GAME_H = 620
const ROUND_SECONDS = 30
const BLADE_SPEED = 7
const TRAIL_LIFE = 180
const GRAVITY = 0.105
const PARTICLE_LIFE = 640
const SPLIT_LIFE = 720
const EXPLOSION_LIFE = 760
const RUSH_SECONDS = 5

const FRUITS = [
  { emoji: '🍉', color: '#ef4444', juice: '#f87171', score: 10, size: 42 },
  { emoji: '🍊', color: '#f97316', juice: '#fb923c', score: 10, size: 38 },
  { emoji: '🍋', color: '#facc15', juice: '#fde047', score: 12, size: 36 },
  { emoji: '🥝', color: '#84cc16', juice: '#a3e635', score: 12, size: 36 },
  { emoji: '🍓', color: '#e11d48', juice: '#fb7185', score: 14, size: 34 },
  { emoji: '🍍', color: '#f59e0b', juice: '#fbbf24', score: 16, size: 42 },
]

const SPARKS = Array.from({ length: 34 }, (_, i) => ({
  left: 18 + ((i * 43) % 386),
  top: 26 + ((i * 67) % 540),
  delay: `${((i * 17) % 60) / 10}s`,
  size: 2 + (i % 4),
}))

function rand(min, max) {
  return min + Math.random() * (max - min)
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function isInteractiveTarget(target) {
  return target instanceof HTMLElement && Boolean(target.closest('button, a, input, textarea, select'))
}

function distPointToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) return Math.hypot(px - ax, py - ay)

  const t = clamp(((px - ax) * dx + (py - ay) * dy) / lengthSq, 0, 1)
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t))
}

function createFruit(id, elapsedRatio, options = {}) {
  const isBomb = !options.forceFruit && Math.random() < Math.min(0.22, 0.08 + elapsedRatio * 0.18)
  const isGolden = !isBomb && Math.random() < (options.goldenChance ?? 0.08)
  const fruit = FRUITS[Math.floor(rand(0, FRUITS.length))]
  const size = isBomb ? rand(36, 44) : isGolden ? 48 : fruit.size + rand(-4, 5)
  const startX = rand(42, GAME_W - 42)
  const targetX = rand(80, GAME_W - 80)
  const flight = options.rush ? rand(44, 70) : rand(54, 82)
  const rushBoost = options.rush ? 1.14 : 1

  return {
    id: `slice-${id}`,
    x: startX,
    y: GAME_H + size,
    vx: (targetX - startX) / flight,
    vy: -rand(8.4, 11.4 + elapsedRatio * 1.4) * rushBoost,
    size,
    spin: rand(-8, 8),
    rotate: rand(-35, 35),
    kind: isBomb ? 'bomb' : isGolden ? 'golden' : 'fruit',
    emoji: isBomb ? '💣' : isGolden ? '🌟' : fruit.emoji,
    color: isBomb ? '#272032' : isGolden ? '#facc15' : fruit.color,
    juice: isBomb ? '#f43f5e' : isGolden ? '#fde68a' : fruit.juice,
    score: isBomb ? -25 : isGolden ? 35 : fruit.score,
  }
}

function createParticles(idRef, x, y, color, amount = 14) {
  return Array.from({ length: amount }, () => {
    idRef.current += 1
    const angle = rand(0, Math.PI * 2)
    const power = rand(18, 66)

    return {
      id: `juice-${idRef.current}`,
      x,
      y,
      dx: Math.cos(angle) * power,
      dy: Math.sin(angle) * power,
      size: rand(5, 14),
      color,
      born: performance.now(),
    }
  })
}

function createSplit(idRef, item, slashAngle) {
  idRef.current += 1
  const pushX = Math.cos(slashAngle || -0.4)
  const pushY = Math.sin(slashAngle || -0.4)

  return [
    {
      id: `half-${idRef.current}-a`,
      x: item.x,
      y: item.y,
      dx: -18 - pushY * 16,
      dy: -16 + pushX * 8,
      rotate: -34,
      emoji: item.emoji,
      born: performance.now(),
    },
    {
      id: `half-${idRef.current}-b`,
      x: item.x,
      y: item.y,
      dx: 18 + pushY * 16,
      dy: -16 - pushX * 8,
      rotate: 34,
      emoji: item.emoji,
      born: performance.now(),
    },
  ]
}

function createExplosion(idRef, x, y, now) {
  idRef.current += 1

  return {
    id: `boom-${idRef.current}`,
    x,
    y,
    born: now,
  }
}

function FruitSlash() {
  const scale = useGameScale(GAME_W, GAME_H, { reservedH: 74 })
  const containerRef = useRef(null)
  const areaRef = useRef(null)
  useTouchLock(containerRef)

  const [phase, setPhase] = useState('menu')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [combo, setCombo] = useState(0)
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS)
  const [view, setView] = useState({
    items: [],
    particles: [],
    splits: [],
    explosions: [],
    trail: [],
    blade: { x: 210, y: 310, active: false },
    flash: null,
    comboPop: null,
    rush: false,
    now: 0,
  })

  const timeRatio = useMemo(() => clamp(timeLeft / ROUND_SECONDS, 0, 1), [timeLeft])

  const phaseRef = useRef(phase)
  const scoreRef = useRef(0)
  const bestRef = useRef(0)
  const comboRef = useRef(0)
  const lastSliceAtRef = useRef(0)
  const deadlineRef = useRef(0)
  const spawnAtRef = useRef(0)
  const itemIdRef = useRef(0)
  const particleIdRef = useRef(0)
  const splitIdRef = useRef(0)
  const explosionIdRef = useRef(0)
  const itemsRef = useRef([])
  const particlesRef = useRef([])
  const splitsRef = useRef([])
  const explosionsRef = useRef([])
  const trailRef = useRef([])
  const comboPopRef = useRef(null)
  const bladeRef = useRef({ x: 210, y: 310, active: false, pointerUntil: 0 })
  const keysRef = useRef(new Set())
  const pointerDownRef = useRef(false)
  const rushActivatedRef = useRef(false)

  useEffect(() => {
    try {
      bestRef.current = Number(localStorage.getItem('fruit-slash-best')) || 0
      setBest(bestRef.current)
    } catch {
      // Storage can be blocked, but the current round score is unaffected.
    }
  }, [])

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  const updateBest = useCallback(() => {
    if (scoreRef.current <= bestRef.current) return
    bestRef.current = scoreRef.current
    setBest(bestRef.current)
    try {
      localStorage.setItem('fruit-slash-best', String(bestRef.current))
    } catch {
      // Ignore storage failures.
    }
  }, [])

  const resetRound = useCallback(() => {
    scoreRef.current = 0
    comboRef.current = 0
    lastSliceAtRef.current = 0
    itemIdRef.current = 0
    itemsRef.current = []
    particlesRef.current = []
    splitsRef.current = []
    explosionsRef.current = []
    trailRef.current = []
    comboPopRef.current = null
    pointerDownRef.current = false
    rushActivatedRef.current = false
    bladeRef.current = { x: 210, y: 310, active: false, pointerUntil: 0 }
    deadlineRef.current = performance.now() + ROUND_SECONDS * 1000
    spawnAtRef.current = performance.now() + 260
    phaseRef.current = 'playing'
    setPhase('playing')
    setScore(0)
    setCombo(0)
    setTimeLeft(ROUND_SECONDS)
    setView({
      items: [],
      particles: [],
      splits: [],
      explosions: [],
      trail: [],
      blade: { x: 210, y: 310, active: false },
      flash: null,
      comboPop: null,
      rush: false,
      now: performance.now(),
    })
  }, [])

  const endRound = useCallback(() => {
    phaseRef.current = 'ended'
    setPhase('ended')
    updateBest()
  }, [updateBest])

  const getGamePoint = useCallback((event) => {
    const rect = areaRef.current?.getBoundingClientRect()
    if (!rect) return null

    return {
      x: clamp((event.clientX - rect.left) / scale, 0, GAME_W),
      y: clamp((event.clientY - rect.top) / scale, 0, GAME_H),
    }
  }, [scale])

  const pushTrailPoint = useCallback((x, y, now = performance.now()) => {
    const blade = bladeRef.current
    blade.x = x
    blade.y = y
    blade.active = true
    blade.pointerUntil = now + 1000
    trailRef.current = [...trailRef.current.filter((point) => now - point.t < TRAIL_LIFE), { x, y, t: now }]
  }, [])

  const handlePointerDown = useCallback((event) => {
    if (phaseRef.current !== 'playing' || isInteractiveTarget(event.target)) return
    event.preventDefault()
    pointerDownRef.current = true
    const point = getGamePoint(event)
    if (!point) return
    pushTrailPoint(point.x, point.y)
  }, [getGamePoint, pushTrailPoint])

  const handlePointerMove = useCallback((event) => {
    if (phaseRef.current !== 'playing' || isInteractiveTarget(event.target)) return
    if (event.pointerType === 'mouse' && !pointerDownRef.current) return
    event.preventDefault()
    const point = getGamePoint(event)
    if (!point) return
    pushTrailPoint(point.x, point.y)
  }, [getGamePoint, pushTrailPoint])

  const stopPointerBlade = useCallback(() => {
    pointerDownRef.current = false
    bladeRef.current.active = false
  }, [])

  useEffect(() => {
    const area = areaRef.current
    if (!area) return undefined

    area.addEventListener('pointerdown', handlePointerDown)
    area.addEventListener('pointermove', handlePointerMove)
    area.addEventListener('pointerup', stopPointerBlade)
    area.addEventListener('pointercancel', stopPointerBlade)
    area.addEventListener('pointerleave', stopPointerBlade)

    return () => {
      area.removeEventListener('pointerdown', handlePointerDown)
      area.removeEventListener('pointermove', handlePointerMove)
      area.removeEventListener('pointerup', stopPointerBlade)
      area.removeEventListener('pointercancel', stopPointerBlade)
      area.removeEventListener('pointerleave', stopPointerBlade)
    }
  }, [handlePointerDown, handlePointerMove, stopPointerBlade])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (isInteractiveTarget(event.target) || isInteractiveTarget(document.activeElement)) return
      const key = event.key.toLowerCase()
      const moveKeys = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd']

      if (moveKeys.includes(key) && phaseRef.current === 'playing') {
        event.preventDefault()
        keysRef.current.add(key)
      }

      if (key === ' ' && phaseRef.current === 'playing') {
        event.preventDefault()
        bladeRef.current.active = true
      }

      if (key === 'enter' && phaseRef.current !== 'playing') {
        event.preventDefault()
        resetRound()
      }

      if (key === 'r') {
        event.preventDefault()
        resetRound()
      }
    }

    const onKeyUp = (event) => {
      const key = event.key.toLowerCase()
      keysRef.current.delete(key)
      if (key === ' ') bladeRef.current.active = false
    }

    const onBlur = () => {
      keysRef.current.clear()
      bladeRef.current.active = false
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [resetRound])

  useEffect(() => {
    if (phase !== 'playing') return undefined

    let frameId = 0
    let last = performance.now()

    function scoreSlice(item, now, slashAngle) {
      const recent = now - lastSliceAtRef.current < 430
      comboRef.current = recent ? comboRef.current + 1 : 1
      lastSliceAtRef.current = now

      if (item.kind === 'bomb') {
        scoreRef.current = Math.max(0, scoreRef.current + item.score)
        comboRef.current = 0
        setScore(scoreRef.current)
        setCombo(0)
        particlesRef.current = [
          ...particlesRef.current,
          ...createParticles(particleIdRef, item.x, item.y, '#fb7185', 28),
          ...createParticles(particleIdRef, item.x, item.y, '#fde047', 18),
        ]
        explosionsRef.current = [...explosionsRef.current, createExplosion(explosionIdRef, item.x, item.y, now)]
        return { flash: 'bomb', comboPop: null }
      }

      const comboBonus = comboRef.current >= 3 ? comboRef.current * 4 : 0
      scoreRef.current += item.score + comboBonus
      setScore(scoreRef.current)
      setCombo(comboRef.current)
      particlesRef.current = [...particlesRef.current, ...createParticles(particleIdRef, item.x, item.y, item.juice, item.kind === 'golden' ? 28 : 16)]
      splitsRef.current = [...splitsRef.current, ...createSplit(splitIdRef, item, slashAngle)]

      return {
        flash: item.kind === 'golden' ? 'golden' : 'juice',
        comboPop: comboRef.current >= 3 ? { text: `${comboRef.current} COMBO`, x: item.x, y: item.y, born: now } : null,
      }
    }

    function tick(now) {
      if (phaseRef.current !== 'playing') return

      const deltaScale = Math.min(2.2, (now - last) / 16)
      last = now
      const secondsLeft = Math.max(0, (deadlineRef.current - now) / 1000)
      setTimeLeft(secondsLeft)

      if (secondsLeft <= 0) {
        endRound()
        return
      }

      const blade = bladeRef.current
      const keys = keysRef.current
      const inputX = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0)
      const inputY = (keys.has('arrowdown') || keys.has('s') ? 1 : 0) - (keys.has('arrowup') || keys.has('w') ? 1 : 0)

      if (inputX || inputY) {
        const length = Math.hypot(inputX, inputY) || 1
        const nextX = clamp(blade.x + (inputX / length) * BLADE_SPEED * deltaScale, 0, GAME_W)
        const nextY = clamp(blade.y + (inputY / length) * BLADE_SPEED * deltaScale, 0, GAME_H)
        if (blade.active) pushTrailPoint(nextX, nextY, now)
        else {
          blade.x = nextX
          blade.y = nextY
        }
      }

      if (!keys.has(' ') && now > blade.pointerUntil) {
        blade.active = false
      }

      const elapsedRatio = 1 - secondsLeft / ROUND_SECONDS
      const finalRush = secondsLeft <= RUSH_SECONDS
      let flash = null
      let comboPop = comboPopRef.current && now - comboPopRef.current.born < 620 ? comboPopRef.current : null

      if (finalRush && !rushActivatedRef.current) {
        rushActivatedRef.current = true
        itemsRef.current = itemsRef.current.filter((item) => item.kind === 'fruit')
        comboPop = { text: '과일 폭주!', x: GAME_W / 2, y: 132, born: now }
        spawnAtRef.current = now
      }

      if (now >= spawnAtRef.current) {
        const burst = finalRush
          ? 4 + Math.floor(rand(0, 4))
          : Math.random() < 0.28 + elapsedRatio * 0.16 ? 2 + Math.floor(rand(0, 2)) : 1
        const nextItems = Array.from({ length: burst }, () => {
          itemIdRef.current += 1
          return createFruit(itemIdRef.current, elapsedRatio, {
            forceFruit: finalRush,
            goldenChance: finalRush ? 0 : 0.08,
            rush: finalRush,
          })
        })
        itemsRef.current = [...itemsRef.current, ...nextItems]
        spawnAtRef.current = finalRush ? now + rand(90, 135) : now + rand(330, Math.max(360, 780 - elapsedRatio * 260))
      }

      let items = itemsRef.current
        .map((item) => ({
          ...item,
          x: item.x + item.vx * deltaScale,
          y: item.y + item.vy * deltaScale,
          vy: item.vy + GRAVITY * deltaScale,
          rotate: item.rotate + item.spin * deltaScale,
        }))
        .filter((item) => item.y < GAME_H + item.size + 42 && item.x > -70 && item.x < GAME_W + 70)

      const trail = trailRef.current.filter((point) => now - point.t < TRAIL_LIFE)
      trailRef.current = trail
      const slicedIds = new Set()

      if (blade.active && trail.length >= 2) {
        const segments = []
        for (let i = 1; i < trail.length; i += 1) {
          segments.push([trail[i - 1], trail[i]])
        }

        items.forEach((item) => {
          const hit = segments.some(([a, b]) => distPointToSegment(item.x, item.y, a.x, a.y, b.x, b.y) < item.size * 0.58)
          if (!hit) return
          slicedIds.add(item.id)
          const lastSegment = segments[segments.length - 1]
          const angle = Math.atan2(lastSegment[1].y - lastSegment[0].y, lastSegment[1].x - lastSegment[0].x)
          const result = scoreSlice(item, now, angle)
          flash = result.flash || flash
          comboPop = result.comboPop || comboPop
        })
      }

      if (slicedIds.size > 0) {
        items = items.filter((item) => !slicedIds.has(item.id))
      }

      comboPopRef.current = comboPop
      particlesRef.current = particlesRef.current.filter((particle) => now - particle.born < PARTICLE_LIFE)
      splitsRef.current = splitsRef.current.filter((split) => now - split.born < SPLIT_LIFE)
      explosionsRef.current = explosionsRef.current.filter((explosion) => now - explosion.born < EXPLOSION_LIFE)
      itemsRef.current = items

      setView({
        items,
        particles: particlesRef.current,
        splits: splitsRef.current,
        explosions: explosionsRef.current,
        trail,
        blade: { x: blade.x, y: blade.y, active: blade.active },
        flash,
        comboPop,
        rush: finalRush,
        now,
      })

      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [endRound, phase, pushTrailPoint])

  return (
    <div className="fs-container" ref={containerRef}>
      <Link to="/" className="fs-back">← 홈으로</Link>

      <div className="fs-wrapper" style={{ width: GAME_W * scale, height: GAME_H * scale }}>
        <div
          ref={areaRef}
          className={`fs-area fs-${phase}${view.flash ? ` fs-flash-${view.flash}` : ''}${view.rush ? ' fs-rush' : ''}`}
          style={{ width: GAME_W, height: GAME_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
          <div className="fs-kitchen">
            {SPARKS.map((spark, index) => (
              <span
                key={index}
                className="fs-spark"
                style={{
                  left: spark.left,
                  top: spark.top,
                  width: spark.size,
                  height: spark.size,
                  animationDelay: spark.delay,
                }}
              />
            ))}
            <span className="fs-board" />
            <span className="fs-leaf fs-leaf-1">🌿</span>
            <span className="fs-leaf fs-leaf-2">🍃</span>
          </div>

          <div className="fs-hud">
            <div className="fs-chip">점수 {score}</div>
            <div className="fs-timer">
              <span style={{ width: `${timeRatio * 100}%` }} />
            </div>
            <div className="fs-chip fs-time">{Math.ceil(timeLeft)}</div>
          </div>

          <div className="fs-best">BEST {best}</div>

          {view.items.map((item) => (
            <div
              key={item.id}
              className={`fs-fruit fs-${item.kind}`}
              style={{
                left: item.x,
                top: item.y,
                width: item.size,
                height: item.size,
                '--fruit-color': item.color,
                transform: `translate(-50%, -50%) rotate(${item.rotate}deg)`,
              }}
            >
              <span>{item.emoji}</span>
            </div>
          ))}

          {view.splits.map((split) => {
            const age = view.now - split.born
            const progress = clamp(age / SPLIT_LIFE, 0, 1)
            return (
              <span
                key={split.id}
                className="fs-half"
                style={{
                  left: split.x + split.dx * progress,
                  top: split.y + split.dy * progress + progress * progress * 68,
                  transform: `translate(-50%, -50%) rotate(${split.rotate + progress * 170}deg) scale(${1 - progress * 0.18})`,
                  opacity: 1 - progress,
                }}
              >
                {split.emoji}
              </span>
            )
          })}

          {view.particles.map((particle) => (
            <span
              key={particle.id}
              className="fs-juice"
              style={{
                left: particle.x,
                top: particle.y,
                width: particle.size,
                height: particle.size,
                background: particle.color,
                '--juice-x': `${particle.dx}px`,
                '--juice-y': `${particle.dy}px`,
              }}
            />
          ))}

          {view.explosions.map((explosion) => (
            <div key={explosion.id} className="fs-explosion" style={{ left: explosion.x, top: explosion.y }}>
              <span className="fs-explosion-core" />
              <span className="fs-explosion-ring fs-explosion-ring-1" />
              <span className="fs-explosion-ring fs-explosion-ring-2" />
              <span className="fs-explosion-ring fs-explosion-ring-3" />
              <span className="fs-explosion-score">-25</span>
            </div>
          ))}

          {view.trail.length > 1 && (
            <svg className="fs-blade-svg" viewBox={`0 0 ${GAME_W} ${GAME_H}`} aria-hidden="true">
              <polyline points={view.trail.map((point) => `${point.x},${point.y}`).join(' ')} />
            </svg>
          )}

          <div
            className={`fs-blade-cursor${view.blade.active ? ' fs-blade-cursor-active' : ''}`}
            style={{ left: view.blade.x, top: view.blade.y }}
          />

          {combo >= 3 && phase === 'playing' && <div className="fs-combo">COMBO {combo}</div>}
          {view.rush && phase === 'playing' && <div className="fs-rush-badge">과일 폭주!</div>}
          {view.comboPop && <div className="fs-combo-pop" style={{ left: view.comboPop.x, top: view.comboPop.y }}>{view.comboPop.text}</div>}

          {phase !== 'playing' && (
            <div className="fs-overlay">
              <div className="fs-modal">
                <div className="fs-modal-icon">{phase === 'ended' ? '🏆' : '🍉'}</div>
                <h1>{phase === 'ended' ? '시간 종료!' : '과일 닌자'}</h1>
                <p>{phase === 'ended' ? `점수 ${score} · 최고 ${best}` : '30초 점수전'}</p>
                <button type="button" className="fs-primary-button" onClick={resetRound}>
                  {phase === 'ended' ? '다시 베기' : '시작'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default FruitSlash
