import { useState, useCallback, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGameScale } from '../hooks/useGameScale'
import { useTouchLock } from '../hooks/useTouchLock'
import './CodeAdventure.css'

const GAME_W = 400
const GAME_H = 650

const DIR = {
  up: { dx: 0, dy: -1, emoji: '⬆️', label: '위' },
  down: { dx: 0, dy: 1, emoji: '⬇️', label: '아래' },
  left: { dx: -1, dy: 0, emoji: '⬅️', label: '왼쪽' },
  right: { dx: 1, dy: 0, emoji: '➡️', label: '오른쪽' },
}

const CELL_EMPTY = 0
const CELL_WALL = 1
const CELL_STAR = 2
const CELL_GEM = 3

const LEVELS = [
  // === 1~5: 튜토리얼 (3x3, 4x4) ===
  {
    name: '한 칸 이동',
    hint: '오른쪽 버튼을 한 번 눌러보세요!',
    cols: 3, rows: 3,
    start: { x: 0, y: 1 },
    grid: [
      [0, 0, 0],
      [0, 2, 0],
      [0, 0, 0],
    ],
    maxCommands: 2,
  },
  {
    name: '두 칸 이동',
    hint: '오른쪽으로 두 번!',
    cols: 3, rows: 3,
    start: { x: 0, y: 1 },
    grid: [
      [0, 0, 0],
      [0, 0, 2],
      [0, 0, 0],
    ],
    maxCommands: 3,
  },
  {
    name: '위로 가자',
    hint: '위쪽 버튼을 눌러보세요!',
    cols: 3, rows: 3,
    start: { x: 1, y: 2 },
    grid: [
      [0, 2, 0],
      [0, 0, 0],
      [0, 0, 0],
    ],
    maxCommands: 3,
  },
  {
    name: '꺾어 가기',
    hint: '오른쪽으로 간 다음 위로!',
    cols: 3, rows: 3,
    start: { x: 0, y: 2 },
    grid: [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 2],
    ],
    maxCommands: 4,
  },
  {
    name: 'ㄱ자 길',
    hint: '위로 간 다음 오른쪽으로!',
    cols: 4, rows: 4,
    start: { x: 0, y: 3 },
    grid: [
      [0, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    maxCommands: 7,
  },
  // === 6~10: 벽 등장 (4x4) ===
  {
    name: '첫 번째 벽',
    hint: '벽을 피해서 가세요!',
    cols: 4, rows: 4,
    start: { x: 0, y: 1 },
    grid: [
      [0, 0, 0, 0],
      [0, 0, 1, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    maxCommands: 6,
  },
  {
    name: '벽 돌아가기',
    hint: '벽 아래로 돌아가세요!',
    cols: 4, rows: 4,
    start: { x: 0, y: 0 },
    grid: [
      [0, 0, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 2],
    ],
    maxCommands: 8,
  },
  {
    name: '좁은 통로',
    hint: '벽 사이로 지나가세요!',
    cols: 4, rows: 4,
    start: { x: 0, y: 0 },
    grid: [
      [0, 0, 0, 0],
      [1, 1, 0, 1],
      [0, 0, 0, 0],
      [2, 0, 0, 0],
    ],
    maxCommands: 8,
  },
  {
    name: '지그재그',
    hint: '벽 사이를 지그재그로!',
    cols: 4, rows: 4,
    start: { x: 0, y: 0 },
    grid: [
      [0, 0, 0, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 1, 1, 2],
    ],
    maxCommands: 8,
  },
  {
    name: 'ㄴ자 미로',
    hint: '벽을 따라 길을 찾으세요!',
    cols: 4, rows: 4,
    start: { x: 0, y: 0 },
    grid: [
      [0, 1, 0, 0],
      [0, 1, 0, 1],
      [0, 0, 0, 1],
      [0, 0, 0, 2],
    ],
    maxCommands: 8,
  },
  // === 11~15: 보석 등장 (4x4, 5x5) ===
  {
    name: '첫 보석',
    hint: '보석을 모으고 별로 가세요!',
    cols: 4, rows: 4,
    start: { x: 0, y: 1 },
    grid: [
      [0, 0, 0, 0],
      [0, 0, 3, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    maxCommands: 5,
  },
  {
    name: '보석 두 개',
    hint: '보석을 다 모아보세요!',
    cols: 4, rows: 4,
    start: { x: 0, y: 3 },
    grid: [
      [0, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 3, 0, 0],
      [0, 0, 0, 3],
    ],
    maxCommands: 10,
  },
  {
    name: '보석과 벽',
    hint: '벽을 피하면서 보석을 모으세요!',
    cols: 5, rows: 5,
    start: { x: 0, y: 2 },
    grid: [
      [0, 0, 0, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 1, 0, 2],
      [0, 3, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ],
    maxCommands: 10,
  },
  {
    name: '보석 사냥꾼',
    hint: '보석을 모으고 별까지!',
    cols: 5, rows: 5,
    start: { x: 0, y: 4 },
    grid: [
      [0, 0, 0, 0, 2],
      [0, 1, 0, 1, 0],
      [0, 0, 3, 0, 0],
      [0, 1, 0, 1, 0],
      [0, 0, 0, 0, 0],
    ],
    maxCommands: 10,
  },
  {
    name: '보석 삼총사',
    hint: '보석 세 개를 다 모으세요!',
    cols: 5, rows: 5,
    start: { x: 2, y: 4 },
    grid: [
      [0, 0, 2, 0, 0],
      [0, 3, 0, 3, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 3, 0, 0],
      [0, 0, 0, 0, 0],
    ],
    maxCommands: 12,
  },
  // === 16~20: 5x5 미로 ===
  {
    name: '방향 전환',
    hint: '여러 방향을 써보세요!',
    cols: 5, rows: 5,
    start: { x: 0, y: 4 },
    grid: [
      [0, 0, 0, 0, 0],
      [0, 0, 2, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ],
    maxCommands: 6,
  },
  {
    name: '벽 미로',
    hint: '벽을 피해서 별까지!',
    cols: 5, rows: 5,
    start: { x: 0, y: 0 },
    grid: [
      [0, 0, 1, 0, 0],
      [1, 0, 1, 0, 0],
      [0, 0, 0, 0, 1],
      [0, 1, 1, 0, 0],
      [0, 0, 0, 0, 2],
    ],
    maxCommands: 10,
  },
  {
    name: 'S자 길',
    hint: '구불구불 길을 따라가세요!',
    cols: 5, rows: 5,
    start: { x: 0, y: 0 },
    grid: [
      [0, 0, 0, 0, 0],
      [1, 1, 1, 1, 0],
      [0, 0, 0, 0, 0],
      [0, 1, 1, 1, 1],
      [0, 0, 0, 0, 2],
    ],
    maxCommands: 12,
  },
  {
    name: '미로 탈출',
    hint: '출구를 찾으세요!',
    cols: 5, rows: 5,
    start: { x: 0, y: 0 },
    grid: [
      [0, 1, 0, 0, 0],
      [0, 0, 0, 1, 0],
      [1, 1, 0, 1, 0],
      [0, 0, 0, 0, 0],
      [0, 1, 1, 0, 2],
    ],
    maxCommands: 10,
  },
  {
    name: '보석 미로',
    hint: '보석도 모으면서 가세요!',
    cols: 5, rows: 5,
    start: { x: 0, y: 0 },
    grid: [
      [0, 0, 1, 0, 0],
      [0, 0, 1, 3, 0],
      [3, 0, 0, 0, 0],
      [0, 1, 1, 0, 1],
      [0, 0, 0, 0, 2],
    ],
    maxCommands: 12,
  },
  // === 21~25: 6x6 고급 ===
  {
    name: 'ㄹ자 길',
    hint: '구불구불 길을 따라가세요!',
    cols: 6, rows: 6,
    start: { x: 0, y: 0 },
    grid: [
      [0, 0, 0, 0, 0, 0],
      [1, 1, 1, 1, 1, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 1, 1, 1, 1, 1],
      [0, 0, 0, 0, 0, 0],
      [1, 1, 1, 1, 1, 2],
    ],
    maxCommands: 14,
  },
  {
    name: '보석 대탐험',
    hint: '보석도 모으면서 가세요!',
    cols: 6, rows: 6,
    start: { x: 0, y: 0 },
    grid: [
      [0, 0, 1, 0, 0, 0],
      [0, 0, 1, 0, 1, 0],
      [0, 3, 0, 0, 1, 0],
      [1, 1, 0, 1, 0, 0],
      [0, 0, 0, 1, 3, 0],
      [0, 1, 0, 0, 0, 2],
    ],
    maxCommands: 14,
  },
  {
    name: '이중 미로',
    hint: '길이 두 갈래! 잘 골라가세요!',
    cols: 6, rows: 6,
    start: { x: 0, y: 0 },
    grid: [
      [0, 0, 0, 1, 0, 0],
      [1, 1, 0, 1, 0, 1],
      [0, 0, 0, 0, 0, 0],
      [0, 1, 0, 1, 1, 0],
      [0, 1, 0, 0, 0, 0],
      [0, 0, 0, 1, 0, 2],
    ],
    maxCommands: 14,
  },
  {
    name: '보석 회전',
    hint: '가운데 보석을 모아가세요!',
    cols: 6, rows: 6,
    start: { x: 0, y: 5 },
    grid: [
      [0, 0, 0, 0, 0, 2],
      [0, 1, 1, 1, 0, 0],
      [0, 1, 3, 0, 0, 1],
      [0, 0, 0, 3, 1, 0],
      [1, 0, 1, 0, 0, 0],
      [0, 0, 0, 0, 1, 0],
    ],
    maxCommands: 16,
  },
  {
    name: '보석 고수',
    hint: '보석을 전부 모아보세요!',
    cols: 6, rows: 6,
    start: { x: 0, y: 0 },
    grid: [
      [0, 0, 0, 1, 3, 0],
      [0, 1, 0, 0, 0, 0],
      [0, 1, 3, 1, 1, 0],
      [0, 0, 0, 0, 0, 0],
      [1, 1, 0, 1, 0, 1],
      [3, 0, 0, 0, 0, 2],
    ],
    maxCommands: 16,
  },
  // === 26~30: 7x7 최상급 ===
  {
    name: '대미로',
    hint: '끝까지 길을 찾아보세요!',
    cols: 7, rows: 7,
    start: { x: 0, y: 0 },
    grid: [
      [0, 0, 1, 0, 0, 0, 0],
      [1, 0, 1, 0, 1, 1, 0],
      [0, 0, 0, 0, 0, 1, 0],
      [0, 1, 1, 1, 0, 0, 0],
      [0, 0, 0, 1, 0, 1, 0],
      [1, 1, 0, 0, 0, 1, 0],
      [0, 0, 0, 1, 0, 0, 2],
    ],
    maxCommands: 16,
  },
  {
    name: '보석 대미로',
    hint: '보석도 챙기면서 탈출!',
    cols: 7, rows: 7,
    start: { x: 0, y: 0 },
    grid: [
      [0, 0, 1, 0, 0, 0, 0],
      [1, 0, 1, 0, 1, 1, 0],
      [0, 0, 0, 0, 0, 1, 0],
      [0, 1, 1, 1, 0, 0, 0],
      [0, 0, 0, 1, 0, 1, 3],
      [1, 1, 0, 0, 0, 1, 0],
      [0, 0, 0, 1, 0, 0, 2],
    ],
    maxCommands: 18,
  },
  {
    name: '미로의 왕',
    hint: '가장 긴 미로에 도전!',
    cols: 7, rows: 7,
    start: { x: 0, y: 6 },
    grid: [
      [0, 0, 0, 0, 0, 0, 2],
      [0, 1, 1, 1, 1, 0, 1],
      [0, 0, 0, 0, 0, 0, 0],
      [1, 0, 1, 1, 1, 1, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 1, 1, 0, 1],
      [0, 0, 0, 0, 0, 0, 0],
    ],
    maxCommands: 20,
  },
  {
    name: '보석 왕',
    hint: '보석을 다 모으고 별로!',
    cols: 7, rows: 7,
    start: { x: 3, y: 3 },
    grid: [
      [0, 0, 0, 1, 0, 0, 0],
      [0, 3, 0, 1, 0, 3, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [1, 1, 0, 0, 0, 1, 1],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 3, 0, 1, 0, 3, 0],
      [0, 0, 0, 1, 0, 0, 2],
    ],
    maxCommands: 20,
  },
  {
    name: '코딩 마스터',
    hint: '최종 레벨! 모든 보석과 별!',
    cols: 7, rows: 7,
    start: { x: 0, y: 6 },
    grid: [
      [3, 0, 1, 0, 0, 3, 2],
      [0, 0, 1, 0, 1, 0, 0],
      [0, 1, 0, 0, 1, 0, 1],
      [0, 1, 0, 1, 0, 0, 0],
      [0, 0, 0, 1, 0, 1, 0],
      [1, 0, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, 1, 3, 0],
    ],
    maxCommands: 22,
  },
]

function getGemCount(grid) {
  let count = 0
  for (const row of grid) {
    for (const cell of row) {
      if (cell === CELL_GEM) count++
    }
  }
  return count
}

function calculateStars(gemCount, gemsCollected, commandCount, maxCommands) {
  if (gemCount > 0 && gemsCollected >= gemCount) return 3
  if (commandCount <= Math.ceil(maxCommands * 0.6)) return 2
  return 1
}

function CodeAdventure() {
  const scale = useGameScale(GAME_W, GAME_H)
  const containerRef = useRef(null)
  useTouchLock(containerRef)

  const [gameState, setGameState] = useState('menu')
  const [levelIdx, setLevelIdx] = useState(0)
  const [commands, setCommands] = useState([])
  const [playerPos, setPlayerPos] = useState({ x: 0, y: 0 })
  const [executing, setExecuting] = useState(false)
  const [execStep, setExecStep] = useState(-1)
  const [collectedGems, setCollectedGems] = useState(new Set())
  const [result, setResult] = useState(null)
  const [earnedStars, setEarnedStars] = useState(0)
  const [totalStars, setTotalStars] = useState(0)
  const [shakeCell, setShakeCell] = useState(null)
  const [clearedLevels, setClearedLevels] = useState(() => {
    try {
      const saved = localStorage.getItem('code-adventure-cleared')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  })

  const execTimerRef = useRef(null)
  const playerPosRef = useRef({ x: 0, y: 0 })
  const collectedGemsRef = useRef(new Set())
  const level = LEVELS[levelIdx]

  useEffect(() => {
    playerPosRef.current = playerPos
  }, [playerPos])

  useEffect(() => {
    collectedGemsRef.current = collectedGems
  }, [collectedGems])

  useEffect(() => {
    setCommands([])
    setPlayerPos({ ...LEVELS[levelIdx].start })
    setExecuting(false)
    setExecStep(-1)
    setCollectedGems(new Set())
    setResult(null)
    setShakeCell(null)
    setEarnedStars(0)
  }, [levelIdx])

  const startGame = useCallback(() => {
    setGameState('playing')
    setLevelIdx(0)
    setTotalStars(0)
  }, [])

  const startFromLevel = useCallback((idx) => {
    setGameState('playing')
    setLevelIdx(idx)
    setTotalStars(0)
  }, [])

  const addCommand = useCallback((dir) => {
    if (executing || result) return
    setCommands(prev => {
      if (prev.length >= level.maxCommands) return prev
      return [...prev, dir]
    })
  }, [executing, result, level])

  const removeLastCommand = useCallback(() => {
    if (executing || result) return
    setCommands(prev => prev.slice(0, -1))
  }, [executing, result])

  const clearCommands = useCallback(() => {
    if (executing) return
    setCommands([])
    setPlayerPos({ ...level.start })
    setCollectedGems(new Set())
    setResult(null)
    setShakeCell(null)
    setEarnedStars(0)
  }, [executing, level])

  const executeCommands = useCallback(() => {
    if (commands.length === 0 || executing) return
    setExecuting(true)
    setExecStep(0)
    setPlayerPos({ ...level.start })
    setCollectedGems(new Set())
    setResult(null)
    setShakeCell(null)
    setEarnedStars(0)
  }, [commands, executing, level])

  useEffect(() => {
    if (!executing || execStep < 0) return

    if (execStep >= commands.length) {
      setExecuting(false)
      setResult('fail')
      return
    }

    execTimerRef.current = setTimeout(() => {
      const dir = DIR[commands[execStep]]
      const prev = playerPosRef.current
      const nx = prev.x + dir.dx
      const ny = prev.y + dir.dy

      if (nx < 0 || nx >= level.cols || ny < 0 || ny >= level.rows) {
        setExecuting(false)
        setResult('crash')
        setShakeCell({ x: prev.x, y: prev.y })
        return
      }

      if (level.grid[ny][nx] === CELL_WALL) {
        setExecuting(false)
        setResult('crash')
        setShakeCell({ x: nx, y: ny })
        return
      }

      const newPos = { x: nx, y: ny }
      setPlayerPos(newPos)

      if (level.grid[ny][nx] === CELL_GEM) {
        const gemKey = `${nx},${ny}`
        setCollectedGems(prev2 => {
          const next = new Set(prev2)
          next.add(gemKey)
          return next
        })
      }

      if (level.grid[ny][nx] === CELL_STAR) {
        setExecuting(false)
        setResult('success')

        const gemCount = getGemCount(level.grid)
        const gemsCollected = collectedGemsRef.current.size
        const stars = calculateStars(gemCount, gemsCollected, commands.length, level.maxCommands)
        setEarnedStars(stars)
        setTotalStars(t => t + stars)

        setClearedLevels(prev2 => {
          const next = new Set(prev2)
          next.add(levelIdx)
          try {
            localStorage.setItem('code-adventure-cleared', JSON.stringify([...next]))
          } catch { /* noop */ }
          return next
        })
        return
      }

      setExecStep(s => s + 1)
    }, 400)

    return () => clearTimeout(execTimerRef.current)
  }, [executing, execStep, commands, level, levelIdx])

  const nextLevel = useCallback(() => {
    if (levelIdx < LEVELS.length - 1) {
      setLevelIdx(i => i + 1)
    } else {
      setGameState('complete')
    }
  }, [levelIdx])

  useEffect(() => {
    const handleKey = (e) => {
      if (gameState !== 'playing') return
      if (executing) return

      switch (e.key) {
        case 'ArrowUp': e.preventDefault(); addCommand('up'); break
        case 'ArrowDown': e.preventDefault(); addCommand('down'); break
        case 'ArrowLeft': e.preventDefault(); addCommand('left'); break
        case 'ArrowRight': e.preventDefault(); addCommand('right'); break
        case 'Enter': e.preventDefault(); result ? (result === 'success' ? nextLevel() : clearCommands()) : executeCommands(); break
        case 'Backspace': e.preventDefault(); removeLastCommand(); break
        case 'Escape': e.preventDefault(); clearCommands(); break
        default: break
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [gameState, executing, addCommand, removeLastCommand, clearCommands, executeCommands, result, nextLevel])

  const cellSize = Math.min(
    Math.floor((GAME_W - 40) / level.cols),
    Math.floor(280 / level.rows)
  )
  const gridW = cellSize * level.cols
  const gridH = cellSize * level.rows

  const renderGrid = () => (
    <div
      className="ca-grid"
      style={{ width: gridW, height: gridH }}
    >
      {level.grid.map((row, y) =>
        row.map((cell, x) => {
          const isPlayer = playerPos.x === x && playerPos.y === y
          const isGemCollected = collectedGems.has(`${x},${y}`)
          const isShake = shakeCell && shakeCell.x === x && shakeCell.y === y

          return (
            <div
              key={`${x}-${y}`}
              className={[
                'ca-cell',
                cell === CELL_WALL ? 'ca-cell-wall' : '',
                isShake ? 'ca-cell-shake' : '',
              ].join(' ')}
              style={{
                width: cellSize,
                height: cellSize,
                left: x * cellSize,
                top: y * cellSize,
              }}
            >
              {cell === CELL_STAR && !isPlayer && (
                <span className="ca-cell-icon ca-star">⭐</span>
              )}
              {cell === CELL_GEM && !isGemCollected && (
                <span className="ca-cell-icon ca-gem">💎</span>
              )}
              {cell === CELL_WALL && (
                <span className="ca-cell-icon">🧱</span>
              )}
              {isPlayer && (
                <span className={`ca-player ${result === 'success' ? 'ca-player-win' : ''} ${result === 'crash' ? 'ca-player-crash' : ''}`}>
                  🐱
                </span>
              )}
            </div>
          )
        })
      )}
    </div>
  )

  const renderCommands = () => (
    <div className="ca-commands-area">
      <div className="ca-commands-label">
        명령어 ({commands.length}/{level.maxCommands})
      </div>
      <div className="ca-commands-list">
        {commands.length === 0 && (
          <span className="ca-commands-empty">방향 버튼을 눌러 명령을 추가하세요</span>
        )}
        {commands.map((cmd, i) => (
          <span
            key={i}
            className={`ca-command-item ${executing && i === execStep ? 'ca-command-active' : ''} ${executing && i < execStep ? 'ca-command-done' : ''}`}
          >
            {DIR[cmd].emoji}
          </span>
        ))}
      </div>
    </div>
  )

  const renderControls = () => (
    <div className="ca-controls">
      <div className="ca-dir-pad">
        <button className="ca-dir-btn ca-dir-up" onClick={() => addCommand('up')} disabled={executing || !!result}>⬆️</button>
        <div className="ca-dir-mid">
          <button className="ca-dir-btn ca-dir-left" onClick={() => addCommand('left')} disabled={executing || !!result}>⬅️</button>
          <button className="ca-dir-btn ca-dir-right" onClick={() => addCommand('right')} disabled={executing || !!result}>➡️</button>
        </div>
        <button className="ca-dir-btn ca-dir-down" onClick={() => addCommand('down')} disabled={executing || !!result}>⬇️</button>
      </div>
      <div className="ca-action-btns">
        <button className="ca-run-btn" onClick={executeCommands} disabled={executing || commands.length === 0 || !!result}>
          ▶️ 실행하기
        </button>
        <div className="ca-sub-btns">
          <button className="ca-action-btn ca-btn-undo" onClick={removeLastCommand} disabled={executing || commands.length === 0 || !!result}>
            ↩️ 되돌리기
          </button>
          <button className="ca-action-btn ca-btn-clear" onClick={clearCommands} disabled={executing}>
            🗑️ 지우기
          </button>
        </div>
      </div>
    </div>
  )

  const renderResultOverlay = () => {
    if (!result) return null

    if (result === 'success') {
      return (
        <div className="ca-overlay ca-overlay-success">
          <div className="ca-overlay-content">
            <span className="ca-overlay-emoji">🎉</span>
            <h2>레벨 클리어!</h2>
            <p>{level.name} 완료!</p>
            <div className="ca-stars-display">
              {[1, 2, 3].map(i => (
                <span key={i} className={`ca-star-icon ${i <= earnedStars ? 'ca-star-earned' : ''}`}>
                  ⭐
                </span>
              ))}
            </div>
            <button className="ca-overlay-btn" onClick={nextLevel}>
              {levelIdx < LEVELS.length - 1 ? '다음 레벨 →' : '🏆 완료!'}
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="ca-overlay ca-overlay-fail">
        <div className="ca-overlay-content">
          <span className="ca-overlay-emoji">{result === 'crash' ? '💥' : '🤔'}</span>
          <h2>{result === 'crash' ? '부딪혔어요!' : '별에 도착 못했어요!'}</h2>
          <p>다시 시도해보세요!</p>
          <button className="ca-overlay-btn" onClick={clearCommands}>
            다시 도전 🔄
          </button>
        </div>
      </div>
    )
  }

  if (gameState === 'menu') {
    return (
      <div ref={containerRef} className="ca-container">
        <Link to="/" className="ca-back-button">← 홈으로</Link>
        <div className="ca-wrapper" style={{ width: GAME_W * scale, height: GAME_H * scale }}>
          <div className="ca-area" style={{ width: GAME_W, height: GAME_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            <div className="ca-menu">
              <span className="ca-menu-emoji">🐱</span>
              <h1 className="ca-menu-title">코딩 어드벤처</h1>
              <p className="ca-menu-desc">
                명령어를 만들어서<br />고양이를 별까지 데려가세요!
              </p>
              <div className="ca-menu-features">
                <div className="ca-feature">🧩 30개 레벨</div>
                <div className="ca-feature">💎 보석 수집</div>
                <div className="ca-feature">🧠 코딩 사고력</div>
              </div>
              <button className="ca-menu-start" onClick={startGame}>
                시작하기 🚀
              </button>
              {clearedLevels.size > 0 && (() => {
                const maxUnlocked = Math.max(...clearedLevels) + 1
                return (
                  <div className="ca-level-select">
                    <p className="ca-level-select-title">레벨 선택</p>
                    <div className="ca-level-btns">
                      {LEVELS.map((lv, i) => (
                        <button
                          key={i}
                          className={`ca-level-btn ${clearedLevels.has(i) ? 'ca-level-cleared' : ''} ${i > maxUnlocked ? 'ca-level-locked' : ''}`}
                          onClick={() => startFromLevel(i)}
                          disabled={i > maxUnlocked}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (gameState === 'complete') {
    return (
      <div ref={containerRef} className="ca-container">
        <Link to="/" className="ca-back-button">← 홈으로</Link>
        <div className="ca-wrapper" style={{ width: GAME_W * scale, height: GAME_H * scale }}>
          <div className="ca-area" style={{ width: GAME_W, height: GAME_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            <div className="ca-menu ca-complete">
              <span className="ca-menu-emoji">🏆</span>
              <h1 className="ca-menu-title">축하해요!</h1>
              <p className="ca-menu-desc">
                모든 레벨을 클리어했어요!<br />
                당신은 코딩 마스터!
              </p>
              <div className="ca-total-stars">
                총 ⭐ {totalStars}개
              </div>
              <button className="ca-menu-start" onClick={startGame}>
                다시 도전 🔄
              </button>
              <button className="ca-menu-start ca-menu-home" onClick={() => setGameState('menu')}>
                메뉴로
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="ca-container">
      <Link to="/" className="ca-back-button">← 홈으로</Link>
      <div className="ca-wrapper" style={{ width: GAME_W * scale, height: GAME_H * scale }}>
        <div className="ca-area" style={{ width: GAME_W, height: GAME_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <div className="ca-hud">
            <span className="ca-level-label">Lv.{levelIdx + 1}</span>
            <span className="ca-level-name">{level.name}</span>
            <button className="ca-menu-btn" onClick={() => setGameState('menu')}>☰</button>
          </div>
          <div className="ca-hint">{level.hint}</div>
          <div className="ca-grid-wrapper">
            {renderGrid()}
          </div>
          {renderCommands()}
          {renderControls()}
          {renderResultOverlay()}
        </div>
      </div>
      <div className="ca-instructions">
        방향키로 명령 추가 · Enter로 실행 · Backspace로 되돌리기
      </div>
    </div>
  )
}

export default CodeAdventure
