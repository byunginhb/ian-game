// 빛 꺾기 실험실 레벨 생성기. `node scripts/generate-light-lab-levels.mjs`로 src/lib/lightLabLevels.js를 다시 만든다.
// 정답 배치를 먼저 만들고 → 수정을 빛길 위에 놓고 → 거울을 치운 뒤, 풀이기로 "최소 거울 수와 해가 의도대로인지" 걸러 낸다.
import { writeFileSync } from 'node:fs'
import { DIRS, emptyBoard, evaluate, serializeRows, trace } from '../src/lib/lightLab.js'
import { solve } from '../src/lib/lightLabSolver.js'

function mulberry32(seed) {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

// [가로, 세로, 광원 색들, 필요한 거울 수, 수정 수, 바위 수, 색유리 색들, 프리즘 수, 고정 거울 수, 섞인 색 수정 최소 개수]
const SPECS = [
  [4, 4, [7], 1, 1, 0, [], 0, 0, 0], [5, 4, [7], 1, 2, 1, [], 0, 0, 0], [5, 5, [7], 2, 1, 2, [], 0, 0, 0],
  [5, 5, [7], 2, 2, 3, [], 0, 0, 0], [6, 5, [7], 3, 2, 3, [], 0, 1, 0], [6, 6, [7], 3, 3, 4, [], 0, 1, 0],
  [5, 5, [1, 2], 1, 1, 1, [], 0, 0, 1], [5, 5, [1, 2], 2, 2, 2, [], 0, 0, 1], [6, 5, [1, 2, 4], 2, 2, 2, [], 0, 0, 1],
  [6, 6, [1, 2, 4], 3, 3, 3, [], 0, 0, 2], [6, 6, [7, 7], 2, 2, 2, [1, 2], 0, 0, 1], [6, 6, [7, 1], 3, 3, 3, [4], 0, 0, 1],
  [5, 5, [7], 1, 2, 1, [], 1, 0, 0], [6, 5, [7], 2, 2, 2, [], 1, 0, 0], [6, 6, [7], 3, 3, 3, [], 1, 0, 1],
  [6, 6, [7], 3, 3, 2, [3], 1, 0, 1], [7, 6, [7, 2], 3, 3, 3, [], 1, 0, 1], [7, 6, [7], 4, 3, 3, [], 1, 1, 1],
  [7, 6, [7, 1], 3, 3, 3, [6], 1, 0, 1], [7, 6, [7, 4], 3, 4, 3, [], 1, 1, 1], [7, 7, [7, 2], 4, 3, 4, [5], 1, 0, 2],
  [7, 7, [7, 1], 4, 4, 4, [], 1, 1, 2], [7, 7, [7, 4], 4, 4, 4, [3], 1, 1, 2], [7, 7, [7, 7], 4, 4, 4, [3], 1, 1, 2],
]
const CHAPTER_OF = (index) => Math.floor(index / 6)
const bits = (value) => (value & 1) + ((value >> 1) & 1) + ((value >> 2) & 1)

function candidate(spec, rng) {
  const [w, h, sources, k, crystalCount, rocks, filters, prisms, fixed, mixed] = spec
  const cells = Array.from({ length: w * h }, () => ({ type: 'empty' }))
  const pick = (test) => { for (let tries = 0; tries < 60; tries++) { const i = Math.floor(rng() * w * h); if (cells[i].type === 'empty' && test(i % w, Math.floor(i / w))) return i } return -1 }
  const inner = (x, y) => x > 0 && y > 0 && x < w - 1 && y < h - 1
  for (const color of sources) {
    // 광원은 가장자리에 두고 판 안쪽을 향하게 한다.
    const i = pick((x, y) => !inner(x, y))
    if (i < 0) return null
    const x = i % w, y = Math.floor(i / w)
    const options = [0, 1, 2, 3].filter((d) => { const nx = x + DIRS[d][0] * 2, ny = y + DIRS[d][1] * 2; return nx >= 0 && ny >= 0 && nx < w && ny < h })
    cells[i] = { type: 'source', dir: options[Math.floor(rng() * options.length)], color }
  }
  for (let n = 0; n < rocks; n++) { const i = pick(() => true); if (i < 0) return null; cells[i] = { type: 'rock' } }
  const level = { id: 0, w, h, cells, marble: -1, mirrors: k + 1, par: k, solution: [] }

  // 프리즘 → (색유리·고정 거울·정답 거울을 섞어서) 순서로, 항상 지금 빛이 지나가는 칸에 놓는다.
  // 그래야 모든 장치가 정답에서 실제로 쓰인다.
  let placed = emptyBoard(level)
  const rest = [...filters.map((color) => ({ type: 'filter', color })), ...Array.from({ length: fixed }, () => ({ type: 'fixed', mirror: rng() < 0.5 ? 1 : 2 })), ...Array(k).fill(null)].sort(() => rng() - 0.5)
  for (const piece of [...Array.from({ length: prisms }, () => ({ type: 'prism' })), ...rest]) {
    const through = trace(level, placed).through
    const lit = [...through.keys()].filter((i) => through[i] && cells[i].type === 'empty' && !placed[i] && (piece?.type !== 'prism' || inner(i % w, Math.floor(i / w))))
    if (!lit.length) return null
    const spot = lit[Math.floor(rng() * lit.length)]
    if (piece) cells[spot] = piece
    else { placed = new Uint8Array(placed); placed[spot] = rng() < 0.5 ? 1 : 2 }
  }
  const solved = trace(level, placed), before = trace(level, emptyBoard(level))
  // 수정 후보: 정답 상태에서만 올바른 색이 닿는 빈칸. 섞인 색(두 빛이 만나는 곳)을 먼저 고른다.
  const spots = [...solved.through.keys()].filter((i) => solved.through[i] && cells[i].type === 'empty' && !placed[i] && before.through[i] !== solved.through[i])
    .sort((a, b) => bits(solved.through[b]) - bits(solved.through[a]) + (rng() - 0.5))
  if (spots.length < crystalCount) return null
  const mixedSpots = spots.filter((i) => bits(solved.through[i]) > 1 && (solved.through[i] !== 7 || !sources.includes(7)))
  if (mixedSpots.length < mixed) return null
  const chosen = [...mixedSpots.slice(0, mixed)]
  for (const i of spots.sort(() => rng() - 0.5)) if (chosen.length < crystalCount && !chosen.includes(i)) chosen.push(i)
  for (const i of chosen) cells[i] = { type: 'crystal', need: solved.through[i] }
  if (!evaluate(level, placed).solved) return null // 수정이 빛길을 바꾸지는 않지만 안전하게 다시 확인
  return level
}

function build(spec, index) {
  const [, , , k] = spec
  let best = null
  for (let seed = 1; seed <= 12000 && !(best && best.score >= 100); seed++) {
    const rng = mulberry32(index * 100003 + seed)
    const level = candidate(spec, rng)
    if (!level) continue
    const main = solve(level, { maxMirrors: k, limit: 4 })
    if (main.par !== k || main.exhausted || main.solutions.length > 2) continue
    const answer = main.solutions[0], answerBoard = emptyBoard(level)
    answer.forEach(([i, m]) => { answerBoard[i] = m })
    const answerTrace = trace(level, answerBoard)
    // 프리즘·색유리·고정 거울이 정답에서 실제로 쓰여야 한다.
    if (!level.cells.every((cell, i) => !['prism', 'filter', 'fixed'].includes(cell.type) || answerTrace.through[i])) continue
    // 유리구슬: 기본 정답의 빛길 밖에 있어서 다른 길(거울 하나 더)을 찾아야 닿는 칸.
    const free = level.cells.map((cell, i) => i).filter((i) => level.cells[i].type === 'empty' && !answerTrace.through[i] && !answerBoard[i]).sort(() => rng() - 0.5).slice(0, 8)
    let marble = -1
    for (const i of free) {
      const alt = solve({ ...level, marble: i }, { maxMirrors: k + 1, needMarble: true, limit: 1, budget: 150000 })
      if (alt.par >= 0) { marble = i; break }
    }
    if (marble < 0) continue
    const turns = answerTrace.hops.length, colors = new Set(level.cells.filter((cell) => cell.type === 'crystal').map((cell) => cell.need)).size
    const score = (main.solutions.length === 1 ? 100 : 60) + turns + colors * 6
    if (!best || score > best.score) best = { score, level: { ...level, marble, solution: answer } }
  }
  if (!best) throw new Error(`레벨 ${index + 1}을 만들지 못했습니다`)
  return best.level
}

const levels = SPECS.map((spec, index) => {
  const level = build(spec, index)
  console.log(`실험 ${index + 1}: ${level.w}x${level.h} 거울 ${level.par}개`)
  return { id: index + 1, chapter: CHAPTER_OF(index), mirrors: level.mirrors, par: level.par, rows: serializeRows(level), solution: level.solution }
})
const body = levels.map((level) => `  { id: ${level.id}, chapter: ${level.chapter}, mirrors: ${level.mirrors}, par: ${level.par}, solution: ${JSON.stringify(level.solution)}, rows: [\n${level.rows.map((row) => `    '${row}',`).join('\n')}\n  ] },`).join('\n')
writeFileSync(new URL('../src/lib/lightLabLevels.js', import.meta.url), `// scripts/generate-light-lab-levels.mjs가 만든 파일입니다. 칸 표기는 lightLab.js의 parseLevel을 보세요.\nexport const LEVELS = [\n${body}\n]\n`)
