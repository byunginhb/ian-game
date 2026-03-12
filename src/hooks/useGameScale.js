import { useState, useEffect } from 'react'

export function useGameScale(gameW, gameH, { maxScale = 2, padding = 24, reservedH = 100 } = {}) {
  const [scale, setScale] = useState(1)

  useEffect(() => {
    function update() {
      const maxW = window.innerWidth - padding
      const maxH = window.innerHeight - reservedH
      const scaleW = maxW / gameW
      const scaleH = maxH / gameH
      setScale(Math.min(scaleW, scaleH, maxScale))
    }

    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [gameW, gameH, maxScale, padding, reservedH])

  return scale
}
