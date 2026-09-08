// Top-down freestyle silhouette. Limb pivots use the SVG's own coordinates.
export default function SwimmingRacer({ id, lane }) {
  const skin = `swim-skin-${id}`
  const suit = `swim-suit-${id}`
  const cap = `swim-cap-${id}`

  return (
    <svg className="swim-figure" viewBox="0 -12 148 96" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={skin} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0" stopColor="var(--skin-light)" />
          <stop offset="0.45" stopColor="var(--skin-color)" />
          <stop offset="1" stopColor="var(--skin-shadow)" />
        </linearGradient>
        <linearGradient id={suit} x2="0" y2="1">
          <stop stopColor="var(--swimmer-color)" />
          <stop offset="1" stopColor="#173649" />
        </linearGradient>
        <linearGradient id={cap} x2="0.2" y2="1">
          <stop stopColor="#fff" stopOpacity="0.9" />
          <stop offset="0.35" stopColor="var(--cap-color)" />
          <stop offset="1" stopColor="var(--cap-color)" />
        </linearGradient>
      </defs>
      <ellipse className="swim-underwater-shadow" cx="69" cy="40" rx="51" ry="13" />
      <g className="swim-anatomy" fill={`url(#${skin})`} stroke="var(--skin-shadow)" strokeWidth="0.65" strokeLinejoin="round">
        <g className="swim-leg swim-leg-top">
          <path d="M51 27 C40 26 30 27 21 29 Q16 31 20 35 C31 37 40 37 51 37Z" />
          <g className="swim-shin swim-shin-top">
            <path d="M22 29 C14 29 10 30 5 29 Q0 27 1 30 L5 35 Q12 37 22 35Z" />
            <path d="M7 31 L3 30" fill="none" stroke="var(--skin-light)" />
          </g>
          <path d="M45 29 Q32 29 24 31" fill="none" stroke="var(--skin-light)" strokeWidth="1.3" />
        </g>
        <g className="swim-leg swim-leg-bottom">
          <path d="M51 37 C40 36 29 38 20 40 Q16 43 21 46 C33 47 43 47 52 45Z" />
          <g className="swim-shin swim-shin-bottom">
            <path d="M22 40 C15 41 10 42 5 41 Q0 40 1 43 L6 47 Q14 48 23 46Z" />
            <path d="M8 44 L3 43" fill="none" stroke="var(--skin-light)" />
          </g>
          <path d="M44 39 Q33 40 25 42" fill="none" stroke="var(--skin-light)" strokeWidth="1.3" />
        </g>
        <g className="swim-arm swim-arm-top">
          <path d="M86 23 C94 21 101 19 110 20 Q115 21 111 26 C102 27 96 29 88 31Z" />
          <g className="swim-forearm swim-forearm-top">
            <path d="M109 20 C117 20 124 22 131 22 L140 22 Q145 23 141 26 L132 28 C123 28 116 27 109 26Z" />
            <path d="M130 24 L139 24" stroke="var(--skin-light)" fill="none" />
          </g>
          <path d="M92 24 L106 22" stroke="var(--skin-light)" strokeWidth="1.5" fill="none" />
        </g>
        <g className="swim-arm swim-arm-bottom">
          <path d="M87 41 C96 42 102 45 111 46 Q115 48 110 52 C101 53 93 51 85 49Z" />
          <g className="swim-forearm swim-forearm-bottom">
            <path d="M110 46 C119 46 125 45 132 45 L141 46 Q145 48 140 50 L132 51 C124 53 116 54 110 52Z" />
            <path d="M131 47 L139 48" stroke="var(--skin-light)" fill="none" />
          </g>
          <path d="M93 45 L107 48" stroke="var(--skin-light)" strokeWidth="1.5" fill="none" />
        </g>
        <path className="swim-torso" d="M49 28 C61 29 69 24 79 22 Q88 20 93 25 L96 31 L96 41 Q93 49 85 50 C72 49 63 43 50 46 Q46 37 49 28Z" />
        <path d="M62 34 Q76 36 89 35 M78 26 Q80 30 89 31 M78 45 Q82 41 89 40" fill="none" stroke="var(--skin-shadow)" opacity="0.5" />
        <path d="M63 31 Q73 27 80 26" fill="none" stroke="var(--skin-light)" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
        <path d="M43 27 Q52 26 58 29 L59 45 Q50 48 43 47 L41 39 L43 36Z" fill={`url(#${suit})`} stroke="#183947" />
        <path d="M47 28 L46 35 M46 40 L47 46" fill="none" stroke="white" strokeWidth="1.7" opacity="0.8" />
        <path d="M56 30 L56 44" stroke="#0d293e" opacity="0.5" />
        <path d="M92 31 L103 30 L105 42 L92 41Z" />
        <g className="swim-face">
          <path d="M104 25 C111 24 117 28 118 34 L122 36 Q123 38 119 39 C118 45 109 48 104 43Z" />
          <path d="M110 27 L111 44" fill="none" stroke="#163447" strokeWidth="2.5" />
          <path d="M114 30 Q120 32 118 35 L115 35Z M115 39 L119 38 Q120 42 115 43Z" fill="#163447" stroke="#b5edfa" strokeWidth="0.8" />
          <path d="M97 27 Q103 20 111 25 L114 29 Q108 36 114 44 C107 49 99 45 96 40 Q94 33 97 27Z" fill={`url(#${cap})`} stroke="var(--cap-color)" />
          <path d="M99 27 Q104 23 110 27 M98 29 Q95 36 99 40" fill="none" stroke="white" opacity="0.55" />
          <text x="104" y="39" textAnchor="middle" fill="#173447" stroke="none" fontSize="7" fontWeight="900">{lane}</text>
        </g>
      </g>
      <g className="swim-water-glints" fill="none" stroke="#e0fbff" strokeLinecap="round">
        <path d="M56 51 Q76 56 93 51" opacity="0.4" />
        <path d="M95 19 Q109 15 120 24" opacity="0.65" />
        <path d="M26 22 L35 21 M17 50 L27 51" opacity="0.55" />
      </g>
    </svg>
  )
}
