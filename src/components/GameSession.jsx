import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { gameClock } from '../lib/gameClock'
import './GameSession.css'

export default function GameSession({ game, children }) {
  const paused = useSyncExternalStore(gameClock.subscribe, gameClock.isPaused)
  const resumeRef = useRef(null)
  const pauseRef = useRef(null)
  const contentRef = useRef(null)
  const wasPaused = useRef(false)

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
    const keys = new Map()
    const releaseKeys = () => {
      for (const [key, code] of keys) window.dispatchEvent(new KeyboardEvent('keyup', { key, code }))
      keys.clear()
    }
    const pause = () => { releaseKeys(); gameClock.pause() }
    const onVisibility = () => { if (document.hidden) pause() }
    const onKeyDown = (event) => {
      const inGame = !event.target.closest?.('.session-toolbar, .session-pause')
      if (gameClock.isPaused() && inGame) {
        event.preventDefault()
        event.stopImmediatePropagation()
        return
      }
      // Keep focused buttons operable without also triggering game shortcuts.
      if (!inGame) return
      if (event.target.closest?.('button, a, input, select') && [' ', 'Enter'].includes(event.key)) {
        event.stopPropagation()
        return
      }
      keys.set(event.key, event.code)
    }
    const onKeyUp = (event) => { keys.delete(event.key) }
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)
    window.addEventListener('blur', pause)
    document.addEventListener('visibilitychange', onVisibility)
    try { localStorage.setItem('ian-last-game', game.id) } catch { /* Optional convenience. */ }
    document.title = `${game.title} · IAN Games`
    return () => {
      releaseKeys()
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
      window.removeEventListener('blur', pause)
      document.removeEventListener('visibilitychange', onVisibility)
      gameClock.reset()
    }
  }, [game])

  useEffect(() => {
    if (paused) resumeRef.current?.focus()
    else if (wasPaused.current) contentRef.current?.focus({ preventScroll: true })
    wasPaused.current = paused
  }, [paused])

  const resume = () => {
    gameClock.resume()
  }

  return (
    <div className={`game-session${paused ? ' is-paused' : ''}`}>
      <nav className="session-toolbar" aria-label="게임 메뉴" inert={paused} onKeyDown={(event) => event.stopPropagation()}>
        <Link to="/" className="session-home">← <span>게임 목록</span></Link>
        <span className="session-title">{game.emoji} {game.title}</span>
        <button ref={pauseRef} onClick={() => {
          // Reuse blur cleanup for games with held keyboard/pointer input.
          window.dispatchEvent(new Event('blur'))
        }} aria-label="게임 일시정지">Ⅱ <span>잠깐 쉬기</span></button>
      </nav>
      <div ref={contentRef} className="game-content" tabIndex={-1} inert={paused}>{children}</div>
      {paused && (
        <div className="session-pause" role="dialog" aria-modal="true" aria-labelledby="pause-title"
          onKeyDown={(event) => {
            event.stopPropagation()
            if (event.key === 'Escape') resume()
            if (event.key === 'Tab') {
              const buttons = event.currentTarget.querySelectorAll('button, a')
              const next = event.shiftKey ? buttons[buttons.length - 1] : buttons[0]
              if ((event.shiftKey && document.activeElement === buttons[0]) || (!event.shiftKey && document.activeElement === buttons[buttons.length - 1])) {
                event.preventDefault()
                next.focus()
              }
            }
          }}>
          <div className="session-pause-card">
            <span className="session-pause-icon" aria-hidden="true">☕</span>
            <h2 id="pause-title">잠깐 쉬어 가요</h2>
            <p>게임과 시간이 멈췄어요.<br />준비되면 이어서 놀아요!</p>
            <button ref={resumeRef} onClick={resume}>▶ 계속하기</button>
            <Link to="/">게임 목록으로</Link>
          </div>
        </div>
      )}
    </div>
  )
}
