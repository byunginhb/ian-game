import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { ArmySymbols, Commander } from '../components/ConquestArt'
import { createWorld, FACTIONS, getLevelConfig, MAX_LEVEL, marchingSoldiers, readProgress, recordWin, SAVE_KEY, sendTroops, territoryAt, tickWorld } from '../lib/conquest'
import { gameClock } from '../lib/gameClock'
import useConquestAudio from '../hooks/useConquestAudio'
import './Conquest.css'

function initialize() {
  let progress
  try { progress = readProgress(window.localStorage) } catch { progress = readProgress(null) }
  return { mode: 'menu', progress, selected: progress.selected, level: Math.min(MAX_LEVEL, progress.cleared[progress.selected] + 1), world: null, round: 0 }
}

function reducer(state, action) {
  if (action.type === 'select') return { ...state, selected: action.team, level: Math.min(MAX_LEVEL, state.progress.cleared[action.team] + 1), progress: { ...state.progress, selected: action.team } }
  if (action.type === 'level' && action.level <= state.progress.cleared[state.selected] + 1) return { ...state, level: action.level }
  if (action.type === 'start') return { ...state, mode: 'battle', world: createWorld(state.level, state.selected, action.portrait), round: state.round + 1 }
  if (action.type === 'menu') return { ...state, mode: 'menu', world: null, level: Math.min(MAX_LEVEL, state.progress.cleared[state.selected] + 1) }
  if (action.type === 'next' && state.world?.status === 'won' && state.level < MAX_LEVEL) return { ...state, level: state.level + 1, world: createWorld(state.level + 1, state.selected, action.portrait) }
  if (action.type === 'send' && state.world) return { ...state, world: sendTroops(state.world, action.from, action.to) }
  if (action.type === 'tick' && state.world?.status === 'playing') {
    const world = tickWorld(state.world, action.dt)
    return { ...state, world, progress: world.status === 'won' ? recordWin(state.progress, world) : state.progress }
  }
  return state
}

