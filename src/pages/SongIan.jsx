import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGameScale } from '../hooks/useGameScale'
import './SongIan.css'

const SIZE = 4
const BOARD_PX = 360
const GAP = 8
const CELL_PX = (BOARD_PX - GAP * (SIZE + 1)) / SIZE
const LAYOUT_W = BOARD_PX + 16
const LAYOUT_H = BOARD_PX + 140

const TILE_COLORS = {
  2:    { bg: '#eee4da', color: '#776e65', size: 36 },
  4:    { bg: '#ede0c8', color: '#776e65', size: 36 },
  8:    { bg: '#f2b179', color: '#f9f6f2', size: 36 },
  16:   { bg: '#f59563', color: '#f9f6f2', size: 34 },
  32:   { bg: '#f67c5f', color: '#f9f6f2', size: 34 },
  64:   { bg: '#f65e3b', color: '#f9f6f2', size: 34 },
  128:  { bg: '#edcf72', color: '#f9f6f2', size: 30 },
  256:  { bg: '#edcc61', color: '#f9f6f2', size: 30 },
  512:  { bg: '#edc850', color: '#f9f6f2', size: 28 },
  1024: { bg: '#edc53f', color: '#f9f6f2', size: 22 },
  2048: { bg: '#edc22e', color: '#f9f6f2', size: 22 },
}

function getStyle(val) {
  if (TILE_COLORS[val]) return TILE_COLORS[val]
  return { bg: '#3c3a32', color: '#f9f6f2', size: 20 }
}

function createEmpty() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0))
}

function getEmpty(grid) {
  const cells = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === 0) cells.push([r, c])
    }
  }
  return cells
}

function addRandom(grid) {
  const empty = getEmpty(grid)
  if (empty.length === 0) return grid
  const [r, c] = empty[Math.floor(Math.random() * empty.length)]
  const newGrid = grid.map((row) => [...row])
  newGrid[r][c] = Math.random() < 0.9 ? 2 : 4
  return { grid: newGrid, pos: [r, c] }
}

function slideRow(row) {
  const filtered = row.filter((v) => v !== 0)
  const result = []
  let score = 0
  const mergedIndices = []

  for (let i = 0; i < filtered.length; i++) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const merged = filtered[i] * 2
      result.push(merged)
      mergedIndices.push(result.length - 1)
      score += merged
      i++
    } else {
      result.push(filtered[i])
    }
  }

  while (result.length < SIZE) result.push(0)
  return { row: result, score, mergedIndices }
}

function moveGrid(grid, direction) {
  let totalScore = 0
  const newGrid = createEmpty()
  const mergedCells = []
  let moved = false

  if (direction === 'left' || direction === 'right') {
    for (let r = 0; r < SIZE; r++) {
      let row = [...grid[r]]
      if (direction === 'right') row.reverse()
      const { row: slid, score, mergedIndices } = slideRow(row)
      if (direction === 'right') slid.reverse()
      totalScore += score
      for (let c = 0; c < SIZE; c++) {
        newGrid[r][c] = slid[c]
        if (grid[r][c] !== slid[c]) moved = true
      }
      for (const mi of mergedIndices) {
        const actualC = direction === 'right' ? SIZE - 1 - mi : mi
        mergedCells.push([r, actualC])
      }
    }
  } else {
    for (let c = 0; c < SIZE; c++) {
      let col = []
      for (let r = 0; r < SIZE; r++) col.push(grid[r][c])
      if (direction === 'down') col.reverse()
      const { row: slid, score, mergedIndices } = slideRow(col)
      if (direction === 'down') slid.reverse()
      totalScore += score
      for (let r = 0; r < SIZE; r++) {
        newGrid[r][c] = slid[r]
        if (grid[r][c] !== slid[r]) moved = true
      }
      for (const mi of mergedIndices) {
        const actualR = direction === 'down' ? SIZE - 1 - mi : mi
        mergedCells.push([actualR, c])
      }
    }
  }

  return { grid: newGrid, score: totalScore, moved, mergedCells }
}

function canMove(grid) {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === 0) return true
      if (c + 1 < SIZE && grid[r][c] === grid[r][c + 1]) return true
      if (r + 1 < SIZE && grid[r][c] === grid[r + 1][c]) return true
    }
  }
  return false
}

function hasWon(grid) {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] >= 2048) return true
    }
  }
  return false
}

