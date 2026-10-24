import { useEffect, useRef, useState } from 'react'
import { circuitConnected, puzzleFor, rotateMask, routeValid } from '../lib/treasureKingdom'
import { gameClock } from '../lib/gameClock'

function CircuitTile({ mask }) {
  return <svg viewBox="0 0 70 70" aria-hidden="true"><rect x="3" y="3" width="64" height="64" rx="3" fill="#17272b" stroke="#526060" />{[[1, 35, 0], [2, 70, 35], [4, 35, 70], [8, 0, 35]].map(([bit, x, y]) => Boolean(mask & bit) && <path key={bit} d={`M35 35L${x} ${y}`} stroke="#d8b575" strokeWidth="7" fill="none" />)}<circle cx="35" cy="35" r="7" fill="#ead3a2" /><circle cx="35" cy="35" r="3" fill="#7b5e3b" /></svg>
}

export default function TreasurePuzzle({ item, onSolved }) {
  const [puzzle] = useState(() => puzzleFor(item))
  const [tiles, setTiles] = useState(() => puzzle.tiles?.map((tile) => rotateMask(tile.mask, tile.turns)) || [])
  const [selected, setSelected] = useState([])
  const [path, setPath] = useState([0])
  const [signal, setSignal] = useState([])
  const [playback, setPlayback] = useState(-1)
  const [feedback, setFeedback] = useState('')
  const [hint, setHint] = useState(false)
  const timers = useRef([])
  useEffect(() => () => timers.current.forEach(gameClock.clearTimeout), [])
  const playSignal = () => {
    timers.current.forEach(gameClock.clearTimeout); timers.current = []
    setSignal([]); setFeedback(''); setPlayback(puzzle.sequence[0])
    puzzle.sequence.forEach((symbol, index) => {
      timers.current.push(gameClock.setTimeout(() => setPlayback(symbol), index * 800))
      timers.current.push(gameClock.setTimeout(() => setPlayback(-2), index * 800 + 550))
    })
    timers.current.push(gameClock.setTimeout(() => setPlayback(-1), puzzle.sequence.length * 800))
  }
  const enterSignal = (symbol) => {
    if (playback !== -1) return
    const next = [...signal, symbol]
    if (puzzle.sequence[next.length - 1] !== symbol) { setSignal([]); setFeedback('신호가 일치하지 않는다. 관측 기록을 다시 재생할 수 있다.'); return }
    setSignal(next)
    if (next.length === puzzle.sequence.length) onSolved()
  }
  const check = () => {
    const success = puzzle.mode === 'circuit' ? circuitConnected(tiles) : puzzle.mode === 'balance' ? selected.reduce((sum, index) => sum + puzzle.weights[index], 0) === puzzle.target : routeValid(puzzle, path)
    if (success) onSolved()
    else setFeedback(puzzle.mode === 'circuit' ? '전력이 수신부에 도달하지 못했다. 회로의 방향을 확인하라.' : puzzle.mode === 'balance' ? '목표 출력과 일치하지 않는다. 부품 조합을 바꿔야 한다.' : '두 중계기를 모두 연결한 뒤 출구에 도달해야 한다.')
  }
  return <div className={`tk-puzzle tk-puzzle-${puzzle.mode}`}>
    <p className="tk-puzzle-objective">{puzzle.question}</p>
    {puzzle.mode === 'circuit' && <><div className="tk-circuit-labels"><span>전원: 왼쪽 위</span><span>수신부: 오른쪽 아래</span></div><div className="tk-circuit-grid">{tiles.map((mask, index) => <button key={index} className={index === 0 ? 'is-source' : index === 8 ? 'is-exit' : ''} aria-label={`회로 ${index + 1} 회전`} onClick={() => { setTiles((current) => current.map((value, cell) => cell === index ? rotateMask(value) : value)); setFeedback('') }}><CircuitTile mask={mask} />{[0, 8].includes(index) && <span className="tk-circuit-port">{index === 0 ? '전원' : '수신부'}</span>}</button>)}</div><p className="tk-puzzle-subtext">회로 조각을 눌러 90° 회전</p></>}
    {puzzle.mode === 'sequence' && <><button className="tk-signal-play" disabled={playback !== -1} onClick={playSignal}>{playback !== -1 ? '신호 수신 중…' : '관측 신호 재생'}</button><div className="tk-signal-buttons">{puzzle.symbols.map((symbol, index) => <button key={symbol} className={playback === index ? 'is-lit' : ''} disabled={playback !== -1} onClick={() => enterSignal(index)} aria-label={`문양 ${index + 1}`}>{symbol}</button>)}</div><div className="tk-signal-progress" aria-label={`신호 ${signal.length}/${puzzle.sequence.length} 입력`}>{puzzle.sequence.map((_, index) => <i key={index} className={signal.length > index ? 'is-lit' : ''} />)}</div></>}
    {puzzle.mode === 'balance' && <><div className="tk-power-display"><span>목표 출력<strong>{puzzle.target}</strong></span><span>현재 출력<strong>{selected.reduce((sum, index) => sum + puzzle.weights[index], 0)}</strong></span></div><div className="tk-weight-buttons">{puzzle.weights.map((weight, index) => <button key={index} aria-pressed={selected.includes(index)} onClick={() => { setSelected((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index]); setFeedback('') }}><span>동력 부품</span><strong>{weight}</strong></button>)}</div></>}
    {puzzle.mode === 'route' && <><div className="tk-route-grid">{Array.from({ length: 16 }, (_, cell) => <button key={cell} disabled={puzzle.blocked.includes(cell)} aria-label={`경로 ${cell + 1}${puzzle.relays.includes(cell) ? ' 중계기' : ''}`} aria-pressed={path.includes(cell)} onClick={() => {
      if (cell === path.at(-1)) { if (path.length > 1) setPath(path.slice(0, -1)); return }
      if (path.includes(cell)) { setPath(path.slice(0, path.indexOf(cell) + 1)); return }
      const previous = path.at(-1)
      if (Math.abs(cell % 4 - previous % 4) + Math.abs(Math.floor(cell / 4) - Math.floor(previous / 4)) === 1) { setPath([...path, cell]); setFeedback('') }
      else setFeedback('연결된 칸을 선택해야 한다.')
    }}>{cell === 0 ? '시작' : cell === 15 ? '출구' : puzzle.blocked.includes(cell) ? '×' : puzzle.relays.includes(cell) ? '◇' : path.includes(cell) ? path.indexOf(cell) : '·'}</button>)}</div><button className="tk-text-button" onClick={() => { setPath([0]); setFeedback('') }}>경로 초기화</button></>}
    <p className="tk-puzzle-feedback" role="status">{feedback || (hint ? puzzle.hint : '장치에 남은 단서를 읽고 연결 방법을 찾아라.')}</p>
    <div className="tk-puzzle-footer"><button className="tk-text-button" onClick={() => setHint(!hint)}>{hint ? '단서 접기' : '단서 확인'}</button>{puzzle.mode !== 'sequence' && <button className="tk-primary" onClick={check}>장치 가동</button>}</div>
  </div>
}
