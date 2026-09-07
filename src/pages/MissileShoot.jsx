import { gameClock } from '../lib/gameClock'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGameScale } from '../hooks/useGameScale'
import { useTouchLock } from '../hooks/useTouchLock'
import './MissileShoot.css'

const GAME_W = 400
const GAME_H = 600
const TICK = 16
const PLAYER_W = 40
const PLAYER_H = 40
const PLAYER_SPEED = 6
const MISSILE_BASE_SPEED = 9
const MISSILE_BASE_INTERVAL = 280
const MAX_MISSILES = 70

const BOMB_DAMAGE = 8

const ITEM_TYPES = ['powerup', 'multishot', 'bomb']
const ITEM_SIZE = 32
const ITEM_FALL_SPEED = 2
const ITEM_DROP_CHANCE = 0.32

const SNAKE_SEGMENT_W = 30
const SNAKE_SEGMENT_H = 30
const SNAKE_SPEED_BASE = 2.0
const SNAKE_SPEED_PER_STAGE = 0.35
const ROW_GAP = 38
const SEGMENT_PATH_SPACING = 34
const PATH_PADDING = 6

const GAME_OVER_Y = GAME_H - 80

function seededRandom(seed) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function buildZigzagPath(stage) {
  const rand = seededRandom(stage * 7919 + 1301)
  const minLeft = PATH_PADDING
  const maxRight = GAME_W - PATH_PADDING - SNAKE_SEGMENT_W
  const minRowWidth = 80
  const points = []

  points.push({ x: maxRight, y: -50 })

  let y = 0
  let goingLeft = true

  for (let row = 0; row < 50; row++) {
    const rowGap = ROW_GAP + Math.floor((rand() - 0.3) * 24)
    if (row > 0) y += rowGap

    // 꺾이는 지점을 크게 랜덤화 (짧게 갈 수도, 끝까지 갈 수도)
    const leftEnd = minLeft + Math.floor(rand() * 160)
    const rightEnd = maxRight - Math.floor(rand() * 160)
    const safeRight = Math.max(rightEnd, leftEnd + minRowWidth)

    if (goingLeft) {
      points.push({ x: safeRight, y })
      points.push({ x: leftEnd, y })
    } else {
      points.push({ x: leftEnd, y })
      points.push({ x: safeRight, y })
    }

    goingLeft = !goingLeft
  }

  return points
}

function getPositionOnPath(path, distance) {
  if (distance <= 0) return { x: path[0].x, y: path[0].y }

  let acc = 0
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i - 1].x
    const dy = path[i].y - path[i - 1].y
    const segLen = Math.sqrt(dx * dx + dy * dy)

    if (acc + segLen >= distance) {
      const t = (distance - acc) / segLen
      return {
        x: path[i - 1].x + dx * t,
        y: path[i - 1].y + dy * t,
      }
    }
    acc += segLen
  }

  return { x: path[path.length - 1].x, y: path[path.length - 1].y }
}

function getPositionOnSideTrack(path, distance, track) {
  const pathPosition = getPositionOnPath(path, distance)
  const pathRange = GAME_W - PATH_PADDING * 2 - SNAKE_SEGMENT_W
  const progress = Math.max(0, Math.min(1, (pathPosition.x - PATH_PADDING) / pathRange))
  const sideOffset = 8 + progress * 118

  return {
    x: track === 'left' ? sideOffset : GAME_W - SNAKE_SEGMENT_W - sideOffset,
    y: pathPosition.y,
  }
}

function buildSnakeData(stage) {
  const bodyCount = Math.min(12 + stage * 3, 36)
  const hpPerSeg = Math.ceil(4 + stage * 3)
  const segments = []

  // head - invincible dragon
  segments.push({
    id: 0,
    x: 0,
    y: -200,
    hp: Infinity,
    maxHp: Infinity,
    isHead: true,
    alive: true,
  })

  // body segments
  for (let i = 1; i <= bodyCount; i++) {
    segments.push({
      id: i,
      x: 0,
      y: -200,
      hp: hpPerSeg,
      maxHp: hpPerSeg,
      isHead: false,
      alive: true,
      track: i % 2 === 1 ? 'left' : 'right',
    })
  }

  return segments
}

