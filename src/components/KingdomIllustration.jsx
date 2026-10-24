import ruined from '../assets/treasure/kingdom-ruined.webp'
import restored from '../assets/treasure/kingdom-restored.webp'

export default function KingdomIllustration({ count }) {
  return <div className="tk-kingdom-art" role="img" aria-label={`기록핵 ${count}개로 복원된 왕국`}>
    <img src={ruined} alt="" fetchPriority="high" />
    <img className="tk-kingdom-restored" src={restored} alt="" style={{ opacity: count / 100 }} />
    <div className="tk-city-light" style={{ opacity: count / 100 }} />
  </div>
}
