import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTouchLock } from '../hooks/useTouchLock'
import './SwimmingRace.css'

const FINISH = 100
const HUD_UPDATE_INTERVAL = 100
const FINISH_HOLD_MS = 700
const ROUND_INFO = [
  { label: '예선', level: 'ROUND 1' },
  { label: '준결승', level: 'ROUND 2' },
  { label: '결승', level: 'FINAL' },
]

const PLAYER_TYPES = {
  child: {
    label: '어린이',
    shortLabel: 'KIDS',
    icon: '🐬',
    description: '빠른 가속 · 실수 회복 쉬움',
    aiSpeeds: [5.4, 6.2, 7.0],
    aiVariance: 0.9,
    acceleration: 1.22,
    streakBonus: 0.055,
    maxSpeed: 10.8,
    drag: 2.55,
    mistakeMultiplier: 0.7,
    strokeNudge: 0.48,
    boostSpeed: 12.8,
    boostFloor: 12.1,
    boostDrag: 0.8,
    boostDuration: 2100,
  },
  adult: {
    label: '어른',
    shortLabel: 'PRO',
    icon: '🦈',
    description: '강한 AI · 실수 감속 큼',
    aiSpeeds: [7.4, 8.3, 9.2],
    aiVariance: 1.15,
    acceleration: 0.9,
    streakBonus: 0.025,
    maxSpeed: 10,
    drag: 3.8,
    mistakeMultiplier: 0.38,
    strokeNudge: 0.2,
    boostSpeed: 11.9,
    boostFloor: 11.2,
    boostDrag: 1.8,
    boostDuration: 1250,
  },
}

const SWIMMERS = [
  { id: 'coral', name: '코랄', color: '#fb7185', cap: '#ef4444', lane: 1 },
  { id: 'wave', name: '웨이브', color: '#60a5fa', cap: '#1d4ed8', lane: 2 },
  { id: 'ian', name: 'IAN', color: '#facc15', cap: '#fff7a8', lane: 3, player: true },
  { id: 'turtle', name: '터틀', color: '#4ade80', cap: '#16a34a', lane: 4 },
  { id: 'shark', name: '샤크', color: '#a78bfa', cap: '#7c3aed', lane: 5 },
  { id: 'rocket', name: '로켓', color: '#fb923c', cap: '#ea580c', lane: 6 },
]

const AI_VARIANCE = [-0.28, 0.02, 0, 0.2, 0.38, 0.52]

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function makeRacers() {
  return SWIMMERS.map((swimmer) => ({ ...swimmer, progress: 0, finishedAt: null }))
}

function ordinal(rank) {
  return `${rank}위`
}

