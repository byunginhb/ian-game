import { useEffect, useMemo, useRef, useState } from 'react'
import { gameClock } from '../lib/gameClock'
import { COLOR_HEX, COLOR_NAMES, MARK_MARBLE, MARK_SOLVED, MARK_THRIFT, cycleCell, emptyBoard, evaluate, isUnlocked, nextHint, parseLevel, readProgress, recordMarks, saveProgress, trace } from '../lib/lightLab'
import { LEVELS } from '../lib/lightLabLevels'
import { createLabScene } from '../lib/lightLabScene'
import { createLabAudio } from '../lib/lightLabAudio'
import './LightLab.css'

const BOARDS = LEVELS.map(parseLevel)
const CHAPTERS = [
  { name: '반사', line: '빛은 곧게 나아가다 거울을 만나면 튕겨 나가요.', note: '빛은 곧게 나아가요. 거울을 만나면 들어온 각도와 똑같은 각도로 튕겨 나가요. 비스듬히 세운 거울은 빛의 방향을 직각으로 꺾어요.' },
  { name: '빛의 삼원색', line: '빨강·초록·파랑 빛을 겹치면 새 색이 태어나요.', note: '빛은 겹칠수록 밝아져요. 빨강과 초록이 만나면 노랑, 초록과 파랑이 만나면 청록, 빨강과 파랑이 만나면 자홍, 셋이 모두 만나면 하양이 돼요. 색유리는 자기 색에 들어 있는 빛만 통과시켜요.' },
  { name: '프리즘', line: '흰빛 속에 숨은 색을 프리즘으로 갈라내요.', note: '흰빛에는 여러 색이 섞여 있어요. 프리즘을 지나면 색마다 꺾이는 정도가 달라 갈라져요. 이 실험판의 프리즘은 왼쪽으로 빨강, 가운데로 초록, 오른쪽으로 파랑을 보내요.' },
  { name: '종합 실험', line: '배운 것을 모두 써서 가장 어려운 판을 풀어요.', note: '광원이 둘이고 장치도 여러 개예요. 수정마다 어떤 색이 필요한지 먼저 살피고, 그 색을 만들 빛을 어디서 데려올지 거꾸로 생각해 보세요.' },
]
const MIXES = [[1, 2, 3], [2, 4, 6], [1, 4, 5]]
const GOALS = [[MARK_SOLVED, '수정 모두 밝히기'], [MARK_MARBLE, '유리구슬 비추기'], [MARK_THRIFT, '거울 아껴 쓰기']]

function supportsWebGL() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return Boolean(gl)
  } catch { return false }
}

const Dot = ({ color }) => <i className="ll-dot" style={{ background: color }} />
const MirrorIcon = ({ used }) => <svg className={`ll-mirror-icon${used ? ' is-used' : ''}`} viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19L19 5" /><path d="M3.5 17.5l3 3M17.5 3.5l3 3" /></svg>

/** 표지 그림: 흰빛이 거울에서 꺾이고, 세 색 빛이 겹치는 모습. */
function CoverDiagram() {
  return (
    <svg className="ll-cover" viewBox="0 0 320 200" role="img" aria-label="거울에서 꺾이는 빛과 겹쳐서 색이 바뀌는 세 가지 빛">
      <rect width="320" height="200" rx="3" fill="#0b0e14" />
      <g stroke="#ffffff14" strokeWidth="1">{[40, 80, 120, 160].map((y) => <path key={y} d={`M0 ${y}H320`} />)}{[40, 80, 120, 160, 200, 240, 280].map((x) => <path key={x} d={`M${x} 0V200`} />)}</g>
      <path d="M24 140H120V40" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" className="ll-cover-beam" />
      <path d="M100 160L140 120" stroke="#c8a05a" strokeWidth="6" strokeLinecap="round" />
      <path d="M96 140a24 24 0 0 0 7 -17" fill="none" stroke="#ffb347" strokeWidth="1.5" /><path d="M120 116a24 24 0 0 0 -17 7" fill="none" stroke="#ffb347" strokeWidth="1.5" />
      <text x="62" y="126" fill="#ffb347" fontSize="11">45°</text><text x="126" y="102" fill="#ffb347" fontSize="11">45°</text>
      <g style={{ mixBlendMode: 'screen' }}><circle cx="226" cy="84" r="38" fill="#ff3b30" /><circle cx="204" cy="122" r="38" fill="#22d45f" /><circle cx="248" cy="122" r="38" fill="#2f6bff" /></g>
    </svg>
  )
}

