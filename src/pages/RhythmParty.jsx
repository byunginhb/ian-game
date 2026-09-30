import { useCallback, useEffect, useRef, useState } from 'react'
import { gameClock } from '../lib/gameClock'
import { createRhythmAudio } from '../lib/rhythmAudio'
import { SONGS, MODES, CHARACTERS, LANE_KEYS, LANE_LABELS, RECORD_KEY, buildChart, findHit, nextOpenNote, judge, scoreFor, starsFor } from '../lib/rhythm'
import RhythmCharacter from '../components/RhythmCharacter'
import './RhythmParty.css'

const LANE_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7']
const GRADE_TEXT = { perfect: '최고!', good: '좋아!', late: '잘했어!', miss: '놓쳤어', stray: '헛손!' }
const LOOKAHEAD = 90
const HIT_LINE = .86
const MODE_KEY = 'ian-rhythm-mode-v1'

function readStorage(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}

function writeStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* Records are optional. */ }
}

const Stars = ({ count }) => <span className="rp-stars" aria-label={`별 ${count}개`}>{[0, 1, 2].map((i) => <span key={i} className={i < count ? 'on' : ''}>★</span>)}</span>

/** Stop the browser from turning fast taps into zoom, text selection, drags or long-press menus. */
function useNoGestures(rootRef, padRef) {
  useEffect(() => {
    const root = rootRef.current
    const prevent = (event) => event.preventDefault()
    const rootEvents = ['dblclick', 'contextmenu', 'selectstart', 'dragstart']
    rootEvents.forEach((type) => root.addEventListener(type, prevent))
    document.addEventListener('gesturestart', prevent)
    return () => {
      rootEvents.forEach((type) => root.removeEventListener(type, prevent))
      document.removeEventListener('gesturestart', prevent)
    }
  }, [rootRef])
  useEffect(() => {
    const pad = padRef.current
    if (!pad) return
    const prevent = (event) => { if (event.cancelable) event.preventDefault() }
    pad.addEventListener('touchstart', prevent, { passive: false })
    pad.addEventListener('touchmove', prevent, { passive: false })
    pad.addEventListener('touchend', prevent, { passive: false })
    return () => ['touchstart', 'touchmove', 'touchend'].forEach((type) => pad.removeEventListener(type, prevent))
  })
}

