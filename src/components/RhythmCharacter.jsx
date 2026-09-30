import { CHARACTERS } from '../lib/rhythm'

const eyes = (y, r = 6) => <><circle cx="38" cy={y} r={r} fill="#111" /><circle cx="62" cy={y} r={r} fill="#111" /><circle cx="40" cy={y - 2} r={r / 3} fill="#fff" /><circle cx="64" cy={y - 2} r={r / 3} fill="#fff" /></>

function Plumber({ cap, letter }) {
  return <>
    <circle cx="50" cy="58" r="30" fill="#fcd9b6" />
    <path d="M18 48 Q20 14 50 14 Q80 14 82 48 Z" fill={cap} />
    <rect x="14" y="44" width="72" height="9" rx="4" fill={cap} />
    <circle cx="50" cy="30" r="10" fill="#fff" />
    <text x="50" y="35" textAnchor="middle" fontSize="14" fontWeight="900" fill={cap}>{letter}</text>
    {eyes(60, 5)}
    <ellipse cx="50" cy="70" rx="8" ry="6" fill="#f4a988" />
    <path d="M30 78 Q40 70 50 76 Q60 70 70 78 Q60 84 50 80 Q40 84 30 78 Z" fill="#4a2c1a" />
  </>
}

function Hedgehog({ fur, muzzle = '#fcd9b6', tails }) {
  return <>
    <path d={tails ? 'M22 40 L30 8 L44 30 L56 30 L70 8 L78 40 Z' : 'M50 40 L6 30 L26 50 L2 62 L28 66 L14 84 L50 72 Z'} fill={fur} />
    <circle cx="54" cy="54" r="30" fill={fur} />
    <ellipse cx="56" cy="68" rx="20" ry="14" fill={muzzle} />
    <ellipse cx="46" cy="50" rx="9" ry="12" fill="#fff" /><ellipse cx="64" cy="50" rx="9" ry="12" fill="#fff" />
    <circle cx="48" cy="52" r="4" fill="#15803d" /><circle cx="62" cy="52" r="4" fill="#15803d" />
    <ellipse cx="56" cy="64" rx="4" ry="3" fill="#111" />
    <path d="M46 72 Q56 80 66 72" stroke="#111" strokeWidth="2.5" fill="none" strokeLinecap="round" />
  </>
}

function Ninja({ suit }) {
  return <>
    <circle cx="50" cy="52" r="34" fill={suit} />
    <rect x="18" y="40" width="64" height="20" rx="9" fill="#fcd9b6" />
    {eyes(50, 5)}
    <path d="M28 43 L44 46 M72 43 L56 46" stroke="#111" strokeWidth="3" strokeLinecap="round" />
    <rect x="16" y="28" width="68" height="7" rx="3" fill="#facc15" />
    <path d="M80 30 L96 22 L92 36 Z" fill="#facc15" />
  </>
}

const ART = {
  pikachu: <>
    <path d="M24 40 L8 4 L40 30 Z M76 40 L92 4 L60 30 Z" fill="#facc15" />
    <path d="M8 4 L15 20 L22 15 Z M92 4 L85 20 L78 15 Z" fill="#111" />
    <ellipse cx="50" cy="58" rx="36" ry="32" fill="#facc15" />
    {eyes(52)}
    <circle cx="24" cy="68" r="8" fill="#ef4444" /><circle cx="76" cy="68" r="8" fill="#ef4444" />
    <path d="M42 70 Q46 76 50 70 Q54 76 58 70" stroke="#111" strokeWidth="2.5" fill="none" strokeLinecap="round" />
  </>,
  jigglypuff: <>
    <circle cx="50" cy="56" r="38" fill="#f9a8d4" />
    <path d="M16 36 L20 12 L36 26 Z M84 36 L80 12 L64 26 Z" fill="#f9a8d4" />
    <path d="M50 18 Q66 20 58 34 Q50 40 48 30" stroke="#ec4899" strokeWidth="6" fill="none" strokeLinecap="round" />
    <circle cx="36" cy="54" r="11" fill="#fff" /><circle cx="64" cy="54" r="11" fill="#fff" />
    <circle cx="36" cy="56" r="8" fill="#0ea5e9" /><circle cx="64" cy="56" r="8" fill="#0ea5e9" />
    <circle cx="38" cy="52" r="3" fill="#fff" /><circle cx="66" cy="52" r="3" fill="#fff" />
    <path d="M44 76 Q50 82 56 76" stroke="#111" strokeWidth="2.5" fill="none" strokeLinecap="round" />
  </>,
  mario: <Plumber cap="#ef4444" letter="M" />,
  luigi: <Plumber cap="#22c55e" letter="L" />,
  sonic: <Hedgehog fur="#2563eb" />,
  knuckles: <Hedgehog fur="#dc2626" muzzle="#fde2c8" />,
  tails: <Hedgehog fur="#f59e0b" muzzle="#fff7ed" tails />,
  lloyd: <Ninja suit="#16a34a" />,
  kai: <Ninja suit="#dc2626" />,
  jay: <Ninja suit="#2563eb" />,
}

export default function RhythmCharacter({ id, className = '' }) {
  return <svg className={`rp-character ${className}`} viewBox="0 0 100 100" role="img" aria-label={CHARACTERS[id].name}>{ART[id]}</svg>
}
