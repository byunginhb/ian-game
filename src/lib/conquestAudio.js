export const SOUND_KEY = 'ian-conquest-sound-v1'

export function readSoundPreference(storage) {
  try { return storage?.getItem(SOUND_KEY) !== 'off' } catch { return true }
}

// Compare committed snapshots so rendering, pausing and old collision sparks never replay sounds.
export function conquestSoundEvents(previous, world) {
  if (!previous || !world || world.time < previous.time || world.player !== previous.player || world.config.level !== previous.config.level || world.config.difficulty !== previous.config.difficulty) return []
  if (previous.status !== 'playing') return []
  if (world.status !== 'playing') return [world.status === 'won' ? 'victory' : 'defeat']
  const events = []
  const oldFleets = new Set(previous.fleets.map((fleet) => fleet.id))
  if (world.fleets.some((fleet) => fleet.owner === world.player && !oldFleets.has(fleet.id))) events.push('dispatch')
  const oldClashes = new Set(previous.clashes.map((clash) => clash.id))
  if (world.clashes.some((clash) => !oldClashes.has(clash.id))) events.push('clash')
  if (world.territories.some((land, index) => land.owner === world.player && previous.territories[index].owner !== world.player)) events.push('capture')
  if (world.territories.some((land, index) => land.owner !== world.player && previous.territories[index].owner === world.player)) events.push('retreat')
  return events
}

const pitch = (midi) => 440 * 2 ** ((midi - 69) / 12)
const EIGHTH = 60 / 112 / 2
// An original eight-bar adventure theme; rests leave room for the battle effects.
const MELODY = [
  64, 67, 72, 0, 71, 67, 64, 0, 64, 69, 72, 0, 71, 69, 67, 0,
  65, 69, 72, 0, 74, 72, 69, 0, 67, 71, 74, 0, 76, 74, 71, 67,
  72, 0, 67, 64, 67, 0, 72, 74, 72, 69, 65, 0, 69, 72, 74, 0,
  69, 0, 74, 72, 69, 65, 62, 0, 67, 71, 74, 0, 71, 67, 62, 0,
]
const ROOTS = [48, 45, 53, 55, 48, 53, 50, 55]
const COOLDOWNS = { select: .07, dispatch: .16, clash: .14, capture: .25, retreat: .7, start: .2 }