function formatTime(seconds) { return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` }

function MapPreview({ player }) {
  const preview = useMemo(() => createWorld(1, player), [player])
  const origin = preview.territories.find((land) => land.owner === player)
  const destination = preview.territories.filter((land) => land.owner < 0).sort((a, b) => Math.hypot(a.x - origin.x, a.y - origin.y) - Math.hypot(b.x - origin.x, b.y - origin.y))[0]
  return <div className="ct-preview" aria-hidden="true">
    <span className="ct-preview-label">작은 섬에서, 온 세상의 대장으로.</span>
    <svg viewBox="0 0 960 660">
      {preview.territories.map((land) => <g key={land.id}><path d={land.path} fill={land.owner < 0 ? '#eee9d7' : FACTIONS[land.owner].light} stroke="#fffdf4" strokeWidth="4" /><circle cx={land.x} cy={land.y} r="23" fill={land.owner < 0 ? '#b4bcac' : FACTIONS[land.owner].color} /><text x={land.x} y={land.y + 7} textAnchor="middle" fill="white" fontSize="22" fontWeight="900">{Math.floor(land.troops)}</text></g>)}
      <path d={`M${origin.x} ${origin.y}Q${(origin.x + destination.x) / 2} ${Math.min(origin.y, destination.y) - 30} ${destination.x} ${destination.y}`} fill="none" stroke={FACTIONS[player].color} strokeWidth="5" strokeDasharray="9 10" />
    </svg>
    <span className="ct-preview-sticker">이 땅도 내 거! <b>⚑</b></span>
    <span className="ct-compass">✥<small>모험의 바다</small></span>
  </div>
}

function BattleMap({ world, source, setSource, onSend }) {
  const svgRef = useRef(null)
  const gestureRef = useRef(null)
  const [drag, setDrag] = useState(null)
  const [notice, setNotice] = useState('내 깃발이 있는 땅에서 다른 땅으로 쭉 끌어 보세요!')
  const selected = world.territories.find((land) => land.id === source && land.owner === world.player)

  useEffect(() => {
    const cancel = () => { gestureRef.current = null; setDrag(null); setSource(null) }
    window.addEventListener('blur', cancel)
    return () => window.removeEventListener('blur', cancel)
  }, [setSource])

  const pointAt = (event) => {
    const matrix = svgRef.current?.getScreenCTM()
    if (!matrix) return null
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
  }
  const landAt = (point) => territoryAt(world, point)
  const send = (from, to) => {
    if (from === to) return
    const origin = world.territories.find((land) => land.id === from)
    if (!origin || origin.owner !== world.player) { setSource(null); return }
    const units = Math.floor(origin.troops)
    if (units < 1) { setNotice('군사가 모일 때까지 조금만 기다려 주세요.'); return }
    onSend(from, to)
    setSource(null)
    setNotice(`군사 전원 출발! ${world.territories[to].owner === world.player ? '우리 땅에 힘을 보태요.' : '깃발을 꽂으러 가요!'}`)
  }
  const activate = (land) => {
    if (world.status !== 'playing') return
    if (selected && selected.id !== land.id) send(selected.id, land.id)
    else if (land.owner === world.player) { setSource(land.id); setNotice('좋아요! 이제 도착할 땅을 선택하세요. 우리 땅으로 지원도 가능해요.') }
    else { setSource(null); setNotice('먼저 내 깃발이 있는 땅을 골라 주세요.') }
  }

  return <>
    <div className="ct-map-wrap">
      <svg ref={svgRef} className="ct-map ct-board" viewBox={`0 0 ${world.width} ${world.height}`} aria-label={`${world.config.level}탄 전장, 땅 ${world.territories.length}개`} role="group"
        onPointerDown={(event) => {
          if (world.status !== 'playing' || event.button !== 0 || !event.isPrimary) return
          const point = pointAt(event), land = landAt(point)
          if (!land) return
          event.preventDefault()
          svgRef.current.setPointerCapture(event.pointerId)
          gestureRef.current = { pointerId: event.pointerId, start: point, land: land.id, movable: land.owner === world.player, moved: false }
        }}
        onPointerMove={(event) => {
          const gesture = gestureRef.current
          if (!gesture || gesture.pointerId !== event.pointerId) return
          const point = pointAt(event)
          if (!point) return
          if (Math.hypot(point.x - gesture.start.x, point.y - gesture.start.y) > 10) gesture.moved = true
          if (gesture.moved && gesture.movable) {
            setSource(gesture.land)
            setDrag({ x: point.x, y: point.y, target: landAt(point)?.id })
          }
        }}
        onPointerUp={(event) => {
          const gesture = gestureRef.current
          if (!gesture || gesture.pointerId !== event.pointerId) return
          const target = landAt(pointAt(event))
          if (target && gesture.moved && gesture.movable) send(gesture.land, target.id)
          else if (target && !gesture.moved) activate(target)
          else setSource(null)
          gestureRef.current = null
          setDrag(null)
          if (svgRef.current.hasPointerCapture(event.pointerId)) svgRef.current.releasePointerCapture(event.pointerId)
        }}
        onPointerCancel={() => { gestureRef.current = null; setDrag(null); setSource(null) }}
        onLostPointerCapture={() => { gestureRef.current = null; setDrag(null) }}>
        <ArmySymbols />
        <defs><pattern id="ct-sea" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M5 30q5-4 10 0t10 0" fill="none" stroke="#6bafa5" strokeWidth="1" opacity=".22" /></pattern></defs>
        <rect width={world.width} height={world.height} fill="url(#ct-sea)" />
        {world.territories.map((land) => {
          const team = FACTIONS[land.owner], ours = land.owner === world.player
          const active = selected?.id === land.id, targeted = drag?.target === land.id && !active
          return <g key={land.id} className={`ct-land${ours ? ' ct-land-ours' : ''}${active ? ' ct-land-selected' : ''}${targeted ? ' ct-land-target' : ''}`} style={{ '--land-color': team?.color || '#919f8e' }} role="button" tabIndex={world.status === 'playing' ? 0 : -1} aria-label={`${land.id + 1}번 땅, ${ours ? '내 땅' : team?.name || '빈 땅'}, 군사 ${Math.floor(land.troops)}명`} aria-pressed={active} data-land={land.id} data-owner={land.owner} data-troops={Math.floor(land.troops)}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); activate(land) } if (event.key === 'Escape') setSource(null) }}
            onClick={(event) => { if (event.detail === 0) activate(land) }}>
            <path d={land.path} fill="#4e827b" opacity=".18" transform="translate(0 6)" />
            <path className="ct-island" d={land.path} fill={team?.light || '#e8e8d8'} stroke={active || targeted ? team?.color || '#203b42' : '#fcf9ea'} strokeWidth={active || targeted ? 6 : 3} />
            {world.time - land.capturedAt < .8 && <circle className="ct-capture-ring" cx={land.x} cy={land.y} r={34 + (world.time - land.capturedAt) * 38} fill="none" stroke={team?.color} strokeWidth="3" opacity={1 - (world.time - land.capturedAt) / .8} />}
            <g transform={`translate(${land.x} ${land.y})`} pointerEvents="none">
              {team ? <><ellipse cx="0" cy="8" rx="21" ry="8" fill={team.color} opacity=".16" /><use href={`#ct-unit-${land.owner}`} x="-27" y="-59" width="54" height="66" />{ours && <g transform="translate(22 -33)"><path d="M0 14V-6l15 4-15 5" fill={team.color} stroke="#fffbed" strokeWidth="2" /><path d="m4-2 2 2 4-2" fill="none" stroke="white" strokeWidth="1.6" /></g>}</> : <path d="m-12-12 12-8 12 8v12h-24zM-3 0v-8h6v8" fill="#bac2ac" stroke="#98a38e" strokeWidth="2" />}
              <rect x="-26" y="5" width="52" height="29" rx="14.5" fill={team?.color || '#f9f8ee'} stroke={team ? '#fff9ed' : '#cdd2bd'} strokeWidth="2" />
              <text y="26" textAnchor="middle" fill={team ? '#fff' : '#6c7c6b'} className="ct-troop-count">{Math.floor(land.troops)}</text>
              {active && <text y="52" textAnchor="middle" fill="#203b42" fontSize="14" fontWeight="800">모두 출정</text>}
            </g>
          </g>
        })}
        <g pointerEvents="none" aria-hidden="true">
          {world.fleets.map((fleet) => {
            const target = world.territories[fleet.toId]
            const soldiers = marchingSoldiers(fleet, target, world.time)
            return <g key={fleet.id} className="ct-fleet" data-owner={fleet.owner} data-target={fleet.toId} data-dispatched={fleet.totalUnits} data-arrived={fleet.arrived - (fleet.casualties || []).filter((index) => index < fleet.arrived).length} data-casualties={fleet.casualties?.length || 0}>
              {soldiers.length > 0 && <path d={`M${fleet.x} ${fleet.y}L${target.x} ${target.y}`} stroke={FACTIONS[fleet.owner].color} strokeWidth="2" strokeDasharray="3 9" opacity=".18" />}
              {soldiers.map((soldier) => <use key={soldier.id} className="ct-soldier" data-soldier={soldier.id} data-wave={soldier.wave} href={`#ct-unit-${fleet.owner}`} x={soldier.x - 12} y={soldier.y - 22 + Math.sin(world.time * 17 + soldier.id) * 1.2} width="24" height="30" />)}
            </g>
          })}
          {(world.clashes || []).map((clash) => {
            const progress = Math.min(1, (world.time - clash.time) / .36)
            return <g key={clash.id} className="ct-clash" transform={`translate(${clash.x} ${clash.y - 9})`} opacity={1 - progress}>
              <circle r={6 + progress * 19} fill="none" stroke="#fffbea" strokeWidth="3" />
              <path d="M-11-11 11 11m-22 0 22-22M-16 0h32M0-16v32" fill="none" stroke="#efb84d" strokeWidth="2.5" strokeLinecap="round" transform={`scale(${.45 + progress * .6})`} />
              <circle cx={-5 - progress * 9} r="3" fill={FACTIONS[clash.owners[0]].color} />
              <circle cx={5 + progress * 9} r="3" fill={FACTIONS[clash.owners[1]].color} />
            </g>
          })}
          {selected && drag && <path d={`M${selected.x} ${selected.y}Q${(selected.x + drag.x) / 2} ${Math.min(selected.y, drag.y) - 30} ${drag.x} ${drag.y}`} fill="none" stroke="#203b42" strokeWidth="4" strokeDasharray="9 7" markerEnd="url(#ct-arrow)" />}
        </g>
      </svg>
      <span className="ct-sea-note" aria-hidden="true">~ 모험의 바다 ~</span>
    </div>
    <p className="ct-map-notice" role="status">{notice}</p>
  </>
}

