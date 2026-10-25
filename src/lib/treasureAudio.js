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
    play(kind = 'collect', tier = 'relic') {
      if (!enabled || paused || !context || context.state !== 'running' || !master) return
      if (kind === 'footstep') {
        const water = tier === 'water', now = context.currentTime, length = water ? .14 : .065, oscillator = context.createOscillator(), gain = context.createGain()
        oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(water ? 185 : tier === 'space' ? 135 : 95, now); oscillator.frequency.exponentialRampToValueAtTime(water ? 55 : 42, now + length)
        gain.gain.setValueAtTime(water ? .025 : .045, now); gain.gain.exponentialRampToValueAtTime(.001, now + length)
        oscillator.connect(gain); gain.connect(master); oscillator.start(now); oscillator.stop(now + length)
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
        const noise = context.createBufferSource(), filter = context.createBiquadFilter(), envelope = context.createGain(), buffer = context.createBuffer(1, Math.ceil(context.sampleRate * length), context.sampleRate)
        const data = buffer.getChannelData(0)
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3
        noise.buffer = buffer; filter.type = 'lowpass'; filter.frequency.setValueAtTime(water ? 2800 : tier === 'ocean' ? 1500 : tier === 'garden' ? 650 : 950, now)
        if (water) filter.frequency.exponentialRampToValueAtTime(450, now + length)
        envelope.gain.value = water ? .09 : .045; noise.connect(filter); filter.connect(envelope); envelope.connect(master); noise.start(now)
        noise.onended = () => { noise.disconnect(); filter.disconnect(); envelope.disconnect() }
        return
      }
      if (['missileLaunch', 'missileImpact', 'bossAttack', 'bossFall'].includes(kind)) {
        const charged = tier === 'charged', heavy = charged || kind === 'bossFall' || kind === 'bossAttack'
        const duration = kind === 'missileLaunch' ? .26 : heavy ? .75 : .23, now = context.currentTime
        const oscillator = context.createOscillator(), gain = context.createGain()
        oscillator.type = kind === 'missileLaunch' || tier === 'electric' ? 'sawtooth' : 'sine'
        oscillator.frequency.setValueAtTime(kind === 'missileLaunch' ? (charged ? 500 : 330) : tier === 'electric' ? 750 : tier === 'water' ? 180 : 110, now)
        oscillator.frequency.exponentialRampToValueAtTime(kind === 'missileLaunch' ? 80 : tier === 'electric' ? 160 : tier === 'water' ? 45 : 27, now + duration)
        gain.gain.setValueAtTime(heavy ? .17 : .08, now); gain.gain.exponentialRampToValueAtTime(.001, now + duration)
        oscillator.connect(gain); gain.connect(master); oscillator.start(now); oscillator.stop(now + duration)
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
        if (kind !== 'missileLaunch') {
          const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate), data = buffer.getChannelData(0)
          for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2
          const noise = context.createBufferSource(), filter = context.createBiquadFilter(), envelope = context.createGain()
          noise.buffer = buffer; filter.type = 'lowpass'; filter.frequency.setValueAtTime(heavy ? 2300 : 3500, now); filter.frequency.exponentialRampToValueAtTime(120, now + duration)
          envelope.gain.value = heavy ? .24 : .08; noise.connect(filter); filter.connect(envelope); envelope.connect(master); noise.start()
          noise.onended = () => { noise.disconnect(); filter.disconnect(); envelope.disconnect() }
        }
        return
      }
      const collectible = kind === 'collect' || kind === 'homecoming'
      const notes = kind === 'homecoming' ? [261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.5] : kind === 'hit' ? [220, 294] : kind === 'heal' ? [659.25, 880, 1318.5] : kind === 'deposit' ? [196, 294, 392, 587] : tier === 'relic' ? [523.25, 659.25, 783.99, 1046.5, 1567.98] : [392, 523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98]
      if (collectible) {
        const impact = context.createOscillator(), envelope = context.createGain()
        impact.frequency.setValueAtTime(105, context.currentTime); impact.frequency.exponentialRampToValueAtTime(45, context.currentTime + .2)
        envelope.gain.setValueAtTime(.16, context.currentTime); envelope.gain.exponentialRampToValueAtTime(.001, context.currentTime + .24)
        impact.connect(envelope); envelope.connect(master); impact.start(); impact.stop(context.currentTime + .25)
        impact.onended = () => { impact.disconnect(); envelope.disconnect() }
      }
      notes.forEach((frequency, index) => {
        const oscillator = context.createOscillator(), gain = context.createGain(), start = context.currentTime + index * (collectible ? .065 : .11)
        oscillator.type = collectible ? 'sine' : 'triangle'; oscillator.frequency.value = frequency
        gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(collectible ? .11 : .07, start + .008); gain.gain.exponentialRampToValueAtTime(.001, start + (collectible ? .85 : .48))
        oscillator.connect(gain)
        const pan = collectible && context.createStereoPanner ? context.createStereoPanner() : null
        if (pan) { pan.pan.value = (index % 2 ? 1 : -1) * .35; gain.connect(pan); pan.connect(master) } else gain.connect(master)
        oscillator.start(start); oscillator.stop(start + (collectible ? .9 : .5))
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); pan?.disconnect() }
      })
    },
    destroy() { wind?.stop(); tones.forEach((tone) => tone.stop()); context?.close().catch(() => {}); context = null; master = null; wind = null; tones = [] },
  }
}