function SwimmingRace() {
  const containerRef = useRef(null)
  const poolRef = useRef(null)
  useTouchLock(containerRef)

  const [phase, setPhase] = useState('menu')
  const [playerType, setPlayerType] = useState(null)
  const [round, setRound] = useState(1)
  const [countdown, setCountdown] = useState(3)
  const [racers, setRacers] = useState(makeRacers)
  const [speed, setSpeed] = useState(0)
  const [boosts, setBoosts] = useState(0)
  const [lastStroke, setLastStroke] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [result, setResult] = useState(null)
  const [championCount, setChampionCount] = useState(0)
  const [boosting, setBoosting] = useState(false)

  const phaseRef = useRef(phase)
  const playerTypeRef = useRef(null)
  const roundRef = useRef(round)
  const racersRef = useRef(racers)
  const speedRef = useRef(0)
  const streakRef = useRef(0)
  const boostsRef = useRef(0)
  const lastStrokeRef = useRef(null)
  const boostUntilRef = useRef(0)
  const raceStartedAtRef = useRef(0)
  const lastFrameRef = useRef(0)
  const animationRef = useRef(0)
  const feedbackTimerRef = useRef(0)
  const finishTimerRef = useRef(0)
  const lastHudUpdateRef = useRef(0)
  const boostingRef = useRef(false)
  const racerElementRefs = useRef(new Map())

  const racerRefCallbacks = useMemo(
    () => Object.fromEntries(SWIMMERS.map((swimmer) => [
      swimmer.id,
      (node) => {
        if (node) racerElementRefs.current.set(swimmer.id, node)
        else racerElementRefs.current.delete(swimmer.id)
      },
    ])),
    [],
  )

  const paintRacers = useCallback((nextRacers) => {
    const poolWidth = poolRef.current?.clientWidth ?? 0
    nextRacers.forEach((racer) => {
      const element = racerElementRefs.current.get(racer.id)
      if (element && poolWidth > 0) {
        const trackX = poolWidth * (0.065 + racer.progress * 0.00855)
        element.style.setProperty('--racer-x', `${trackX}px`)
      }
    })
  }, [])

  const sortedRacers = useMemo(
    () => [...racers].sort((a, b) => b.progress - a.progress),
    [racers],
  )
  const liveRank = sortedRacers.findIndex((racer) => racer.player) + 1
  const roundInfo = ROUND_INFO[round - 1]
  const difficulty = PLAYER_TYPES[playerType ?? 'child']

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    roundRef.current = round
  }, [round])

  useEffect(() => {
    paintRacers(racersRef.current)
  }, [paintRacers, phase, round])

  useEffect(() => {
    try {
      setChampionCount(Number(localStorage.getItem('swimming-race-champions')) || 0)
    } catch {
      // 기록 저장이 막혀도 게임 진행에는 영향이 없습니다.
    }
  }, [])

  const showFeedback = useCallback((kind, text) => {
    window.clearTimeout(feedbackTimerRef.current)
    setFeedback({ kind, text, id: performance.now() })
    feedbackTimerRef.current = window.setTimeout(() => setFeedback(null), 520)
  }, [])

  const choosePlayerType = useCallback((type) => {
    playerTypeRef.current = type
    setPlayerType(type)
  }, [])

  const startRound = useCallback((targetRound = roundRef.current) => {
    if (!playerTypeRef.current) return
    window.cancelAnimationFrame(animationRef.current)
    window.clearTimeout(finishTimerRef.current)
    roundRef.current = targetRound
    setRound(targetRound)
    const freshRacers = makeRacers()
    racersRef.current = freshRacers
    speedRef.current = 0
    streakRef.current = 0
    boostsRef.current = 0
    lastStrokeRef.current = null
    boostUntilRef.current = 0
    lastHudUpdateRef.current = 0
    boostingRef.current = false
    setRacers(freshRacers)
    setSpeed(0)
    setBoosts(0)
    setLastStroke(null)
    setBoosting(false)
    setFeedback(null)
    setResult(null)
    setCountdown(3)
    setPhase('countdown')
    phaseRef.current = 'countdown'
    window.requestAnimationFrame(() => paintRacers(freshRacers))
  }, [paintRacers])

  useEffect(() => {
    if (phase !== 'countdown') return undefined

    const timer = window.setTimeout(() => {
      if (countdown > 0) {
        setCountdown((value) => value - 1)
      } else {
        raceStartedAtRef.current = performance.now()
        lastFrameRef.current = performance.now()
        lastHudUpdateRef.current = performance.now()
        setPhase('racing')
        phaseRef.current = 'racing'
      }
    }, countdown > 0 ? 720 : 500)

    return () => window.clearTimeout(timer)
  }, [countdown, phase])

  const finishRace = useCallback((finalRacers) => {
    if (phaseRef.current !== 'racing' && phaseRef.current !== 'touching') return

    const ranked = [...finalRacers].sort((a, b) => {
      if (a.finishedAt !== null && b.finishedAt !== null) return a.finishedAt - b.finishedAt
      return b.progress - a.progress
    })
    const playerRank = ranked.findIndex((racer) => racer.player) + 1
    const won = playerRank === 1
    const isChampion = won && roundRef.current === ROUND_INFO.length

    if (isChampion) {
      setChampionCount((current) => {
        const next = current + 1
        try {
          localStorage.setItem('swimming-race-champions', String(next))
        } catch {
          // 기록 저장이 막혀도 우승 결과는 그대로 표시합니다.
        }
        return next
      })
    }

    setResult({ rank: playerRank, won, isChampion, ranked })
    setPhase('finished')
    phaseRef.current = 'finished'
  }, [])

  useEffect(() => {
    if (phase !== 'racing') return undefined

    const tick = (now) => {
      if (phaseRef.current !== 'racing') return

      const dt = clamp((now - lastFrameRef.current) / 1000, 0, 0.05)
      lastFrameRef.current = now
      const elapsed = (now - raceStartedAtRef.current) / 1000
      const activeBoost = now < boostUntilRef.current
      let nextSpeed = Math.max(0, speedRef.current - dt * (activeBoost ? difficulty.boostDrag : difficulty.drag))
      if (activeBoost) nextSpeed = Math.max(nextSpeed, difficulty.boostFloor)
      speedRef.current = nextSpeed

      const nextRacers = racersRef.current.map((racer, index) => {
        if (racer.progress >= FINISH) return racer

        let advance
        if (racer.player) {
          advance = nextSpeed * dt
        } else {
          const base = difficulty.aiSpeeds[roundRef.current - 1] + AI_VARIANCE[index] * difficulty.aiVariance
          const rhythm = Math.sin(elapsed * (1.25 + index * 0.11) + index * 1.7) * 0.34
          const surge = Math.sin(elapsed * 0.32 + index) > 0.82 ? 0.26 : 0
          advance = Math.max(2.8, base + rhythm + surge) * dt
        }

        const progress = Math.min(FINISH, racer.progress + advance)
        return {
          ...racer,
          progress,
          finishedAt: progress >= FINISH ? now : null,
        }
      })

      racersRef.current = nextRacers
      paintRacers(nextRacers)

      if (activeBoost !== boostingRef.current) {
        boostingRef.current = activeBoost
        setBoosting(activeBoost)
      }

      if (now - lastHudUpdateRef.current >= HUD_UPDATE_INTERVAL) {
        lastHudUpdateRef.current = now
        setRacers(nextRacers)
        setSpeed(nextSpeed)
      }

      const playerRacer = nextRacers.find((racer) => racer.player)
      if (playerRacer?.progress >= FINISH) {
        setRacers(nextRacers)
        setSpeed(nextSpeed)
        setPhase('touching')
        phaseRef.current = 'touching'
        finishTimerRef.current = window.setTimeout(() => finishRace(nextRacers), FINISH_HOLD_MS)
        return
      }

      animationRef.current = window.requestAnimationFrame(tick)
    }

    animationRef.current = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(animationRef.current)
  }, [difficulty, finishRace, paintRacers, phase])

  const stroke = useCallback((side) => {
    if (phaseRef.current !== 'racing') return

    if (lastStrokeRef.current === side) {
      speedRef.current *= difficulty.mistakeMultiplier
      streakRef.current = 0
      setSpeed(speedRef.current)
      showFeedback('miss', '같은 팔! 속도 DOWN')
      return
    }

    lastStrokeRef.current = side
    const nextStreak = streakRef.current + 1
    speedRef.current = Math.min(
      difficulty.maxSpeed,
      speedRef.current + difficulty.acceleration + Math.min(nextStreak, 8) * difficulty.streakBonus,
    )
    setSpeed(speedRef.current)
    setLastStroke(side)

    const nudgedRacers = racersRef.current.map((racer) => (
      racer.player && racer.progress < FINISH
        ? { ...racer, progress: Math.min(FINISH, racer.progress + difficulty.strokeNudge) }
        : racer
    ))
    racersRef.current = nudgedRacers
    paintRacers(nudgedRacers)

    if (nextStreak >= 10) {
      streakRef.current = 0
      boostsRef.current = 1
      setBoosts(1)
    } else {
      streakRef.current = nextStreak
    }
  }, [difficulty, paintRacers, showFeedback])

  const triggerBoost = useCallback(() => {
    if (phaseRef.current !== 'racing') return
    if (boostsRef.current <= 0) return

    boostsRef.current -= 1
    boostUntilRef.current = Math.max(performance.now(), boostUntilRef.current) + difficulty.boostDuration
    speedRef.current = difficulty.boostSpeed
    setBoosts(boostsRef.current)
    setSpeed(speedRef.current)
    boostingRef.current = true
    setBoosting(true)
    showFeedback('boost', 'SUPER BOOST!')
  }, [difficulty, showFeedback])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (['ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault()
      if (event.repeat) return
      if (event.code === 'ArrowLeft') stroke('left')
      if (event.code === 'ArrowRight') stroke('right')
      if (event.code === 'Space') triggerBoost()
    }

    window.addEventListener('keydown', onKeyDown, { passive: false })
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [stroke, triggerBoost])

  useEffect(() => () => {
    window.clearTimeout(feedbackTimerRef.current)
    window.clearTimeout(finishTimerRef.current)
    window.cancelAnimationFrame(animationRef.current)
  }, [])

  const continueGame = () => {
    if (result?.isChampion) {
      setRound(1)
      roundRef.current = 1
      setPhase('menu')
      phaseRef.current = 'menu'
      return
    }
    startRound(result?.won ? round + 1 : round)
  }

  return (
    <main ref={containerRef} className={`swim-container${boosting ? ' is-boosting' : ''}${playerType ? ` is-${playerType}` : ''}`}>
      <div className="swim-shell">
        <header className="swim-topbar">
          <Link to="/" className="swim-back" aria-label="게임 목록으로 돌아가기">← 게임 목록</Link>
          <div className="swim-title-lockup">
            <span className="swim-title-kicker">IAN AQUATICS</span>
            <h1>이겨야해. <em>어푸어푸</em></h1>
          </div>
          <div className="swim-trophy" title="결승 우승 횟수">
            <span>🏆</span>
            <strong>{championCount}</strong>
          </div>
        </header>

        <section className="swim-scoreboard" aria-label="경기 현황">
          <div className="swim-round-block">
            <small>ROUND {round}/3</small>
            <strong>{roundInfo.label}</strong>
          </div>
          <div
            className="swim-difficulty"
            aria-label={playerType ? `${difficulty.label} 난이도 ${roundInfo.level}` : `선수 선택 ${roundInfo.level}`}
          >
            {ROUND_INFO.map((info, index) => (
              <span key={info.level} className={index < round ? 'is-on' : ''} />
            ))}
            <b>{playerType ? difficulty.shortLabel : 'PICK'} · {roundInfo.level}</b>
          </div>
          <div className="swim-live-stat">
            <small>현재 순위</small>
            <strong>{phase === 'racing' || phase === 'touching' || phase === 'finished' ? ordinal(liveRank) : '—'}</strong>
          </div>
          <div className="swim-live-stat swim-speed-stat">
            <small>속도</small>
            <strong>{Math.round(speed * 4.2)}<i> km/h</i></strong>
          </div>
        </section>

        <section ref={poolRef} className={`swim-pool-wrap${phase === 'touching' ? ' is-touching' : ''}`}>
          <div className="swim-pool-shine" />
          <div className="swim-meter-markers" aria-hidden="true">
            <span style={{ left: '28%' }}>25m</span>
            <span style={{ left: '50%' }}>50m</span>
            <span style={{ left: '72%' }}>75m</span>
          </div>
          <div className="swim-start-line" />
          <div className="swim-finish-line"><span>FINISH</span></div>

          {racers.map((racer) => (
            <div key={racer.id} className={`swim-lane${racer.player ? ' is-player' : ''}`}>
              <div className="swim-lane-label">
                <b>{racer.lane}</b>
                <span>{racer.name}</span>
              </div>
              <div
                ref={racerRefCallbacks[racer.id]}
                className={`swim-racer${racer.player ? ' is-player' : ''}${racer.player && lastStroke ? ` is-stroke-${lastStroke}` : ''}${racer.progress >= FINISH ? ' is-finished' : ''}`}
                style={{
                  '--swimmer-color': racer.color,
                  '--cap-color': racer.cap,
                }}
              >
                <span className="swim-wake" />
                <span className="swim-splash swim-splash-one" />
                <span className="swim-splash swim-splash-two" />
                <span className="swim-figure">
                  <i className="swim-arm swim-arm-top" />
                  <i className="swim-arm swim-arm-bottom" />
                  <i className="swim-body" />
                  <i className="swim-head" />
                </span>
                {racer.player && <span className="swim-you">YOU</span>}
              </div>
            </div>
          ))}

          {phase === 'menu' && (
            <div className="swim-overlay swim-menu">
              <div className="swim-menu-badge">6 LANES · 50 METERS</div>
              <h2>물살을 가르고<br /><span>제일 먼저 터치!</span></h2>
              <p>누가 수영할까요? 선수에 따라 속도와 페널티가 크게 달라져요.</p>
              <div className="swim-player-types" aria-label="선수 난이도 선택">
                {Object.entries(PLAYER_TYPES).map(([type, config]) => (
                  <button
                    key={type}
                    type="button"
                    className={`swim-player-type is-${type}${playerType === type ? ' is-selected' : ''}`}
                    aria-pressed={playerType === type}
                    onClick={() => choosePlayerType(type)}
                  >
                    <span>{config.icon}</span>
                    <strong>{config.label}</strong>
                    <small>{config.description}</small>
                    {type === 'child' && <i>추천</i>}
                  </button>
                ))}
              </div>
              <div className="swim-howto">
                <div><kbd>←</kbd><kbd>→</kbd><span>번갈아 수영</span></div>
                <div><kbd className="space-key">SPACE</kbd><span>부스터 발사</span></div>
              </div>
              <div className="swim-warning">같은 방향을 두 번 누르면 속도가 느려져요!</div>
              <button
                type="button"
                className="swim-primary"
                onClick={() => startRound(1)}
                disabled={!playerType}
              >
                {playerType ? `${difficulty.label} 경기 시작` : '선수를 골라주세요'}
              </button>
            </div>
          )}

          {phase === 'countdown' && (
            <div className="swim-overlay swim-countdown" aria-live="assertive">
              <small>TAKE YOUR MARKS</small>
              <strong key={countdown}>{countdown || '출발!'}</strong>
            </div>
          )}

          {phase === 'finished' && result && (
            <div className="swim-overlay swim-result">
              <div className={`swim-result-medal rank-${result.rank}`}>
                {result.isChampion ? '🏆' : result.won ? '🥇' : result.rank === 2 ? '🥈' : '🏊'}
              </div>
              <small>{result.isChampion ? 'IAN AQUATICS CHAMPION' : `${roundInfo.label} 결과`}</small>
              <h2>{result.isChampion ? '완벽한 우승!' : result.won ? '1위! 이겼다!' : `${result.rank}위, 다시 가자!`}</h2>
              <div className="swim-podium">
                {result.ranked.slice(0, 3).map((racer, index) => (
                  <span key={racer.id} className={racer.player ? 'is-you' : ''}>
                    <b>{index + 1}</b>{racer.name}
                  </span>
                ))}
              </div>
              <button type="button" className="swim-primary" onClick={continueGame}>
                {result.isChampion ? '처음부터 다시' : result.won ? '다음 경기' : '같은 경기 재도전'}
              </button>
            </div>
          )}

          {feedback && (
            <div key={feedback.id} className={`swim-feedback is-${feedback.kind}`} aria-live="polite">
              {feedback.text}
            </div>
          )}
        </section>

        <section className="swim-controls" aria-label="수영 조작 버튼">
          <button
            type="button"
            className={`swim-stroke-button is-left${lastStroke === 'left' ? ' is-last' : ''}`}
            onPointerDown={(event) => { event.preventDefault(); stroke('left') }}
            disabled={phase !== 'racing'}
          >
            <span>←</span><b>왼팔</b><small>LEFT</small>
          </button>

          <button
            type="button"
            className={`swim-boost-button${boosts > 0 ? ' is-ready' : ''}`}
            onPointerDown={(event) => { event.preventDefault(); triggerBoost() }}
            disabled={phase !== 'racing' || boosts <= 0}
          >
            <span>⚡</span><b>부스터</b><small>SPACE</small>
          </button>

          <button
            type="button"
            className={`swim-stroke-button is-right${lastStroke === 'right' ? ' is-last' : ''}`}
            onPointerDown={(event) => { event.preventDefault(); stroke('right') }}
            disabled={phase !== 'racing'}
          >
            <span>→</span><b>오른팔</b><small>RIGHT</small>
          </button>
        </section>
      </div>
    </main>
  )
}

export default SwimmingRace
