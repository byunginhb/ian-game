export function createTreasureAudio() {
  let context, master, wind, tones = [], worldId = 0
  let enabled = true, paused = false
  const updateVolume = () => { if (master) master.gain.setTargetAtTime(enabled && !paused ? .5 : 0, context.currentTime, .12) }
  const setup = () => {
    master = context.createGain(); master.gain.value = .5; master.connect(context.destination)
    const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate), samples = buffer.getChannelData(0)
    let brown = 0
    for (let i = 0; i < samples.length; i++) { brown = (brown + (Math.random() * 2 - 1) * .025) / 1.025; samples[i] = brown * 2.5 }
    wind = context.createBufferSource(); wind.buffer = buffer; wind.loop = true
    const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 650
    const gain = context.createGain(); gain.gain.value = .06
    wind.connect(filter); filter.connect(gain); gain.connect(master); wind.start()
    tones = [1, 1.5].map((ratio, index) => {
      const oscillator = context.createOscillator(), toneGain = context.createGain()
      oscillator.type = 'sine'; oscillator.frequency.value = [98, 110, 130.81, 146.83][worldId] * ratio; oscillator.detune.value = index ? 4 : -3
      toneGain.gain.value = .009; oscillator.connect(toneGain); toneGain.connect(master); oscillator.start(); return oscillator
    })
  }
  return {
    unlock() {
      if (!enabled) return
      try { if (!context) { context = new (window.AudioContext || window.webkitAudioContext)(); setup() } context.resume().catch(() => {}); updateVolume() } catch { /* Silent play remains available. */ }
    },
    setWorld(value) { worldId = value; tones.forEach((oscillator, index) => oscillator.frequency.setTargetAtTime([98, 110, 130.81, 146.83][worldId] * (index ? 1.5 : 1), context.currentTime, 1)) },
    setEnabled(value) { enabled = value; updateVolume() },
    setPaused(value) { paused = value; updateVolume() },
    play(kind = 'collect') {
      if (!enabled || paused || !context || context.state !== 'running' || !master) return
      const notes = kind === 'hit' ? [220, 294] : kind === 'deposit' ? [196, 294, 392, 587] : [440, 660]
      notes.forEach((frequency, index) => {
        const oscillator = context.createOscillator(), gain = context.createGain(), start = context.currentTime + index * .11
        oscillator.type = 'triangle'; oscillator.frequency.value = frequency
        gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.07, start + .008); gain.gain.exponentialRampToValueAtTime(.001, start + .48)
        oscillator.connect(gain); gain.connect(master); oscillator.start(start); oscillator.stop(start + .5)
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
      })
    },
    destroy() { wind?.stop(); tones.forEach((tone) => tone.stop()); context?.close().catch(() => {}); context = null; master = null; wind = null; tones = [] },
  }
}
