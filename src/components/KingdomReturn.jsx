import { useEffect, useRef, useState } from 'react'
import KingdomIllustration from './KingdomIllustration'
import citizens from '../assets/treasure/citizens-cheering.webp'
import { gameClock } from '../lib/gameClock'
import { RESTORATIONS } from '../lib/treasureKingdom'

export default function KingdomReturn({ before, after, steps, stageName }) {
  const [shown, setShown] = useState(before)
  const timer = useRef(null)
  const complete = shown >= after
  useEffect(() => {
    const start = gameClock.now()
    const id = gameClock.setInterval(() => {
      const progress = Math.min(1, (gameClock.now() - start) / 4400)
      const eased = progress * progress * (3 - 2 * progress)
      setShown(before + (after - before) * eased)
      if (progress === 1) gameClock.clearInterval(id)
    }, 50)
    timer.current = id
    return () => gameClock.clearInterval(id)
  }, [before, after])
  const current = RESTORATIONS.filter((step) => shown >= step.at).at(-1)
  return <>
    <div className={`tk-return-stage${complete ? ' is-rebuilt' : ''}`} data-before={before} data-after={after}>
      <KingdomIllustration count={shown} />
      <div className="tk-repair-light" />
      <div className="tk-return-caption"><span>{stageName ? `${stageName}의 보물이 왕국에 도착했다` : '회수한 보물의 힘이 왕국으로 돌아온다'}</span><strong>{complete ? '다시 살아나는 왕국' : '무너진 왕국을 복구하는 중'}</strong></div>
      <div className="tk-welcoming-plaza" />
      <div className="tk-welcoming-citizens" role="img" aria-label="돌아온 탐사자를 환호하며 맞이하는 왕국의 백성들">
        {[0, 1, 2].map((index) => <div key={index} className={`tk-citizen-group tk-citizen-group-${index}`} style={{ backgroundImage: `url(${citizens})` }} />)}
      </div>

      <button className="tk-skip-repair" onClick={() => { gameClock.clearInterval(timer.current); setShown(after) }} disabled={complete}>연출 건너뛰기</button>
    </div>
      <div className="tk-return-meter"><span>왕국 복원 <b>{Math.floor(shown)}%</b></span><div role="progressbar" aria-label="왕국 복구 연출" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(shown)}><i style={{ width: `${shown}%` }} /></div><small>{current.name}</small></div>
    <p className="tk-homecoming-message">백성들이 이안이의 귀환을 환호한다. 보물 <b>{after - before}개</b>가 왕국의 동력으로 연결됐다.</p>
    <div className="tk-restored-steps">{steps.length ? steps.map((step) => <p key={step.at}><b>{step.name}</b><span>{step.text}</span></p>) : <p>복구 동력 축적 중. 다음 구역 재가동을 위한 준비가 진행된다.</p>}</div>
  </>
}