function SongIan() {
  const scale = useGameScale(LAYOUT_W, LAYOUT_H)

  const [grid, setGrid] = useState(createEmpty)
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => {
    try { return Number(localStorage.getItem('2048-best')) || 0 } catch { return 0 }
  })
  const [gameOver, setGameOver] = useState(false)
  const [won, setWon] = useState(false)
  const [keepPlaying, setKeepPlaying] = useState(false)
  const [newTile, setNewTile] = useState(null)
  const [mergedTiles, setMergedTiles] = useState([])
  const movingRef = useRef(false)

  const initGame = useCallback(() => {
    let g = createEmpty()
    const r1 = addRandom(g)
    g = r1.grid
    const r2 = addRandom(g)
    g = r2.grid
    setGrid(g)
    setScore(0)
    setGameOver(false)
    setWon(false)
    setKeepPlaying(false)
    setNewTile(r2.pos)
    setMergedTiles([])
  }, [])

  useEffect(() => {
    initGame()
  }, [initGame])

  const doMove = useCallback((direction) => {
    if (movingRef.current || gameOver || (won && !keepPlaying)) return
    movingRef.current = true

    setGrid((prev) => {
      const result = moveGrid(prev, direction)
      if (!result.moved) {
        movingRef.current = false
        return prev
      }

      const added = addRandom(result.grid)
      const newScore = score + result.score

      setScore(newScore)
      if (newScore > best) {
        setBest(newScore)
        try { localStorage.setItem('2048-best', String(newScore)) } catch { /* noop */ }
      }

      setMergedTiles(result.mergedCells)
      setNewTile(added.pos)

      if (!keepPlaying && hasWon(added.grid)) {
        setWon(true)
      } else if (!canMove(added.grid)) {
        setGameOver(true)
      }

      setTimeout(() => {
        movingRef.current = false
        setMergedTiles([])
      }, 150)

      return added.grid
    })
  }, [gameOver, won, keepPlaying, score, best])

  // keyboard
  useEffect(() => {
    const onKey = (e) => {
      const map = {
        ArrowLeft: 'left',
        ArrowRight: 'right',
        ArrowUp: 'up',
        ArrowDown: 'down',
      }
      if (map[e.key]) {
        e.preventDefault()
        doMove(map[e.key])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doMove])

  // swipe support
  useEffect(() => {
    let startX = 0, startY = 0
    const onStart = (e) => {
      const t = e.touches[0]
      startX = t.clientX
      startY = t.clientY
    }
    const onEnd = (e) => {
      const t = e.changedTouches[0]
      const dx = t.clientX - startX
      const dy = t.clientY - startY
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)
      if (Math.max(absDx, absDy) < 30) return
      if (absDx > absDy) {
        doMove(dx > 0 ? 'right' : 'left')
      } else {
        doMove(dy > 0 ? 'down' : 'up')
      }
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchend', onEnd)
    }
  }, [doMove])

  const isMerged = (r, c) => mergedTiles.some(([mr, mc]) => mr === r && mc === c)
  const isNew = (r, c) => newTile && newTile[0] === r && newTile[1] === c

  // build tiles
  const tiles = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const val = grid[r][c]
      if (val === 0) continue
      const style = getStyle(val)
      const left = c * (CELL_PX + GAP)
      const top = r * (CELL_PX + GAP)
      let className = 't48-tile'
      if (isNew(r, c)) className += ' t48-tile-new'
      else if (isMerged(r, c)) className += ' t48-tile-merged'

      tiles.push(
        <div
          key={`${r}-${c}`}
          className={className}
          style={{
            left,
            top,
            width: CELL_PX,
            height: CELL_PX,
            background: style.bg,
            color: style.color,
            fontSize: style.size,
          }}
        >
          {val}
        </div>
      )
    }
  }

  return (
    <div className="t48-container">
      <Link to="/" className="t48-back">← 홈으로</Link>

      <div className="t48-game-wrapper" style={{ width: LAYOUT_W * scale, height: LAYOUT_H * scale }}>
        <div style={{ width: LAYOUT_W, height: LAYOUT_H, transform: `scale(${scale})`, transformOrigin: 'top left', padding: '0 8px' }}>

          {/* header */}
          <div className="t48-header">
            <div className="t48-title">2048</div>
            <div className="t48-scores">
              <div className="t48-score-box">
                <div className="t48-score-label">점수</div>
                <div className="t48-score-value">{score}</div>
              </div>
              <div className="t48-score-box">
                <div className="t48-score-label">최고</div>
                <div className="t48-score-value">{best}</div>
              </div>
            </div>
          </div>

          {/* board */}
          <div
            className="t48-board"
            style={{
              width: BOARD_PX,
              height: BOARD_PX,
              gridTemplateColumns: `repeat(${SIZE}, ${CELL_PX}px)`,
              gridTemplateRows: `repeat(${SIZE}, ${CELL_PX}px)`,
            }}
          >
            {/* bg cells */}
            {Array.from({ length: SIZE * SIZE }, (_, i) => (
              <div key={i} className="t48-cell-bg" />
            ))}

            {/* tile layer */}
            <div className="t48-tile-layer">
              {tiles}
            </div>

            {/* game over overlay */}
            {gameOver && (
              <div className="t48-overlay">
                <div className="t48-overlay-box">
                  <h2>게임 오버</h2>
                  <p>점수: {score}</p>
                  <div className="overlay-btns">
                    <button onClick={initGame}>다시 시작</button>
                    <Link to="/" className="overlay-btn-home" style={{ color: '#776e65', borderColor: 'rgba(119,110,101,0.3)' }}>홈으로</Link>
                  </div>
                </div>
              </div>
            )}

            {/* win overlay */}
            {won && !keepPlaying && (
              <div className="t48-overlay t48-overlay-win">
                <div className="t48-overlay-box">
                  <h2>🎉 2048!</h2>
                  <p>점수: {score}</p>
                  <button onClick={() => setKeepPlaying(true)} style={{ marginRight: 8 }}>계속하기</button>
                  <button onClick={initGame}>새 게임</button>
                </div>
              </div>
            )}
          </div>

          {/* actions */}
          <div className="t48-actions">
            <button className="t48-btn" onClick={initGame}>새 게임</button>
            <Link to="/" className="t48-btn" style={{ textDecoration: 'none', textAlign: 'center' }}>홈으로</Link>
          </div>
        </div>
      </div>

      <div className="t48-instructions">방향키로 타일을 밀어 같은 숫자를 합치세요</div>
    </div>
  )
}

export default SongIan
