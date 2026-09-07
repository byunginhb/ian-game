import { useSyncExternalStore } from 'react'
import { fitGameScale } from '../lib/gameViewport'

function subscribe(callback) {
  window.addEventListener('resize', callback)
  window.visualViewport?.addEventListener('resize', callback)
  return () => {
    window.removeEventListener('resize', callback)
    window.visualViewport?.removeEventListener('resize', callback)
  }
}

function getViewport() {
  const viewport = window.visualViewport
  // Pinch zoom should magnify the game, rather than shrink it back down.
  const height = viewport?.scale === 1 ? viewport.height : window.innerHeight
  return `${window.innerWidth},${height}`
}

export function useGameScale(gameW, gameH, options = {}) {
  const viewport = useSyncExternalStore(subscribe, getViewport, () => '400,700')
  const [width, height] = viewport.split(',').map(Number)
  return fitGameScale(gameW, gameH, width, height, options)
}
