import test from 'node:test'
import assert from 'node:assert/strict'
import { BACKSLASH, MARK_MARBLE, MARK_SOLVED, MARK_THRIFT, SLASH, cycleCell, emptyBoard, evaluate, isUnlocked, nextHint, parseLevel, readProgress, recordMarks, reflect, serializeRows, trace, defaultProgress } from '../src/lib/lightLab.js'
import { solve } from '../src/lib/lightLabSolver.js'
import { LEVELS } from '../src/lib/lightLabLevels.js'

const level = (rows, extra = {}) => parseLevel({ id: 0, chapter: 0, mirrors: 3, par: 1, rows, ...extra })
const board = (parsed, entries) => { const placed = emptyBoard(parsed); entries.forEach(([index, mirror]) => { placed[index] = mirror }); return placed }

test('mirrors turn light the way their shape suggests', () => {
  assert.deepEqual([0, 1, 2, 3].map((dir) => reflect(SLASH, dir)), [1, 0, 3, 2])
  assert.deepEqual([0, 1, 2, 3].map((dir) => reflect(BACKSLASH, dir)), [3, 2, 1, 0])
})

test('light travels straight, bends at mirrors, passes crystals and stops at blocks', () => {
  const parsed = level(['>w .. *w ..', '.. .. .. ..', '.. ## *w ..'])
  assert.equal(evaluate(parsed, emptyBoard(parsed)).solved, false)
  const bent = board(parsed, [[3, BACKSLASH]])
  const traced = trace(parsed, bent)
  assert.equal(traced.received[2], 7)
  assert.equal(traced.through[7], 7)
  assert.equal(traced.through[11], 7)
  assert.equal(traced.hops.at(-1).end, 'exit')
  const back = board(parsed, [[3, BACKSLASH], [11, SLASH]])
  assert.equal(evaluate(parsed, back).solved, true)
  assert.equal(trace(parsed, back).hops.at(-1).end, 'block') // 수정을 지난 빛이 블록에서 멈춘다
  assert.equal(trace(level(['>w ## *w']), new Uint8Array(3)).hops.at(-1).end, 'block')
})

test('coloured light mixes on a crystal and must match exactly', () => {
  const parsed = level(['>r .. *y', '.. .. ..', '.. .. ^g'])
  assert.equal(evaluate(parsed, emptyBoard(parsed)).solved, true)
  const red = level(['>r .. *r', '.. .. ..', '.. .. ^g'])
  assert.deepEqual(evaluate(red, emptyBoard(red)).crystals, [{ index: 2, need: 1, got: 3 }])
})

test('colour glass keeps its own colour and a prism splits white three ways', () => {
  const glass = level(['>w oy *y og *g or'])
  const traced = trace(glass, emptyBoard(glass))
  assert.deepEqual([traced.received[2], traced.received[4]], [3, 2])
  assert.equal(traced.hops.at(-1).end, 'block')
  const prism = level(['.. *r ..', '>w PP *g', '.. *b ..'])
  assert.equal(evaluate(prism, emptyBoard(prism)).solved, true)
})

test('a light loop between mirrors ends instead of running forever', () => {
  const parsed = level(['Fa .. Fb', '>w .. ..', 'Fb .. Fa'])
  const placed = board(parsed, [[5, SLASH]])
  assert.ok(trace(parsed, placed).hops.length < 40)
})

test('tapping cycles a tile and respects the mirror tray', () => {
  const parsed = level(['>w .. ..', '.. ## *w'], { mirrors: 1 })
  const first = cycleCell(parsed, emptyBoard(parsed), 2)
  assert.deepEqual([first.change, first.placed[2]], ['placed', SLASH])
  assert.equal(cycleCell(parsed, first.placed, 1).change, 'empty-tray')
  const second = cycleCell(parsed, first.placed, 2)
  assert.deepEqual([second.change, second.placed[2], first.placed[2]], ['flipped', BACKSLASH, SLASH])
  assert.deepEqual([cycleCell(parsed, second.placed, 2).change, cycleCell(parsed, second.placed, 2).placed[2]], ['removed', 0])
  assert.equal(cycleCell(parsed, second.placed, 4).change, 'blocked')
  assert.equal(cycleCell(parsed, second.placed, 5).change, 'blocked')
})

test('every shipped experiment is well formed and solvable exactly as recorded', () => {
  assert.equal(LEVELS.length, 24)
  LEVELS.forEach((data, index) => {
    const parsed = parseLevel(data)
    assert.deepEqual(serializeRows(parsed), data.rows)
    assert.equal(data.id, index + 1)
    assert.equal(data.chapter, Math.floor(index / 6))
    assert.equal(evaluate(parsed, emptyBoard(parsed)).solved, false, `실험 ${data.id}는 처음부터 풀려 있으면 안 된다`)
    const result = evaluate(parsed, board(parsed, data.solution))
    assert.equal(result.marks & (MARK_SOLVED | MARK_THRIFT), MARK_SOLVED | MARK_THRIFT, `실험 ${data.id} 기록된 정답`)
    assert.equal(data.solution.length, data.par)
    const best = solve(parsed, { maxMirrors: data.par })
    assert.equal(best.par, data.par, `실험 ${data.id} 최소 거울 수`)
    assert.ok(parsed.marble >= 0 && !result.marble, `실험 ${data.id} 유리구슬은 기본 정답 밖에 있다`)
    assert.ok(solve(parsed, { maxMirrors: data.mirrors, needMarble: true, limit: 1 }).par >= 0, `실험 ${data.id} 유리구슬`)
  })
})

test('hints fix a wrong mirror first, then point at a missing one', () => {
  const parsed = parseLevel(LEVELS[0])
  const [[index, mirror]] = parsed.solution
  assert.deepEqual(nextHint(parsed, emptyBoard(parsed)), { index, mirror })
  const other = parsed.cells.findIndex((cell, i) => cell.type === 'empty' && i !== index)
  assert.deepEqual(nextHint(parsed, board(parsed, [[other, SLASH]])), { index: other, mirror: 0 })
  assert.equal(nextHint(parsed, board(parsed, parsed.solution)), null)
})

test('progress is sanitized and unlocks one experiment at a time', () => {
  const progress = readProgress({ getItem: () => JSON.stringify({ marks: [7, 99, 'x'], sound: false }) }, 4)
  assert.deepEqual([progress.marks, progress.sound], [[7, 3, 0, 0], false])
  assert.deepEqual(readProgress({ getItem: () => 'oops' }, 2), defaultProgress(2))
  const fresh = defaultProgress(3)
  assert.deepEqual([isUnlocked(fresh, 0), isUnlocked(fresh, 1)], [true, false])
  const next = recordMarks(recordMarks(fresh, 0, MARK_SOLVED), 0, MARK_MARBLE)
  assert.deepEqual([next.marks[0], fresh.marks[0], isUnlocked(next, 1), isUnlocked(next, 2)], [3, 0, true, false])
})