function getMissileProps(level) {
  if (level <= 1) return { color: '#0ff', width: 3, height: 12, glow: 4, name: 'Basic', trail: false }
  if (level === 2) return { color: '#0f0', width: 4, height: 14, glow: 6, name: 'Green Bolt', trail: false }
  if (level === 3) return { color: '#ff0', width: 4, height: 16, glow: 8, name: 'Yellow Beam', trail: true }
  if (level === 4) return { color: '#f80', width: 5, height: 18, glow: 10, name: 'Orange Blaze', trail: true }
  if (level === 5) return { color: '#f0f', width: 5, height: 20, glow: 12, name: 'Plasma', trail: true }
  return { color: '#f44', width: 6, height: 22, glow: 16, name: 'Inferno', trail: true }
}

function getMissileDamage(level) {
  return 1 + level
}

function getMissileInterval(level) {
  return Math.max(80, MISSILE_BASE_INTERVAL - level * 30)
}

let nextId = 1000
function uid() {
  return nextId++
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function ItemPickup({ type }) {
  return (
    <>
      <span className="ms-item-orbit" />
      <span className="ms-item-shell">
        {type === 'powerup' && (
          <span className="ms-item-power-icon" aria-hidden="true">
            <i />
            <i />
          </span>
        )}
        {type === 'multishot' && (
          <span className="ms-item-multi-icon" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        )}
        {type === 'bomb' && <span className="ms-item-bomb-icon" aria-hidden="true">✦</span>}
      </span>
    </>
  )
}

function MissileShoot() {
  const containerRef = useRef(null)
  useTouchLock(containerRef)
  const [gameState, setGameState] = useState('menu')
  const [stage, setStage] = useState(1)
  const [score, setScore] = useState(0)
  const [missileLevel, setMissileLevel] = useState(1)
  const [multiShot, setMultiShot] = useState(0)
  const [bombs, setBombs] = useState(0)
  const [playerX, setPlayerX] = useState(GAME_W / 2 - PLAYER_W / 2)
  const [snake, setSnake] = useState([])
  const [missiles, setMissiles] = useState([])
  const [items, setItems] = useState([])
  const [explosions, setExplosions] = useState([])
  const [bombEffect, setBombEffect] = useState(null)
  const [hitFlashes, setHitFlashes] = useState([])
  const [stageBanner, setStageBanner] = useState(false)

  const keysRef = useRef(new Set())
  const lastFireRef = useRef(0)
  const gameAreaRef = useRef(null)
  const playerXRef = useRef(GAME_W / 2 - PLAYER_W / 2)
  const pathRef = useRef([])
  const headDistRef = useRef(0)
  const snakeRef = useRef([])
  const missilesRef = useRef([])
  const itemsRef = useRef([])
  const bombsRef = useRef(0)
  const gameStateRef = useRef('menu')

  const startGame = useCallback(() => {
    gameClock.clearTimeouts()
    nextId = 1000
    setStage(1)
    setScore(0)
    setMissileLevel(1)
    setMultiShot(0)
    bombsRef.current = 1
    setBombs(1)
    setPlayerX(GAME_W / 2 - PLAYER_W / 2)
    playerXRef.current = GAME_W / 2 - PLAYER_W / 2
    pathRef.current = buildZigzagPath(1)
    headDistRef.current = 0
    const nextSnake = buildSnakeData(1)
    snakeRef.current = nextSnake
    missilesRef.current = []
    setSnake(nextSnake)
    setMissiles([])
    itemsRef.current = []
    setItems([])
    setExplosions([])
    setBombEffect(null)
    setHitFlashes([])
    lastFireRef.current = 0
    gameStateRef.current = 'playing'
    setGameState('playing')
    setStageBanner(true)
    gameClock.setTimeout(() => setStageBanner(false), 1500)
  }, [])

  const startStage = useCallback((stageNum) => {
    pathRef.current = buildZigzagPath(stageNum)
    headDistRef.current = 0
    const nextSnake = buildSnakeData(stageNum)
    snakeRef.current = nextSnake
    missilesRef.current = []
    setSnake(nextSnake)
    setMissiles([])
    itemsRef.current = []
    setItems([])
    setExplosions([])
    setBombEffect(null)
    setHitFlashes([])
    lastFireRef.current = 0
    setPlayerX(GAME_W / 2 - PLAYER_W / 2)
    playerXRef.current = GAME_W / 2 - PLAYER_W / 2
    gameStateRef.current = 'playing'
    setGameState('playing')
    setStageBanner(true)
    gameClock.setTimeout(() => setStageBanner(false), 1500)
  }, [])

  // keyboard
  useEffect(() => {
    const onDown = (e) => {
      if (['ArrowLeft', 'ArrowRight', ' ', 'Enter', 'z', 'Z'].includes(e.key)) {
        e.preventDefault()
      }
      keysRef.current.add(e.key)

      if ((e.key === ' ' || e.key === 'Enter') && gameState === 'menu') {
        startGame()
      }
      if ((e.key === ' ' || e.key === 'Enter') && gameState === 'stageClear') {
        const next = stage + 1
        setStage(next)
        startStage(next)
      }
      if ((e.key === ' ' || e.key === 'Enter') && gameState === 'gameOver') {
        startGame()
      }
    }
    const onUp = (e) => keysRef.current.delete(e.key)

    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [gameState, stage, startGame, startStage])

  // touch controls
  const touchTargetXRef = useRef(null)

  useEffect(() => {
    const area = gameAreaRef.current
    if (!area) return

    const handleTouchMove = (e) => {
      if (e.target.closest('button, a') || !e.isPrimary) return
      if (gameState !== 'playing') return
      if (e.type === 'pointerdown') area.setPointerCapture(e.pointerId)
      e.preventDefault()
      const rect = area.getBoundingClientRect()
      const touchX = e.clientX
      const x = (touchX - rect.left) / (rect.width / GAME_W) - PLAYER_W / 2
      touchTargetXRef.current = Math.max(0, Math.min(GAME_W - PLAYER_W, x))
    }
    const handleTouchEnd = () => { touchTargetXRef.current = null }

    area.addEventListener('pointerdown', handleTouchMove)
    area.addEventListener('pointermove', handleTouchMove)
    area.addEventListener('pointerup', handleTouchEnd)
    area.addEventListener('pointercancel', handleTouchEnd)
    window.addEventListener('blur', handleTouchEnd)
    area.addEventListener('lostpointercapture', handleTouchEnd)
    return () => {
      window.removeEventListener('blur', handleTouchEnd)
      area.removeEventListener('lostpointercapture', handleTouchEnd)
      area.removeEventListener('pointerdown', handleTouchMove)
      area.removeEventListener('pointermove', handleTouchMove)
      area.removeEventListener('pointerup', handleTouchEnd)
      area.removeEventListener('pointercancel', handleTouchEnd)
    }
  }, [gameState])

  // main game loop
  useEffect(() => {
    if (gameState !== 'playing') return

    const loop = gameClock.setInterval(() => {
      if (gameStateRef.current !== 'playing') return
      const now = gameClock.now()

      // advance snake along path
      const snakeSpeed = SNAKE_SPEED_BASE + stage * SNAKE_SPEED_PER_STAGE
      headDistRef.current += snakeSpeed

      // Compute movement and inventory outside React updater callbacks.
      let nextX = playerXRef.current
      if (keysRef.current.has('ArrowLeft')) nextX -= PLAYER_SPEED
      if (keysRef.current.has('ArrowRight')) nextX += PLAYER_SPEED
      if (touchTargetXRef.current !== null) {
        nextX += Math.max(-PLAYER_SPEED, Math.min(PLAYER_SPEED, touchTargetXRef.current - nextX))
      }
      playerXRef.current = Math.max(0, Math.min(GAME_W - PLAYER_W, nextX))
      setPlayerX(playerXRef.current)

      if (keysRef.current.has('z') || keysRef.current.has('Z')) {
        keysRef.current.delete('z')
        keysRef.current.delete('Z')
        if (bombsRef.current > 0) {
          bombsRef.current--
          setBombs(bombsRef.current)
          setBombEffect({ time: now })
          // Bombs weaken armour; the final hit still requires aiming at the core.
          snakeRef.current = snakeRef.current.map((segment) => !segment.alive || segment.isHead
            ? segment : { ...segment, hp: Math.max(1, segment.hp - BOMB_DAMAGE) })
          gameClock.setTimeout(() => setBombEffect(null), 400)
        }
      }

      // Build the whole combat frame locally, then commit each state once.
      // This keeps multishot from scheduling one React update per missile.
      let nextMissiles = missilesRef.current

      // fire missiles
      if (now - lastFireRef.current > getMissileInterval(missileLevel)) {
        lastFireRef.current = now
        const props = getMissileProps(missileLevel)
        const cx = playerXRef.current + PLAYER_W / 2

        const offsets = [0, 14, -14]
        const shotCount = multiShot > 0 ? 3 : 1
        const newMissiles = offsets.slice(0, shotCount).map((offset) => ({
          id: uid(),
          x: cx + offset - props.width / 2,
          y: GAME_H - PLAYER_H - 10,
          ...props,
          damage: getMissileDamage(missileLevel),
        }))

        nextMissiles = [...nextMissiles, ...newMissiles].slice(-MAX_MISSILES)
      }

      nextMissiles = nextMissiles
        .map((m) => ({ ...m, y: m.y - MISSILE_BASE_SPEED }))
        .filter((m) => m.y > -30 && m.x > -20 && m.x < GAME_W + 20)

      // Body cores travel inside two separated side tracks. They are always
      // vulnerable; the player moves because the targets physically are there.
      const path = pathRef.current
      const hd = headDistRef.current
      let aliveBodyIndex = 0
      const combatSnake = snakeRef.current.map((seg) => {
        if (seg.isHead) {
          const pos = getPositionOnPath(path, hd)
          return { ...seg, x: pos.x, y: pos.y }
        }
        if (!seg.alive) return seg
        aliveBodyIndex++
        const dist = hd - aliveBodyIndex * SEGMENT_PATH_SPACING
        const pos = getPositionOnSideTrack(path, dist, seg.track)
        return { ...seg, x: pos.x, y: pos.y }
      })

      const survivingMissiles = []
      const frameHitFlashes = []
      const frameExplosions = []
      const frameItems = []
      let frameScore = 0

      nextMissiles.forEach((m) => {
        const hitIndex = combatSnake.findIndex((seg) =>
          seg.alive &&
          !seg.isHead &&
          rectsOverlap(
            { x: m.x, y: m.y, w: m.width, h: m.height },
            { x: seg.x, y: seg.y, w: SNAKE_SEGMENT_W, h: SNAKE_SEGMENT_H }
          )
        )

        if (hitIndex === -1) {
          survivingMissiles.push(m)
          return
        }

        const seg = combatSnake[hitIndex]
        const newHp = seg.hp - m.damage
        frameHitFlashes.push({ id: uid(), x: m.x, y: m.y, time: now })

        if (newHp <= 0) {
          frameScore += seg.maxHp * 10
          frameExplosions.push({
            id: uid(),
            x: seg.x + SNAKE_SEGMENT_W / 2,
            y: seg.y + SNAKE_SEGMENT_H / 2,
            time: now,
          })
          if (Math.random() < ITEM_DROP_CHANCE) {
            const type = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)]
            frameItems.push({
              id: uid(),
              x: seg.x + SNAKE_SEGMENT_W / 2 - ITEM_SIZE / 2,
              y: seg.y,
              type,
            })
          }
          combatSnake[hitIndex] = { ...seg, hp: 0, alive: false }
        } else {
          combatSnake[hitIndex] = { ...seg, hp: newHp }
        }
      })

      snakeRef.current = combatSnake
      missilesRef.current = survivingMissiles
      setSnake(combatSnake)
      setMissiles(survivingMissiles)

      if (frameScore > 0) setScore((s) => s + frameScore)
      if (frameHitFlashes.length > 0) {
        setHitFlashes((prev) => [...prev, ...frameHitFlashes])
      }
      if (frameExplosions.length > 0) {
        setExplosions((prev) => [...prev, ...frameExplosions])
      }
      if (frameItems.length > 0) {
        itemsRef.current = [...itemsRef.current, ...frameItems]
      }

      const bodyAlive = combatSnake.some((seg) => !seg.isHead && seg.alive)
      if (!bodyAlive && combatSnake.length > 1) {
        gameStateRef.current = 'stageClear'
        setGameState('stageClear')
      }

      const head = combatSnake.find((seg) => seg.isHead)
      if (bodyAlive && head && head.y >= GAME_OVER_Y) {
        gameStateRef.current = 'gameOver'
        setGameState('gameOver')
      }

      const pickupExplosions = []
      itemsRef.current = itemsRef.current
        .map((item) => ({ ...item, y: item.y + ITEM_FALL_SPEED }))
        .filter((item) => {
          if (item.y >= GAME_H + 30) return false
          const playerRect = { x: playerXRef.current, y: GAME_H - PLAYER_H - 10, w: PLAYER_W, h: PLAYER_H }
          if (!rectsOverlap(playerRect, { x: item.x, y: item.y, w: ITEM_SIZE, h: ITEM_SIZE })) return true
          if (item.type === 'powerup') setMissileLevel((level) => Math.min(level + 1, 6))
          else if (item.type === 'multishot') setMultiShot(1)
          else if (item.type === 'bomb') {
            bombsRef.current = Math.min(bombsRef.current + 1, 9)
            setBombs(bombsRef.current)
          }
          pickupExplosions.push({ id: uid(), x: item.x + ITEM_SIZE / 2, y: item.y + ITEM_SIZE / 2, time: now, small: true })
          return false
        })
      setItems(itemsRef.current)
      if (pickupExplosions.length) setExplosions((previous) => [...previous, ...pickupExplosions])

      // clean up explosions & flashes
      setExplosions((prev) => prev.filter((e) => now - e.time < 500))
      setHitFlashes((prev) => prev.filter((h) => now - h.time < 150))

    }, TICK)

    return () => gameClock.clearInterval(loop)
  }, [gameState, missileLevel, multiShot, stage])

  const mProps = getMissileProps(missileLevel)
  const scale = useGameScale(GAME_W, GAME_H)

  // count remaining body segments
  const bodyRemaining = snake.filter((s) => !s.isHead && s.alive).length
  const bodyTotal = snake.filter((s) => !s.isHead).length
  const leftRemaining = snake.filter((s) => !s.isHead && s.alive && s.track === 'left').length
  const rightRemaining = snake.filter((s) => !s.isHead && s.alive && s.track === 'right').length

  return (
    <div ref={containerRef} className="ms-container">
      <Link to="/" className="ms-back">← 홈으로</Link>

      <div className="ms-game-wrapper" style={{ width: GAME_W * scale, height: GAME_H * scale }}>
        <div className="ms-game-area" ref={gameAreaRef} style={{ width: GAME_W, height: GAME_H, '--game-scale': scale, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        {/* HUD */}
        <div className="ms-hud">
          <div className="ms-hud-left">
            <span className="ms-hud-score">점수: {score}</span>
          </div>
          <div className="ms-hud-right">
            <span className="ms-hud-stage">STAGE {stage}</span>
          </div>
        </div>

        {/* body remaining bar */}
        {gameState === 'playing' && bodyTotal > 0 && (
          <div className="ms-mission-hud">
            <div className="ms-body-bar">
              <span className="ms-body-label">DRAGON {bodyRemaining}/{bodyTotal}</span>
              <div className="ms-body-gauge">
                <div
                  className="ms-body-gauge-fill"
                  style={{ width: `${(bodyRemaining / bodyTotal) * 100}%` }}
                />
              </div>
            </div>
            <div className="ms-core-counts" aria-label="남은 좌우 코어">
              <span className="ms-core-count-left">◀ LEFT {leftRemaining}</span>
              <span className="ms-core-count-right">RIGHT {rightRemaining} ▶</span>
            </div>
          </div>
        )}

        <div className="ms-hud-bottom">
          <div className="ms-hud-missile" style={{ color: mProps.color }}>
            Lv.{missileLevel} {mProps.name}
          </div>
          <div className="ms-hud-items">
            {multiShot > 0 && <span className="ms-hud-multi">TRIPLE</span>}
            <span className="ms-hud-bomb">✦ EMP {bombs}</span>
          </div>
        </div>

        {/* stage banner */}
        {stageBanner && (
          <div className="ms-stage-banner">
            <span>STAGE {stage}</span>
          </div>
        )}

        {/* danger line */}
        <div className="ms-danger-line" style={{ top: GAME_OVER_Y }} />

        {/* snake segments */}
        {snake.map((seg) =>
          seg.alive ? (
            <div
              key={seg.id}
              className={`ms-segment ${seg.isHead ? 'ms-segment-head' : `ms-segment-${seg.track}`}`}
              style={{
                left: seg.x,
                top: seg.y,
                width: SNAKE_SEGMENT_W,
                height: SNAKE_SEGMENT_H,
              }}
            >
              {seg.isHead ? (
                <span className="ms-segment-face">🐉</span>
              ) : (
                <>
                  <div className="ms-segment-hp-bar">
                    <div
                      className="ms-segment-hp-fill"
                      style={{ width: `${(seg.hp / seg.maxHp) * 100}%` }}
                    />
                  </div>
                  <span className="ms-segment-core" aria-hidden="true">
                    <b>{seg.track === 'left' ? 'L' : 'R'}</b>
                  </span>
                  <span className="ms-segment-hp-text">{seg.hp}</span>
                </>
              )}
            </div>
          ) : null
        )}

        {/* missiles */}
        {missiles.map((m) => (
          <div
            key={m.id}
            className={`ms-missile ${m.trail ? 'ms-missile-trail' : ''}`}
            style={{
              left: m.x,
              top: m.y,
              width: m.width,
              height: m.height,
              backgroundColor: m.color,
              boxShadow: `0 0 ${m.glow}px ${m.color}, 0 0 ${m.glow * 2}px ${m.color}`,
            }}
          />
        ))}

        {/* items */}
        {items.map((it) => (
          <div
            key={it.id}
            className={`ms-item ms-item-${it.type}`}
            style={{ left: it.x, top: it.y, width: ITEM_SIZE, height: ITEM_SIZE }}
            aria-label={it.type === 'powerup' ? '미사일 강화' : it.type === 'multishot' ? '멀티샷' : 'EMP 폭탄'}
          >
            <ItemPickup type={it.type} />
          </div>
        ))}

        {/* explosions */}
        {explosions.map((e) => (
          <div
            key={e.id}
            className={`ms-explosion ${e.small ? 'ms-explosion-small' : ''}`}
            style={{ left: e.x, top: e.y }}
          />
        ))}

        {/* hit flashes */}
        {hitFlashes.map((h) => (
          <div
            key={h.id}
            className="ms-hit-flash"
            style={{ left: h.x, top: h.y }}
          />
        ))}

        {/* bomb effect */}
        {bombEffect && <div className="ms-bomb-effect" />}

        {/* player */}
        <div
          className="ms-player"
          style={{ left: playerX, top: GAME_H - PLAYER_H - 10, width: PLAYER_W, height: PLAYER_H }}
        >
          <div className="ms-player-body" style={{ borderColor: mProps.color }}>
            <div className="ms-player-turret" style={{ backgroundColor: mProps.color }} />
            <div className="ms-player-cockpit" />
            <div className="ms-player-wing ms-player-wing-left" />
            <div className="ms-player-wing ms-player-wing-right" />
          </div>
        </div>

        {/* menu */}
        {gameState === 'menu' && (
          <div className="ms-overlay">
            <div className="ms-menu">
              <div className="ms-menu-icon">🐉</div>
              <h2>미사일 슈팅</h2>
              <p>양쪽 길의 코어를 모두 추격하세요!</p>
              <div className="ms-menu-mission">
                <span className="ms-menu-left">왼쪽 코어 추격</span>
                <b>↔</b>
                <span className="ms-menu-right">오른쪽 코어 추격</span>
              </div>
              <p className="ms-menu-warning">코어가 양쪽 길로 흩어져 내려와요</p>
              <p className="ms-menu-sub">🐉 머리가 바닥에 닿으면 게임 오버</p>
              <p className="ms-menu-controls">← → 빠르게 이동 · 자동 발사 · Z EMP</p>
              <button onClick={startGame}>시작하기</button>
              <p className="ms-menu-hint">Enter / Space로 시작</p>
            </div>
          </div>
        )}

        {/* stage clear */}
        {gameState === 'stageClear' && (
          <div className="ms-overlay">
            <div className="ms-clear">
              <h2>🎉 STAGE {stage} CLEAR!</h2>
              <p>점수: {score}</p>
              <button onClick={() => { const next = stage + 1; setStage(next); startStage(next) }}>
                다음 스테이지
              </button>
              <p className="ms-menu-hint">Enter / Space로 계속</p>
            </div>
          </div>
        )}

        {/* game over */}
        {gameState === 'gameOver' && (
          <div className="ms-overlay">
            <div className="ms-gameover">
              <h2>🐉 GAME OVER</h2>
              <p>스테이지: {stage}</p>
              <p>최종 점수: {score}</p>
              <div className="overlay-btns">
                <button onClick={startGame}>다시 시작</button>
                <Link to="/" className="overlay-btn-home">홈으로</Link>
              </div>
              <p className="ms-menu-hint">Enter / Space로 재시작</p>
            </div>
          </div>
        )}
        </div>
      </div>

      {gameState === 'playing' && (
        <button
          className="ms-touch-bomb"
          onClick={() => keysRef.current.add('z')}
          aria-label="폭탄 사용"
        >
          ✦ EMP ({bombs})
        </button>
      )}
      <div className="ms-instructions">화면 좌우로 움직여 양쪽 코어를 추격하세요</div>
    </div>
  )
}

export default MissileShoot
