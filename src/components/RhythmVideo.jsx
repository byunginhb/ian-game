import { useEffect, useRef, useState } from 'react'
import { gameClock } from '../lib/gameClock'

let apiPromise

function loadYouTube() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  apiPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    const fail = () => {
      clearTimeout(timeout)
      script.remove()
      reject(new Error('YouTube player unavailable'))
    }
    const timeout = setTimeout(fail, 12000)
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout)
      resolve(window.YT)
    }
    script.src = 'https://www.youtube.com/iframe_api'
    script.onerror = fail
    document.head.append(script)
  }).catch((error) => {
    apiPromise = undefined
    throw error
  })
  return apiPromise
}

export default function RhythmVideo({ videoId, playerRef }) {
  const hostRef = useRef(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    let disposed = false
    let player
    let resume = false
    const unsubscribe = gameClock.subscribe(() => {
      if (!playerRef.current) return
      if (gameClock.isPaused()) {
        resume = [1, 3].includes(player.getPlayerState())
        if (resume) player.pauseVideo()
      } else if (resume) {
        resume = false
        player.playVideo()
      }
    })
    loadYouTube().then((api) => {
      if (disposed) return
      const target = document.createElement('div')
      host.append(target)
      player = new api.Player(target, {
        videoId,
        width: 356,
        height: 200,
        playerVars: { playsinline: 1, cc_load_policy: 1, cc_lang_pref: 'en', origin: location.origin },
        events: {
          onReady({ target }) {
            if (disposed) return
            playerRef.current = target
            if (!gameClock.isPaused()) target.playVideo()
          },
          onError() {
            if (!disposed) setFailed(true)
          },
        },
      })
    }).catch(() => {
      if (!disposed) setFailed(true)
    })
    return () => {
      disposed = true
      unsubscribe()
      playerRef.current = null
      player?.destroy()
    }
  }, [videoId, playerRef])

  return (
    <div className="rp-video">
      <div ref={hostRef} className="rp-video-player" />
      {failed && (
        <p role="status">
          영상을 불러올 수 없어요. <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noreferrer">YouTube에서 듣기</a>
        </p>
      )}
    </div>
  )
}
