import test from 'node:test'
import assert from 'node:assert/strict'
import { ALL_TREASURES, BACKUP_KEY, SAVE_KEY, emptyProgress, loadProgress, normalizeProgress, progressAction, saveProgress } from '../src/lib/treasureKingdom.js'
import { bestRun, createPlayTimer, formatRunTime } from '../src/lib/treasureRuns.js'
const now = 1800000000000
function storage() { const values = new Map(); return { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) } }
function complete(durationMs, history = []) {
  let progress = progressAction({ ...emptyProgress(), history }, { type: 'startRun', now })
  progress = progressAction(progress, { type: 'elapsed', deltaMs: durationMs })
  progress = progressAction(progress, { type: 'collect', ids: ALL_TREASURES.map((item) => item.id) })
  return progressAction(progress, { type: 'deposit', now: now + durationMs + 90000 })
}

test('real active time excludes pause, background, loading and offline periods without capping slow frames', () => {
  let stamp = 0
  const timer = createPlayTimer(() => stamp)
  stamp = 9000; timer.setActive(true) // loading excluded
  stamp += 2500; assert.equal(timer.read(), 2500)
  stamp += 700; timer.setActive(false) // exact boundary includes last 700 ms
  stamp += 60000; assert.equal(timer.take(), 3200)
  timer.setActive(true); stamp += 30000 // a slow foreground frame still counts real time
  assert.equal(timer.take(), 30000)
  assert.equal(timer.take(), 0)
  timer.setActive(false); stamp += 86400000; timer.setActive(true)
  stamp += 400; assert.equal(timer.take(), 400)
})

test('100 treasures only finish upon deposit, save one result and stop the timer permanently', () => {
  let progress = progressAction(emptyProgress(), { type: 'startRun', now })
  const id = progress.run.id
  progress = progressAction(progress, { type: 'elapsed', deltaMs: 3723456 })
  progress = progressAction(progress, { type: 'collect', ids: ALL_TREASURES.map((item) => item.id) })
  assert.equal(progress.history.length, 0)
  assert.equal(progress.run.complete, false)
  const finished = progressAction(progress, { type: 'deposit', now: now + 4000000 })
  assert.deepEqual(finished.history, [{ id, startedAt: now, finishedAt: now + 4000000, durationMs: 3723456 }])
  assert.equal(progress.history.length, 0)
  assert.equal(progressAction(finished, { type: 'elapsed', deltaMs: 1000 }), finished)
  assert.equal(progressAction(finished, { type: 'deposit', now: now + 9999999 }).history.length, 1)
  assert.equal(finished.run.complete, true)
})

test('restart clears only the adventure, keeps all runs and outranks a stale completed backup', () => {
  const first = complete(500000), replay = progressAction(first, { type: 'restart' })
  assert.deepEqual(replay.collected, []); assert.deepEqual(replay.banked, [])
  assert.deepEqual(replay.quests, []); assert.deepEqual(replay.questItems, [])
  assert.deepEqual(replay.positions, {}); assert.deepEqual(replay.revealed, [])
  assert.equal(replay.run, null); assert.deepEqual(replay.history, first.history)
  assert.ok(replay.revision > first.revision)
  const db = storage(); db.setItem(SAVE_KEY, JSON.stringify(replay)); db.setItem(BACKUP_KEY, JSON.stringify(first))
  assert.deepEqual(loadProgress(db).progress, replay)
  const second = progressAction(replay, { type: 'startRun', now: now + 1000000 })
  assert.notEqual(second.run.id, first.run.id); assert.equal(second.run.eligible, true)
  assert.equal(progressAction(emptyProgress(), { type: 'restart' }).run, null)
  assert.equal(progressAction(first, { type: 'startRun', now }), first)
})

test('save and reload retain exact elapsed time and history; corrupt primary recovers from backup', () => {
  const db = storage(), progress = complete(86400123)
  assert.equal(saveProgress(db, progress), true)
  assert.deepEqual(loadProgress(db).progress, progress)
  db.setItem(SAVE_KEY, '{broken'); assert.deepEqual(loadProgress(db).progress, progress)
  let active = progressAction(emptyProgress(), { type: 'startRun', now })
  active = progressAction(active, { type: 'elapsed', deltaMs: 9123 })
  saveProgress(db, active); assert.equal(loadProgress(db).progress.run.elapsedMs, 9123)
})

test('legacy completion is kept as untimed and an unfinished old run cannot become a speed record', () => {
  const legacy = normalizeProgress({ version: 1, collected: ALL_TREASURES.map((item) => item.id), banked: ALL_TREASURES.map((item) => item.id) })
  assert.equal(legacy.history.length, 1); assert.equal(legacy.history[0].durationMs, null)
  assert.equal(legacy.history[0].finishedAt, null)
  assert.deepEqual(normalizeProgress(legacy), legacy)
  const partial = progressAction({ ...emptyProgress(), collected: ['0-0'] }, { type: 'startRun', now })
  assert.equal(partial.run.eligible, false)
  assert.equal(complete(1000, legacy.history).history.length, 2)
  assert.equal(bestRun(legacy.history), null)
})

test('best record uses elapsed time, not finish order, while malformed timings cannot poison records', () => {
  const slow = complete(500000), fast = complete(400000)
  assert.equal(bestRun([...slow.history, { ...fast.history[0], id: 'faster' }]).durationMs, 400000)
  const progress = normalizeProgress({ ...emptyProgress(), run: { id: 'x', startedAt: -1, elapsedMs: Infinity, eligible: true }, history: [{ id: 'a', startedAt: now, finishedAt: now - 1, durationMs: -1 }, { id: 'a', durationMs: 12 }, null] })
  assert.equal(progress.run.eligible, false); assert.equal(progress.run.elapsedMs, 0)
  assert.equal(progress.history.length, 1); assert.equal(progress.history[0].durationMs, null)
  assert.equal(progress.history[0].finishedAt, null)
  assert.equal(formatRunTime(3723456, true), '01:02:03.45')
  assert.equal(formatRunTime(86400123), '24:00:00')
  assert.equal(formatRunTime(null), '시간 기록 없음')
})