export function createConquestAudio({ createContext = () => {
  const Audio = globalThis.AudioContext || globalThis.webkitAudioContext
  return Audio ? new Audio() : null
} } = {}) {
  let context = null, master = null, music = null, effects = null, noise = null
  let enabled = true, paused = false, scene = 'menu', timer = null, step = 0, nextNote = 0
  const voices = new Set(), lastPlayed = new Map()

  function finish(voice) {
    voice.source.disconnect()
    voice.gain.disconnect()
    voice.filter?.disconnect()
    voices.delete(voice)
  }

  function stopVoices(bus) {
    if (!context) return
    for (const voice of voices) {
      if (bus && voice.bus !== bus) continue
      voice.gain.gain.cancelScheduledValues(context.currentTime)
      voice.gain.gain.setTargetAtTime(.0001, context.currentTime, .006)
      voice.source.stop(context.currentTime + .03)
    }
  }

  function stopMusic() {
    if (timer !== null) globalThis.clearInterval(timer)
    timer = null
    stopVoices(music)
  }

  function connectVoice(source, bus, time, duration, volume, filter) {
    if (voices.size >= 48) return false
    const gain = context.createGain()
    gain.gain.setValueAtTime(.0001, time)
    gain.gain.exponentialRampToValueAtTime(volume, time + .008)
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration)
    if (filter) { source.connect(filter); filter.connect(gain) } else source.connect(gain)
    gain.connect(bus)
    const voice = { source, gain, filter, bus }
    voices.add(voice)
    source.onended = () => finish(voice)
    source.start(time)
    source.stop(time + duration + .02)
    return true
  }

  function tone(midi, time, duration, volume, type = 'triangle', bus = effects, endMidi = midi) {
    if (voices.size >= 48) return
    const oscillator = context.createOscillator()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(pitch(midi), time)
    if (endMidi !== midi) oscillator.frequency.exponentialRampToValueAtTime(pitch(endMidi), time + duration)
    connectVoice(oscillator, bus, time, duration, volume)
  }

  function tap(time, duration, volume, frequency = 1300, bus = effects) {
    if (voices.size >= 48) return
    const source = context.createBufferSource(), filter = context.createBiquadFilter()
    source.buffer = noise
    filter.type = 'bandpass'
    filter.frequency.value = frequency
    filter.Q.value = .8
    connectVoice(source, bus, time, duration, volume, filter)
  }

  function scheduleMusic() {
    // Schedule against the audio clock, independent of render speed. Skip a delayed beat;
    // never catch up with a burst of notes when returning from a background tab.
    if (nextNote < context.currentTime) nextNote = context.currentTime + .03
    while (nextNote < context.currentTime + .12) {
      const beat = step % 8, bar = Math.floor(step / 8) % 8, root = ROOTS[bar]
      const melody = MELODY[step % MELODY.length]
      if (melody) tone(melody, nextNote, EIGHTH * 1.25, .075, 'triangle', music)
      if (beat % 2 === 0) tone(root - 12, nextNote, .22, .14, 'sine', music)
      if (beat === 0 || beat === 4) tone(43, nextNote, .1, .2, 'sine', music, 25)
      if (beat === 2 || beat === 6) tap(nextNote, .075, .09, 1500, music)
      if (beat % 2 === 1) tap(nextNote, .03, .035, 4300, music)
      step = (step + 1) % MELODY.length
      nextNote += EIGHTH
    }
  }

  function syncMusic() {
    if (!context || !enabled || paused || scene !== 'battle') { stopMusic(); return }
    if (timer !== null) return
    nextNote = context.currentTime + .06
    scheduleMusic()
    timer = globalThis.setInterval(scheduleMusic, 50)
  }

  function unlock() {
    if (!enabled || paused) return
    try {
      if (!context) {
        context = createContext()
        if (!context) return
        master = context.createGain(); master.gain.value = .65
        music = context.createGain(); music.gain.value = .48
        effects = context.createGain(); effects.gain.value = .8
        const compressor = context.createDynamicsCompressor()
        compressor.threshold.value = -16; compressor.knee.value = 16; compressor.ratio.value = 5
        compressor.attack.value = .003; compressor.release.value = .18
        music.connect(master); effects.connect(master); master.connect(compressor); compressor.connect(context.destination)
        noise = context.createBuffer(1, Math.ceil(context.sampleRate * .5), context.sampleRate)
        const samples = noise.getChannelData(0)
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1
      }
      if (context.state === 'suspended' || context.state === 'interrupted') context.resume().catch(() => {})
      syncMusic()
    } catch { /* Audio is optional on browsers without an available audio device. */ }
  }

  function play(event, faction = 0) {
    if (!context || !enabled || paused || context.state === 'closed') return
    const now = context.currentTime + .006
    if (now - (lastPlayed.get(event) ?? -Infinity) < (COOLDOWNS[event] || 0)) return
    lastPlayed.set(event, now)
    // Briefly lower the accompaniment to keep useful feedback easy to hear.
    if (['start', 'capture', 'retreat'].includes(event)) {
      music.gain.cancelScheduledValues(now)
      music.gain.setTargetAtTime(.2, now, .015)
      music.gain.setTargetAtTime(.48, now + .5, .15)
    }
    const phrase = (notes, interval, volume = .18, duration = .25) => notes.forEach((note, index) => tone(note, now + index * interval, duration, volume))
    switch (event) {
      case 'select': phrase([60 + [0, 2, 4, 5, 7, 9][faction % 6], 72 + [0, 2, 4, 5, 7, 9][faction % 6]], .055, .13, .15); break
      case 'start': phrase([60, 64, 67, 72], .09, .2, .28); tap(now, .13, .18, 900); break
      case 'dispatch': tone(55, now, .17, .19, 'triangle', effects, 74); tap(now + .025, .12, .14, 2200); tone(43, now, .1, .16, 'sine', effects, 31); break
      case 'clash': tap(now, .11, .24, 1800); tone(79, now, .085, .13, 'triangle', effects, 62); break
      case 'capture': phrase([72, 76, 79, 84], .075, .21, .3); tone(48, now, .25, .2, 'sine'); break
      case 'retreat': phrase([67, 63, 60], .13, .15, .25); break
      case 'victory':
        stopMusic(); stopVoices(effects)
        phrase([60, 64, 67, 72, 72, 74, 76], .14, .23, .32)
        ;[60, 64, 67, 72].forEach((note) => tone(note, now + 1.13, .8, .11))
        tap(now, .15, .16, 1200); tap(now + .28, .15, .16, 1200)
        break
      case 'defeat': stopMusic(); stopVoices(effects); phrase([67, 64, 62, 60], .22, .16, .42); tone(48, now + .66, .65, .12, 'sine'); break
    }
  }

  return {
    unlock,
    play,
    setEnabled(value) {
      enabled = value
      if (master) master.gain.setTargetAtTime(enabled && !paused ? .65 : .0001, context.currentTime, .01)
      if (!enabled) { stopMusic(); stopVoices(); lastPlayed.clear() } else syncMusic()
    },
    setScene(value, isPaused = false) {
      if (scene !== value) {
        stopMusic(); stopVoices(); lastPlayed.clear(); step = 0
      }
      scene = value; paused = isPaused
      if (master) master.gain.setTargetAtTime(enabled && !paused ? .65 : .0001, context.currentTime, .01)
      if (paused) { stopMusic(); stopVoices() } else if (context) unlock()
    },
    dispose() {
      stopMusic(); stopVoices()
      if (context && context.state !== 'closed') context.close?.().catch(() => {})
      context = null; master = null; music = null; effects = null; noise = null
      voices.clear(); lastPlayed.clear(); step = 0
    },
  }
}
