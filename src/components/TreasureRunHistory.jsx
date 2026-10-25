import { bestRun, formatRunTime } from '../lib/treasureRuns'

export function RunSummary({ record, history }) {
  if (!record) return null
  const best = bestRun(history), isBest = record.durationMs !== null && best?.id === record.id
  const previous = bestRun(history.filter((item) => item.id !== record.id))
  return <div className="tk-run-summary" role="status"><span>{isBest ? previous ? 'NEW RECORD · 최고 기록 경신' : 'FIRST CLEAR · 첫 완주' : 'EXPEDITION COMPLETE · 완주 기록'}</span><strong>{formatRunTime(record.durationMs, true)}</strong><p>{record.durationMs === null ? '이전 버전에 시작한 탐험입니다. 다음 도전부터 정확한 완주 시간을 기록합니다.' : isBest && previous ? `이전 최고 기록보다 ${formatRunTime(previous.durationMs - record.durationMs, true)} 단축` : '보물 100개를 왕국에 전달한 시점의 플레이 시간'}</p></div>
}
export default function TreasureRunHistory({ history, canRestart, onRestart }) {
  const best = bestRun(history)
  return <div className="tk-run-history">
    <div className="tk-run-best"><span>PERSONAL BEST · 최고 기록</span><strong>{best ? formatRunTime(best.durationMs, true) : '새 기록을 기다리는 중'}</strong><small>보물 100개 · 네 세계 완주</small></div>
    <p className="tk-run-rules">첫 탐험부터 왕국에 보물 100개 전달까지 측정합니다. 미션 풀이와 왕국에서의 플레이를 포함하며 일시정지·로딩·다른 화면에 머문 시간은 제외합니다.</p>
    {history.length ? <ol className="tk-run-records">{[...history].reverse().map((record, index) => <li key={record.id}><span className="tk-run-number">{String(history.length - index).padStart(2, '0')}</span><div><b>{formatRunTime(record.durationMs, true)}</b><small>{record.finishedAt ? new Date(record.finishedAt).toLocaleString('ko-KR') : '이전 완주 · 완료일 미기록'}</small></div>{record.id === best?.id && <em>BEST</em>}{record.durationMs === null && <em>시간 미측정</em>}</li>)}</ol> : <p className="tk-run-empty">왕국을 완전히 복구하면 첫 완주 기록이 이곳에 남습니다.</p>}
    <p className="tk-dialog-note">같은 브라우저에 완주 기록을 자동 저장합니다. 처음부터 다시 도전해도 기록은 유지됩니다.</p>
    {canRestart && <button className="tk-primary" onClick={onRestart}>처음부터 다시 도전</button>}
  </div>
}
