import { useEffect, useRef, useState } from 'react'
import { gameClock } from '../lib/gameClock'

const KEY_ACTIONS = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ' ': 'jump', Shift: 'dash', e: 'interact', E: 'interact', Enter: 'interact' }

export default function TreasureExpedition({ worldId, bridge }) {
  const hostRef = useRef(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let disposed = false
    let engine
    let primaryHeld = false
    const host = hostRef.current
    bridge.setHandlers({ onError: () => { setError('탐사 장면을 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도하세요.'); bridge.onReady() } })
    import('../lib/treasureScene').then(({ mountTreasureScene }) => {
      if (!disposed) {
        try { engine = mountTreasureScene(host, worldId, bridge) } catch { setError('탐험 지도를 불러오지 못했어요. 다시 열어 주세요.') }
      }
    }).catch(() => { if (!disposed) setError('탐험 지도를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 열어 주세요.') })
    const release = () => { primaryHeld = false; bridge.resetInput() }
    const checkpoint = () => { release(); engine?.checkpoint() }
    const keydown = (event) => {
      const action = KEY_ACTIONS[event.key]
      if (event.repeat && action === 'jump') return
      if (event.target.closest?.('a, input, select, [role="dialog"]') || bridge.blocked || gameClock.isPaused()) return
      if (event.target.closest?.('button') && !['left', 'right', 'up', 'down'].includes(action)) return
      if (action) { event.preventDefault(); if (action === 'jump') primaryHeld = true; bridge.setInput(action, true, ['left', 'right', 'up', 'down'].includes(action)) }
    }
    const keyup = (event) => {
      const action = KEY_ACTIONS[event.key]
      if (action) bridge.input[action] = false
      if (action === 'jump' && primaryHeld) { primaryHeld = false; if (!bridge.blocked && !gameClock.isPaused()) bridge.setInput('primaryTap', true) }
    }
    window.addEventListener('keydown', keydown)
    window.addEventListener('keyup', keyup)
    window.addEventListener('blur', checkpoint)
    window.addEventListener('pagehide', checkpoint)
    document.addEventListener('visibilitychange', checkpoint)
    const unsubscribe = gameClock.subscribe(release)
    return () => {
      disposed = true; engine?.checkpoint(); engine?.destroy(); release(); unsubscribe()
      window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup)
      window.removeEventListener('blur', checkpoint); window.removeEventListener('pagehide', checkpoint)
      document.removeEventListener('visibilitychange', checkpoint)
    }
  }, [worldId, bridge, attempt])

  return <div className="tk-canvas-host" ref={hostRef} tabIndex={0} aria-label="탐험 조작 영역">
    {error && <div className="tk-engine-error" role="alert"><p>{error}</p><button onClick={() => { setError(''); setAttempt((value) => value + 1) }}>다시 열기</button></div>}
  </div>
}
