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
const PLAYER_SPEED = 5
const MISSILE_BASE_SPEED = 9
const MISSILE_BASE_INTERVAL = 280

const BOMB_DAMAGE = 30

const ITEM_TYPES = ['powerup', 'multishot', 'bomb']
const ITEM_SIZE = 24
const ITEM_FALL_SPEED = 1.8
const ITEM_DROP_CHANCE = 0.2

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

function buildSnakeData(stage) {
  const bodyCount = Math.min(15 + stage * 5, 55)
  const hpPerSeg = Math.ceil(12 + stage * 8)
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

  const startGame = useCallback(() => {
    nextId = 1000
    setStage(1)
    setScore(0)
    setMissileLevel(1)
    setMultiShot(0)
    setBombs(3)
    setPlayerX(GAME_W / 2 - PLAYER_W / 2)
    playerXRef.current = GAME_W / 2 - PLAYER_W / 2
    pathRef.current = buildZigzagPath(1)
    headDistRef.current = 0
    setSnake(buildSnakeData(1))
    setMissiles([])
    setItems([])
    setExplosions([])
    setBombEffect(null)
    setHitFlashes([])
    lastFireRef.current = 0
    setGameState('playing')
    setStageBanner(true)
    setTimeout(() => setStageBanner(false), 1500)
  }, [])

  const startStage = useCallback((stageNum) => {
    pathRef.current = buildZigzagPath(stageNum)
    headDistRef.current = 0
    setSnake(buildSnakeData(stageNum))
    setMissiles([])
    setItems([])
    setExplosions([])
    setBombEffect(null)
    setHitFlashes([])
    lastFireRef.current = 0
    setPlayerX(GAME_W / 2 - PLAYER_W / 2)
    playerXRef.current = GAME_W / 2 - PLAYER_W / 2
    setGameState('playing')
    setStageBanner(true)
    setTimeout(() => setStageBanner(false), 1500)
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
      e.preventDefault()
      const rect = area.getBoundingClientRect()
      const touchX = e.touches[0].clientX
      const x = (touchX - rect.left) / (rect.width / GAME_W) - PLAYER_W / 2
      touchTargetXRef.current = Math.max(0, Math.min(GAME_W - PLAYER_W, x))
    }
    const handleTouchEnd = () => { touchTargetXRef.current = null }

    area.addEventListener('touchmove', handleTouchMove, { passive: false })
    area.addEventListener('touchend', handleTouchEnd)
    area.addEventListener('touchcancel', handleTouchEnd)
    return () => {
      area.removeEventListener('touchmove', handleTouchMove)
      area.removeEventListener('touchend', handleTouchEnd)
      area.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [])

  // main game loop
  useEffect(() => {
    if (gameState !== 'playing') return

    const loop = setInterval(() => {
      const now = Date.now()

      // advance snake along path
      const snakeSpeed = SNAKE_SPEED_BASE + stage * SNAKE_SPEED_PER_STAGE
      headDistRef.current += snakeSpeed

      // move player
      setPlayerX((px) => {
        let nx = px
        if (keysRef.current.has('ArrowLeft')) nx = Math.max(0, px - PLAYER_SPEED)
        if (keysRef.current.has('ArrowRight')) nx = Math.min(GAME_W - PLAYER_W, px + PLAYER_SPEED)

        // touch: move toward touch position
        if (touchTargetXRef.current !== null) {
          const diff = touchTargetXRef.current - px
          if (Math.abs(diff) < PLAYER_SPEED) {
            nx = touchTargetXRef.current
          } else {
            nx = px + (diff > 0 ? PLAYER_SPEED : -PLAYER_SPEED)
          }
        }

        playerXRef.current = nx
        return nx
      })

      // bomb key
      if (keysRef.current.has('z') || keysRef.current.has('Z')) {
        keysRef.current.delete('z')
        keysRef.current.delete('Z')
        setBombs((b) => {
          if (b <= 0) return b
          setBombEffect({ time: now })
          setSnake((prev) =>
            prev.map((seg) => {
              if (!seg.alive || seg.isHead) return seg
              const newHp = seg.hp - BOMB_DAMAGE
              if (newHp <= 0) {
                setScore((s) => s + seg.maxHp * 10)
                setExplosions((ex) => [
                  ...ex,
                  { id: uid(), x: seg.x + SNAKE_SEGMENT_W / 2, y: seg.y + SNAKE_SEGMENT_H / 2, time: now },
                ])
                if (Math.random() < ITEM_DROP_CHANCE) {
                  const type = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)]
                  setItems((it) => [...it, { id: uid(), x: seg.x + SNAKE_SEGMENT_W / 2 - ITEM_SIZE / 2, y: seg.y, type }])
                }
                return { ...seg, hp: 0, alive: false }
              }
              return { ...seg, hp: newHp }
            })
          )
          setTimeout(() => setBombEffect(null), 400)
          return b - 1
        })
      }

      // fire missiles
      if (now - lastFireRef.current > getMissileInterval(missileLevel)) {
        lastFireRef.current = now
        const props = getMissileProps(missileLevel)
        const cx = playerXRef.current + PLAYER_W / 2

        setMissiles((prev) => {
          const newMissiles = []
          newMissiles.push({
            id: uid(),
            x: cx - props.width / 2,
            y: GAME_H - PLAYER_H - 10,
            ...props,
            damage: getMissileDamage(missileLevel),
          })

          const extraCount = multiShot > 0 ? Math.min(multiShot, 4) : 0
          for (let i = 0; i < extraCount; i++) {
            const angle = ((i % 2 === 0 ? 1 : -1) * (Math.floor(i / 2) + 1) * 12 * Math.PI) / 180
            newMissiles.push({
              id: uid(),
              x: cx - props.width / 2,
              y: GAME_H - PLAYER_H - 10,
              ...props,
              damage: getMissileDamage(missileLevel),
              angle,
            })
          }

          return [...prev, ...newMissiles]
        })
      }

      // update missiles
      setMissiles((prev) =>
        prev
          .map((m) => ({
            ...m,
            x: m.x + (m.angle ? Math.sin(m.angle) * MISSILE_BASE_SPEED * 0.5 : 0),
            y: m.y - MISSILE_BASE_SPEED,
          }))
          .filter((m) => m.y > -30 && m.x > -20 && m.x < GAME_W + 20)
      )

      // update snake positions from path
      // head at front, alive body segments compress behind head
      setSnake((prev) => {
        const path = pathRef.current
        const hd = headDistRef.current

        let aliveBodyIndex = 0
        return prev.map((seg) => {
          if (seg.isHead) {
            const pos = getPositionOnPath(path, hd)
            return { ...seg, x: pos.x, y: pos.y }
          }
          if (!seg.alive) return seg
          aliveBodyIndex++
          const dist = hd - aliveBodyIndex * SEGMENT_PATH_SPACING
          const pos = getPositionOnPath(path, dist)
          return { ...seg, x: pos.x, y: pos.y }
        })
      })

      // collision: missiles vs snake
      // missiles pass through the head (invincible)
      setMissiles((prevMissiles) => {
        const survivingMissiles = []

        prevMissiles.forEach((m) => {
          let hit = false
          setSnake((prevSnake) => {
            const newSnake = prevSnake.map((seg) => {
              if (!seg.alive || hit || seg.isHead) return seg
              if (
                rectsOverlap(
                  { x: m.x, y: m.y, w: m.width, h: m.height },
                  { x: seg.x, y: seg.y, w: SNAKE_SEGMENT_W, h: SNAKE_SEGMENT_H }
                )
              ) {
                hit = true
                const newHp = seg.hp - m.damage
                setHitFlashes((hf) => [...hf, { id: uid(), x: m.x, y: m.y, time: now }])
                if (newHp <= 0) {
                  setScore((s) => s + seg.maxHp * 10)
                  setExplosions((ex) => [
                    ...ex,
                    { id: uid(), x: seg.x + SNAKE_SEGMENT_W / 2, y: seg.y + SNAKE_SEGMENT_H / 2, time: now },
                  ])
                  if (Math.random() < ITEM_DROP_CHANCE) {
                    const type = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)]
                    setItems((it) => [
                      ...it,
                      { id: uid(), x: seg.x + SNAKE_SEGMENT_W / 2 - ITEM_SIZE / 2, y: seg.y, type },
                    ])
                  }
                  return { ...seg, hp: 0, alive: false }
                }
                return { ...seg, hp: newHp }
              }
              return seg
            })
            return newSnake
          })
          if (!hit) {
            survivingMissiles.push(m)
          }
        })

        return survivingMissiles
      })

      // update items
      setItems((prev) =>
        prev
          .map((it) => ({ ...it, y: it.y + ITEM_FALL_SPEED }))
          .filter((it) => it.y < GAME_H + 30)
      )

      // player collects items
      setItems((prev) => {
        return prev.filter((it) => {
          const playerRect = { x: playerXRef.current, y: GAME_H - PLAYER_H - 10, w: PLAYER_W, h: PLAYER_H }
          const itemRect = { x: it.x, y: it.y, w: ITEM_SIZE, h: ITEM_SIZE }
          if (rectsOverlap(playerRect, itemRect)) {
            if (it.type === 'powerup') {
              setMissileLevel((l) => Math.min(l + 1, 6))
            } else if (it.type === 'multishot') {
              setMultiShot((ms) => Math.min(ms + 2, 4))
            } else if (it.type === 'bomb') {
              setBombs((b) => Math.min(b + 1, 9))
            }
            setExplosions((ex) => [...ex, { id: uid(), x: it.x + ITEM_SIZE / 2, y: it.y + ITEM_SIZE / 2, time: now, small: true }])
            return false
          }
          return true
        })
      })

      // clean up explosions & flashes
      setExplosions((prev) => prev.filter((e) => now - e.time < 500))
      setHitFlashes((prev) => prev.filter((h) => now - h.time < 150))

      // check stage clear - all body segments destroyed
      setSnake((prev) => {
        const bodyAlive = prev.some((s) => !s.isHead && s.alive)
        if (!bodyAlive && prev.length > 1) {
          setGameState('stageClear')
        }
        return prev
      })

      // check game over - dragon head reached bottom
      setSnake((prev) => {
        const head = prev.find((s) => s.isHead)
        if (head && head.y >= GAME_OVER_Y) {
          setGameState('gameOver')
        }
        return prev
      })
    }, TICK)

    return () => clearInterval(loop)
  }, [gameState, missileLevel, multiShot, stage])

  const mProps = getMissileProps(missileLevel)
  const scale = useGameScale(GAME_W, GAME_H)

  // count remaining body segments
  const bodyRemaining = snake.filter((s) => !s.isHead && s.alive).length
  const bodyTotal = snake.filter((s) => !s.isHead).length

  return (
    <div ref={containerRef} className="ms-container">
      <Link to="/" className="ms-back">← 홈으로</Link>

      <div className="ms-game-wrapper" style={{ width: GAME_W * scale, height: GAME_H * scale }}>
        <div className="ms-game-area" ref={gameAreaRef} style={{ width: GAME_W, height: GAME_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
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
          <div className="ms-body-bar">
            <span className="ms-body-label">🐉 {bodyRemaining}/{bodyTotal}</span>
            <div className="ms-body-gauge">
              <div
                className="ms-body-gauge-fill"
                style={{ width: `${(bodyRemaining / bodyTotal) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="ms-hud-bottom">
          <div className="ms-hud-missile" style={{ color: mProps.color }}>
            Lv.{missileLevel} {mProps.name}
          </div>
          <div className="ms-hud-items">
            {multiShot > 0 && <span className="ms-hud-multi">x{multiShot}</span>}
            <span className="ms-hud-bomb">💣x{bombs}</span>
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
              className={`ms-segment ${seg.isHead ? 'ms-segment-head' : ''}`}
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
          >
            {it.type === 'powerup' && '⬆️'}
            {it.type === 'multishot' && '🔱'}
            {it.type === 'bomb' && '💣'}
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
          </div>
        </div>

        {/* menu */}
        {gameState === 'menu' && (
          <div className="ms-overlay">
            <div className="ms-menu">
              <div className="ms-menu-icon">🐉</div>
              <h2>미사일 슈팅</h2>
              <p>용의 몸통을 모두 파괴하세요!</p>
              <p className="ms-menu-sub">🐉 머리가 바닥에 닿으면 게임 오버</p>
              <p className="ms-menu-controls">← → 이동 | 자동 발사 | Z 폭탄</p>
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
          onTouchStart={(e) => { e.preventDefault(); keysRef.current.add('z') }}
          onTouchEnd={() => keysRef.current.delete('z')}
          onClick={() => { keysRef.current.add('z'); setTimeout(() => keysRef.current.delete('z'), 50) }}
        >
          💣 폭탄 ({bombs})
        </button>
      )}
      <div className="ms-instructions">터치로 이동 · 자동 발사 · 💣 폭탄 버튼</div>
    </div>
  )
}

export default MissileShoot
