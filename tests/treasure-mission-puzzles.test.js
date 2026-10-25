import test from 'node:test'
import assert from 'node:assert/strict'
import { WORLDS, emptyProgress, missionChallenge, normalizeProgress, progressAction, treasuresFor } from '../src/lib/treasureKingdom.js'
import { lineClues, nonogramFor, nonogramValid, sudokuFor, sudokuValid } from '../src/lib/treasureMissionPuzzles.js'

function pictureSolutions(puzzle) {
  const candidates = puzzle.rows.map((clues) => Array.from({ length: 2 ** puzzle.size }, (_, mask) => Array.from({ length: puzzle.size }, (_, column) => mask >> column & 1)).filter((row) => lineClues(row).join() === clues.join()))
  const solutions = []
  function search(row, cells) { if (row === puzzle.size) { if (nonogramValid(puzzle, cells)) solutions.push(cells); return } for (const value of candidates[row]) search(row + 1, [...cells, ...value]) }
  search(0, []); return solutions
}
function numberSolutions(puzzle) {
  const solutions = []
  function search(index, cells) { if (index === 9) { if (sudokuValid(puzzle, cells)) solutions.push(cells); return } for (const value of puzzle.givens[index] ? [puzzle.givens[index]] : [1,2,3]) search(index + 1, [...cells, value]) }
  search(0, []); return solutions
}

test('all six small nonograms have one solution discoverable from their row and column clues', () => {
  const pictures = []
  for (let variant = 0; variant < 6; variant++) {
    const puzzle = nonogramFor(variant), solutions = pictureSolutions(puzzle)
    assert.ok([4,5].includes(puzzle.size)); assert.equal(solutions.length, 1)
    assert.deepEqual(solutions[0], puzzle.solution); pictures.push(puzzle.solution.join())
    assert.equal(nonogramValid(puzzle, Array(puzzle.size ** 2).fill(0)), false)
    assert.equal(nonogramValid(puzzle, puzzle.solution.map((cell) => cell || -1)), true, 'X marks are optional empty cells')
    const wrong = [...puzzle.solution]; wrong[0] = 1 - wrong[0]
    assert.equal(nonogramValid(puzzle, wrong), false)
  }
  assert.equal(new Set(pictures).size, 6)
  assert.deepEqual(lineClues([0,0,0]), [0]); assert.deepEqual(lineClues([1,0,1,1]), [1,2])
})

test('3x3 mini sudoku uses only 1 through 3 and each set of visible clues has exactly one completion', () => {
  for (let seed = 0; seed < 80; seed++) for (const easy of [false, true]) {
    const puzzle = sudokuFor(seed, easy), solutions = numberSolutions(puzzle)
    assert.equal(solutions.length, 1, `seed ${seed}`); assert.deepEqual(solutions[0], puzzle.solution)
    assert.ok(puzzle.givens.filter(Boolean).length >= 5)
    assert.equal(sudokuValid(puzzle, puzzle.givens), false)
    const wrong = [...puzzle.solution]; wrong[0] = wrong[1]
    assert.equal(sudokuValid(puzzle, wrong), false)
    assert.equal(sudokuValid(puzzle, Array(9).fill(4)), false)
  }
})

test('the 36 mission sites include both new puzzle types while basic sums and hints stay child-sized', () => {
  const totals = { nonogram: 0, sudoku: 0, timing: 0, choice: 0 }
  for (const world of WORLDS) for (const item of treasuresFor(world.id).filter((item) => item.type === 'friend')) {
    for (let step = 0; step < 3; step++) {
      const challenge = missionChallenge(item, step); totals[challenge.mode]++
      if (step === 1) assert.ok(['nonogram','sudoku'].includes(challenge.mode))
      if (challenge.mode === 'choice') {
        assert.equal(challenge.choices.length, 3); assert.ok(Number(challenge.choices[challenge.correct]) <= 30)
        assert.ok(challenge.hint); assert.ok(!/最大|최대|최소|전력|주기|올림|운항/.test(challenge.question))
      }
      if (challenge.mode === 'timing') { assert.ok(challenge.width >= 32); assert.ok(challenge.speed <= .22) }
    }
    const final = missionChallenge(item, 3, true)
    assert.equal(final.choices.length, 3); assert.ok(Number(final.choices[final.correct]) <= 62); assert.ok(final.hint)
  }
  assert.deepEqual(totals, { nonogram: 6, sudoku: 6, timing: 8, choice: 16 })
})

test('the displayed school-level calculations have the expected answers', () => {
  const examples = [
    [0, 4, 0, '10 + 6 = ?', 16],
    [1, 4, 0, '7 + 3 = ?', 10],
    [2, 15, 0, '21 − 6 = ?', 15],
    [0, 4, 2, '4 → 6 → 8 → ?', 10],
    [2, 4, 2, '3 → 7 → 11 → ?', 15],
    [3, 4, 2, '5 → 10 → 15 → ?', 20],
  ]
  for (const [world, index, step, notes, answer] of examples) {
    const challenge = missionChallenge(treasuresFor(world)[index], step)
    assert.equal(challenge.notes, notes); assert.equal(Number(challenge.choices[challenge.correct]), answer)
  }
  for (const [world, phrase, answer] of [[0, '가장 작은 수', 15], [1, '가장 큰 수', 26], [2, '첫째 수와 둘째 수', 32], [3, '차이', 16]]) {
    const challenge = missionChallenge(treasuresFor(world)[4], 3, true)
    assert.ok(challenge.question.includes(phrase)); assert.equal(Number(challenge.choices[challenge.correct]), answer)
  }
  const grouped = missionChallenge(treasuresFor(3)[15], 2)
  assert.ok(grouped.question.includes('2명씩 2줄')); assert.equal(Number(grouped.choices[grouped.correct]), 4)
})

test('previous mission progress and rewards survive the new second-site puzzle allocation', () => {
  const item = treasuresFor(0)[4]
  let progress = { ...emptyProgress(), quests: [item.id], questItems: item.targets.slice(0,2).map((target) => target.id), collected: ['0-0'], banked: ['0-0'] }
  progress = normalizeProgress(progress)
  assert.deepEqual(progress.questItems, item.targets.slice(0,2).map((target) => target.id))
  assert.equal(progressAction(progress, { type: 'questItem', id: item.targets[1].id }), progress)
  const next = progressAction(progress, { type: 'questItem', id: item.targets[2].id })
  assert.deepEqual(progress.collected, next.collected); assert.equal(next.questItems.length, 3)
})
