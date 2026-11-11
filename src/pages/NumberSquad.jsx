import { useEffect, useRef, useState } from 'react'
import { gameClock } from '../lib/gameClock'
import { SKINS, STAGE_COUNT, TRACK_HALF, WORLDS, buySkin, createRun, createStage, readProgress, recordResult, saveProgress, stepRun, unlockedStage } from '../lib/numberSquad'
import { createSquadScene } from '../lib/numberSquadScene'
import { createSquadAudio } from '../lib/numberSquadAudio'
import './NumberSquad.css'

const WORLD_COLORS = ['#2fae5a', '#1596d1', '#f4511e', '#7b4dff']
const START_HUD = { count: 1, coins: 0, combo: 0, fever: false }

const Star = ({ on }) => <svg className={`ns-star${on ? ' is-on' : ''}`} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.5l-5.9 3.2 1.2-6.6L2.5 9.5l6.6-.9z" /></svg>
const Coin = () => <svg className="ns-coin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6.2" /></svg>
const Lock = () => <svg className="ns-lock" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7.5a5 5 0 0110 0V10h1.5v11h-13V10zm2.2 0h5.6V7.5a2.8 2.8 0 00-5.6 0z" /></svg>

function supportsWebGL() {
  try {
    const probe = document.createElement('canvas')
    const gl = probe.getContext('webgl2') || probe.getContext('webgl')
    gl?.getExtension('WEBGL_lose_context')?.loseContext() // 확인용 컨텍스트는 바로 돌려준다.
    return Boolean(gl)
  } catch { return false }
}

function popFor(event, row) {
  if (event.type === 'gate') return { text: `${event.label}  →  ${event.after}명`, tone: event.good ? 'good' : 'bad' }
  if (event.type === 'quiz') return event.good ? { text: `정답!  +${row.bonus}`, tone: 'good' } : { text: `${event.prompt} = ${event.answer}`, tone: 'bad' }
  if (event.type === 'enemy') return { text: `그림자 군단  −${event.before - event.after}`, tone: 'bad' }
  if (event.type === 'hazard' && event.hit) return { text: `쿵!  −${event.before - event.after}`, tone: 'bad' }
  return null
}

