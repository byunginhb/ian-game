/** 빛 꺾기 실험실 소리: 나무판에 거울을 꽂는 소리와 유리 종소리를 WebAudio로 합성한다. */
const pitch = (midi) => 440 * 2 ** ((midi - 69) / 12)
const SCALE = [72, 74, 77, 79, 81, 84, 86, 89] // 수정이 켜질 때마다 한 음씩 올라가는 5음 음계

export function createLabAudio() {
  let context = null, master = null, echo = null, enabled = true, paused = false

  function setup() {
    master = context.createGain(); master.gain.value = 0.55; master.connect(context.destination)
    // 짧은 메아리로 조용한 실험실의 울림을 만든다.
    echo = context.createDelay(0.5); echo.delayTime.value = 0.23
    const feedback = context.createGain(), wet = context.createGain()
    feedback.gain.value = 0.32; wet.gain.value = 0.3
    echo.connect(feedback); feedback.connect(echo); echo.connect(wet); wet.connect(master)
  }

  function voice(frequency, start, length, gain, type = 'sine', slideTo = 0, wet = true) {
    const oscillator = context.createOscillator(), envelope = context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, start)
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + length)
    envelope.gain.setValueAtTime(0.0001, start)
    envelope.gain.exponentialRampToValueAtTime(gain, start + 0.008)
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + length)
    oscillator.connect(envelope); envelope.connect(master)
    if (wet) envelope.connect(echo)
    oscillator.start(start); oscillator.stop(start + length + 0.02)
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect() }
  }

  const bell = (midi, start, gain = 0.16) => { voice(pitch(midi), start, 1.3, gain); voice(pitch(midi) * 2.76, start, 0.5, gain * 0.28); voice(pitch(midi) * 5.4, start, 0.2, gain * 0.12) }
  const knock = (start, low, gain) => { voice(low, start, 0.07, gain, 'triangle', low * 0.5, false); voice(low * 7.3, start, 0.018, gain * 0.35, 'square', 0, false) }

  const SOUNDS = {
    placed: (now) => knock(now, 210, 0.3),
    flipped: (now) => knock(now, 320, 0.2),
    removed: (now) => knock(now, 150, 0.2),
    blocked: (now) => voice(110, now, 0.12, 0.16, 'triangle', 70, false),
    crystal: (now, order = 0) => bell(SCALE[Math.min(order, SCALE.length - 1)], now),
    marble: (now) => { bell(96, now, 0.07); bell(101, now + 0.09, 0.06) },
    solved: (now) => [72, 77, 81, 84, 89].forEach((midi, i) => bell(midi, now + 0.25 + i * 0.11, 0.12)),
    hint: (now) => { bell(84, now, 0.07); bell(79, now + 0.12, 0.07) },
    page: (now) => voice(900, now, 0.05, 0.04, 'triangle', 300, false),
  }

  return {
    unlock() {
      try {
        if (!context) { context = new (window.AudioContext || window.webkitAudioContext)(); setup() }
        if (!paused) context.resume().catch(() => {})
      } catch { /* 소리 없이도 실험은 계속된다. */ }
    },
    play(name, value) {
      if (!enabled || paused || !context || context.state !== 'running') return
      SOUNDS[name]?.(context.currentTime, value)
    },
    setEnabled(value) { enabled = value },
    setPaused(value) {
      paused = value
      if (!context) return
      if (value) context.suspend().catch(() => {})
      else context.resume().catch(() => {})
    },
    dispose() { context?.close().catch(() => {}); context = null },
  }
}
