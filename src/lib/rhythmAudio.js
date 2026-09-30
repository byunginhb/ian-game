const frequency = (midi) => 440 * 2 ** ((midi - 69) / 12)

/** Tiny synth: the player's hits play the melody, the song clock plays bass and drums. */
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
  }

  function tone(midi, duration, { type = 'triangle', volume = .35, delay = 0 } = {}) {
    if (!ready()) return
    const osc = context.createOscillator()
    osc.type = type
    osc.frequency.value = frequency(midi)
    envelope(osc, context.currentTime + delay, duration, volume)
  }

  function hiss(time, duration, volume, type, cutoff) {
    const source = context.createBufferSource()
    source.buffer = noise
    const filter = context.createBiquadFilter()
    filter.type = type
    filter.frequency.value = cutoff
    envelope(source, time, duration, volume, filter)
  }

  function drum(kind, delay = 0) {
    if (!ready()) return
    const time = context.currentTime + delay
    if (kind === 'hat') hiss(time, .04, .08, 'highpass', 7000)
    if (kind === 'snare') { hiss(time, .14, .22, 'highpass', 1500); tone(55, .08, { type: 'triangle', volume: .15, delay }) }
    if (kind === 'kick') {
      const osc = context.createOscillator()
      osc.frequency.setValueAtTime(150, time)
      osc.frequency.exponentialRampToValueAtTime(45, time + .12)
      envelope(osc, time, .18, .7)
    }
  }

  return {
    unlock: ready,
    melody: (midi, ms) => tone(midi, Math.min(1.2, Math.max(.18, ms / 1000))),
    backing: (event, delay) => (event.kind === 'bass' ? tone(event.midi, .28, { type: 'sine', volume: .3, delay }) : drum(event.kind, delay)),
    tap: () => tone(84, .06, { type: 'square', volume: .05 }),
    fanfare: () => [72, 76, 79, 84].forEach((midi, i) => tone(midi, .3, { delay: i * .11 })),
    close: () => { context?.close().catch(() => {}); context = null },
  }
}
