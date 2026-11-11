import test from 'node:test'
import assert from 'node:assert/strict'
import { STAGE_COUNT, MAX_COUNT, applyOp, createStage, createRun, stepRun, gateIndex, quizIndex, makeQuiz, mulberry32, readProgress, recordResult, buySkin, unlockedStage, defaultProgress, SAVE_KEY, starsFor } from '../src/lib/numberSquad.js'

const bestX = (run) => {
  const row = run.stage.rows[run.rowIndex]
  if (!row) return 0
  if (row.type === 'gate') {
    const results = row.options.map((op) => applyOp(op, run.count))
    return results[0] >= results[1] ? -3 : 3
  }
  if (row.type === 'quiz') return [-3.5, 0, 3.5][row.quiz.choices.indexOf(row.quiz.answer)]
  if (row.type === 'hazard') return row.x > 0 ? -4 : 4
  return 0
}

function play(stage, chooseX) {
  const run = createRun(stage)
  for (let i = 0; i < 60 * 240 && !run.result; i++) { stepRun(run, 1 / 60, chooseX(run)); run.events.length = 0 }
  return run
}

test('ops keep the squad between one and the cap', () => {
  assert.equal(applyOp({ kind: 'sub', value: 9 }, 3), 1)
  assert.equal(applyOp({ kind: 'div', value: 2 }, 7), 4)
  assert.equal(applyOp({ kind: 'mul', value: 3 }, 500), MAX_COUNT)
  assert.equal(applyOp({ kind: 'add', value: 5 }, 2), 7)
})

test('lane mapping splits the track for two and three choices', () => {
  assert.deepEqual([gateIndex(-1), gateIndex(1)], [0, 1])
  assert.deepEqual([quizIndex(-4), quizIndex(0), quizIndex(4)], [0, 1, 2])
})

test('every stage is deterministic, well formed and winnable in both modes', () => {
  for (const easy of [true, false]) {
    for (let stage = 1; stage <= STAGE_COUNT; stage++) {
      for (const seed of [1, 2, 3]) {
        const data = createStage(stage, { easy, seed })
        assert.deepEqual(createStage(stage, { easy, seed }), data)
        assert.equal(data.rows[0].type, 'gate')
        assert.equal(data.rows.at(-1).type, 'gate')
        assert.ok(data.rows.at(-1).options.some((op) => op.kind === 'add' || op.kind === 'mul'))
        assert.ok(data.rows.filter((row) => row.type === 'gate' && row.options.every((op) => op.kind === 'sub' || op.kind === 'div')).length <= 1)
        for (const row of data.rows) {
          if (row.type === 'quiz') {
            assert.equal(new Set(row.quiz.choices).size, 3)
            assert.ok(row.quiz.choices.includes(row.quiz.answer))
          }
        }
        assert.ok(data.bossHp <= data.best && data.best <= MAX_COUNT)
        const run = play(data, bestX)
        assert.equal(run.result.win, true, `stage ${stage} seed ${seed}`)
        assert.equal(run.result.stars, 3)
        assert.equal(run.count, data.best)
        assert.equal(run.result.goodPicks, run.result.picks)
      }
    }
  }
})

test('poor choices never drop below Ian alone and lose to the boss', () => {
  const data = createStage(6, { easy: false, seed: 4 })
  const run = play(data, (state) => -bestX(state) || 4)
  assert.ok(run.count >= 1)
  assert.equal(run.result.win, run.count >= data.bossHp)
  if (!run.result.win) assert.equal(run.result.stars, 0)
})

test('quizzes always have one right answer among three unique choices', () => {
  const rng = mulberry32(9)
  for (let tier = 0; tier < 4; tier++) for (let i = 0; i < 200; i++) {
    const quiz = makeQuiz(tier, rng)
    assert.equal(quiz.choices.filter((value) => value === quiz.answer).length, 1)
    assert.equal(new Set(quiz.choices).size, 3)
    assert.ok(quiz.choices.every((value) => value >= 0))
  }
})

test('holding the brake slows the run and releasing it speeds back up', () => {
  const stage = createStage(1, { easy: false, seed: 2 })
  const fast = createRun(stage), slow = createRun(stage)
  for (let i = 0; i < 120; i++) { stepRun(fast, 1 / 60, 0); stepRun(slow, 1 / 60, 0, true) }
  assert.ok(slow.z < fast.z * 0.5 && slow.z > 0, `${slow.z} vs ${fast.z}`)
  assert.equal(slow.braking, true)
  const before = slow.z
  for (let i = 0; i < 120; i++) stepRun(slow, 1 / 60, 0)
  assert.ok(slow.z - before > before && slow.braking === false)
})

test('stars reward staying close to the best possible squad', () => {
  assert.deepEqual([starsFor(20, 20), starsFor(13, 20), starsFor(8, 20)], [3, 2, 1])
})

test('progress is sanitized, unlocks in order and buys skins once', () => {
  const storage = { getItem: () => JSON.stringify({ stars: [3, 9, 'x'], coins: 80.7, skins: ['leaf', 'hack'], skin: 'hack', easy: false }) }
  const progress = readProgress(storage)
  assert.deepEqual(progress.stars.slice(0, 3), [3, 3, 0])
  assert.deepEqual([progress.coins, progress.skins, progress.skin, progress.easy], [80, ['basic', 'leaf'], 'basic', false])
  assert.equal(unlockedStage(progress), 3)
  assert.deepEqual(readProgress({ getItem: () => '{broken' }), defaultProgress())
  const after = recordResult(progress, 3, { stars: 2, coins: 50 })
  assert.deepEqual([after.stars[2], after.coins, progress.coins], [2, 130, 80])
  assert.equal(recordResult(after, 3, { stars: 1, coins: 0 }).stars[2], 2)
  const bought = buySkin(after, 'coral')
  assert.deepEqual([bought.coins, bought.skin, bought.skins.includes('coral')], [10, 'coral', true])
  assert.equal(buySkin(bought, 'gold'), bought)
  assert.equal(buySkin(bought, 'leaf').coins, 10)
  assert.equal(typeof SAVE_KEY, 'string')
})
