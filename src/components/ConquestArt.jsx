import ninja from '../assets/conquest/ninja-v2.png'
import sonic from '../assets/conquest/sonic-v2.png'
import mario from '../assets/conquest/mario-v2.png'
import demon from '../assets/conquest/demon-v2.png'
import monkey from '../assets/conquest/monkey-v2.png'
import iron from '../assets/conquest/iron-v2.png'
import { FACTIONS } from '../lib/conquest'

const portraits = { ninja, sonic, mario, demon, monkey, iron }

export function Commander({ team, className = '' }) {
  return <img className={`ct-portrait ct-portrait-${team.id} ${className}`} src={portraits[team.id]} alt={team.hero} draggable={false} width="160" height="192" />
}

// Reuse the same transparent character art for commanders and marching armies.
export function ArmySymbols() {
  return <defs>
    {FACTIONS.map((team, index) => <symbol key={team.id} id={`ct-unit-${index}`} viewBox={team.id === 'iron' ? '400 0 550 1079' : '0 0 80 100'}>
      <image href={portraits[team.id]} width={team.id === 'iron' ? 1337 : 80} height={team.id === 'iron' ? 1079 : 100} preserveAspectRatio="xMidYMid meet" />
    </symbol>)}
    <marker id="ct-arrow" markerWidth="10" markerHeight="10" refX="7" refY="4" orient="auto"><path d="m0 0 8 4-8 4z" fill="#203b42" /></marker>
  </defs>
}
