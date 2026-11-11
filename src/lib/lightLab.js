/** 빛 꺾기 실험실: 렌더러와 분리된 순수 규칙 (빛 추적, 판정, 거울 놓기, 저장). */
export const RED = 1, GREEN = 2, BLUE = 4, WHITE = 7
export const SAVE_KEY = 'ian-light-lab-v1'
export const MARK_SOLVED = 1, MARK_MARBLE = 2, MARK_THRIFT = 4
export const SLASH = 1, BACKSLASH = 2

export const COLOR_NAMES = { 1: '빨강', 2: '초록', 3: '노랑', 4: '파랑', 5: '자홍', 6: '청록', 7: '하양' }
export const COLOR_HEX = { 1: '#ff3b30', 2: '#22d45f', 3: '#ffd60a', 4: '#2f6bff', 5: '#ff3bd4', 6: '#22d3ee', 7: '#ffffff' }
const COLOR_CODES = { r: 1, g: 2, y: 3, b: 4, m: 5, c: 6, w: 7 }
const CODE_OF = Object.fromEntries(Object.entries(COLOR_CODES).map(([code, value]) => [value, code]))
const DIR_CODES = { '^': 0, '>': 1, v: 2, '<': 3 }
const DIR_OF = ['^', '>', 'v', '<']
/** 북·동·남·서. y는 아래로 커진다. */
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]

// `/`는 북↔동, 남↔서를 잇고 `\`는 북↔서, 남↔동을 잇는다.
export const reflect = (mirror, dir) => (mirror === SLASH ? dir ^ 1 : 3 - dir)

/**
 * 레벨 한 칸은 두 글자다. `..` 빈칸, `##` 바위, `@@` 유리구슬(빈칸), `>w` 광원(방향+색),
 * `*y` 수정(필요한 색), `or` 색유리, `PP` 프리즘, `Fa`·`Fb` 고정 거울(`/`, `\`).
 */
export function parseLevel(data) {
  const rows = data.rows.map((row) => row.trim().split(/\s+/))
  const h = rows.length, w = rows[0].length
  const cells = []
  let marble = -1
  rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`레벨 ${data.id}: ${y + 1}번째 줄의 칸 수가 다릅니다`)
    row.forEach((token, x) => {
      const [a, b] = token
      if (token === '..') cells.push({ type: 'empty' })
      else if (token === '@@') { marble = y * w + x; cells.push({ type: 'empty' }) } else if (token === '##') cells.push({ type: 'rock' })
      else if (token === 'PP') cells.push({ type: 'prism' })
      else if (a in DIR_CODES && COLOR_CODES[b]) cells.push({ type: 'source', dir: DIR_CODES[a], color: COLOR_CODES[b] })
      else if (a === '*' && COLOR_CODES[b]) cells.push({ type: 'crystal', need: COLOR_CODES[b] })
      else if (a === 'o' && COLOR_CODES[b]) cells.push({ type: 'filter', color: COLOR_CODES[b] })
      else if (a === 'F' && (b === 'a' || b === 'b')) cells.push({ type: 'fixed', mirror: b === 'a' ? SLASH : BACKSLASH })
      else throw new Error(`레벨 ${data.id}: 알 수 없는 칸 "${token}"`)
    })
  })
  return { id: data.id, chapter: data.chapter, w, h, cells, marble, mirrors: data.mirrors, par: data.par, solution: data.solution || [] }
}

export function serializeRows(level) {
  const rows = []
  for (let y = 0; y < level.h; y++) {
    const row = []
    for (let x = 0; x < level.w; x++) {
      const index = y * level.w + x, cell = level.cells[index]
      row.push(cell.type === 'rock' ? '##' : cell.type === 'prism' ? 'PP'
        : cell.type === 'source' ? DIR_OF[cell.dir] + CODE_OF[cell.color]
          : cell.type === 'crystal' ? `*${CODE_OF[cell.need]}`
            : cell.type === 'filter' ? `o${CODE_OF[cell.color]}`
              : cell.type === 'fixed' ? (cell.mirror === SLASH ? 'Fa' : 'Fb')
                : index === level.marble ? '@@' : '..')
    }
    rows.push(row.join(' '))
  }
  return rows
}

export const emptyBoard = (level) => new Uint8Array(level.w * level.h)

/**
 * 모든 광원에서 빛을 따라간다. hops는 칸 중심에서 다음 칸(또는 판 밖)으로 가는 한 걸음이고,
 * through[i]는 i번 칸을 지나간 빛의 색 합, received[i]는 수정이 받은 색 합이다.
 */
