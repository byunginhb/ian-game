import { useEffect, useRef, useState } from 'react'
import { missionChallenge } from '../lib/treasureKingdom'
import { gameClock } from '../lib/gameClock'

function Challenge({ challenge, onSolved }) {
  const [choice, setChoice] = useState(null), [feedback, setFeedback] = useState(''), [phase, setPhase] = useState(0)
  useEffect(() => {
    if (challenge.mode !== 'timing') return
    const start = gameClock.now(), id = gameClock.setInterval(() => setPhase((Math.sin((gameClock.now() - start) / 1000 * challenge.speed * Math.PI * 2) + 1) * 50), 35)
    return () => gameClock.clearInterval(id)
  }, [challenge])
  const check = () => {
    const success = challenge.mode === 'timing' ? Math.abs(phase - challenge.center) <= challenge.width / 2 : choice === challenge.correct
    if (success) onSolved()
    else setFeedback(challenge.mode === 'timing' ? '신호가 불안정하다. 푸른 구간에 도달할 때 다시 동기화하라.' : choice === null ? '근거를 확인하고 답을 선택하라.' : '현장 기록과 일치하지 않는다. 조건을 다시 확인하라.')
  }
  return <div className="tk-mission-challenge"><p>{challenge.question}</p>{challenge.notes && <p className="tk-site-notes">{challenge.notes}</p>}
    {challenge.mode === 'timing' ? <div className="tk-relay-meter" aria-label="중계기 신호 동기화"><div className="tk-relay-safe" style={{ left: `${challenge.center - challenge.width / 2}%`, width: `${challenge.width}%` }} /><i style={{ left: `${phase}%` }} /><span>안정 구간에서 Enter</span></div> : <div className="tk-mission-choices">{challenge.choices.map((text, index) => <button key={index} aria-pressed={choice === index} onClick={() => { setChoice(index); setFeedback('') }}>{text}</button>)}</div>}
    <p className="tk-puzzle-feedback" role="status">{feedback || '이 현장을 해결해야 다음 지점으로 진행할 수 있다.'}</p><button className="tk-primary" onClick={check}>{challenge.mode === 'timing' ? '신호 동기화' : '현장 판단 확인'}</button>
  </div>
}
export function MissionSite({ item, step, onSolved }) {
  const [challenge] = useState(() => missionChallenge(item, step))
  const [solved, setSolved] = useState(false), report = useRef(null)
  useEffect(() => { if (solved) report.current?.focus() }, [solved])
  return <><p className="tk-mission-phase">{item.targets[step].name} · {step + 1}/3</p>{!solved ? <Challenge challenge={challenge} onSolved={() => setSolved(true)} /> : <div className="tk-site-report"><h3>현장 기록 확인</h3><p>관측값 <b>{item.targets[step].code}</b></p><p>{step === 2 ? item.missionMode === 'rescue' ? '대원을 구출했다. 동행하는 대원을 담당자에게 호위하라.' : '세 지점의 조사 완료. 담당자에게 돌아가 관측 순서를 해독하라.' : `다음 목표: ${item.targets[step + 1].name}`}</p><button ref={report} className="tk-primary" onClick={onSolved}>기록 저장하고 계속</button></div>}</>
}
export function MissionBriefing({ item, progress, escortReady, onAccept, onClose, onComplete }) {
  const accepted = progress.quests.includes(item.id), done = item.targets.filter((target) => progress.questItems.includes(target.id)).length
  const [challenge] = useState(() => missionChallenge(item, 3, true))
  return <><p className="tk-quest-quote">“{item.briefing}”</p><ol className="tk-mission-objectives">{item.targets.map((target, i) => <li key={target.id} className={progress.questItems.includes(target.id) ? 'is-done' : ''}>{target.name}{progress.questItems.includes(target.id) ? ` · 기록 ${target.code}` : accepted && i === done ? ' · 현재 목표' : ' · 미조사'}</li>)}<li>담당자 복귀{item.missionMode === 'rescue' ? ' · 구출 대원 호위' : ' · 기록 순서 해독'}</li></ol>
    {!accepted ? <button className="tk-primary" onClick={onAccept}>임무 수락</button> : done < 3 ? <><p className="tk-dialog-note">현장 표시에 접근한 뒤 조사 버튼 또는 E를 누른다. 지점은 순서대로 해결해야 한다.</p><button className="tk-primary" onClick={onClose}>임무 계속</button></> : item.missionMode === 'rescue' ? <><p>{escortReady ? '구출 대원이 안전 지점에 도착했다.' : '구출 대원과 함께 더 가까이 이동한 뒤 보고하라.'}</p><button className="tk-primary" onClick={escortReady ? onComplete : onClose}>{escortReady ? '구조 임무 완료' : '호위 계속'}</button></> : <Challenge challenge={challenge} onSolved={onComplete} />}
  </>
}
