import { useEffect, useRef, useState } from 'react'
import { missionChallenge } from '../lib/treasureKingdom'
import TreasureMissionGrid from './TreasureMissionGrid'
import { gameClock } from '../lib/gameClock'

function Challenge({ challenge, onSolved }) {
  const [choice, setChoice] = useState(null), [feedback, setFeedback] = useState(''), [phase, setPhase] = useState(0), [showHint, setShowHint] = useState(false)
  useEffect(() => {
    if (challenge.mode !== 'timing') return
    const start = gameClock.now(), id = gameClock.setInterval(() => setPhase((Math.sin((gameClock.now() - start) / 1000 * challenge.speed * Math.PI * 2) + 1) * 50), 35)
    return () => gameClock.clearInterval(id)
  }, [challenge])
  if (['nonogram', 'sudoku'].includes(challenge.mode)) return <TreasureMissionGrid puzzle={challenge} onSolved={onSolved} />
  const check = () => {
    const success = challenge.mode === 'timing' ? Math.abs(phase - challenge.center) <= challenge.width / 2 : choice === challenge.correct
    if (success) onSolved()
    else setFeedback(challenge.mode === 'timing' ? '조금만 더 기다려볼까요? 빛이 푸른 구간에 들어오면 다시 눌러주세요.' : choice === null ? '답을 하나 골라주세요.' : '한 번 더 생각해 볼까요? 도움말을 보고 다시 골라도 괜찮아요.')
  }
  return <div className="tk-mission-challenge"><p>{challenge.question}</p>{challenge.notes && <p className="tk-site-notes">{challenge.notes}</p>}
    {challenge.mode === 'timing' ? <div className="tk-relay-meter" aria-label="중계기 신호 동기화"><div className="tk-relay-safe" style={{ left: `${challenge.center - challenge.width / 2}%`, width: `${challenge.width}%` }} /><i style={{ left: `${phase}%` }} /><span>푸른 구간에서 Enter</span></div> : <div className="tk-mission-choices">{challenge.choices.map((text, index) => <button key={index} aria-pressed={choice === index} onClick={() => { setChoice(index); setFeedback('') }}>{text}</button>)}</div>}
    <p className="tk-puzzle-feedback" role="status">{feedback || '시간제한은 없어요. 천천히 생각하고 골라주세요.'}</p>{challenge.hint && <><button className="tk-text-button" onClick={() => setShowHint(!showHint)}>{showHint ? '도움말 접기' : '도움말 보기'}</button>{showHint && <p className="tk-mission-help">{challenge.hint}</p>}</>}<button className="tk-primary" onClick={check}>{challenge.mode === 'timing' ? '신호 동기화' : '현장 판단 확인'}</button>
  </div>
}
export function MissionSite({ item, step, onSolved }) {
  const [challenge] = useState(() => missionChallenge(item, step))
  const [solved, setSolved] = useState(false), report = useRef(null)
  useEffect(() => { if (solved) report.current?.focus() }, [solved])
  return <><p className="tk-mission-phase">{item.targets[step].name} · {step + 1}/3</p>{!solved ? <Challenge challenge={challenge} onSolved={() => setSolved(true)} /> : <div className="tk-site-report"><h3>현장 기록 확인</h3><p>찾은 숫자 <b>{item.targets[step].code}</b></p><p>{step === 2 ? item.missionMode === 'rescue' ? '대원을 구출했다. 동행하는 대원을 담당자에게 호위하라.' : '세 현장을 모두 해결했어요. 담당자에게 돌아가 찾은 수를 확인해 주세요.' : `다음 목표: ${item.targets[step + 1].name}`}</p><button ref={report} className="tk-primary" onClick={onSolved}>기록 저장하고 계속</button></div>}</>
}
export function MissionBriefing({ item, progress, escortReady, onAccept, onClose, onComplete }) {
  const accepted = progress.quests.includes(item.id), done = item.targets.filter((target) => progress.questItems.includes(target.id)).length
  const [challenge] = useState(() => missionChallenge(item, 3, true))
  return <><p className="tk-quest-quote">“{item.briefing}”</p><ol className="tk-mission-objectives">{item.targets.map((target, i) => <li key={target.id} className={progress.questItems.includes(target.id) ? 'is-done' : ''}>{target.name}{progress.questItems.includes(target.id) ? ` · 기록 ${target.code}` : accepted && i === done ? ' · 현재 목표' : ' · 미조사'}</li>)}<li>담당자 복귀{item.missionMode === 'rescue' ? ' · 구출 대원 호위' : ' · 찾은 수 확인'}</li></ol>
    {!accepted ? <button className="tk-primary" onClick={onAccept}>임무 수락</button> : done < 3 ? <><p className="tk-dialog-note">현장 표시에 접근한 뒤 조사 버튼 또는 E를 누른다. 지점은 순서대로 해결해야 한다.</p><button className="tk-primary" onClick={onClose}>임무 계속</button></> : item.missionMode === 'rescue' ? <><p>{escortReady ? '구출 대원이 안전 지점에 도착했다.' : '구출 대원과 함께 더 가까이 이동한 뒤 보고하라.'}</p><button className="tk-primary" onClick={escortReady ? onComplete : onClose}>{escortReady ? '구조 임무 완료' : '호위 계속'}</button></> : <Challenge challenge={challenge} onSolved={onComplete} />}
  </>
}
