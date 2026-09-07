import { gameClock } from '../lib/gameClock'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGameScale } from '../hooks/useGameScale'
import { useTouchLock } from '../hooks/useTouchLock'
import './Tetris.css'

const COLS = 10
const ROWS = 20
const CELL = 28
const GAME_W = COLS * CELL
const GAME_H = ROWS * CELL
const LAYOUT_W = GAME_W + 8 + 90
const LAYOUT_H = GAME_H

const BASE_INTERVAL = 800
const MIN_INTERVAL = 80
const SPEED_FACTOR = 50

const PIECES = {
  I: { shape: [[1, 1, 1, 1]], color: '#00d4ff' },
  O: { shape: [[1, 1], [1, 1]], color: '#ffd700' },
  T: { shape: [[0, 1, 0], [1, 1, 1]], color: '#aa44ff' },
  S: { shape: [[0, 1, 1], [1, 1, 0]], color: '#44cc44' },
  Z: { shape: [[1, 1, 0], [0, 1, 1]], color: '#ff4444' },
  J: { shape: [[1, 0, 0], [1, 1, 1]], color: '#4488ff' },
  L: { shape: [[0, 0, 1], [1, 1, 1]], color: '#ff8844' },
}

const PIECE_KEYS = Object.keys(PIECES)

function randomPiece() {
  const key = PIECE_KEYS[Math.floor(Math.random() * PIECE_KEYS.length)]
  return { key, ...PIECES[key] }
}

function rotate(shape) {
  const rows = shape.length
  const cols = shape[0].length
  const rotated = []
  for (let c = 0; c < cols; c++) {
    const newRow = []
    for (let r = rows - 1; r >= 0; r--) {
      newRow.push(shape[r][c])
    }
    rotated.push(newRow)
  }
  return rotated
}

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null))
}

function isValid(board, shape, px, py) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue
      const nx = px + c
      const ny = py + r
      if (nx < 0 || nx >= COLS || ny >= ROWS) return false
      if (ny >= 0 && board[ny][nx]) return false
    }
  }
  return true
}

function placePiece(board, shape, px, py, color) {
  const newBoard = board.map((row) => [...row])
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue
      const ny = py + r
      const nx = px + c
      if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) {
        newBoard[ny][nx] = color
      }
    }
  }
  return newBoard
}

function clearLines(board) {
  const kept = board.filter((row) => row.some((cell) => !cell))
  const cleared = ROWS - kept.length
  const empty = Array.from({ length: cleared }, () => Array(COLS).fill(null))
  return { board: [...empty, ...kept], cleared }
}

function getGhostY(board, shape, px, py) {
  let gy = py
  while (isValid(board, shape, px, gy + 1)) gy++
  return gy
}

const LINE_SCORES = [0, 100, 300, 500, 800]

