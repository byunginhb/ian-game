import ruined from '../assets/treasure/kingdom-ruined.webp'
import restored from '../assets/treasure/kingdom-restored.webp'

const DISTRICTS = [
  [1, 61, 46], [10, 39, 44], [20, 69, 35], [30, 81, 38], [40, 66, 48],
  [50, 75, 48], [60, 91, 30], [75, 73, 22], [90, 75, 17], [100, 50, 50],
]
export default function KingdomIllustration({ count }) {
  return <div className="tk-kingdom-art" role="img" aria-label={`기록핵 ${Math.round(count)}개로 복원된 왕국`}>
    <img src={ruined} alt="" fetchPriority="high" />
    <img className="tk-kingdom-restored" src={restored} alt="" style={{ opacity: count === 100 ? 1 : count / 100 * .35 }} />
    {count < 100 && DISTRICTS.map(([at, x, y], index) => {
      const previous = index ? DISTRICTS[index - 1][0] : 0
      const opacity = Math.max(0, Math.min(1, (count - previous) / (at - previous)))
      return opacity > 0 && <img key={at} className="tk-restored-district" src={restored} alt="" style={{ opacity, maskImage: `radial-gradient(ellipse 24% 30% at ${x}% ${y}%, #000 35%, transparent 100%)` }} />
    })}
    <div className="tk-city-light" style={{ opacity: count / 100 }} />
  </div>
}
