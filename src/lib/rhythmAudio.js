const frequency = (midi) => 440 * 2 ** ((midi - 69) / 12)

/** Tiny synth: the player's hits play the melody, the song clock plays the bass. */
export function createRhythmAudio() {
  let context = null
  let master = null

  function ready() {
    if (!context) {
      const Audio = globalThis.AudioContext || globalThis.webkitAudioContext
      if (!Audio) return false
      context = new Audio()
      master = context.createGain()
      master.gain.value = .5
      master.connect(context.destination)
    }
    if (context.state === 'suspended') context.resume().catch(() => {})
    return true
  }

  function tone(midi, duration, { type = 'triangle', volume = .35 } = {}) {
    if (!ready()) return
    const time = context.currentTime
    const osc = context.createOscillator()
    const gain = context.createGain()
    osc.type = type
    osc.frequency.value = frequency(midi)
    gain.gain.setValueAtTime(.0001, time)
    gain.gain.exponentialRampToValueAtTime(volume, time + .01)
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration)
    osc.connect(gain)
    gain.connect(master)
    osc.start(time)
    osc.stop(time + duration + .02)
    osc.onended = () => { osc.disconnect(); gain.disconnect() }
  }

  return {
    unlock: ready,
    melody: (midi, ms) => tone(midi, Math.min(1.2, Math.max(.18, ms / 1000))),
    bass: (midi) => tone(midi, .28, { type: 'sine', volume: .3 }),
    tap: () => tone(84, .06, { type: 'square', volume: .05 }),
    fanfare: () => [72, 76, 79, 84].forEach((midi, i) => setTimeout(() => tone(midi, .3), i * 110)),
    close: () => { context?.close().catch(() => {}); context = null },
  }
}
