import { useCallback, useEffect, useRef, useState } from 'react'
import KingdomIllustration from '../components/KingdomIllustration'
import TreasureExpedition from '../components/TreasureExpedition'
import TreasurePuzzle from '../components/TreasurePuzzle'
import { ALL_TREASURES, MAP, PROLOGUE, RESTORATIONS, TYPE_LABELS, WORLDS, loadProgress, progressAction, restorationFor, saveProgress, trailsFor, treasuresFor, worldCount, worldUnlocked } from '../lib/treasureKingdom'
import { createTreasureAudio } from '../lib/treasureAudio'
import { createTreasureBridge } from '../lib/treasureBridge'
import { gameClock } from '../lib/gameClock'
import './TreasureKingdom.css'

function Relic({ small = false }) {
  return <svg className={`tk-star${small ? ' tk-star-small' : ''}`} viewBox="0 0 32 44" aria-hidden="true"><path d="m16 2 13 15-5 20-8 5-8-5-5-20Z" fill="#b58c4f" stroke="#e7d5a2" strokeWidth="1" /><path d="m16 2 0 32-13-17Z" fill="#f2dda0" /><path d="m16 2 13 15-13 17Z" fill="#ddbd76" /><path d="m3 17 13 17-8 3Z" fill="#806642" /><path d="m29 17-13 17 8 3Z" fill="#a17b42" /><path d="m16 34 0 8-8-5Z" fill="#d8b77a" /></svg>
}
function GameDialog({ title, children, onClose, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    ref.current?.focus()
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }) }
  }, [])
  return <div className="tk-modal-scrim" onKeyDown={(event) => {
    event.stopPropagation()
    if (event.key === 'Escape') onClose()
    if (event.key === 'Tab') {
      const buttons = ref.current.querySelectorAll('button:not(:disabled), [href]')
      const first = buttons[0], last = buttons[buttons.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first?.focus() }
    }
  }}><section ref={ref} tabIndex={-1} className={`tk-dialog ${className}`} role="dialog" aria-modal="true" aria-labelledby="tk-dialog-title">
    <button className="tk-dialog-close" onClick={onClose} aria-label="닫기">×</button><h2 id="tk-dialog-title">{title}</h2>{children}
  </section></div>
}
function Controls({ bridge, actionLabel, actionable }) {
  const pulse = (action) => { bridge.setInput(action, true); gameClock.setTimeout(() => bridge.setInput(action, false), 150) }
  return <div className="tk-touch-controls">
    <div className="tk-actions"><button className="tk-dash" aria-label="회피" onClick={() => pulse('dash')}><span>회피</span><kbd>Shift</kbd></button><button className="tk-jump" aria-label="점프" onClick={() => pulse('jump')}><span>점프</span><kbd>Space</kbd></button><button className="tk-interact" aria-label={actionLabel} disabled={!actionable} onClick={() => pulse('interact')}><span>{actionLabel}</span><kbd>E</kbd></button></div>
  </div>
}
function TreasureJournal({ worldId, progress, onClose, onHint, initialTab = 'relics' }) {
  const [tab, setTab] = useState(initialTab)
  const items = treasuresFor(worldId)
  return <GameDialog title="탐사 기록" onClose={onClose} className="tk-journal">
    <div className="tk-journal-tabs"><button aria-pressed={tab === 'relics'} onClick={() => setTab('relics')}>보물 수첩</button><button aria-pressed={tab === 'archive'} onClick={() => setTab('archive')}>왕국의 기록</button></div>
    {tab === 'relics' ? <><p>{WORLDS[worldId].chapter} · 확보한 보물 {worldCount(progress, worldId)} / 25</p><div className="tk-journal-grid">{items.map((item) => <div key={item.id} className={progress.collected.includes(item.id) ? 'is-found' : ''}><Relic small /><span>{String(item.index + 1).padStart(2, '0')}</span><strong>{item.name}</strong><small>{progress.collected.includes(item.id) ? '회수 완료' : TYPE_LABELS[item.type]}</small>{!progress.collected.includes(item.id) && <button className="tk-hint-button" aria-label={`${item.name} 힌트`} onClick={() => onHint(item)}>힌트 · 지도</button>}</div>)}</div><p className="tk-dialog-note">매몰된 보물은 탐지 펄스(E)로 위치를 확인한다. 수호자는 구역의 보물 8개·18개를 확보하면 깨어난다.</p></> : <div className="tk-archive">{WORLDS.map((world) => <section key={world.id}><h3>{world.id + 1}. {world.chapter}</h3>{world.records.map((record, index) => <p key={index} className={worldCount(progress, world.id) >= [5, 12, 25][index] ? 'is-decoded' : ''}><span>{[5, 12, 25][index]}개</span>{worldCount(progress, world.id) >= [5, 12, 25][index] ? record : '기록 미해독'}</p>)}</section>)}</div>}
  </GameDialog>
}
function readInitial() {
  try { return loadProgress(window.localStorage) } catch { return { progress: loadProgress({ getItem: () => null }).progress, unavailable: true } }
}
function requestGameFullscreen() {
  const element = document.querySelector('.game-session')
  if (element?.requestFullscreen && !document.fullscreenElement) {
    try { const request = element.requestFullscreen({ navigationUI: 'hide' }); request?.catch(() => {}) } catch { /* The game still fills its browser viewport. */ }
  }
}

