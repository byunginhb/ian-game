import { useRef, useState } from 'react'
import { lineClues, nonogramValid, sudokuValid } from '../lib/treasureMissionPuzzles'

export default function TreasureMissionGrid({ puzzle, onSolved }) {
  const nonogram = puzzle.mode === 'nonogram'
  const initial = () => nonogram ? Array(puzzle.size ** 2).fill(0) : [...puzzle.givens]
  const [cells, setCells] = useState(initial), [selected, setSelected] = useState(nonogram ? 0 : puzzle.givens.indexOf(0))
  const [feedback, setFeedback] = useState(''), [helped, setHelped] = useState(-1)
  const buttons = useRef([])
  const edit = (index, value) => { setCells((current) => current.map((cell, i) => i === index ? value : cell)); setFeedback(''); setHelped(-1) }
  const check = () => {
    if (nonogram ? nonogramValid(puzzle, cells) : sudokuValid(puzzle, cells)) onSolved()
    else setFeedback(nonogram ? '아직 단서와 맞지 않는 줄이 있어요. 왼쪽과 위쪽 숫자를 다시 비교해 보세요.' : cells.includes(0) ? '빈칸이 남아 있어요. 가로줄이나 세로줄에 없는 숫자를 찾아보세요.' : '같은 줄에 겹치는 숫자가 있어요. 주황색으로 표시된 칸을 살펴보세요.')
  }
  const help = () => {
    const index = cells.findIndex((value, i) => (nonogram ? Number(value === 1) : value) !== puzzle.solution[i])
    if (index < 0) { setFeedback('모두 완성했어요! 정답 확인을 눌러주세요.'); return }
    setCells((current) => current.map((value, i) => i === index ? nonogram ? puzzle.solution[i] || -1 : puzzle.solution[i] : value)); setHelped(index); setSelected(index)
    const row = Math.floor(index / puzzle.size) + 1, column = index % puzzle.size + 1
    setFeedback(nonogram ? `${row}행 ${column}열은 ${puzzle.solution[index] ? '칠하는' : '비워두는'} 칸이에요. 이 가로줄의 단서 ${puzzle.rows[row - 1].join(' · ')}와 비교해 보세요.` : `${row}행 ${column}열에는 ${puzzle.solution[index]}이 들어가요. 같은 가로줄과 세로줄에서 이 숫자가 겹치지 않는지 살펴보세요.`)
  }
  const keyboard = (event, index) => {
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -puzzle.size, ArrowDown: puzzle.size }
    if (event.key in moves) {
      event.preventDefault(); event.stopPropagation()
      const next = index + moves[event.key]
      if (next >= 0 && next < cells.length && (Math.abs(moves[event.key]) !== 1 || Math.floor(next / puzzle.size) === Math.floor(index / puzzle.size))) { setSelected(next); buttons.current[next]?.focus() }
    } else if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); check() }
    else if (!nonogram && ['1','2','3','Backspace','Delete'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); if (!puzzle.givens[index]) edit(index, Number(event.key) || 0) }
    else if (nonogram && ['x','X'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); edit(index, -1) }
  }
  const sameClues = (a, b) => a.join(',') === b.join(',')
  const conflict = (index) => !nonogram && cells[index] && cells.some((value, i) => i !== index && value === cells[index] && (Math.floor(i / 3) === Math.floor(index / 3) || i % 3 === index % 3))
  return <div className={`tk-mission-grid-puzzle tk-mission-${puzzle.mode}`}>
    <span className="tk-mission-puzzle-name">{nonogram ? `${puzzle.size}×${puzzle.size} 노노그램 · 그림 암호` : '3×3 미니 스도쿠 · 숫자 열쇠'}</span>
    <p>{puzzle.question}</p><p className="tk-grid-rule">{nonogram ? '왼쪽은 가로줄, 위쪽은 세로줄의 단서예요. 숫자만큼 이어서 칠해요. 0인 줄은 모두 비워요.' : '가로줄과 세로줄마다 1, 2, 3을 한 번씩 넣어요. 회색 숫자는 바꿀 수 없는 힌트예요.'}</p>
    {nonogram ? <>
      <div className="tk-nonogram-board" style={{ gridTemplateColumns: `46px repeat(${puzzle.size}, minmax(0, 1fr))` }} role="group" aria-label="노노그램 그림 암호">
        <div aria-hidden="true" className="tk-nonogram-corner">↓ →</div>
        {puzzle.columns.map((clues, column) => <div key={`column-${column}`} aria-label={`${column + 1}열 단서 ${clues.join(' ')}`} className={`tk-nonogram-column${sameClues(clues, lineClues(Array.from({ length: puzzle.size }, (_, row) => cells[row * puzzle.size + column]))) ? ' is-complete' : ''}`}>{clues.map((value, i) => <b key={i}>{value}</b>)}</div>)}
        {puzzle.rows.flatMap((clues, row) => [<div key={`row-${row}`} aria-label={`${row + 1}행 단서 ${clues.join(' ')}`} className={`tk-nonogram-row${sameClues(clues, lineClues(cells.slice(row * puzzle.size, row * puzzle.size + puzzle.size))) ? ' is-complete' : ''}`}>{clues.map((value, i) => <b key={i}>{value}</b>)}</div>, ...Array.from({ length: puzzle.size }, (_, column) => {
          const index = row * puzzle.size + column, value = cells[index]
          return <button data-game-keyboard-control ref={(element) => { buttons.current[index] = element }} key={index} aria-label={`${row + 1}행 ${column + 1}열 ${value === 1 ? '색칠함' : value === -1 ? '빈칸 표시' : '미표시'}`} aria-pressed={value === 1} className={`tk-picture-cell${value === 1 ? ' is-filled' : ''}${helped === index ? ' is-helped' : ''}`} onClick={() => edit(index, value === 0 ? 1 : value === 1 ? -1 : 0)} onContextMenu={(event) => { event.preventDefault(); edit(index, -1) }} onKeyDown={(event) => keyboard(event, index)}>{value === -1 ? '×' : value === 1 ? '◆' : ''}</button>
        })])}
      </div>
      <p className="tk-grid-instruction">칸을 누르면 색칠 → X 표시 → 지움 순서로 바뀌어요. X는 메모라서 모두 표시하지 않아도 돼요.</p>
    </> : <>
      <div className="tk-sudoku-board" role="group" aria-label="미니 스도쿠 숫자 열쇠">{cells.map((value, index) => <button data-game-keyboard-control ref={(element) => { buttons.current[index] = element }} key={index} aria-label={`${Math.floor(index / 3) + 1}행 ${index % 3 + 1}열${puzzle.givens[index] ? ` 고정 숫자 ${value}` : ` ${value || '빈칸'}`}`} aria-disabled={Boolean(puzzle.givens[index])} aria-pressed={!puzzle.givens[index] && selected === index} className={`${puzzle.givens[index] ? 'is-fixed' : ''}${conflict(index) ? ' has-conflict' : ''}${helped === index ? ' is-helped' : ''}`} onClick={() => { if (!puzzle.givens[index]) { setSelected(index); setFeedback('') } }} onKeyDown={(event) => keyboard(event, index)}>{value || '·'}</button>)}</div>
      <p className="tk-grid-instruction">빈칸을 고른 다음 숫자를 눌러주세요. PC에서는 숫자 키도 쓸 수 있어요.</p>
      <div className="tk-sudoku-keypad">{[1,2,3].map((value) => <button key={value} aria-label={`숫자 ${value} 입력`} disabled={Boolean(puzzle.givens[selected])} onClick={() => edit(selected, value)}>{value}</button>)}<button aria-label="선택한 숫자 지우기" disabled={Boolean(puzzle.givens[selected])} onClick={() => edit(selected, 0)}>지움</button></div>
    </>}
    {nonogram && <details className="tk-grid-example"><summary>숫자 읽는 방법</summary><p>3은 세 칸을 붙여 칠해요: ■■■<br />1 1은 한 칸씩 두 묶음이에요: ■ · ■<br />묶음 사이는 적어도 한 칸을 비워요.</p></details>}
    <p className="tk-puzzle-feedback" role="status">{feedback || '천천히 풀어도 괜찮아요. 막히면 한 칸 도움을 눌러보세요.'}</p>
    <div className="tk-grid-tools"><button className="tk-text-button" onClick={help}>한 칸 도움</button><button className="tk-text-button" onClick={() => { setCells(initial()); setSelected(nonogram ? 0 : puzzle.givens.indexOf(0)); setFeedback('처음 상태로 돌아왔어요. 다시 풀어보세요.'); setHelped(-1) }}>퍼즐 초기화</button><button className="tk-primary" onClick={check}>정답 확인</button></div>
  </div>
}
