/** 숫자 특공대 사운드: 파일 없이 WebAudio로 합성하는 효과음과 월드별 배경 루프. */
const pitch = (midi) => 440 * 2 ** ((midi - 69) / 12)
// 월드별 [기준음, 템포(BPM), 음계]. 멜로디는 5음 음계 위를 걷는 고유 패턴이다.
const THEMES = [
  [60, 132, [0, 2, 4, 7, 9]],
  [62, 120, [0, 2, 5, 7, 9]],
  [57, 138, [0, 3, 5, 7, 10]],
  [64, 126, [0, 2, 4, 7, 11]],
]
const MELODY = [0, 2, 4, 2, 3, -1, 4, 5, 4, 2, 0, -1, 1, 2, 3, -1, 0, 2, 4, 5, 6, -1, 5, 4, 3, 4, 2, -1, 1, 0, -1, -1]
const BASS = [0, 0, 3, 3, 4, 4, 2, 2]

export function createSquadAudio() {
  let context = null, master = null, enabled = true, paused = false, theme = -1, step = 0, nextTime = 0, timer = 0

  const volume = () => { if (master) master.gain.setTargetAtTime(enabled && !paused ? 0.5 : 0, context.currentTime, 0.05) }

  function tone(frequency, start, length, type = 'triangle', gain = 0.1, slideTo = 0) {
    const oscillator = context.createOscillator(), envelope = context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, start)
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + length)
    envelope.gain.setValueAtTime(0.0001, start)
    envelope.gain.exponentialRampToValueAtTime(gain, start + 0.012)
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + length)
    oscillator.connect(envelope); envelope.connect(master)
    oscillator.start(start); oscillator.stop(start + length + 0.02)
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect() }
  }

  function schedule() {
    if (!context || !enabled || theme < 0 || context.state !== 'running') return
    const [root, bpm, scale] = THEMES[theme], beat = 60 / bpm / 2
    if (nextTime < context.currentTime) nextTime = context.currentTime + 0.05
    while (nextTime < context.currentTime + 0.25) {
      const note = MELODY[step % MELODY.length]
      if (note >= 0) tone(pitch(root + 12 + scale[note % 5] + 12 * Math.floor(note / 5)), nextTime, beat * 0.9, 'triangle', 0.045)
      if (step % 4 === 0) tone(pitch(root - 12 + scale[BASS[Math.floor(step / 4) % BASS.length]]), nextTime, beat * 3.2, 'sine', 0.09)
      if (step % 2 === 1) tone(6000, nextTime, 0.03, 'square', 0.008)
      step += 1
      nextTime += beat
    }
  }

  const SOUNDS = {
    good: (now, combo = 1) => [0, 4, 7, 12].forEach((interval, i) => tone(pitch(72 + Math.min(combo, 8) + interval), now + i * 0.055, 0.16, 'triangle', 0.11)),
    bad: (now) => tone(260, now, 0.32, 'sawtooth', 0.07, 110),
    coin: (now, combo = 0) => { tone(pitch(84 + Math.min(combo, 7)), now, 0.07, 'square', 0.04); tone(pitch(91 + Math.min(combo, 7)), now + 0.06, 0.12, 'square', 0.04) },
    hit: (now) => { tone(140, now, 0.25, 'sawtooth', 0.11, 50); tone(90, now, 0.3, 'square', 0.06, 40) },
    shot: (now) => tone(880, now, 0.09, 'square', 0.035, 220),
    boss: (now) => [0, 1, 0, 1].forEach((interval, i) => tone(pitch(40 + interval), now + i * 0.22, 0.2, 'sawtooth', 0.1)),
    win: (now) => [0, 4, 7, 12, 7, 12, 16].forEach((interval, i) => tone(pitch(72 + interval), now + i * 0.11, i === 6 ? 0.6 : 0.14, 'triangle', 0.13)),
    lose: (now) => [7, 4, 2, 0].forEach((interval, i) => tone(pitch(55 + interval), now + i * 0.2, 0.3, 'triangle', 0.11)),
    tap: (now) => tone(660, now, 0.06, 'triangle', 0.06),
    buy: (now) => [0, 7, 12].forEach((interval, i) => tone(pitch(76 + interval), now + i * 0.07, 0.14, 'square', 0.05)),
  }

  return {
    unlock() {
      try {
        if (!context) {
          context = new (window.AudioContext || window.webkitAudioContext)()
          master = context.createGain(); master.gain.value = enabled ? 0.5 : 0; master.connect(context.destination)
          timer = window.setInterval(schedule, 80)
        }
        if (!paused) context.resume().catch(() => {})
      } catch { /* 소리 없이도 게임은 계속된다. */ }
    },
    play(name, value) {
      if (!enabled || paused || !context || context.state !== 'running') return
      SOUNDS[name]?.(context.currentTime, value)
    },
    music(world) { theme = world; step = 0 },
    setEnabled(value) { enabled = value; volume() },
    setPaused(value) {
      paused = value
      if (!context) return
      // suspend는 예약된 음까지 함께 멈춰 일시정지 중 음악이 새지 않는다.
      if (value) context.suspend().catch(() => {})
      else context.resume().catch(() => {})
    },
    dispose() {
      window.clearInterval(timer)
      context?.close().catch(() => {})
      context = null
    },
  }
}