export function trace(level, placed) {
  const { w, h, cells } = level
  const hops = [], through = new Uint8Array(w * h), received = new Uint8Array(w * h)
  const seen = new Set(), queue = []
  cells.forEach((cell, index) => { if (cell.type === 'source') queue.push([index % w, Math.floor(index / w), cell.dir, cell.color, 0]) })
  while (queue.length) {
    let [x, y, dir, color, dist] = queue.pop()
    for (;;) {
      const nx = x + DIRS[dir][0], ny = y + DIRS[dir][1]
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) { hops.push({ x, y, dir, color, dist, end: 'exit' }); break }
      const index = ny * w + nx, cell = cells[index], key = (index * 4 + dir) * 8 + color
      if (seen.has(key)) break
      seen.add(key)
      const blocked = cell.type === 'rock' || cell.type === 'source' || (cell.type === 'filter' && !(color & cell.color))
      hops.push({ x, y, dir, color, dist, end: blocked ? 'block' : '' })
      if (blocked) break
      through[index] |= color
      x = nx; y = ny; dist += 1
      if (cell.type === 'crystal') received[index] |= color
      else if (cell.type === 'filter') color &= cell.color
      else if (cell.type === 'fixed') dir = reflect(cell.mirror, dir)
      else if (cell.type === 'prism') {
        // 프리즘은 들어온 빛을 왼쪽 빨강, 가운데 초록, 오른쪽 파랑으로 나눈다.
        for (const [turn, part] of [[3, RED], [0, GREEN], [1, BLUE]]) if (color & part) queue.push([x, y, (dir + turn) % 4, part, dist])
        break
      } else if (placed[index]) dir = reflect(placed[index], dir)
    }
  }
  return { hops, through, received }
}

export function evaluate(level, placed, traced = trace(level, placed)) {
  let solved = true, used = 0
  const crystals = []
  level.cells.forEach((cell, index) => {
    if (placed[index]) used += 1
    if (cell.type !== 'crystal') return
    const got = traced.received[index]
    crystals.push({ index, need: cell.need, got })
    if (got !== cell.need) solved = false
  })
  const marble = level.marble >= 0 && traced.through[level.marble] !== 0
  const marks = solved ? MARK_SOLVED | (marble ? MARK_MARBLE : 0) | (used <= level.par ? MARK_THRIFT : 0) : 0
  return { solved, marble, used, crystals, marks }
}

/** 빈칸을 누르면 없음 → `/` → `\` → 없음 순서로 바뀐다. 거울이 모자라면 놓을 수 없다. */
export function cycleCell(level, placed, index) {
  if (level.cells[index]?.type !== 'empty') return { placed, change: 'blocked' }
  const current = placed[index]
  if (!current && placed.reduce((sum, value) => sum + (value ? 1 : 0), 0) >= level.mirrors) return { placed, change: 'empty-tray' }
  const next = new Uint8Array(placed)
  next[index] = (current + 1) % 3
  return { placed: next, change: current === 0 ? 'placed' : current === 1 ? 'flipped' : 'removed' }
}

/** 정답과 다른 칸 하나를 알려 준다: 잘못 놓인 거울을 먼저, 그다음 아직 안 놓은 자리. */
export function nextHint(level, placed) {
  const wanted = new Map(level.solution)
  for (let index = 0; index < placed.length; index++) if (placed[index] && wanted.get(index) !== placed[index]) return { index, mirror: wanted.get(index) || 0 }
  for (const [index, mirror] of wanted) if (placed[index] !== mirror) return { index, mirror }
  return null
}

export const defaultProgress = (count) => ({ v: 1, marks: Array(count).fill(0), sound: true })

export function readProgress(storage, count) {
  const base = defaultProgress(count)
  try {
    const data = JSON.parse(storage.getItem(SAVE_KEY))
    if (!data || typeof data !== 'object') return base
    return { ...base, marks: base.marks.map((_, i) => (Number(data.marks?.[i]) | 0) & 7), sound: data.sound !== false }
  } catch { return base }
}

export function saveProgress(storage, progress) {
  try { storage.setItem(SAVE_KEY, JSON.stringify(progress)) } catch { /* 저장 없이도 계속 실험할 수 있다. */ }
}

export const recordMarks = (progress, levelIndex, marks) => ({ ...progress, marks: progress.marks.map((value, i) => (i === levelIndex ? value | marks : value)) })
export const isUnlocked = (progress, levelIndex) => levelIndex === 0 || (progress.marks[levelIndex - 1] & MARK_SOLVED) !== 0
