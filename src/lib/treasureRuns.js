// Run records live beside progress so finishing and replaying use the same backup slots.
const duration = (value) => Number.isSafeInteger(value) && value >= 0 ? value : 0
const date = (value) => Number.isSafeInteger(value) && value > 0 && value <= 8640000000000000 ? value : null
const validId = (value) => typeof value === 'string' && value.length > 0 && value.length <= 120

export function normalizeRuns(value, complete) {
  const seen = new Set()
  const history = (Array.isArray(value.history) ? value.history : []).filter((record) => record && validId(record.id) && !seen.has(record.id) && seen.add(record.id)).map((record) => {
    const startedAt = date(record.startedAt), finishedAt = date(record.finishedAt)
    return { id: record.id, startedAt, finishedAt: finishedAt && (!startedAt || finishedAt >= startedAt) ? finishedAt : null, durationMs: record.durationMs !== null && startedAt && duration(record.durationMs) === record.durationMs ? record.durationMs : null }
  })
  const raw = value.run
  const run = raw && validId(raw.id) ? { id: raw.id, startedAt: date(raw.startedAt), elapsedMs: duration(raw.elapsedMs), eligible: raw.eligible === true && Boolean(date(raw.startedAt)), complete: Boolean(complete && raw.complete), finishedAt: complete ? date(raw.finishedAt) : null } : null
  return complete ? finishRun({ run, history }, null) : { run, history }
}
export function finishRun(progress, now) {
  const run = { ...(progress.run || { id: 'legacy-complete', startedAt: null, elapsedMs: 0, eligible: false }), complete: true, finishedAt: progress.run?.finishedAt || date(now) }
  const history = progress.history.some((record) => record.id === run.id) ? progress.history : [...progress.history, { id: run.id, startedAt: run.startedAt, finishedAt: run.finishedAt, durationMs: run.eligible ? run.elapsedMs : null }]
  return { run, history }
}
export function startRun(progress, now) {
  if (progress.run || !date(now) || progress.banked.length === 100) return progress
  return { ...progress, run: { id: `run-${now}-${progress.revision}`, startedAt: now, elapsedMs: 0, eligible: progress.collected.length === 0 && progress.quests.length === 0 && progress.revealed.length === 0 && Object.keys(progress.positions).length === 0, complete: false, finishedAt: null } }
}
export function addRunTime(progress, deltaMs) {
  if (!progress.run || progress.run.complete || !Number.isFinite(deltaMs) || deltaMs <= 0) return progress
  const elapsedMs = Math.min(Number.MAX_SAFE_INTEGER, progress.run.elapsedMs + Math.round(deltaMs))
  return { ...progress, run: { ...progress.run, elapsedMs } }
}
export function bestRun(history) {
  return history.filter((record) => Number.isSafeInteger(record.durationMs) && record.durationMs >= 0).reduce((best, record) => !best || record.durationMs < best.durationMs ? record : best, null)
}
export function formatRunTime(ms, precise = false) {
  if (ms === null || ms === undefined) return '시간 기록 없음'
  const seconds = Math.floor(ms / 1000), parts = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map((part) => String(part).padStart(2, '0'))
  return parts.join(':') + (precise ? `.${String(Math.floor(ms % 1000 / 10)).padStart(2, '0')}` : '')
}

// Monotonic active time: pause/visibility/loading transitions flush their exact boundary.
// Unlike simulation time this counts real seconds even on a slow display.
export function createPlayTimer(now = () => performance.now()) {
  let stamp = now(), pending = 0, active = false
  const sample = () => { const next = now(); if (active) pending += Math.max(0, next - stamp); stamp = next }
  return {
    setActive(value) { sample(); active = value },
    read() { sample(); return pending },
    take() { sample(); const elapsed = pending; pending = 0; return elapsed },
  }
}