export default function LightLab() {
  const [progress, setProgress] = useState(() => readProgress(window.localStorage, BOARDS.length))
  const [screen, setScreen] = useState('menu')
  const [levelIndex, setLevelIndex] = useState(0)
  const [placed, setPlaced] = useState(() => emptyBoard(BOARDS[0]))
  const [history, setHistory] = useState([])
  const [hint, setHint] = useState(null)
  const [cursorIndex, setCursorIndex] = useState(-1)
  const [report, setReport] = useState(0)
  const [notebook, setNotebook] = useState(false)
  const [toast, setToast] = useState(null)
  const [webgl, setWebgl] = useState(supportsWebGL)
  const hostRef = useRef(null), topRef = useRef(null), bottomRef = useRef(null), sceneRef = useRef(null), audioRef = useRef(null)
  const measureRef = useRef(() => {}), actionsRef = useRef({}), screenRef = useRef('menu'), reportTimer = useRef(0), downRef = useRef(null), toastId = useRef(0)

  const level = BOARDS[levelIndex], chapter = CHAPTERS[level.chapter]
  const traced = useMemo(() => trace(level, placed), [level, placed])
  const evaluation = useMemo(() => evaluate(level, placed, traced), [level, placed, traced])
  const lit = evaluation.crystals.filter((crystal) => crystal.got === crystal.need).length
  const earned = progress.marks[levelIndex]

  const commit = (next) => { setProgress(next); saveProgress(window.localStorage, next) }
  const say = (text) => setToast({ text, id: ++toastId.current })

  // 렌더러·오디오·그리기 루프는 한 번만 만든다.
  useEffect(() => {
    if (!webgl) return undefined
    const canvas = document.createElement('canvas')
    canvas.className = 'll-canvas'
    hostRef.current.appendChild(canvas)
    let scene
    try { scene = createLabScene(canvas) } catch { canvas.remove(); queueMicrotask(() => setWebgl(false)); return undefined }
    sceneRef.current = scene
    const audio = createLabAudio()
    audioRef.current = audio
    const measure = () => scene.resize({ top: (topRef.current?.offsetHeight || 0) + 8, bottom: (bottomRef.current?.offsetHeight || 0) + 8 })
    const observer = new ResizeObserver(measure)
    observer.observe(hostRef.current)
    // 웹폰트가 늦게 도착해 안내 높이가 바뀌면 판 위치를 다시 맞춘다.
    document.fonts?.ready.then(() => measureRef.current())
    measureRef.current = measure
    const unsubscribe = gameClock.subscribe(() => audio.setPaused(gameClock.isPaused()))
    let last = gameClock.now(), frame = 0
    const tick = (now) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
      last = now
      if (screenRef.current === 'play') scene.update(dt)
      frame = gameClock.requestAnimationFrame(tick)
    }
    frame = gameClock.requestAnimationFrame(tick)
    const onKey = (event) => {
      if (screenRef.current !== 'play' || actionsRef.current.locked || event.metaKey || event.ctrlKey || event.altKey) return
      const move = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[event.key]
      const key = event.key.toLowerCase()
      if (move) actionsRef.current.move(...move)
      else if (event.key === ' ' || event.key === 'Enter') actionsRef.current.tapCursor()
      else if (key === 'z') actionsRef.current.undo()
      else if (key === 'r') actionsRef.current.reset()
      else if (key === 'h') actionsRef.current.hint()
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      gameClock.cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKey)
      observer.disconnect(); unsubscribe(); audio.dispose(); scene.dispose(); canvas.remove()
      sceneRef.current = null
    }
  }, [webgl])

  useEffect(() => {
    if (screen !== 'play' || !sceneRef.current) return
    sceneRef.current.load(level)
    measureRef.current()
  }, [screen, level])

  useEffect(() => {
    if (screen === 'play') sceneRef.current?.sync({ placed, traced, evaluation, cursorIndex, hint })
  }, [screen, level, placed, traced, evaluation, cursorIndex, hint])

  useEffect(() => { audioRef.current?.setEnabled(progress.sound) }, [progress.sound])

  const openLevel = (index) => {
    audioRef.current?.unlock()
    audioRef.current?.play('page')
    gameClock.clearTimeout(reportTimer.current)
    setLevelIndex(index); setPlaced(emptyBoard(BOARDS[index])); setHistory([]); setHint(null); setReport(0); setCursorIndex(-1); setToast(null)
    // 장마다 첫 실험에서는 그 장의 실험 노트를 먼저 펼쳐 준다.
    setNotebook(index % 6 === 0 && !(progress.marks[index] & MARK_SOLVED))
    screenRef.current = 'play'; setScreen('play')
  }
  const toMenu = () => { gameClock.clearTimeout(reportTimer.current); screenRef.current = 'menu'; setScreen('menu') }

  /** 새 배치를 적용하고, 켜진 수정·풀이 여부에 맞춰 소리와 기록을 처리한다. */
  const applyBoard = (next, sound, remember = true) => {
    const audio = audioRef.current, result = evaluate(level, next)
    const nowLit = result.crystals.filter((crystal) => crystal.got === crystal.need).length
    audio?.unlock()
    audio?.play(sound)
    if (nowLit > lit) audio?.play('crystal', nowLit - 1)
    if (result.marble && !evaluation.marble) audio?.play('marble')
    if (remember) setHistory([...history, placed])
    setPlaced(next); setHint(null)
    gameClock.clearTimeout(reportTimer.current)
    setReport(0)
    // 이미 풀린 판에 상관없는 거울을 더 놓았을 때는 다시 축하하지 않는다. 새 목표를 이뤘을 때만 알린다.
    if (result.solved && (!evaluation.solved || result.marks & ~evaluation.marks)) {
      audio?.play('solved')
      commit(recordMarks(progress, levelIndex, result.marks))
      reportTimer.current = gameClock.setTimeout(() => setReport(result.marks), 1100)
    }
  }

  const tap = (index) => {
    if (index < 0 || notebook) return
    const { placed: next, change } = cycleCell(level, placed, index)
    if (change === 'blocked') { audioRef.current?.play('blocked'); return }
    if (change === 'empty-tray') { audioRef.current?.play('blocked'); say('거울을 다 썼어요. 놓아 둔 거울을 눌러 치우면 다시 쓸 수 있어요.'); return }
    applyBoard(next, change)
  }
  const undo = () => {
    if (!history.length) return
    setHistory(history.slice(0, -1))
    applyBoard(history[history.length - 1], 'removed', false)
  }
  const reset = () => { if (placed.some(Boolean)) applyBoard(emptyBoard(level), 'removed') }
  const showHint = () => {
    const next = evaluation.solved ? null : nextHint(level, placed)
    if (!next) return
    audioRef.current?.unlock(); audioRef.current?.play('hint')
    setHint(next)
    say(next.mirror ? '깜빡이는 자리에 거울을 이 방향으로 놓아 보세요.' : '깜빡이는 거울은 치워 보세요.')
  }
  const moveCursor = (dx, dy) => {
    const x = cursorIndex < 0 ? 0 : Math.max(0, Math.min(level.w - 1, (cursorIndex % level.w) + dx))
    const y = cursorIndex < 0 ? 0 : Math.max(0, Math.min(level.h - 1, Math.floor(cursorIndex / level.w) + dy))
    setCursorIndex(y * level.w + x)
  }
  useEffect(() => { actionsRef.current = { locked: notebook, move: moveCursor, tapCursor: () => tap(cursorIndex), undo, reset, hint: showHint } })

  const onPointerDown = (event) => { downRef.current = { x: event.clientX, y: event.clientY } }
  const onPointerUp = (event) => {
    const down = downRef.current
    downRef.current = null
    if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 12) return
    const index = sceneRef.current?.pick(event.clientX, event.clientY) ?? -1
    if (event.pointerType === 'mouse') setCursorIndex(index)
    tap(index)
  }
  const onPointerMove = (event) => {
    if (event.pointerType !== 'mouse') return
    const index = sceneRef.current?.pick(event.clientX, event.clientY) ?? -1
    if (index !== cursorIndex) setCursorIndex(index)
  }

  const usedCount = evaluation.used
  const goalDone = [evaluation.solved, evaluation.solved && evaluation.marble, evaluation.solved && usedCount <= level.par]

  return (
    <div className={`ll-container is-${screen}`}>
      <div ref={hostRef} className="ll-host" />
      {!webgl && <p className="ll-unsupported" role="alert">이 기기에서는 3D 실험판을 켤 수 없어요. 다른 브라우저에서 다시 열어 주세요.</p>}

      {screen === 'menu' && webgl && (
        <div className="ll-menu">
          <div className="ll-menu-page">
            <header className="ll-head">
              <div>
                <h1>빛 꺾기 실험실</h1>
                <p>거울을 놓아 빛의 길을 꺾고, 수정마다 꼭 맞는 색의 빛을 보내 주세요.</p>
                <button className="ll-paper-button" aria-pressed={progress.sound} onClick={() => commit({ ...progress, sound: !progress.sound })}>소리 {progress.sound ? '켜짐' : '꺼짐'}</button>
              </div>
              <CoverDiagram />
            </header>
            <div className="ll-chapters">
              {CHAPTERS.map((item, c) => (
                <section key={item.name} className="ll-chapter" aria-label={`${c + 1}장 ${item.name}`}>
                  <h2><span>{c + 1}장</span>{item.name}</h2>
                  <p>{item.line}</p>
                  <div className="ll-experiments">
                    {[0, 1, 2, 3, 4, 5].map((n) => {
                      const index = c * 6 + n, marks = progress.marks[index], open = isUnlocked(progress, index)
                      return (
                        <button key={index} className={`ll-experiment${marks === 7 ? ' is-complete' : ''}`} disabled={!open} aria-label={open ? `실험 ${index + 1} 시작` : `실험 ${index + 1} 잠김`} onClick={() => openLevel(index)}>
                          <strong>{index + 1}</strong>
                          <span className="ll-marks" aria-hidden="true">{[[MARK_SOLVED, COLOR_HEX[1]], [MARK_MARBLE, COLOR_HEX[2]], [MARK_THRIFT, COLOR_HEX[4]]].map(([mark, color]) => <i key={mark} style={marks & mark ? { background: color, borderColor: color } : undefined} />)}</span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
            <p className="ll-legend"><Dot color={COLOR_HEX[1]} /> 수정 모두 밝히기 <Dot color={COLOR_HEX[2]} /> 유리구슬 비추기 <Dot color={COLOR_HEX[4]} /> 거울 아껴 쓰기. 세 빛을 모두 모으면 칸이 하얗게 빛나요.</p>
          </div>
        </div>
      )}

      {screen === 'play' && (
        <div className="ll-play" data-solved={evaluation.solved} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerMove={onPointerMove} onPointerLeave={() => setCursorIndex(-1)}>
          <div ref={topRef} className="ll-top">
            <div className="ll-heading">
              <h2>실험 {level.id}</h2>
              <span>{level.chapter + 1}장 {chapter.name}</span>
            </div>
            <ul className="ll-goals" aria-label="목표">
              <li className={goalDone[0] ? 'is-done' : ''}><Dot color={COLOR_HEX[1]} />수정 {lit}/{evaluation.crystals.length}</li>
              <li className={goalDone[1] ? 'is-done' : ''}><Dot color={COLOR_HEX[2]} />유리구슬</li>
              <li className={goalDone[2] ? 'is-done' : ''}><Dot color={COLOR_HEX[4]} />거울 {level.par}개 이하</li>
            </ul>
          </div>
          <p className="ll-status" role="status">수정 {evaluation.crystals.length}개 중 {lit}개가 켜졌어요. 거울 {usedCount}개 사용.{evaluation.solved ? ' 실험 성공!' : ''}</p>
          {toast && <p key={toast.id} className="ll-toast">{toast.text}</p>}
          <div ref={bottomRef} className="ll-bottom" onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()}>
            <div className="ll-tray" aria-label={`남은 거울 ${level.mirrors - usedCount}개`}>
              <span>거울</span>
              {Array.from({ length: level.mirrors }, (_, i) => <MirrorIcon key={i} used={i >= level.mirrors - usedCount} />)}
            </div>
            <div className="ll-tools">
              <button onClick={undo} disabled={!history.length}>되돌리기</button>
              <button onClick={reset} disabled={!placed.some(Boolean)}>모두 치우기</button>
              <button onClick={showHint} disabled={evaluation.solved}>힌트</button>
              <button onClick={() => setNotebook(true)}>실험 노트</button>
              <button onClick={toMenu}>목록</button>
            </div>
          </div>

          {notebook && (
            <div className="ll-sheet" role="region" aria-labelledby="ll-note-title" onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()}>
              <div className="ll-note">
                <h3 id="ll-note-title">{level.chapter + 1}장 {chapter.name}</h3>
                <p>{chapter.note}</p>
                {level.chapter >= 1 && (
                  <ul className="ll-mixes" aria-label="빛 섞기 표">
                    {MIXES.map(([a, b, sum]) => <li key={sum}><Dot color={COLOR_HEX[a]} />{COLOR_NAMES[a]} + <Dot color={COLOR_HEX[b]} />{COLOR_NAMES[b]} = <Dot color={COLOR_HEX[sum]} /><b>{COLOR_NAMES[sum]}</b></li>)}
                    <li><Dot color={COLOR_HEX[1]} /><Dot color={COLOR_HEX[2]} /><Dot color={COLOR_HEX[4]} /> 모두 = <Dot color="#fff" /><b>하양</b></li>
                  </ul>
                )}
                <p className="ll-note-how">빈칸을 누르면 거울이 놓이고, 한 번 더 누르면 방향이 바뀌고, 또 누르면 치워져요. 수정 받침의 색 띠가 그 수정에 필요한 빛의 색이에요.</p>
                <button className="ll-paper-button is-primary" onClick={() => setNotebook(false)}>실험 시작</button>
              </div>
            </div>
          )}

          {report > 0 && !notebook && (
            <div className="ll-sheet is-report" role="region" aria-labelledby="ll-report-title" onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()}>
              <div className="ll-note">
                <span className="ll-stamp" aria-hidden="true">성공</span>
                <h3 id="ll-report-title">실험 {level.id} 성공</h3>
                <ul className="ll-report-goals">
                  {GOALS.map(([mark, label], i) => <li key={mark} className={report & mark ? 'is-done' : ''}><Dot color={COLOR_HEX[[1, 2, 4][i]]} />{label}<em>{report & mark ? '해냄' : earned & mark ? '전에 해냄' : '아직'}</em></li>)}
                </ul>
                {(earned | report) !== 7 && <p>{!((earned | report) & MARK_MARBLE) ? '유리구슬은 다른 길로 빛을 돌려야 닿아요. 거울을 하나 더 써 보세요.' : `거울 ${level.par}개만으로도 풀 수 있어요.`}</p>}
                <div className="ll-report-actions">
                  {levelIndex < BOARDS.length - 1 && <button className="ll-paper-button is-primary" onClick={() => openLevel(levelIndex + 1)}>다음 실험</button>}
                  <button className="ll-paper-button" onClick={() => setReport(0)}>더 해 보기</button>
                  <button className="ll-paper-button" onClick={toMenu}>목록</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