export default function NumberSquad() {
  const [progress, setProgress] = useState(() => readProgress(window.localStorage))
  const [screen, setScreen] = useState('menu')
  const [stageNum, setStageNum] = useState(1)
  const [hud, setHud] = useState(START_HUD)
  const [quiz, setQuiz] = useState(null)
  const [pop, setPop] = useState(null)
  const [boss, setBoss] = useState(null)
  const [result, setResult] = useState(null)
  const [webgl, setWebgl] = useState(supportsWebGL)
  const hostRef = useRef(null), sceneRef = useRef(null), audioRef = useRef(null), runRef = useRef(null)
  const barRef = useRef(null), bossHpRef = useRef(null), bossBarRef = useRef(null)
  const screenRef = useRef('menu'), progressRef = useRef(progress)
  const inputRef = useRef({ target: 0, left: false, right: false, brake: false, drag: null })
  const [braking, setBraking] = useState(false)
  const setBrake = (value) => { inputRef.current.brake = value; setBraking(value) }

  const skin = SKINS.find((item) => item.id === progress.skin) || SKINS[0]
  const unlocked = unlockedStage(progress)
  const totalStars = progress.stars.reduce((sum, value) => sum + value, 0)

  const commit = (next) => {
    progressRef.current = next
    setProgress(next)
    saveProgress(window.localStorage, next)
  }
  const show = (next) => { screenRef.current = next; setScreen(next) }

  // 렌더러·오디오·게임 루프는 화면이 살아 있는 동안 한 번만 만든다.
  useEffect(() => {
    if (!webgl) return undefined
    const host = hostRef.current
    const canvas = document.createElement('canvas')
    canvas.className = 'ns-canvas'
    host.appendChild(canvas)
    let scene
    try { scene = createSquadScene(canvas) } catch { canvas.remove(); setWebgl(false); return undefined }
    sceneRef.current = scene
    const audio = createSquadAudio()
    audioRef.current = audio
    audio.setEnabled(progressRef.current.sound)
    const observer = new ResizeObserver(() => scene.resize())
    observer.observe(host)
    const unsubscribe = gameClock.subscribe(() => {
      audio.setPaused(gameClock.isPaused())
      if (gameClock.isPaused()) setBrake(false) // 쉬는 동안 뗀 손가락을 놓치지 않도록 브레이크를 푼다
    })
    let popId = 0, lastShot = 0

    const onEvents = (run) => {
      let changed = false
      for (const event of run.events) {
        if (event.type === 'shot') {
          if (bossHpRef.current) bossHpRef.current.textContent = event.hpLeft
          if (bossBarRef.current) bossBarRef.current.style.transform = `scaleX(${event.hpLeft / run.stage.bossHp})`
          if (run.time - lastShot > 0.07) { lastShot = run.time; audio.play('shot') }
          continue
        }
        changed = true
        if (event.type === 'coin') audio.play('coin', run.combo)
        else if (event.type === 'boss') { setBoss({ hp: event.hp }); setQuiz(null); setBrake(false); audio.play('boss') } else if (event.type === 'end') {
          commit(recordResult(progressRef.current, run.stage.cfg.stage, event))
          audio.music(-1)
          audio.play(event.win ? 'win' : 'lose')
          // 보스가 터지는 장면을 먼저 보여 준 뒤 결과 카드를 올린다.
          gameClock.setTimeout(() => { if (runRef.current === run) { setResult(event); show('result') } }, event.win ? 1500 : 900)
        } else {
          const row = run.stage.rows[event.row], next = run.stage.rows[event.row + 1]
          const message = popFor(event, row)
          if (message) setPop({ ...message, id: ++popId })
          setQuiz(next?.type === 'quiz' ? next.quiz : null)
          if (event.type === 'hazard') { if (event.hit) audio.play('hit') } else if (event.type === 'enemy') audio.play('hit')
          else audio.play(event.good ? 'good' : 'bad', run.combo)
        }
      }
      if (changed) setHud({ count: Math.max(run.count - run.fired, 0), coins: run.coins, combo: run.combo, fever: run.fever })
    }

    let last = gameClock.now(), frame = 0
    const tick = (now) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
      last = now
      const run = runRef.current, input = inputRef.current
      if (run) {
        if (screenRef.current === 'menu') run.time += dt // 메뉴 배경: 진행 없이 제자리 애니메이션만
        else {
          input.target = Math.max(-TRACK_HALF, Math.min(TRACK_HALF, input.target + (Number(input.right) - Number(input.left)) * 14 * dt))
          stepRun(run, dt, input.target, input.brake)
          if (run.events.length) onEvents(run)
        }
        scene.update(run, dt)
        run.events.length = 0
        if (barRef.current) barRef.current.style.transform = `scaleX(${Math.min(1, run.z / run.stage.length)})`
      }
      frame = gameClock.requestAnimationFrame(tick)
    }
    frame = gameClock.requestAnimationFrame(tick)

    const onKey = (event) => {
      const down = event.type === 'keydown'
      if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') inputRef.current.left = down
      else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') inputRef.current.right = down
      else if (event.key === ' ' || event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') { if (screenRef.current === 'play' && !event.repeat) setBrake(down) }
      else return
      if (screenRef.current === 'play') event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => {
      gameClock.cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
      observer.disconnect()
      unsubscribe()
      audio.dispose()
      scene.dispose()
      canvas.remove()
      sceneRef.current = null
    }
  }, [webgl])

  // 메뉴 뒤에는 지금 도전할 월드가 살아 있는 3D 배경으로 깔린다.
  useEffect(() => {
    if (screen !== 'menu' || !sceneRef.current) return
    const stage = createStage(unlocked, { easy: true, seed: 1 })
    runRef.current = createRun(stage)
    sceneRef.current.load(stage, skin)
  }, [screen, unlocked, skin])

  const startStage = (number) => {
    const audio = audioRef.current
    audio?.unlock()
    audio?.play('tap')
    const stage = createStage(number, { easy: progress.easy, seed: 1 + Math.floor(Math.random() * 999983) })
    runRef.current = createRun(stage)
    inputRef.current = { target: 0, left: false, right: false, brake: false, drag: null }
    setBraking(false)
    sceneRef.current?.load(stage, skin)
    audio?.music(stage.cfg.world)
    setStageNum(number); setHud(START_HUD); setQuiz(null); setBoss(null); setResult(null); setPop(null)
    show('play')
  }

  const toMenu = () => { audioRef.current?.music(-1); show('menu') }

  const onPointerDown = (event) => {
    audioRef.current?.unlock()
    inputRef.current.drag = { id: event.pointerId, x: event.clientX, start: inputRef.current.target }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const onPointerMove = (event) => {
    const input = inputRef.current, width = event.currentTarget.clientWidth || 1
    if (input.drag?.id === event.pointerId) input.target = input.drag.start + ((event.clientX - input.drag.x) / Math.min(width, 620)) * 13
    else if (event.pointerType === 'mouse') input.target = ((event.clientX - event.currentTarget.getBoundingClientRect().left) / width - 0.5) * Math.min(13, (width / event.currentTarget.clientHeight) * 9)
    input.target = Math.max(-TRACK_HALF, Math.min(TRACK_HALF, input.target))
  }
  const onPointerUp = (event) => { if (inputRef.current.drag?.id === event.pointerId) inputRef.current.drag = null }

  const world = WORLDS[Math.floor((stageNum - 1) / 5)]

  return (
    <div className="ns-container" style={{ '--ns-world': WORLD_COLORS[Math.floor(((screen === 'menu' ? unlocked : stageNum) - 1) / 5)] }}>
      <div ref={hostRef} className="ns-stage-host" />
      {!webgl && <p className="ns-unsupported" role="alert">이 기기에서는 3D 화면을 켤 수 없어요. 다른 브라우저에서 다시 열어 주세요.</p>}

      {screen === 'menu' && webgl && (
        <div className="ns-menu">
          <div className="ns-menu-inner">
            <header className="ns-title">
              <span className="ns-title-tag">3D 수학 러너</span>
              <h1>숫자 특공대</h1>
              <p>더 좋은 숫자 문을 골라 꼬마 로봇을 모으고, 보스를 물리쳐요!</p>
              <div className="ns-wallet">
                <span><Coin /> {progress.coins}</span>
                <span><Star on /> {totalStars} / {STAGE_COUNT * 3}</span>
              </div>
              <div className="ns-options">
                <div className="ns-segment" role="group" aria-label="난이도">
                  <button aria-pressed={progress.easy} onClick={() => commit({ ...progress, easy: true })}>쉬움<small>천천히 생각해요</small></button>
                  <button aria-pressed={!progress.easy} onClick={() => commit({ ...progress, easy: false })}>도전<small>빠르고 강한 보스</small></button>
                </div>
                <button className="ns-sound" aria-pressed={progress.sound} onClick={() => { audioRef.current?.setEnabled(!progress.sound); commit({ ...progress, sound: !progress.sound }) }}>소리 {progress.sound ? '켜짐' : '꺼짐'}</button>
              </div>
              <ol className="ns-howto">
                <li><b>+</b> <b>×</b> 파란 문은 늘어나고 <i>−</i> <i>÷</i> 빨간 문은 줄어요</li>
                <li>보라색 퀴즈 문은 정답을 통과하면 보너스!</li>
                <li>좌우 드래그 또는 방향키로 움직여요</li>
                <li>브레이크를 꾹 누르면 천천히 달리며 계산할 수 있어요</li>
              </ol>
            </header>

            <section className="ns-worlds" aria-label="스테이지 선택">
              {WORLDS.map((item, w) => (
                <div key={item.id} className="ns-world" style={{ '--ns-accent': WORLD_COLORS[w] }}>
                  <h2>{item.name}<small>보스 · {item.boss}</small></h2>
                  <div className="ns-stage-row">
                    {[1, 2, 3, 4, 5].map((n) => {
                      const number = w * 5 + n, locked = number > unlocked
                      return (
                        <button key={number} className={`ns-stage${number === unlocked ? ' is-next' : ''}`} disabled={locked} aria-label={locked ? `${number}탄 잠김` : `${number}탄 출동`} onClick={() => startStage(number)}>
                          {locked ? <Lock /> : <strong>{number}</strong>}
                          <span className="ns-stage-stars">{[1, 2, 3].map((i) => <Star key={i} on={progress.stars[number - 1] >= i} />)}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
              <div className="ns-skins" role="group" aria-label="특공대 꾸미기">
                {SKINS.map((item) => {
                  const owned = progress.skins.includes(item.id), active = progress.skin === item.id
                  return (
                    <button key={item.id} className={active ? 'is-active' : ''} aria-pressed={active} disabled={!owned && progress.coins < item.cost}
                      onClick={() => { audioRef.current?.unlock(); audioRef.current?.play(owned ? 'tap' : 'buy'); commit(buySkin(progress, item.id)) }}>
                      <span className="ns-skin-dot" style={{ background: `linear-gradient(135deg, ${item.suit} 50%, ${item.robot} 50%)` }} />
                      <span>{item.name}</span>
                      <small>{owned ? (active ? '사용 중' : '보유') : <><Coin /> {item.cost}</>}</small>
                    </button>
                  )
                })}
              </div>
            </section>
          </div>
        </div>
      )}

      {screen !== 'menu' && (
        <div className="ns-play" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          <div className="ns-hud" hidden={screen === 'result'}>
            <div className="ns-hud-top">
              <span className="ns-chip ns-chip-stage">{world.name} {stageNum}탄</span>
              <span className="ns-progress" aria-hidden="true"><i ref={barRef} /></span>
              <span className="ns-chip"><Coin /> {hud.coins}</span>
            </div>
            <div className="ns-hud-row">
              <span className="ns-chip ns-chip-count" aria-label={`특공대 ${hud.count}명`}>특공대 <b>{hud.count}</b>명</span>
              {hud.combo >= 2 && <span key={hud.combo} className={`ns-chip ns-combo${hud.fever ? ' is-fever' : ''}`}>{hud.fever ? '피버! 코인 2배' : '콤보'} ×{hud.combo}</span>}
            </div>
            {boss && (
              <div className="ns-boss" role="status">
                <span>{world.boss}</span>
                <span className="ns-boss-bar"><i ref={bossBarRef} /></span>
                <b ref={bossHpRef}>{boss.hp}</b>
              </div>
            )}
            {quiz && !boss && <div key={quiz.prompt + quiz.answer} className="ns-quiz" role="status"><small>{quiz.kind === 'math' ? '정답 문으로!' : quiz.kind === 'english' ? '영어 숫자는?' : '한자 숫자는?'}</small><strong>{quiz.prompt}{quiz.kind === 'math' ? ' = ?' : ''}</strong></div>}
            {stageNum === 1 && screen === 'play' && !boss && <p className="ns-tip">좌우로 움직여 <b>더 큰 숫자 문</b>을 골라요. 헷갈리면 <b>브레이크</b>!</p>}
            {pop && screen === 'play' && <div key={pop.id} className={`ns-pop is-${pop.tone}`}>{pop.text}</div>}
          </div>
          {screen === 'play' && !boss && (
            <button className={`ns-brake${braking ? ' is-on' : ''}`} data-game-hold-action aria-label="브레이크: 누르고 있으면 천천히 달려요" aria-pressed={braking}
              onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture?.(event.pointerId); setBrake(true) }}
              onPointerMove={(event) => event.stopPropagation()}
              onPointerUp={() => setBrake(false)} onPointerCancel={() => setBrake(false)} onLostPointerCapture={() => setBrake(false)}
              onKeyDown={(event) => { if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) setBrake(true) }}
              onKeyUp={(event) => { if (event.key === ' ' || event.key === 'Enter') setBrake(false) }}
              onContextMenu={(event) => event.preventDefault()}>
              <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="12" y="6" width="24" height="34" rx="8" /><path d="M18 15h12M18 23h12M18 31h12" /></svg>
              <span>브레이크</span>
            </button>
          )}
          {screen === 'play' && <button className="ns-exit" onPointerDown={(event) => event.stopPropagation()} onClick={toMenu}>탄 고르기</button>}
        </div>
      )}

      {screen === 'result' && result && (
        <div className="ns-result" role="dialog" aria-labelledby="ns-result-title">
          <div className={`ns-result-card${result.win ? ' is-win' : ''}`}>
            <span className="ns-title-tag">{world.name} {stageNum}탄</span>
            <h2 id="ns-result-title">{result.win ? (result.stars === 3 ? '완벽한 승리!' : '보스 격파!') : '아쉬워요!'}</h2>
            <div className="ns-result-stars">{[1, 2, 3].map((i) => <Star key={i} on={result.stars >= i} />)}</div>
            <dl>
              <div><dt>내 특공대</dt><dd>{result.count}명</dd></div>
              <div><dt>최고 기록 가능</dt><dd>{result.best}명</dd></div>
              <div><dt>좋은 선택</dt><dd>{result.goodPicks} / {result.picks}</dd></div>
              <div><dt>얻은 코인</dt><dd><Coin /> +{result.coins}</dd></div>
            </dl>
            <p>{result.win
              ? (result.stars === 3 ? '모든 문에서 멋진 선택을 했어요!' : `문마다 계산해 보면 ${result.best}명까지 모을 수 있어요.`)
              : `${world.boss}의 체력은 ${result.bossHp}! 특공대를 ${result.bossHp}명 넘게 모아 보세요.`}</p>
            <div className="ns-result-actions">
              {result.win && stageNum < STAGE_COUNT && <button className="ns-primary" onClick={() => startStage(stageNum + 1)}>다음 탄</button>}
              <button className={result.win ? '' : 'ns-primary'} onClick={() => startStage(stageNum)}>다시 도전</button>
              <button onClick={toMenu}>탄 고르기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