export default function TreasureKingdom() {
  const [initial] = useState(readInitial)
  const [progress, setProgress] = useState(initial.progress)
  const [bridge] = useState(() => createTreasureBridge(initial.progress))
  const [sound] = useState(createTreasureAudio)
  const [activeWorld, setActiveWorld] = useState(null)
  const [modal, setModal] = useState(null)
  const [context, setContext] = useState({ nearest: null, boss: null, position: MAP.spawn, hp: 4, stamina: 100, scan: 0 })
  const [toast, setToast] = useState(null)
  const [saveOK, setSaveOK] = useState(!initial.unavailable)
  const [muted, setMuted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [reward, setReward] = useState(null)
  const [hint, setHint] = useState(null)
  const pending = progress.collected.length - progress.banked.length
  const restoration = restorationFor(progress.banked.length)
  const nextRestoration = RESTORATIONS.find((step) => step.at > progress.banked.length)
  const commit = useCallback((action) => {
    const next = progressAction(bridge.progress, action); bridge.setProgress(next)
    let saved = false
    try { saved = saveProgress(window.localStorage, next) } catch { /* Session progress remains available. */ }
    setSaveOK(saved); setProgress(next); return next
  }, [bridge])
  const notify = useCallback((message) => setToast({ message, at: gameClock.now() }), [])
  const celebrate = useCallback((id, next, decoded = false) => {
    const item = ALL_TREASURES.find((entry) => entry.id === id)
    if (!item) return
    const tier = next.collected.length === 100 ? 'kingdom' : item.type === 'boss' ? 'guardian' : worldCount(next, item.worldId) === 25 ? 'chapter' : 'relic'
    const acquired = { id, name: item.name, count: next.collected.length, worldCount: worldCount(next, item.worldId), tier, decoded, sequence: next.revision }
    setHint((current) => current?.id === id ? null : current); setToast(null); setReward(acquired); bridge.celebrate?.(acquired); sound.play('collect', tier)
  }, [bridge, sound])
  const closeModal = useCallback(() => { setModal(null); bridge.setBlocked(false) }, [bridge])
  const openModal = useCallback((value) => { bridge.setBlocked(true); setModal(value) }, [bridge])
  useEffect(() => {
    bridge.setHandlers({ onReady: () => setLoading(false), onContext: setContext, onEvent: (event) => {
      if (['collect', 'questItem', 'reveal'].includes(event.type)) {
        const before = worldCount(bridge.progress, bridge.worldId)
        const next = commit(event)
        if (event.type === 'collect') { const count = worldCount(next, bridge.worldId); celebrate(event.id, next, [5, 12, 25].includes(count) && before !== count) }
        if (event.type === 'questItem') { sound.play('hit'); notify(event.message) }
      }
      if (event.type === 'position') commit({ type: 'position', worldId: bridge.worldId, position: event.position })
      if (event.type === 'puzzle' || event.type === 'friend') openModal(event)
      if (['notice', 'scan', 'hurt', 'heal'].includes(event.type)) notify(event.message)
      if (event.type === 'heal') sound.play('heal')
      if (event.type === 'hit' || event.type === 'scan' || event.type === 'hurt') sound.play('hit')
    } })
    return () => bridge.setHandlers({ onContext: () => {}, onReady: () => {} })
  }, [bridge, celebrate, commit, notify, openModal, sound])
  useEffect(() => {
    if (!reward) return
    const timer = gameClock.setTimeout(() => setReward(null), reward.tier === 'relic' ? 2400 : 3100)
    return () => gameClock.clearTimeout(timer)
  }, [reward])
  useEffect(() => {
    if (!toast) return
    const id = gameClock.setTimeout(() => setToast(null), 4200)
    return () => gameClock.clearTimeout(id)
  }, [toast])
  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', update)
    return () => document.removeEventListener('fullscreenchange', update)
  }, [])
  useEffect(() => () => sound.destroy(), [sound])
  useEffect(() => { sound.setPaused(gameClock.isPaused()); return gameClock.subscribe(() => sound.setPaused(gameClock.isPaused())) }, [sound])
  const startWorld = (worldId) => {
    if (!worldUnlocked(bridge.progress, worldId)) return
    if (window.innerWidth >= 900 && !window.matchMedia('(pointer: coarse)').matches) requestGameFullscreen()
    sound.setWorld(worldId); sound.unlock(); bridge.setWorld(worldId)
    setContext({ nearest: null, boss: null, position: progress.positions[worldId] || MAP.spawn, hp: 4, stamina: 100, scan: 0 })
    setLoading(true); setActiveWorld(worldId); setToast(null); setMapOpen(false); setHint(null); setReward(null)
  }
  const returnToKingdom = () => {
    const before = bridge.progress.banked.length, next = commit({ type: 'deposit' })
    setActiveWorld(null); setModal(null); setHint(null); setReward(null); bridge.setBlocked(false)
    if (next.banked.length > before) { sound.play('deposit'); openModal({ type: 'restored', steps: RESTORATIONS.filter((step) => step.at > before && step.at <= next.banked.length), count: next.banked.length - before }) }
  }
  const toggleSound = () => { sound.setEnabled(muted); if (muted) sound.unlock(); setMuted(!muted) }
  const toggleFullscreen = () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else requestGameFullscreen() }
  const nearest = context.nearest
  const world = activeWorld !== null ? WORLDS[activeWorld] : null
  const actionLabel = context.boss ? '코어 공격' : nearest?.type === 'friend' ? '말 걸기' : nearest?.type === 'boss' ? '봉인 해제' : nearest?.type === 'puzzle' ? '장치 조사' : '탐지 펄스'
  const actionable = !context.boss || context.boss.phase === 'vulnerable'
  const contextual = nearest && ['jump', 'puzzle', 'friend', 'boss'].includes(nearest.type)
  const toolButtons = <><button onClick={() => openModal({ type: 'help' })} aria-label="조작 방법 보기">도움말</button><button onClick={toggleSound} aria-label={muted ? '소리 켜기' : '소리 끄기'}>{muted ? '소리 꺼짐' : '소리 켜짐'}</button><button onClick={toggleFullscreen} aria-label={fullscreen ? '전체화면 종료' : '전체화면 켜기'}>{fullscreen ? '화면 복귀' : '전체화면'}</button></>
  let modalContent = null
  if (modal?.type === 'journal') modalContent = <TreasureJournal worldId={activeWorld ?? progress.lastWorld} progress={progress} onClose={closeModal} onHint={(item) => { closeModal(); if (activeWorld !== item.worldId) startWorld(item.worldId); setHint(item); setMapOpen(true) }} initialTab={modal.tab} />
  if (modal?.type === 'settings') modalContent = <GameDialog title="탐사 설정" onClose={closeModal}><div className="tk-settings-options">{toolButtons}</div><p className="tk-dialog-note">조작 안내와 화면·소리 설정을 여기서 변경한다. 지도의 위치 표시는 지도 버튼으로 열 수 있다.</p></GameDialog>
  if (modal?.type === 'help') modalContent = <GameDialog title="탐사 매뉴얼" onClose={closeModal}><div className="tk-help-list"><p><b>이동 / 점프 / 회피</b>화면에서 가고 싶은 곳을 터치하면 이동한다. 길게 누르거나 드래그하면 손가락·마우스 방향으로 계속 걸어간다. 길게 누른 뒤 손을 떼면 멈춘다. PC 방향키·WASD도 지원한다. Space로 점프, Shift로 회피. 회피에는 행동력이 소모되고 잠시 공격을 피할 수 있다.</p><p><b>탐지와 현장 조사</b>E로 탐지 펄스를 발사해 매몰된 보물을 찾는다. 보물 수첩의 힌트로 지도에 위치를 표시할 수 있다. 길가의 하트는 체력 1칸을 회복하고 30초 뒤 다시 나타난다. 유적·탐사대원에 가까이 가면 E로 조사·대화한다. 임무의 기록 조각 세 개를 회수한 뒤 담당자에게 돌아가라.</p><p><b>수호자</b>붉은 경고의 형태를 읽고 피하라. 코어가 파랗게 노출될 때 가까이 가 E로 공격한다. 수호자의 남은 체력이 줄면 공격이 빨라진다. 체력이 소진되어도 보물은 잃지 않는다.</p><p><b>왕국과 기록</b>확보한 보물을 왕국으로 가져가면 복구가 진행된다. 한 세계의 25개를 가져오면 다음 장이 열린다. 각 장에서 5·12·25개를 찾으면 이야기의 기록이 해독된다.</p><p><b>저장 / 전체화면</b>획득과 임무 진행은 즉시, 위치는 2초마다 저장된다. 같은 브라우저에서 이어 할 수 있다. PC는 탐험 시작 시 전체화면으로 진입하며 Esc로 돌아올 수 있다.</p></div><button className="tk-primary" onClick={closeModal}>탐사 계속</button></GameDialog>
  if (modal?.type === 'story') modalContent = <GameDialog title="멈춘 왕국의 마지막 기록" onClose={closeModal}><div className="tk-prologue">{PROLOGUE.map((line, index) => <p key={index}>{line}</p>)}</div><button className="tk-primary" onClick={() => { closeModal(); startWorld(0) }}>첫 번째 균열로</button></GameDialog>
  if (modal?.type === 'puzzle') modalContent = <GameDialog title={modal.item.name} onClose={closeModal} className="tk-puzzle-dialog"><TreasurePuzzle item={modal.item} onSolved={() => { const next = commit({ type: 'collect', id: modal.item.id }); celebrate(modal.item.id, next, [5, 12, 25].includes(worldCount(next, modal.item.worldId))); closeModal() }} /></GameDialog>
  if (modal?.type === 'friend') {
    const item = modal.item, done = item.targets.filter((target) => progress.questItems.includes(target.id)).length
    modalContent = <GameDialog title={item.contact} onClose={closeModal}><div className="tk-quest-portrait" style={{ '--contact': item.contactIndex }} /><p className="tk-quest-quote">“{item.briefing}”</p><div className="tk-quest-progress">기록 회수 <b>{done} / 3</b></div><p className="tk-dialog-note">수락하면 작은 지도에 위치가 표시된다. 세 조각을 찾은 뒤 이곳으로 돌아오면 임무를 완료할 수 있다.</p><button className="tk-primary" onClick={() => { commit({ type: 'quest', id: item.id }); notify('현장 임무 추적 중. 지도에 기록 조각의 위치가 표시됐다.'); closeModal() }}>{progress.quests.includes(item.id) ? '임무 계속' : '임무 수락'}</button></GameDialog>
  }
  if (modal?.type === 'restored') modalContent = <GameDialog title={progress.banked.length === 100 ? '왕국의 새로운 아침' : '왕국 복구 보고'} onClose={closeModal} className="tk-restored-dialog"><span className="tk-modal-relic"><Relic /></span><p>보물 <b>{modal.count}개</b> 전달. 왕국의 기록과 동력이 연결됐다.</p><div className="tk-restored-steps">{modal.steps.length ? modal.steps.map((step) => <p key={step.at}><b>{step.name}</b><span>{step.text}</span></p>) : <p>복구 동력 축적 중. 다음 구역 재가동을 위한 준비가 진행된다.</p>}</div><button className="tk-primary" onClick={closeModal}>왕국 확인</button></GameDialog>

  return <main className={`tk-container${world ? ' tk-is-playing' : ''}`} style={world ? { '--tk-world': world.color, '--tk-world-light': world.light } : undefined}>
    {!world ? <>
      <KingdomIllustration count={progress.banked.length} /><div className="tk-cover-shade" />
      <header className="tk-hub-header"><span className="tk-title-mark">멈춘 왕국의 기록</span><div className="tk-small-tools">{toolButtons}</div></header>
      <section className="tk-title-copy"><span className="tk-edition">네 세계에 흩어진 백 개의 기억</span><h1>이안이의<br />보물찾기 잘하자</h1><div className="tk-title-rule" /><p>왕국의 심장이 멈춘 날,<br />누군가는 우리를 지키려 했다.</p><p className="tk-cover-description">잊힌 유적을 탐사하고, 수호자의 봉인을 해제하라.<br />흩어진 보물을 모을수록 붕괴의 진실이 드러난다.</p><div className="tk-cover-actions"><button className="tk-primary" onClick={() => progress.collected.length ? startWorld(progress.lastWorld) : openModal({ type: 'story' })}>{progress.collected.length ? '탐험 이어 하기' : '탐사 시작'}<span>›</span></button><button className="tk-text-button" onClick={() => openModal({ type: 'journal', tab: 'archive' })}>해독한 기록 보기</button></div></section>
      <aside className="tk-restoration-strip" aria-label="왕국 복구 상황"><div className="tk-overall-count"><Relic /><strong>{progress.collected.length}<span> / 100</span></strong><small>확보한 보물</small></div><div className="tk-restoration-copy"><span>왕국 복원 {progress.banked.length}%</span><strong>{restoration.name}</strong><div className="tk-progress-track" role="progressbar" aria-label="왕국 복구" aria-valuenow={progress.banked.length} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress.banked.length}%` }} /></div><small>{nextRestoration ? `다음: ${nextRestoration.name} · ${nextRestoration.at}개` : '네 세계의 기록이 모두 연결됐다.'}</small></div>{pending > 0 && <button className="tk-primary" onClick={returnToKingdom}>보물 {pending}개 전달</button>}</aside>
      <section className="tk-adventure-chooser" aria-labelledby="tk-adventure-title"><h2 id="tk-adventure-title">탐사 구역</h2><div className="tk-worlds">{WORLDS.map((item) => {
        const unlocked = worldUnlocked(progress, item.id), count = worldCount(progress, item.id)
        return <button key={item.id} className={`tk-world-card${!unlocked ? ' is-locked' : ''}${count === 25 ? ' is-complete' : ''}`} disabled={!unlocked} onClick={() => startWorld(item.id)} aria-label={`${item.short} ${unlocked ? count ? '이어서 탐험' : '탐험 시작' : '잠김'}`}><span className="tk-chapter">제{item.id + 1}장</span><h3>{item.chapter}</h3><span className="tk-world-region">{item.short}</span><span className="tk-world-count">{unlocked ? `${count} / 25` : '이전 구역 완료 후 개방'}</span><span className="tk-world-cta">{unlocked ? count ? '기록 추적 계속' : '탐사 시작' : '봉인됨'}{unlocked && <span>›</span>}</span></button>
      })}</div></section>
      <footer className="tk-hub-footer"><span className={saveOK ? '' : 'tk-save-warning'} role="status">{saveOK ? '자동 저장 · 이 브라우저에서 이어 하기' : '저장 실패. 저장 공간과 브라우저 설정을 확인하라.'}{!saveOK && <button onClick={() => commit({ type: 'deposit' })}>저장 재시도</button>}</span><span>탐사 · 해독 · 회피 · 복원</span></footer>
    </> : <>
      <div className="tk-playfield"><TreasureExpedition key={world.id} worldId={world.id} bridge={bridge} /><div className="tk-play-vignette" />
        <header className="tk-expedition-header"><button className="tk-return" onClick={returnToKingdom}>〈 <span>왕국으로{pending > 0 ? ` · 보물 ${pending}개 전달` : ''}</span></button><div className="tk-current-world"><span>제{world.id + 1}장 · {world.short}</span><h1>{world.chapter}</h1></div><div className="tk-field-count"><Relic small /><b>{worldCount(progress, world.id)}</b><span>/25</span><small>전체 {progress.collected.length}/100</small></div></header>
        <div className="tk-field-tools"><button aria-label="보물 수첩" onClick={() => openModal({ type: 'journal' })}>탐사 기록</button><button aria-label="지도" aria-expanded={mapOpen} aria-controls="tk-field-map" onClick={() => setMapOpen(!mapOpen)}>지도</button><button aria-label="탐사 설정" onClick={() => openModal({ type: 'settings' })}>설정</button></div>
        <div id="tk-field-map" className={`tk-minimap${hint ? ' tk-minimap-tracking' : ''}`} aria-label="작은 지도" hidden={!mapOpen}>
          {hint && <div className="tk-map-target"><span>추적 중 · {hint.name}</span><button aria-label="보물 위치 추적 해제" onClick={() => setHint(null)}>×</button></div>}
          <svg viewBox={`0 0 ${MAP.width} ${MAP.height}`} role="img" aria-label="현재 위치와 현장 임무">
            <rect width={MAP.width} height={MAP.height} rx="30" fill="#152821" />
            {trailsFor(world.id).map(({ a, b, width }, i) => <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#727b63" strokeWidth={width * 2} strokeLinecap="round" />)}
            {treasuresFor(world.id).filter((item) => ['puzzle', 'friend', 'boss'].includes(item.type)).map((item) => <circle key={item.id} cx={item.x} cy={item.y} r={item.type === 'boss' ? 32 : 19} fill={progress.collected.includes(item.id) ? '#59605b' : item.type === 'boss' ? '#b56953' : '#e7dbaf'} />)}
            {treasuresFor(world.id).filter((item) => progress.quests.includes(item.id) && !progress.collected.includes(item.id)).flatMap((item) => item.targets.filter((target) => !progress.questItems.includes(target.id)).map((target) => <circle key={target.id} cx={target.x} cy={target.y} r="25" fill="#87c6c4" />))}
            {hint && <g className="tk-map-beacon" aria-label={`${hint.name} 위치`} data-treasure-id={hint.id}><circle className="tk-map-pulse" cx={hint.x} cy={hint.y} r="70" fill="none" stroke="#ffdc80" strokeWidth="13" /><circle cx={hint.x} cy={hint.y} r="36" fill="#ffdf8a" stroke="#2d342b" strokeWidth="9" /><path d={`M${hint.x - 20} ${hint.y}h40m-20 -20v40`} stroke="#302d22" strokeWidth="8" /></g>}
            <circle className="tk-player-dot" cx={context.position.x} cy={context.position.y} r="30" fill="#b5f3ea" stroke="#172b2c" strokeWidth="12" />
          </svg>
          {hint && <p>{hint.clue || (hint.type === 'jump' ? '표시한 위치에 가까이 가서 점프하라.' : hint.type === 'hidden' ? '위치에 접근한 뒤 탐지 펄스를 사용하라.' : hint.type === 'boss' ? '주변 보물을 모은 뒤 봉인을 해제하라.' : hint.type === 'puzzle' ? '표시한 유적의 장치를 조사하라.' : hint.type === 'friend' ? '현장 담당자의 임무를 완료하라.' : '표시한 위치 주변의 작은 금속 조각을 찾아라.')}</p>}
          <span className="tk-map-legend">● 내 위치{hint ? '　✦ 추적 보물' : '　● 유적 / 수호자'}</span>
        </div>
        <div className="tk-survival-hud"><div className="tk-health" aria-label={`탐사 체력 ${context.hp}/4`}>{[0, 1, 2, 3].map((hp) => <i key={hp} className={context.hp > hp ? 'is-filled' : ''} aria-hidden="true">♥</i>)}<span>체력</span></div><div className="tk-stamina" role="progressbar" aria-label="행동력" aria-valuenow={Math.round(context.stamina)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${context.stamina}%` }} /></div><small>행동력 · 회피 후 회복</small></div>
        {context.boss && <div className="tk-boss-hud"><span>봉인 수호자</span><h2>{world.bosses[context.boss.id.endsWith('-24') ? 1 : 0]}</h2><div role="progressbar" aria-label="수호자 체력" aria-valuenow={context.boss.hp} aria-valuemin={0} aria-valuemax={context.boss.maxHp}><span style={{ width: `${context.boss.hp / context.boss.maxHp * 100}%` }} /></div></div>}
        {!loading && (context.boss || contextual) && <div className={`tk-context-prompt${context.boss ? ' tk-boss-prompt' : ''}`} role="status">{context.boss ? context.boss.phase === 'warning' ? '경고 영역 이탈 · 점프 / 회피' : context.boss.phase === 'vulnerable' ? '코어 노출 · 접근 후 E로 공격' : '공격 진행 중' : nearest.type === 'jump' ? '상층 기록 · 점프으로 회수' : `${TYPE_LABELS[nearest.type]} · ${nearest.name}`}</div>}
        {loading && <div className="tk-scene-loading" role="status"><div className="tk-loader-ring" /><p>균열 너머로 진입 중</p><span>{world.name}</span></div>}
        {toast && <div className="tk-toast" role="status"><Relic small />{toast.message}</div>}
        {reward && <div key={reward.sequence} className={`tk-acquisition tk-acquisition-${reward.tier}`} role="status" aria-live="polite"><div className="tk-acquisition-rays" /><div className="tk-acquisition-emblem"><Relic /></div><span className="tk-acquisition-label">{reward.tier === 'kingdom' ? '백 개의 기억, 완전 회수' : reward.tier === 'guardian' ? '수호자의 봉인 해제' : reward.tier === 'chapter' ? '구역 탐사 완료' : '기록핵 확보'}</span><strong>{reward.name}</strong><div className="tk-acquisition-total"><b>+1</b><span>보물 <em>{reward.count}</em> / 100</span></div><small>{reward.decoded ? '새로운 왕국 기록이 해독됐다' : `이 구역의 기록 ${reward.worldCount} / 25`}</small></div>}
        <Controls bridge={bridge} actionLabel={actionLabel} actionable={actionable} />
        <div className="tk-keyboard-note"><span>이동 <kbd>WASD</kbd> / 방향키</span><span>터치로 목적지 지정 · 길게 누르거나 드래그해 연속 이동</span></div>
        <div className={`tk-save-line${!saveOK ? ' tk-save-warning' : ''}`} role="status">{saveOK ? '자동 저장' : '저장 실패'}{!saveOK && <button onClick={() => commit({ type: 'position', worldId: world.id, position: context.position })}>다시 저장</button>}{worldCount(progress, world.id) === 25 && <button onClick={returnToKingdom}>구역 기록 회수 완료 · 왕국으로 복귀</button>}</div>
      </div>
    </>}{modalContent}<span className="tk-sr-only">이안이의 보물찾기 잘하자. 네 세계의 보물 {ALL_TREASURES.length}개를 회수해 왕국을 복원한다.</span>
  </main>
}