function Tetris() {
  const scale = useGameScale(LAYOUT_W, LAYOUT_H, { reservedH: 132 })
  const containerRef = useRef(null)
  useTouchLock(containerRef)

  const [gameState, setGameState] = useState('menu')
  const [view, setView] = useState(() => ({ board: createBoard(), current: null, next: null, pos: {"x": 0, "y": 0}, score: 0, level: 1, lines: 0, flashLines: [] }))

  const boardRef = useRef(createBoard())
  const currentRef = useRef(null)
  const nextRef = useRef(null)
  const posRef = useRef({ x: 0, y: 0 })
  const scoreRef = useRef(0)
  const levelRef = useRef(1)
  const linesRef = useRef(0)
  const gameStateRef = useRef('menu')
  const flashLinesRef = useRef([])

  const syncView = useCallback(() => {
    setView(structuredClone({
      board: boardRef.current,
      current: currentRef.current,
      next: nextRef.current,
      pos: posRef.current,
      score: scoreRef.current,
      level: levelRef.current,
      lines: linesRef.current,
      flashLines: flashLinesRef.current,
    }))
  }, [])

  const spawn = useCallback(() => {
    const piece = nextRef.current || randomPiece()
    nextRef.current = randomPiece()
    const px = Math.floor((COLS - piece.shape[0].length) / 2)
    const py = -piece.shape.length + 1

    if (!isValid(boardRef.current, piece.shape, px, 0)) {
      gameStateRef.current = 'gameover'
      setGameState('gameover')
      return
    }

    currentRef.current = piece
    posRef.current = { x: px, y: py }
  }, [])

  const lock = useCallback(() => {
    const piece = currentRef.current
    if (!piece || gameStateRef.current !== 'playing') return
    const { x, y } = posRef.current
    currentRef.current = null
    if (piece.shape.some((row, r) => y + r < 0 && row.some(Boolean))) {
      gameStateRef.current = 'gameover'
      setGameState('gameover')
      syncView()
      return
    }
    boardRef.current = placePiece(boardRef.current, piece.shape, x, y, piece.color)

    const { board, cleared } = clearLines(boardRef.current)

    if (cleared > 0) {
      // find which rows were cleared (before clearing)
      const flashRows = []
      for (let r = 0; r < ROWS; r++) {
        if (boardRef.current[r].every((cell) => cell)) {
          flashRows.push(r)
        }
      }
      flashLinesRef.current = flashRows

      scoreRef.current += LINE_SCORES[cleared] * levelRef.current
      linesRef.current += cleared
      levelRef.current = Math.floor(linesRef.current / 10) + 1

      // brief delay for flash, then clear
      gameClock.setTimeout(() => {
        boardRef.current = board
        flashLinesRef.current = []
        spawn()
        syncView()
      }, 200)
    } else {
      boardRef.current = board
      spawn()
    }
  }, [spawn, syncView])

  const moveDown = useCallback((softDrop = false) => {
    const piece = currentRef.current
    if (!piece || gameStateRef.current !== 'playing') return
    const { x, y } = posRef.current
    if (isValid(boardRef.current, piece.shape, x, y + 1)) {
      posRef.current = { x, y: y + 1 }
      if (softDrop) scoreRef.current += 1
    } else {
      lock()
    }
    syncView()
  }, [lock, syncView])

  const hardDrop = useCallback(() => {
    const piece = currentRef.current
    if (!piece || gameStateRef.current !== 'playing') return
    const { x, y } = posRef.current
    const gy = getGhostY(boardRef.current, piece.shape, x, y)
    scoreRef.current += (gy - y) * 2
    posRef.current = { x, y: gy }
    lock()
    syncView()
  }, [lock, syncView])

  const moveHorizontal = useCallback((dir) => {
    const piece = currentRef.current
    if (!piece || gameStateRef.current !== 'playing') return
    const { x, y } = posRef.current
    if (isValid(boardRef.current, piece.shape, x + dir, y)) {
      posRef.current = { x: x + dir, y }
      syncView()
    }
  }, [syncView])

  const rotatePiece = useCallback(() => {
    const piece = currentRef.current
    if (!piece || gameStateRef.current !== 'playing') return
    const { x, y } = posRef.current
    const rotated = rotate(piece.shape)

    // wall kick offsets
    const kicks = [0, -1, 1, -2, 2]
    for (const kick of kicks) {
      if (isValid(boardRef.current, rotated, x + kick, y)) {
        currentRef.current = { ...piece, shape: rotated }
        posRef.current = { x: x + kick, y }
        syncView()
        return
      }
    }
  }, [syncView])

  const startGame = useCallback(() => {
    gameClock.clearTimeouts()
    boardRef.current = createBoard()
    scoreRef.current = 0
    levelRef.current = 1
    linesRef.current = 0
    flashLinesRef.current = []
    nextRef.current = randomPiece()
    gameStateRef.current = 'playing'
    setGameState('playing')
    spawn()
    syncView()
  }, [spawn, syncView])

  // keyboard
  useEffect(() => {
    const onDown = (e) => {
      if (gameStateRef.current !== 'playing') return
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          moveHorizontal(-1)
          break
        case 'ArrowRight':
          e.preventDefault()
          moveHorizontal(1)
          break
        case 'ArrowDown':
          e.preventDefault()
          moveDown(true)
          break
        case 'ArrowUp':
          e.preventDefault()
          rotatePiece()
          break
        case ' ':
          e.preventDefault()
          if (!e.repeat) hardDrop()
          break
      }
    }
    window.addEventListener('keydown', onDown)
    return () => window.removeEventListener('keydown', onDown)
  }, [moveHorizontal, moveDown, rotatePiece, hardDrop])

  // Reschedule only when the level changes, never in the middle of a drop interval.
  useEffect(() => {
    if (gameState !== 'playing') return
    const interval = Math.max(MIN_INTERVAL, BASE_INTERVAL - (view.level - 1) * SPEED_FACTOR)
    const timer = gameClock.setInterval(() => moveDown(), interval)
    return () => gameClock.clearInterval(timer)
  }, [gameState, view.level, moveDown])

  // Render the published snapshot.
  const board = view.board
  const current = view.current
  const pos = view.pos
  const next = view.next
  const score = view.score
  const level = view.level
  const lines = view.lines
  const flashLines = view.flashLines

  // build cells to render
  const cells = []

  // placed blocks
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c]) {
        cells.push(
          <div
            key={`b-${r}-${c}`}
            className="tt-cell"
            style={{
              left: c * CELL,
              top: r * CELL,
              width: CELL - 1,
              height: CELL - 1,
              background: board[r][c],
            }}
          />
        )
      }
    }
  }

  // ghost piece
  if (current && gameState === 'playing') {
    const gy = getGhostY(board, current.shape, pos.x, pos.y)
    for (let r = 0; r < current.shape.length; r++) {
      for (let c = 0; c < current.shape[r].length; c++) {
        if (!current.shape[r][c]) continue
        const cy = gy + r
        const cx = pos.x + c
        if (cy >= 0 && cy < ROWS) {
          cells.push(
            <div
              key={`g-${r}-${c}`}
              className="tt-cell tt-cell-ghost"
              style={{
                left: cx * CELL,
                top: cy * CELL,
                width: CELL - 1,
                height: CELL - 1,
                background: current.color,
              }}
            />
          )
        }
      }
    }
  }

  // current piece
  if (current) {
    for (let r = 0; r < current.shape.length; r++) {
      for (let c = 0; c < current.shape[r].length; c++) {
        if (!current.shape[r][c]) continue
        const cy = pos.y + r
        const cx = pos.x + c
        if (cy >= 0 && cy < ROWS) {
          cells.push(
            <div
              key={`c-${r}-${c}`}
              className="tt-cell"
              style={{
                left: cx * CELL,
                top: cy * CELL,
                width: CELL - 1,
                height: CELL - 1,
                background: current.color,
              }}
            />
          )
        }
      }
    }
  }

  // next piece preview
  const nextCells = []
  if (next) {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const filled = next.shape[r] && next.shape[r][c]
        nextCells.push(
          <div
            key={`n-${r}-${c}`}
            className="tt-next-cell"
            style={{ background: filled ? next.color : 'rgba(255,255,255,0.05)' }}
          />
        )
      }
    }
  }

  return (
    <div ref={containerRef} className="tt-container">
      <Link to="/" className="tt-back">← 홈으로</Link>

      <div className="tt-game-wrapper" style={{ width: LAYOUT_W * scale, height: LAYOUT_H * scale }}>
        <div style={{ width: LAYOUT_W, height: LAYOUT_H, '--game-scale': scale, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <div className="tt-layout">
            <div
              className="tt-game-area"
              style={{ width: GAME_W, height: GAME_H }}
            >
              {cells}

              {/* flash lines */}
              {flashLines.map((r) => (
                <div
                  key={`fl-${r}`}
                  className="tt-line-flash"
                  style={{ top: r * CELL, height: CELL }}
                />
              ))}

              {/* menu */}
              {gameState === 'menu' && (
                <div className="tt-overlay">
                  <div className="tt-menu">
                    <div className="tt-menu-icon">🟦</div>
                    <h2>테트리스</h2>
                    <p>블록을 쌓아 줄을 없애세요!</p>
                    <p className="tt-menu-controls">← → 이동 · ↑ 회전 · ↓ 소프트드롭 · Space 하드드롭</p>
                    <button onClick={startGame}>게임 시작</button>
                  </div>
                </div>
              )}

              {/* gameover */}
              {gameState === 'gameover' && (
                <div className="tt-overlay">
                  <div className="tt-gameover">
                    <h2>게임 오버</h2>
                    <p>최종 점수: {score}</p>
                    <p>레벨: {level} · 라인: {lines}</p>
                    <div className="overlay-btns">
                      <button onClick={startGame}>다시 시작</button>
                      <Link to="/" className="overlay-btn-home">홈으로</Link>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* side panel */}
            <div className="tt-side">
              <div className="tt-side-box">
                <div className="tt-side-label">점수</div>
                <div className="tt-side-value">{score}</div>
              </div>
              <div className="tt-side-box">
                <div className="tt-side-label">레벨</div>
                <div className="tt-side-value tt-side-value-sm">{level}</div>
              </div>
              <div className="tt-side-box">
                <div className="tt-side-label">라인</div>
                <div className="tt-side-value tt-side-value-sm">{lines}</div>
              </div>
              <div className="tt-side-box">
                <div className="tt-side-label">다음</div>
                <div className="tt-next-grid">{nextCells}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="tt-touch-controls" role="group" aria-label="블록 조작">
        <button className="tt-touch-btn" disabled={gameState !== 'playing'} aria-label="왼쪽 이동" onClick={() => moveHorizontal(-1)}>←</button>
        <button className="tt-touch-btn" disabled={gameState !== 'playing'} aria-label="아래로 이동" onClick={() => moveDown(true)}>↓</button>
        <button className="tt-touch-btn" disabled={gameState !== 'playing'} aria-label="블록 회전" onClick={rotatePiece}>↻</button>
        <button className="tt-touch-btn" disabled={gameState !== 'playing'} aria-label="오른쪽 이동" onClick={() => moveHorizontal(1)}>→</button>
        <button className="tt-touch-btn tt-touch-drop" disabled={gameState !== 'playing'} aria-label="바로 떨어뜨리기" onClick={hardDrop}>⤓</button>
      </div>
      <div className="tt-instructions">← → 이동 · ↑ 회전 · Space 하드드롭</div>
    </div>
  )
}

export default Tetris
