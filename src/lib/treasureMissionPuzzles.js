const PICTURES = [
  [[0,1,1,0],[1,1,1,1],[1,1,1,1],[0,1,1,0]],
  [[1,1,1,1],[1,0,0,0],[1,1,1,0],[1,0,0,0]],
  [[0,0,1,0,0],[0,1,1,1,0],[1,1,1,1,1],[0,1,0,1,0],[0,1,1,1,0]],
  [[0,0,1,0,0],[0,0,1,0,0],[1,1,1,1,1],[0,1,1,1,0],[0,0,1,0,0]],
  [[0,0,0,0],[0,1,1,0],[1,1,1,1],[0,1,1,0]],
  [[1,1,1,0,0],[1,0,1,0,0],[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0]],
]
export function lineClues(line) {
  const groups = []; let count = 0
  for (const value of [...line, 0]) { if (value === 1) count++; else if (count) { groups.push(count); count = 0 } }
  return groups.length ? groups : [0]
}
export function nonogramFor(variant) {
  const picture = PICTURES[variant % PICTURES.length], size = picture.length
  const solution = picture.flat()
  return { mode: 'nonogram', size, solution, rows: picture.map(lineClues), columns: Array.from({ length: size }, (_, column) => lineClues(picture.map((row) => row[column]))), question: '숫자 단서를 보고 숨겨진 그림을 복원해 주세요.', hint: '숫자는 이어서 칠할 칸 수예요. 1 1은 한 칸씩 두 묶음이며, 묶음 사이는 한 칸 이상 비워요.' }
}
export function nonogramValid(puzzle, cells) {
  if (cells.length !== puzzle.size ** 2) return false
  const same = (a, b) => a.join(',') === b.join(',')
  return puzzle.rows.every((clues, row) => same(clues, lineClues(cells.slice(row * puzzle.size, (row + 1) * puzzle.size)))) && puzzle.columns.every((clues, column) => same(clues, lineClues(Array.from({ length: puzzle.size }, (_, row) => cells[row * puzzle.size + column]))))
}
export function sudokuFor(seed, easy = false) {
  const orders = [[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]], digits = orders[seed % 6]
  const solution = Array.from({ length: 9 }, (_, index) => digits[(Math.floor(index / 3) + index % 3 + Math.floor(seed / 6)) % 3])
  const masks = [[0,1,3,5,7],[0,2,3,4,8],[1,2,4,6,8],[0,3,5,6,7]], visible = masks[Math.floor(seed / 3) % masks.length]
  const givens = solution.map((value, index) => visible.includes(index) || easy && index === 4 ? value : 0)
  return { mode: 'sudoku', size: 3, solution, givens, question: '빈칸에 1, 2, 3을 넣어 숫자 열쇠를 완성해 주세요.', hint: '가로줄과 세로줄에 1, 2, 3이 한 번씩만 들어가요. 작은 3×3 퍼즐에는 다른 구역 규칙이 없어요.' }
}
export function sudokuValid(puzzle, cells) {
  if (cells.length !== 9 || cells.some((value) => ![1,2,3].includes(value)) || puzzle.givens.some((value, i) => value && cells[i] !== value)) return false
  return [0,1,2].every((line) => new Set(cells.slice(line * 3, line * 3 + 3)).size === 3 && new Set([cells[line],cells[line + 3],cells[line + 6]]).size === 3)
}
