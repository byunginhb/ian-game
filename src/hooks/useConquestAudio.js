import { useEffect, useRef, useState } from 'react'
import { conquestSoundEvents, createConquestAudio, readSoundPreference, SOUND_KEY } from '../lib/conquestAudio'
import { gameClock } from '../lib/gameClock'

export default function useConquestAudio(world, help, round) {
  const [audio] = useState(createConquestAudio)
  const [sound, setSound] = useState(() => {
    try { return readSoundPreference(window.localStorage) } catch { return true }
  })
  const previous = useRef(null)
  const scene = !world ? 'menu' : world.status === 'playing' ? 'battle' : 'result'

  useEffect(() => () => audio.dispose(), [audio])
  useEffect(() => {
    audio.setEnabled(sound)
    try { localStorage.setItem(SOUND_KEY, sound ? 'on' : 'off') } catch { /* Sound preferences are optional. */ }
  }, [audio, sound])
  useEffect(() => {
    const sync = () => audio.setScene(scene, help || gameClock.isPaused())
    sync()
    return gameClock.subscribe(sync)
  }, [audio, scene, help])
  useEffect(() => {
    if (world && previous.current?.round === round) {
      for (const event of conquestSoundEvents(previous.current.world, world)) audio.play(event)
    }
    previous.current = { world, round }
  }, [audio, world, round])

  return {
    sound,
    toggleSound() {
      audio.setEnabled(!sound)
      if (!sound) { audio.unlock(); audio.play('select') }
      setSound(!sound)
    },
    play(event, faction) { audio.unlock(); audio.play(event, faction) },
    start() {
      // Start in the gesture itself for mobile autoplay rules and clear the old round's music.
      audio.setScene('menu')
      audio.unlock()
      audio.setScene('battle')
      audio.play('start')
    },
    unlock: audio.unlock,
  }
}