export default function Conquest() {
  const [state, dispatch] = useReducer(reducer, undefined, initialize)
  const [source, setSource] = useState(null)
  const [help, setHelp] = useState(false)
  const resultRef = useRef(null)
  const { progress, selected, level, world, mode } = state
  const audio = useConquestAudio(world, help, state.round)
  const team = FACTIONS[selected], config = getLevelConfig(level)
  const won = world?.status === 'won', finished = world && world.status !== 'playing'
  const counts = world ? FACTIONS.map((_, index) => world.territories.filter((land) => land.owner === index).length) : []

  useEffect(() => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)) } catch { /* Storage is optional; the current session still progresses. */ } }, [progress])
  useEffect(() => {
    if (mode !== 'battle' || world?.status !== 'playing' || help) return
    let last = gameClock.now()
    const timer = gameClock.setInterval(() => { const now = gameClock.now(); dispatch({ type: 'tick', dt: (now - last) / 1000 }); last = now }, 1000 / 30)
    return () => gameClock.clearInterval(timer)
  }, [mode, world?.status, help])
  useEffect(() => { if (finished) resultRef.current?.focus() }, [finished])

  const start = (type = 'start') => {
    setSource(null); setHelp(false); audio.start()
    dispatch({ type, portrait: window.matchMedia('(max-width: 650px) and (orientation: portrait)').matches })
    window.scrollTo({ top: 0 })
  }
  const menu = () => { setSource(null); setHelp(false); dispatch({ type: 'menu' }) }

  return <main className={`ct-container ${mode === 'battle' ? 'ct-playing' : ''}`} style={{ '--team-color': team.color, '--team-light': team.light }}>
    <div className="ct-shell">
      <header className="ct-topline"><span className="ct-brand"><span>⚑</span> 이안의 영토 대작전</span><div className="ct-top-actions"><button className="ct-sound-button" onClick={audio.toggleSound} aria-label={audio.sound ? '소리 끄기' : '소리 켜기'} aria-pressed={audio.sound} title="효과음과 배경음 켜기 · 끄기"><span className="ct-sound-bars" aria-hidden="true"><i /><i /><i /></span><span>소리 {audio.sound ? '켜짐' : '꺼짐'}</span></button><button onClick={() => { setSource(null); setHelp(!help) }} aria-label="놀이 방법" aria-expanded={help} aria-controls="ct-guide">? <span>놀이 방법</span></button></div></header>
      {help && <section className="ct-guide" id="ct-guide" aria-label="놀이 방법"><div><h2>손가락 하나로, 땅을 내 것으로!</h2><p><b>① 기다리기</b> 내 땅에서 군사가 조금씩 모여요. 땅마다 최대 150명!</p><p><b>② 끌어 보내기</b> 내 땅을 누른 채 다른 땅에 놓으면 군사 전원이 출발해요. 두 땅을 차례로 눌러도 돼요. 바다에 놓으면 취소돼요.</p><p><b>③ 땅 차지하기</b> 길에서 다른 팀 군사를 만나면 한 명씩 함께 사라져요. 살아남은 군사로 상대 병력을 이기면 내 깃발이 꽂혀요. 빈 땅도 차지해야 해요!</p><p><b>④ 힘 합치기</b> 우리 땅에 보내면 지원군! 군사 전원이 다섯 명씩 출발하고, 도착한 만큼 힘을 보태요.</p><small>♪ 출정·충돌·점령마다 다른 소리가 나요. 위의 소리 버튼으로 배경음과 효과음을 함께 끌 수 있어요.</small><small>키보드로도 가능해요: Tab으로 땅 선택 → Enter로 출발지와 도착지 선택. Esc로 선택 취소.</small>{mode === 'battle' && <strong className="ct-guide-paused">설명을 읽는 동안 전투는 멈춰 있어요.</strong>}</div><button onClick={() => setHelp(false)}>알겠어요 ✓</button></section>}
      {mode === 'menu' ? <>
        <section className="ct-intro"><div className="ct-intro-copy"><span className="ct-eyebrow">여섯 영웅의 한판 승부</span><h1>내가 <span>다 먹었다!</span><i aria-hidden="true">✦</i></h1><p>내가 좋아하는 팀과 함께,<br />작은 섬 하나부터 온 세상을 차지해 봐!</p><div className="ct-feature-pills"><span>☝ 쭉 끌어서 출정</span><span>⚑ 6개 진영</span><span>✦ 20탄의 모험</span></div></div><MapPreview player={selected} /></section>
        <section className="ct-team-section" aria-labelledby="ct-team-title"><div className="ct-section-heading"><h2 id="ct-team-title"><span>01</span> 누구와 함께 정복할까?</h2><p>팀마다 다른 힘, 골라서 출발!</p></div><div className="ct-team-grid">
          {FACTIONS.map((faction, index) => <button key={faction.id} className={`ct-team-card${selected === index ? ' is-selected' : ''}`} style={{ '--faction': faction.color, '--faction-light': faction.light }} onClick={() => { dispatch({ type: 'select', team: index }); audio.play('select', index) }} aria-pressed={selected === index} aria-label={`${faction.name}, ${faction.hero}`}>
            <Commander team={faction} /><div className="ct-team-copy"><small>{faction.name}</small><h3>{faction.hero}</h3><span className="ct-trait">{faction.trait}</span>{progress.cleared[index] > 0 && <span className="ct-team-progress">⚑ {progress.cleared[index]}탄 정복</span>}</div><span className="ct-selected-check" aria-hidden="true">{selected === index ? '✓' : '+'}</span>
          </button>)}
        </div></section>
        <section className="ct-mission-section" aria-label="모험 선택"><div className="ct-section-heading"><h2><span>02</span> 오늘의 모험</h2><span className="ct-save-note">진행은 팀별로 자동 저장돼요</span></div><div className="ct-mission-row"><span className="ct-level-stamp">{String(level).padStart(2, '0')}<small>/ 20</small></span><div className="ct-mission-copy"><span>{config.region}</span><h3>{config.name}</h3><p>땅 {config.count}개 · 6팀 대결{level <= 3 ? ' · 천천히 연습해요' : ''}</p></div><details className="ct-level-picker"><summary>다른 탄 고르기 <span>⌄</span></summary><div className="ct-level-popover"><p>앞 탄을 정복하면 다음 모험이 열려요.</p><div className="ct-level-grid">{Array.from({ length: MAX_LEVEL }, (_, index) => { const number = index + 1, locked = number > progress.cleared[selected] + 1; return <button key={number} disabled={locked} aria-label={`${number}탄${locked ? ', 잠김' : ''}`} aria-pressed={level === number} onClick={(event) => { dispatch({ type: 'level', level: number }); event.currentTarget.closest('details').open = false }}><span>{number}</span><small>{locked ? '잠김' : progress.stars[`${selected}-${number}`] ? '★'.repeat(progress.stars[`${selected}-${number}`]) : '도전'}</small></button> })}</div></div></details></div></section>
        <div className="ct-launch-bar"><div><span className="ct-selected-dot" /><p><strong>{team.hero}</strong> 대장, 준비됐나요?<small>{team.tagline}</small></p></div><button className="ct-primary" onClick={() => start()}>{level}탄 출정하기 <span>→</span></button></div>
        <footer className="ct-footer"><span>작은 손으로 펼치는 커다란 작전.</span><span>MADE FOR IAN ♡</span></footer>
      </> : <>
        <div className="ct-battle-heading"><div><span className="ct-eyebrow">{config.region} · {level} / 20탄</span><h1>{config.name}</h1></div><div className="ct-battle-clock" aria-label="진행 시간">◷ {formatTime(world.time)}</div></div>
        <div className="ct-battle-layout"><section className="ct-arena" aria-label="전투"><div className="ct-arena-hud"><span><b style={{ color: team.color }}>⚑ 내 땅</b> <strong data-testid="ct-owned">{counts[selected]}</strong> / {config.count}</span><div className="ct-dominance" aria-label="팀별 영토 비율">{FACTIONS.map((faction, index) => <span key={faction.id} style={{ width: `${counts[index] / config.count * 100}%`, background: faction.color }} />)}</div><span className="ct-objective">모든 땅에 내 깃발을!</span></div>
          <div className="ct-map-stage" inert={finished || help}><BattleMap key={`${level}-${selected}-${world.width}-${state.round}`} world={world} source={source} setSource={setSource} onSend={(from, to) => { audio.unlock(); dispatch({ type: 'send', from, to }) }} /></div>
          <div className="ct-battle-controls"><p className="ct-march-note"><span aria-hidden="true">⚑</span> 전원 출정 · 다섯 명씩 차례로!</p><button className="ct-restart" disabled={finished} onClick={() => start()} aria-label="이번 탄 다시 시작">↻ <span>다시</span></button></div>
        </section><aside className="ct-sidebar"><div className="ct-player-card"><Commander team={team} /><span>우리 팀의 대장</span><h2>{team.hero}</h2><p>{team.trait}</p></div><div className="ct-scoreboard"><h3>지금, 여섯 진영은 <span>⚑</span></h3>{FACTIONS.map((faction, index) => { const alive = counts[index] > 0 || world.fleets.some((fleet) => fleet.owner === index); return <div key={faction.id} className={!alive ? 'ct-eliminated' : ''}><span className="ct-team-dot" style={{ background: faction.color }}>{faction.symbol}</span><span>{faction.hero}{index === selected && <small>나</small>}</span><b>{counts[index]}<small> 땅</small></b></div> })}</div><div className="ct-tip-card"><b>대장님, 작은 힌트!</b><p>{level < 6 ? '숫자가 작은 빈 땅부터 차지해요. 땅이 많아지면 군사도 더 빨리 모여요!' : '우리 땅끼리 지원군을 보내 보세요. 힘을 모으면 큰 땅도 차지할 수 있어요!'}</p></div><button className="ct-menu-button" onClick={menu}>← 팀 · 모험 고르기</button></aside></div>
        <button className="ct-mobile-menu" onClick={menu}>← 팀 · 모험 고르기</button>
        {finished && <div className="ct-result-overlay" role="dialog" aria-modal="true" aria-labelledby="ct-result-title" onKeyDown={(event) => { if (event.key === 'Tab') { const buttons = event.currentTarget.querySelectorAll('button'); if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1].focus() } else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus() } } }}><div className={`ct-result-card${won ? ' ct-winner' : ''}`}>
          <span className="ct-result-kicker">{won ? level === MAX_LEVEL ? '20탄 정복 완료 · 온 세상의 대장' : `${level}탄 정복 완료!` : '대장님, 다시 도전해요!'}</span><Commander team={team} /><div className="ct-stars" aria-label={won ? `별 ${progress.stars[`${selected}-${level}`]}개` : '다음에는 해낼 수 있어요'}>{won ? '★'.repeat(progress.stars[`${selected}-${level}`]) : '♡'}</div><h2 id="ct-result-title">{won ? '내가 다 먹었다!' : '한 번 더 해볼까?'}</h2><p>{won ? level === MAX_LEVEL ? '모든 모험을 정복했어요! 다른 팀의 대장도 되어 볼까요?' : '모든 땅에 우리 깃발이 꽂혔어요. 다음 섬들이 대장님을 기다려요!' : '괜찮아요! 작은 빈 땅부터 차지하고 군사를 모으면 더 멀리 갈 수 있어요.'}</p><div className="ct-result-stats"><span>함께한 시간 <b>{formatTime(world.time)}</b></span><span>정복한 순간 <b>{world.captures}번</b></span></div><button ref={resultRef} className="ct-primary" onClick={() => won && level < MAX_LEVEL ? start('next') : won ? menu() : start()}>{won ? level < MAX_LEVEL ? `${level + 1}탄으로 출발 →` : '다른 팀으로 모험하기 →' : '다시 출정하기 →'}</button><button className="ct-result-secondary" onClick={menu}>팀 · 모험 고르기</button>
        </div></div>}
      </>}
    </div>
  </main>
}
