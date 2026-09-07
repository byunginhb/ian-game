/** A single, pausable timeline for simulation, animation and delayed game actions. */
export function createGameClock({
  requestFrame = (callback) => window.requestAnimationFrame(callback),
  cancelFrame = (id) => window.cancelAnimationFrame(id),
} = {}) {
  const timers = new Map()
  const frames = new Map()
  const listeners = new Set()
  let nextId = 1
  let frameId = null
  let lastStamp = null
  let time = 1000
  let paused = false

  function wake() {
    if (!paused && frameId === null && (timers.size || frames.size)) {
      frameId = requestFrame(tick)
    }
  }

  function tick(stamp) {
    frameId = null
    if (paused) return
    // Bound catch-up after a slow frame; a resumed game never jumps forward.
    time += lastStamp === null ? 0 : Math.max(0, Math.min(50, stamp - lastStamp))
    lastStamp = stamp
    const pendingFrames = [...frames]
    for (const [id, timer] of [...timers]) {
      let steps = 0
      while (!paused && timers.get(id) === timer && timer.at <= time + 0.000001 && steps++ < 5) {
        if (timer.interval) timer.at += timer.interval
        else timers.delete(id)
        timer.callback()
      }
    }
    for (const [id, callback] of pendingFrames) {
      if (paused) break
      if (frames.delete(id)) callback(time)
    }
    if (!timers.size && !frames.size) lastStamp = null
    wake()
  }

  function schedule(callback, delay, repeat) {
    const id = nextId++
    const interval = Math.max(1, Number(delay) || 0)
    timers.set(id, { callback, at: time + interval, interval: repeat ? interval : 0 })
    wake()
    return id
  }

  function setPaused(value) {
    if (paused === value) return
    paused = value
    lastStamp = null
    if (frameId !== null) cancelFrame(frameId)
    frameId = null
    listeners.forEach((listener) => listener())
    wake()
  }

  return {
    now: () => time,
    setTimeout: (callback, delay) => schedule(callback, delay, false),
    setInterval: (callback, delay) => schedule(callback, delay, true),
    clearTimeout: (id) => timers.delete(id),
    clearInterval: (id) => timers.delete(id),
    clearTimeouts() {
      for (const [id, timer] of timers) if (!timer.interval) timers.delete(id)
    },
    requestAnimationFrame(callback) {
      const id = nextId++
      frames.set(id, callback)
      wake()
      return id
    },
    cancelAnimationFrame: (id) => frames.delete(id),
    pause: () => setPaused(true),
    resume: () => setPaused(false),
    isPaused: () => paused,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    reset() {
      if (frameId !== null) cancelFrame(frameId)
      frameId = null
      lastStamp = null
      timers.clear()
      frames.clear()
      // Keep time and IDs monotonic so old effect cleanups cannot cancel new work.
      setPaused(false)
    },
  }
}

export const gameClock = createGameClock()
