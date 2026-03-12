import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGameScale } from '../hooks/useGameScale'
import './StackTower.css'

const GAME_W = 400
const GAME_H = 600
const TICK = 16

const BLOCK_H = 24
const BASE_W = 200
const BASE_Y = GAME_H - BLOCK_H
const SPEED_BASE = 2.5
const SPEED_ACCEL = 0.12
const SPEED_MAX = 10
const PERFECT_THRESHOLD = 4
const PERFECT_BONUS_GROW = 6

function hslColor(index) {
  const hue = (index * 28 + 200) % 360
  return `hsl(${hue}, 70%, 55%)`
}

function hslColorDark(index) {
  const hue = (index * 28 + 200) % 360
  return `hsl(${hue}, 70%, 42%)`
}

function StackTower() {
  const scale = useGameScale(GAME_W, GAME_H)

  const [gameState, setGameState] = useState('menu')
  const [renderTick, setRenderTick] = useState(0)

  const stackRef = useRef([])
  const movingRef = useRef(null)
  const dirRef = useRef(1)
  const scoreRef = useRef(0)
  const bestRef = useRef(0)
  const comboRef = useRef(0)
  const cutPiecesRef = useRef([])
  const perfectFlashRef = useRef(false)
  const gameStateRef = useRef('menu')
  const cameraYRef = useRef(0)

  useEffect(() => {
    try { bestRef.current = Number(localStorage.getItem('stack-best')) || 0 } catch { /* noop */ }
  }, [])

  const getSpeed = useCallback((level) => {
    return Math.min(SPEED_MAX, SPEED_BASE + level * SPEED_ACCEL)
  }, [])

  const spawnMoving = useCallback((level, width) => {
    const speed = getSpeed(level)
    const y = BASE_Y - (level + 1) * BLOCK_H
    movingRef.current = {
      x: -width,
      y,
      w: width,
      level: level + 1,
      speed,
    }
    dirRef.current = 1
  }, [getSpeed])

  const startGame = useCallback(() => {
    const base = { x: (GAME_W - BASE_W) / 2, y: BASE_Y, w: BASE_W, level: 0 }
    stackRef.current = [base]
    movingRef.current = null
    scoreRef.current = 0
    comboRef.current = 0
    cutPiecesRef.current = []
    perfectFlashRef.current = false
    cameraYRef.current = 0
    gameStateRef.current = 'playing'
    setGameState('playing')
    spawnMoving(0, BASE_W)
    setRenderTick((t) => t + 1)
  }, [spawnMoving])

  const placeBlock = useCallback(() => {
    if (gameStateRef.current !== 'playing' || !movingRef.current) return

    const moving = movingRef.current
    const stack = stackRef.current
    const top = stack[stack.length - 1]

    // calculate overlap
    const overlapLeft = Math.max(moving.x, top.x)
    const overlapRight = Math.min(moving.x + moving.w, top.x + top.w)
    const overlapW = overlapRight - overlapLeft

    if (overlapW <= 0) {
      // miss - game over
      cutPiecesRef.current.push({
        id: Date.now(),
        x: moving.x,
        y: moving.y,
        w: moving.w,
        level: moving.level,
        born: Date.now(),
      })
      movingRef.current = null
      if (scoreRef.current > bestRef.current) {
        bestRef.current = scoreRef.current
        try { localStorage.setItem('stack-best', String(scoreRef.current)) } catch { /* noop */ }
      }
      gameStateRef.current = 'gameover'
      setGameState('gameover')
      setRenderTick((t) => t + 1)
      return
    }

    // check perfect
    const isPerfect = Math.abs(overlapW - top.w) < PERFECT_THRESHOLD
    let placedW = overlapW
    let placedX = overlapLeft

    if (isPerfect) {
      // snap to perfect
      placedW = top.w + PERFECT_BONUS_GROW
      placedX = top.x - PERFECT_BONUS_GROW / 2
      // clamp to game bounds
      if (placedX < 0) placedX = 0
      if (placedX + placedW > GAME_W) placedW = GAME_W - placedX
      comboRef.current++
      perfectFlashRef.current = true
      setTimeout(() => { perfectFlashRef.current = false }, 800)
    } else {
      comboRef.current = 0

      // cut piece
      const cutLeft = moving.x < top.x
      const cutX = cutLeft ? moving.x : overlapRight
      const cutW = moving.w - overlapW
      if (cutW > 1) {
        cutPiecesRef.current.push({
          id: Date.now(),
          x: cutX,
          y: moving.y,
          w: cutW,
          level: moving.level,
          born: Date.now(),
        })
      }
    }

    // place
    const placed = {
      x: placedX,
      y: moving.y,
      w: placedW,
      level: moving.level,
    }
    stackRef.current = [...stack, placed]
    scoreRef.current = placed.level + (isPerfect ? comboRef.current : 0)

    // spawn next
    spawnMoving(placed.level, placedW)
    setRenderTick((t) => t + 1)
  }, [spawnMoving])

  // input
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        placeBlock()
      }
    }
    const onTouch = (e) => {
      if (gameStateRef.current === 'playing') {
        e.preventDefault()
        placeBlock()
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('touchstart', onTouch, { passive: false })
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('touchstart', onTouch)
    }
  }, [placeBlock])

  // game loop
  useEffect(() => {
    if (gameState !== 'playing') return

    const loop = setInterval(() => {
      if (gameStateRef.current !== 'playing') return

      const m = movingRef.current
      if (!m) return

      // move block
      m.x += m.speed * dirRef.current
      if (m.x + m.w >= GAME_W) {
        m.x = GAME_W - m.w
        dirRef.current = -1
      }
      if (m.x <= 0) {
        m.x = 0
        dirRef.current = 1
      }

      // camera follows stack height
      const targetCameraY = Math.max(0, (stackRef.current.length - 10) * BLOCK_H)
      cameraYRef.current += (targetCameraY - cameraYRef.current) * 0.08

      // expire cut pieces
      const now = Date.now()
      cutPiecesRef.current = cutPiecesRef.current.filter((c) => now - c.born < 600)

      setRenderTick((t) => t + 1)
    }, TICK)

    return () => clearInterval(loop)
  }, [gameState])

  // render
  const stack = stackRef.current
  const moving = movingRef.current
  const score = scoreRef.current
  const best = bestRef.current
  const combo = comboRef.current
  const cutPieces = cutPiecesRef.current
  const perfectFlash = perfectFlashRef.current
  const camY = cameraYRef.current

  return (
    <div className="st-container">
      <Link to="/" className="st-back">← 홈으로</Link>

      <div className="st-game-wrapper" style={{ width: GAME_W * scale, height: GAME_H * scale }}>
        <div
          className="st-game-area"
          style={{ width: GAME_W, height: GAME_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
          {/* HUD */}
          <div className="st-hud">
            <div>
              <div className="st-hud-score">{score}</div>
              {best > 0 && <div className="st-hud-best">BEST {best}</div>}
            </div>
            {combo >= 2 && gameState === 'playing' && (
              <div className="st-hud-combo" key={combo}>
                COMBO x{combo}
              </div>
            )}
          </div>

          {/* stacked blocks */}
          {stack.map((block, i) => (
            <div
              key={i}
              className="st-block"
              style={{
                left: block.x,
                top: block.y + camY,
                width: block.w,
                height: BLOCK_H,
                background: `linear-gradient(to bottom, ${hslColor(block.level)}, ${hslColorDark(block.level)})`,
                borderBottom: `2px solid ${hslColorDark(block.level)}`,
              }}
            />
          ))}

          {/* moving block */}
          {moving && (
            <div
              className="st-block"
              style={{
                left: moving.x,
                top: moving.y + camY,
                width: moving.w,
                height: BLOCK_H,
                background: `linear-gradient(to bottom, ${hslColor(moving.level)}, ${hslColorDark(moving.level)})`,
                borderBottom: `2px solid ${hslColorDark(moving.level)}`,
              }}
            />
          )}

          {/* cut pieces */}
          {cutPieces.map((c) => (
            <div
              key={c.id}
              className="st-cut"
              style={{
                left: c.x,
                top: c.y + camY,
                width: c.w,
                height: BLOCK_H,
                background: `linear-gradient(to bottom, ${hslColor(c.level)}, ${hslColorDark(c.level)})`,
              }}
            />
          ))}

          {/* perfect flash */}
          {perfectFlash && (
            <div className="st-perfect">
              <span>PERFECT!</span>
            </div>
          )}

          {/* menu */}
          {gameState === 'menu' && (
            <div className="st-overlay">
              <div className="st-menu">
                <div className="st-menu-icon">🏗️</div>
                <h2>스택 타워</h2>
                <p>블록을 정확히 쌓아 올리세요!</p>
                <p className="st-menu-controls">Space / 터치로 블록 배치</p>
                <button onClick={startGame}>게임 시작</button>
                <p className="st-menu-hint">정확히 맞추면 PERFECT → 블록이 커집니다!</p>
              </div>
            </div>
          )}

          {/* gameover */}
          {gameState === 'gameover' && (
            <div className="st-overlay">
              <div className="st-gameover">
                <h2>게임 오버</h2>
                <p>높이: {score}층</p>
                {best > 0 && <p>최고 기록: {best}층</p>}
                <div className="overlay-btns">
                  <button onClick={startGame}>다시 시작</button>
                  <Link to="/" className="overlay-btn-home">홈으로</Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="st-instructions">Space 또는 화면 터치로 블록을 쌓으세요</div>
    </div>
  )
}

export default StackTower
