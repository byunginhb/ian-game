const eighths = (beats) => Array.from({ length: beats * 2 }, (_, i) => i / 2)
const sixteenths = (beats) => Array.from({ length: beats * 4 }, (_, i) => i / 4)
const swing = (beats) => Array.from({ length: beats }, (_, i) => [i, i + 2 / 3]).flat()

/**
 * Drum styles picked per song. Positions are beats inside one bar.
 * `fill` replaces everything from `fill.from` in the last bar of each 4-bar phrase.
 * `gain` scales the whole kit so gentle songs stay in the background.
 */
export const GROOVES = {
  none: { meter: null },
  // Dixieland two-beat with a swung ride, for marching saints.
  dixie: {
    meter: 4, crash: true,
    bar: { kick: [0, 2], snare: [1, 3, 3 + 2 / 3], hat: swing(4) },
    fill: { from: 3, snare: [3, 3 + 1 / 3, 3 + 2 / 3], tom: [3 + 2 / 3] },
  },
  // Bouncy pop beat for the bus.
  pop: {
    meter: 4, crash: true,
    bar: { kick: [0, 1.5, 2], snare: [1, 3], hat: eighths(4).filter((at) => at !== 3.5), ohat: [3.5] },
    fill: { from: 2.5, snare: [2.5, 3, 3.25], tom: [3.5, 3.75] },
  },
  // Light calypso feel like the overworld theme.
  calypso: {
    meter: 4, crash: true,
    bar: { kick: [0, 1.5, 2, 3.5], rim: [1, 2.5, 3], hat: eighths(4) },
    fill: { from: 3, snare: [3, 3.25, 3.5, 3.75] },
  },
  // Driving sixteenths that only arrive once the castle loop comes around again.
  castle: {
    meter: 4, crash: true,
    bar: { kick: [0, .25, 1, 2, 2.25, 3], snare: [.5, 1.5, 2.5, 3.5], hat: sixteenths(4) },
    fill: { from: 3, tom: [3, 3.25], snare: [3.5, 3.75] },
  },
  // Country train beat: shaker keeps chugging under the banjo song.
  country: {
    meter: 4, crash: true,
    bar: { kick: [0, 2], snare: [1, 3], shake: eighths(4) },
    fill: { from: 3, snare: [3, 3.25, 3.5, 3.75] },
  },
  // Oom-pah-pah for the ballpark organ waltz.
  waltz: {
    meter: 3, crash: true,
    bar: { kick: [0], rim: [1, 2], hat: [0, 1, 2] },
    fill: { from: 2, snare: [2, 2.5] },
  },
  // Soft brushes so the lullaby stays a lullaby.
  brush: { meter: 4, gain: .45, bar: { kick: [0], rim: [1, 3], shake: [.5, 1.5, 2.5, 3.5] } },
  // Campfire folk strum.
  folk: { meter: 4, gain: .6, bar: { kick: [0, 2], rim: [1, 3], shake: eighths(4) } },
  // Barn-dance polka in two.
  polka: {
    meter: 2, crash: true,
    bar: { kick: [0], snare: [1], hat: [.5, 1.5] },
    fill: { from: 1, snare: [1, 1.25, 1.5, 1.75] },
  },
  // Fife-and-drum march.
  fife: {
    meter: 2,
    bar: { kick: [0], snare: [0, .5, .75, 1, 1.5] },
    fill: { from: 1, snare: [1, 1.125, 1.25, 1.375, 1.5, 1.75] },
  },
  // Timpani-like toms only, for the anthem.
  anthem: {
    meter: 4, crash: true, gain: .8,
    bar: { ltom: [0], kick: [0, 2] },
    fill: { from: 3, ltom: [3, 3.25, 3.5, 3.75] },
  },
  // Sleigh bells on every eighth.
  sleigh: {
    meter: 4, crash: true,
    bar: { kick: [0, 2], snare: [1, 3], jingle: eighths(4) },
    fill: { from: 3, snare: [3, 3.25, 3.5, 3.75] },
  },
}

/** Drum hits for one song round, in beats from the round start. */
export function grooveHits(name, beats, from = 0) {
  const groove = GROOVES[name]
  if (!groove?.meter) return []
  const hits = []
  const bars = Math.floor(beats / groove.meter)
  for (let bar = 0; bar < bars; bar++) {
    const start = bar * groove.meter
    if (start < from) continue
    const fill = groove.fill && bar % 4 === 3 ? groove.fill : null
    for (const [kind, positions] of Object.entries(groove.bar)) {
      positions.filter((at) => !fill || at < fill.from).forEach((at) => hits.push({ beat: start + at, kind }))
    }
    if (fill) {
      for (const [kind, positions] of Object.entries(fill)) {
        if (kind !== 'from') positions.forEach((at) => hits.push({ beat: start + at, kind }))
      }
    }
    if (groove.crash && (bar === 0 || start === from)) hits.push({ beat: start, kind: 'crash' })
  }
  return hits.map((hit) => ({ ...hit, gain: groove.gain ?? 1 }))
}
