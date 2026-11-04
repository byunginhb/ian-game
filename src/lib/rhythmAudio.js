const frequency = (midi) => 440 * 2 ** ((midi - 69) / 12)

/** Tiny synth: the player's hits play the melody, the song clock plays bass and a per-song drum kit. */
export function createRhythmAudio() {
  let context = null
  let master = null
  let noise = null

  function ready() {
    if (!context) {
      const Audio = globalThis.AudioContext || globalThis.webkitAudioContext
      if (!Audio) return false
      context = new Audio()
      master = context.createGain()
      master.gain.value = .5
      master.connect(context.destination)
      noise = context.createBuffer(1, context.sampleRate / 2, context.sampleRate)
      const data = noise.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    }
    if (context.state === 'suspended') context.resume().catch(() => {})
    return true
  }

  function envelope(source, time, duration, volume, filter) {
    const gain = context.createGain()
    gain.gain.setValueAtTime(.0001, time)
    gain.gain.exponentialRampToValueAtTime(volume, time + .005)
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration)
    if (filter) { source.connect(filter); filter.connect(gain) } else source.connect(gain)
    gain.connect(master)
    source.start(time)
    source.stop(time + duration + .02)
    source.onended = () => { source.disconnect(); filter?.disconnect(); gain.disconnect() }
    return gain
  }

  function tone(midi, duration, { type = 'triangle', volume = .35, delay = 0 } = {}) {
    if (!ready()) return { stop() {} }
    const osc = context.createOscillator()
    osc.type = type
    osc.frequency.value = frequency(midi)
    const gain = envelope(osc, context.currentTime + delay, duration, volume)
    return {
      // Let go early: fade out now instead of at the scheduled end.
      stop() {
        try {
          gain.gain.cancelScheduledValues(context.currentTime)
          gain.gain.setTargetAtTime(.0001, context.currentTime, .02)
          osc.stop(context.currentTime + .1)
        } catch { /* Already finished. */ }
      },
    }
  }

  function hiss(time, duration, volume, type, cutoff) {
    const source = context.createBufferSource()
    source.buffer = noise
    const filter = context.createBiquadFilter()
    filter.type = type
    filter.frequency.value = cutoff
    envelope(source, time, duration, volume, filter)
  }

  function thump(time, from, to, duration, volume) {
    const osc = context.createOscillator()
    osc.frequency.setValueAtTime(from, time)
    osc.frequency.exponentialRampToValueAtTime(to, time + duration * .8)
    envelope(osc, time, duration, volume)
  }

  const KIT = {
    kick: (time, gain) => thump(time, 150, 45, .18, .7 * gain),
    snare: (time, gain) => { hiss(time, .14, .22 * gain, 'highpass', 1500); thump(time, 220, 160, .08, .15 * gain) },
    hat: (time, gain) => hiss(time, .04, .08 * gain, 'highpass', 7000),
    ohat: (time, gain) => hiss(time, .22, .07 * gain, 'highpass', 6500),
    rim: (time, gain) => { thump(time, 1700, 1500, .03, .12 * gain); hiss(time, .02, .06 * gain, 'bandpass', 3000) },
    shake: (time, gain) => hiss(time, .06, .05 * gain, 'bandpass', 5500),
    jingle: (time, gain) => { hiss(time, .12, .06 * gain, 'highpass', 9000); thump(time, 5200, 5000, .1, .025 * gain) },
    tom: (time, gain) => thump(time, 260, 140, .2, .4 * gain),
    ltom: (time, gain) => thump(time, 120, 70, .4, .5 * gain),
    crash: (time, gain) => hiss(time, 1.1, .1 * gain, 'highpass', 5000),
  }

  return {
    unlock: ready,
    /** Returns a handle whose stop() cuts a held note short. */
    melody: (midi, ms) => tone(midi, Math.min(4, Math.max(.18, ms / 1000))),
    backing(event, delay) {
      if (!ready()) return
      if (event.kind === 'bass') tone(event.midi, Math.min(1.5, Math.max(.2, event.length / 1000 * .9)), { type: 'sine', volume: .3, delay })
      else KIT[event.kind]?.(context.currentTime + delay, event.gain ?? 1)
    },
    tap: () => tone(84, .06, { type: 'square', volume: .05 }),
    fanfare: () => [72, 76, 79, 84].forEach((midi, i) => tone(midi, .3, { delay: i * .11 })),
    close: () => { context?.close().catch(() => {}); context = null },
  }
}