export default function RhythmParty() {
  const [screen, setScreen] = useState('menu')
  const [modeId, setModeId] = useState(() => (readStorage(MODE_KEY, 'kid') === 'adult' ? 'adult' : 'kid'))
  const [records, setRecords] = useState(() => readStorage(RECORD_KEY, {}))
  const [song, setSong] = useState(SONGS[0])
  const [time, setTime] = useState(0)
  const [pressed, setPressed] = useState([false, false, false, false, false])
  const [feedback, setFeedback] = useState(null)
  const [result, setResult] = useState(null)
  const rootRef = useRef(null)
  const padRef = useRef(null)
  const playRef = useRef(null)
  const audioRef = useRef(null)
  const mode = MODES[modeId]

  useNoGestures(rootRef, padRef)
  useEffect(() => () => audioRef.current?.close(), [])

  const audio = () => (audioRef.current ??= createRhythmAudio())

  const startSong = (next) => {
    audio().unlock()
    const chart = buildChart(next, mode)
    playRef.current = {
      chart, time: -mode.travel - 800, lastClock: gameClock.now(), results: {}, score: 0, combo: 0, maxCombo: 0,
      backingIndex: 0, openIndex: 0, waiting: null,
    }
    setSong(next)
    setTime(-mode.travel - 800)
    setFeedback(null)
    setScreen('play')
  }

  const finish = useCallback(() => {
    const play = playRef.current
    const grades = Object.values(play.results)
    const count = (grade) => grades.filter((g) => g === grade).length
    const stars = starsFor(play.results, play.chart.notes.length)
    const key = `${modeId}:${song.id}`
    const best = records[key]
    const isBest = !best || play.score > best.score
    if (isBest) {
      const next = { ...records, [key]: { score: play.score, stars: Math.max(stars, best?.stars ?? 0) } }
      setRecords(next)
      writeStorage(RECORD_KEY, next)
    }
    setResult({ score: play.score, stars, isBest, maxCombo: play.maxCombo, perfect: count('perfect'), good: count('good'), late: count('late'), miss: count('miss') })
    if (stars) audio().fanfare()
    setScreen('result')
  }, [modeId, song, records])

  useEffect(() => {
    if (screen !== 'play') return
    let frame
    const loop = () => {
      const play = playRef.current
      const clock = gameClock.now()
      if (!play.waiting) play.time += clock - play.lastClock
      play.lastClock = clock
      const { backing, notes, duration } = play.chart
      play.openIndex = nextOpenNote(notes, play.results, play.openIndex)
      const open = notes[play.openIndex]
      if (mode.waits && open && !play.waiting && play.time >= open.time) {
        // Hold the song with the note sitting on the line until its pad is pressed.
        play.time = open.time
        play.waiting = { id: open.id, lane: open.lane, since: clock }
      }
      while (!mode.waits && play.openIndex < notes.length && notes[play.openIndex].time < play.time - mode.good) {
        const note = notes[play.openIndex]
        play.results = { ...play.results, [note.id]: 'miss' }
        play.combo = 0
        play.openIndex = nextOpenNote(notes, play.results, play.openIndex)
        setFeedback({ grade: 'miss', id: note.id, lane: note.lane })
      }
      while (play.backingIndex < backing.length && backing[play.backingIndex].time <= play.time + LOOKAHEAD) {
        const event = backing[play.backingIndex++]
        // Skip stale beats after a slow frame instead of playing them in a burst.
        if (play.time - event.time < 120) audio().backing(event, Math.max(0, event.time - play.time) / 1000)
      }
      setTime(play.time)
      if (play.time > duration + 1200) finish()
      else frame = gameClock.requestAnimationFrame(loop)
    }
    frame = gameClock.requestAnimationFrame(loop)
    return () => gameClock.cancelAnimationFrame(frame)
  }, [screen, mode, finish])

  const press = useCallback((lane) => {
    const play = playRef.current
    if (screen !== 'play' || !play) return
    let note
    let grade
    if (play.waiting) {
      if (lane !== play.waiting.lane) { audio().tap(); return }
      note = play.chart.notes[play.waiting.id]
      grade = judge(gameClock.now() - play.waiting.since, mode) ?? 'late'
      play.waiting = null
    } else {
      note = findHit(play.chart.notes, play.results, lane, play.time, mode.good)
      grade = note && judge(play.time - note.time, mode)
    }
    if (!grade) {
      audio().tap()
      if (!mode.waits && play.combo) { play.combo = 0; setFeedback({ grade: 'stray', id: `stray-${gameClock.now()}`, lane }) }
      return
    }
    play.combo = grade === 'late' ? 0 : play.combo + 1
    play.maxCombo = Math.max(play.maxCombo, play.combo)
    play.score += scoreFor(grade, play.combo)
    play.results = { ...play.results, [note.id]: grade }
    audio().melody(note.midi, note.length)
    setFeedback({ grade, id: note.id, lane })
  }, [screen, mode])

  const setLane = (lane, down) => setPressed((old) => old.map((value, i) => (i === lane ? down : value)))

  useEffect(() => {
    if (screen !== 'play') return
    const onKey = (event) => {
      const lane = LANE_KEYS.indexOf(event.code)
      if (lane < 0 || event.ctrlKey || event.metaKey || event.altKey) return
      event.preventDefault()
      if (event.type === 'keyup') { setLane(lane, false); return }
      if (event.repeat) return
      setLane(lane, true)
      press(lane)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey) }
  }, [screen, press])

  const chooseMode = (id) => { setModeId(id); writeStorage(MODE_KEY, id) }
  const play = playRef.current
  const host = CHARACTERS[song.host]
  const waitLane = play?.waiting?.lane

  return (
    <div ref={rootRef} className={`rp-container is-${screen}`} style={{ '--host': host.color }}>
      {screen === 'menu' && (
        <div className="rp-menu">
          <header className="rp-menu-head">
            <div className="rp-parade" aria-hidden="true">{['pikachu', 'mario', 'sonic', 'lloyd'].map((id) => <RhythmCharacter key={id} id={id} />)}</div>
            <h1>리듬 파티</h1>
            <p>떨어지는 음표가 선에 닿을 때 건반을 눌러요! <b>PC</b> <kbd>C</kbd><kbd>V</kbd><kbd>B</kbd><kbd>N</kbd><kbd>M</kbd> · <b>모바일</b> 아래 건반 터치</p>
            <div className="rp-modes" role="group" aria-label="난이도">
              {Object.entries(MODES).map(([id, item]) => <button key={id} aria-pressed={modeId === id} onClick={() => chooseMode(id)}>{item.label} · {item.hint}</button>)}
            </div>
          </header>
          <ul className="rp-songs">
            {SONGS.map((item) => {
              const best = records[`${modeId}:${item.id}`]
              return (
                <li key={item.id}>
                  <button className="rp-song" style={{ '--host': CHARACTERS[item.host].color }} onClick={() => startSong(item)}>
                    <RhythmCharacter id={item.host} />
                    <span className="rp-song-text"><strong>{item.title}</strong><span>{item.ko} · {CHARACTERS[item.host].name}</span></span>
                    <span className="rp-song-best">{best ? <><Stars count={best.stars} /><small>{best.score.toLocaleString()}</small></> : <small>새 노래</small>}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {screen === 'play' && play && (
        <>
          <div className="rp-hud">
            <RhythmCharacter id={song.host} className={play.combo >= 10 ? 'rp-dance is-hype' : 'rp-dance'} />
            <div className="rp-hud-song"><strong>{song.title}</strong><span>{mode.label} 모드</span></div>
            <div className="rp-hud-score"><strong>{play.score.toLocaleString()}</strong><span>{play.combo > 1 ? `${play.combo} 콤보` : ' '}</span></div>
            <button className="rp-quit" onClick={() => setScreen('menu')}>그만</button>
          </div>
          <div ref={padRef} className={`rp-stage${waitLane !== undefined ? ' is-waiting' : ''}`} style={{ '--beat': `${play.chart.beatMs}ms` }}>
            <div className="rp-highway">
              {LANE_COLORS.map((color, lane) => <div key={lane} className={`rp-lane${pressed[lane] ? ' is-down' : ''}${waitLane === lane ? ' is-target' : ''}`} style={{ '--lane': color }} />)}
              <div className="rp-hit-line" style={{ top: `${HIT_LINE * 100}%` }} />
              {play.chart.notes.map((note) => {
                const ahead = note.time - time
                if (ahead > mode.travel || ahead < -260 || ['perfect', 'good', 'late'].includes(play.results[note.id])) return null
                const y = (1 - ahead / mode.travel) * HIT_LINE
                return <div key={note.id} className={`rp-note${play.results[note.id] === 'miss' ? ' is-miss' : ''}`}
                  style={{ top: `${y * 100}%`, left: `${note.lane * 20}%`, '--lane': LANE_COLORS[note.lane] }} />
              })}
              {waitLane !== undefined && <div className="rp-wait" style={{ left: `clamp(64px, ${waitLane * 20 + 10}%, calc(100% - 64px))` }}>여기를 눌러요!</div>}
              {time < 0 && <div className="rp-count">{Math.ceil(-time / 1000) > 3 ? '준비!' : Math.ceil(-time / 1000) || '시작!'}</div>}
              {feedback && <div key={feedback.id} className={`rp-feedback is-${feedback.grade}`} style={{ left: `${feedback.lane * 20 + 10}%` }}>{GRADE_TEXT[feedback.grade]}</div>}
            </div>
            <div className="rp-pads">
              {LANE_LABELS.map((label, lane) => (
                <button key={label} className={`rp-pad${pressed[lane] ? ' is-down' : ''}${waitLane === lane ? ' is-target' : ''}`} style={{ '--lane': LANE_COLORS[lane] }} aria-label={`${lane + 1}번 건반 (${label})`}
                  onPointerDown={(event) => { event.preventDefault(); setLane(lane, true); press(lane) }}
                  onPointerUp={() => setLane(lane, false)} onPointerCancel={() => setLane(lane, false)} onPointerLeave={() => setLane(lane, false)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {screen === 'result' && result && (
        <div className="rp-result" role="status">
          <RhythmCharacter id={song.host} className="rp-dance is-hype" />
          <h2>{result.stars === 3 ? '완벽한 무대!' : result.stars ? '멋진 연주!' : '다시 해 볼까?'}</h2>
          <p className="rp-result-song">{song.title} · {mode.label} 모드</p>
          <Stars count={result.stars} />
          <p className="rp-result-score">{result.score.toLocaleString()}점{result.isBest && <em>최고 기록!</em>}</p>
          <dl className="rp-result-grid">
            <div><dt>최고</dt><dd>{result.perfect}</dd></div>
            <div><dt>좋아</dt><dd>{result.good}</dd></div>
            {modeId === 'kid' ? <div><dt>기다림</dt><dd>{result.late}</dd></div> : <div><dt>놓침</dt><dd>{result.miss}</dd></div>}
            <div><dt>콤보</dt><dd>{result.maxCombo}</dd></div>
          </dl>
          <div className="rp-result-actions">
            <button onClick={() => startSong(song)}>한 번 더</button>
            <button onClick={() => setScreen('menu')}>다른 노래</button>
          </div>
        </div>
      )}
    </div>
  )
}
