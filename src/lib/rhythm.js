export const LANE_KEYS = ['KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM']
export const LANE_LABELS = ['C', 'V', 'B', 'N', 'M']
export const CHARACTERS = {
  pikachu: { name: '피카츄', color: '#facc15' },
  jigglypuff: { name: '푸린', color: '#f9a8d4' },
  mario: { name: '마리오', color: '#ef4444' },
  luigi: { name: '루이지', color: '#22c55e' },
  sonic: { name: '소닉', color: '#2563eb' },
  knuckles: { name: '너클즈', color: '#dc2626' },
  tails: { name: '테일즈', color: '#f59e0b' },
  lloyd: { name: '로이드', color: '#16a34a' },
  kai: { name: '카이', color: '#dc2626' },
  jay: { name: '제이', color: '#2563eb' },
}

export const RECORD_KEY = 'ian-rhythm-best-v1'

export const MODES = {
  kid: { label: '아이', tempo: .8, travel: 2400, perfect: 120, good: 230 },
  adult: { label: '어른', tempo: 1, travel: 1700, perfect: 70, good: 140 },
}

// Melody tokens: NOTE[-beats], R = rest. Chords hold one bass root per `chordBeats`.
export const SONGS = [
  {
    id: 'twinkle', title: 'Twinkle Twinkle Little Star', ko: '반짝반짝 작은 별', host: 'pikachu', bpm: 100, repeat: 2, chordBeats: 2,
    melody: 'C4 C4 G4 G4 A4 A4 G4-2 F4 F4 E4 E4 D4 D4 C4-2 G4 G4 F4 F4 E4 E4 D4-2 G4 G4 F4 F4 E4 E4 D4-2 C4 C4 G4 G4 A4 A4 G4-2 F4 F4 E4 E4 D4 D4 C4-2',
    chords: 'C C F C F C G C C F C G C F C G C C F C F C G C',
  },
  {
    id: 'mary', title: 'Mary Had a Little Lamb', ko: '떴다 떴다 비행기', host: 'mario', bpm: 110, repeat: 3, chordBeats: 4,
    melody: 'E4 D4 C4 D4 E4 E4 E4-2 D4 D4 D4-2 E4 G4 G4-2 E4 D4 C4 D4 E4 E4 E4 E4 D4 D4 E4 D4 C4-4',
    chords: 'C C G C C C G C',
  },
  {
    id: 'old-macdonald', title: 'Old MacDonald Had a Farm', ko: '맥도날드 할아버지', host: 'lloyd', bpm: 120, repeat: 2, chordBeats: 4,
    melody: 'C4 C4 C4 G3 A3 A3 G3-2 E4 E4 D4 D4 C4-3 G3 C4 C4 C4 G3 A3 A3 G3-2 E4 E4 D4 D4 C4-3 G3-.5 G3-.5 '
      + 'C4 C4 C4 G3-.5 G3-.5 C4 C4 C4-2 C4-.5 C4-.5 C4 C4-.5 C4-.5 C4 C4-.5 C4-.5 C4-.5 C4-.5 C4 C4 '
      + 'C4 C4 C4 G3 A3 A3 G3-2 E4 E4 D4 D4 C4-4',
    chords: 'C F G C C F G C C C C C C F G C',
  },
  {
    id: 'wheels', title: 'The Wheels on the Bus', ko: '버스 바퀴가 빙글빙글', host: 'sonic', bpm: 120, repeat: 3, chordBeats: 2,
    melody: 'R-3 G3 C4 C4-.5 C4-.5 C4 E4 G4 E4 C4-2 D4 B3 G3-2 G4 E4 C4 G3 C4 C4-.5 C4-.5 C4 E4 G4 E4 C4-2 D4 G3 C4-2',
    chords: 'C C C C C C G G C C C C C C G C',
  },
  {
    id: 'itsy-bitsy', title: 'Itsy Bitsy Spider', ko: '거미가 줄을 타고', host: 'kai', bpm: 140, repeat: 3, chordBeats: 3,
    melody: 'R-2.5 G3-.5 C4 C4-.5 C4 D4-.5 E4 E4-.5 D4 C4-.5 D4 E4-.5 C4-1.5 E4-1.5 E4 F4-.5 G4-3 F4 E4-.5 F4 G4-.5 E4-3 '
      + 'C4-1.5 C4 D4-.5 E4-3 D4 C4-.5 D4 E4-.5 C4-2.5 G3-.5 C4 C4-.5 C4 D4-.5 E4 E4-.5 D4 C4-.5 D4 E4-.5 C4-1.5',
    chords: 'C C C G C C G C F C G C C C C',
  },
  {
    id: 'baby-shark', title: 'Baby Shark', ko: '아기 상어', host: 'jigglypuff', bpm: 115, repeat: 5, chordBeats: 4,
    melody: 'C4 D4 F4-.5 F4-.5 F4-.5 F4-.5 C4 D4 F4-.5 F4-.5 F4-.5 F4-.5 C4 D4 F4-.5 F4-.5 F4-.5 F4-.5 F4 F4 E4-2',
    chords: 'C C C G',
  },
  {
    id: 'happy', title: "If You're Happy and You Know It", ko: '우리 모두 다 같이 손뼉을', host: 'luigi', bpm: 110, repeat: 3, chordBeats: 4,
    melody: 'R-3 G3-.5 G3-.5 C4 C4-.5 C4-.5 C4-.5 B3-.5 C4 D4-.5 D4-.5 D4 G4-.5 G4-.5 G3-.5 G3-.5 '
      + 'D4 D4-.5 D4-.5 D4-.5 C4-.5 D4 E4-.5 E4-.5 E4 G4-.5 G4-.5 E4-.5 E4-.5 F4 F4-.5 F4-.5 F4-.5 F4-.5 A4-.5 A4-.5 '
      + 'A4-.5 G4-.5 G4-.5 F4-.5 E4-.5 E4-.5 E4 E4-.5 E4-.5 D4-.5 D4-.5 C4-.5 C4-.5 B3 A3-.5 B3-.5 C4 G4-.5 G4-.5 R',
    chords: 'C C G G C F C G C',
  },
  {
    id: 'london-bridge', title: 'London Bridge Is Falling Down', ko: '런던 다리 무너진다', host: 'knuckles', bpm: 120, repeat: 3, chordBeats: 4,
    melody: 'G4-1.5 A4-.5 G4 F4 E4 F4 G4-2 D4 E4 F4-2 E4 F4 G4-2 G4-1.5 A4-.5 G4 F4 E4 F4 G4-2 D4-2 G4-2 E4 C4-3',
    chords: 'C C G C C C G C',
  },
  {
    id: 'jingle-bells', title: 'Jingle Bells', ko: '징글벨', host: 'jay', bpm: 130, repeat: 2, chordBeats: 4,
    melody: 'E4 E4 E4-2 E4 E4 E4-2 E4 G4 C4-1.5 D4-.5 E4-4 F4 F4 F4-1.5 F4-.5 F4 E4 E4 E4-.5 E4-.5 E4 D4 D4 E4 D4-2 G4-2 '
      + 'E4 E4 E4-2 E4 E4 E4-2 E4 G4 C4-1.5 D4-.5 E4-4 F4 F4 F4 F4 F4 E4 E4 E4-.5 E4-.5 G4 G4 F4 D4 C4-4',
    chords: 'C C C C F C D G C C C C F C G C',
  },
  {
    id: 'row-boat', title: 'Row, Row, Row Your Boat', ko: '노를 저어라', host: 'tails', bpm: 140, repeat: 4, chordBeats: 3,
    melody: 'C4-1.5 C4-1.5 C4 D4-.5 E4-1.5 E4 D4-.5 E4 F4-.5 G4-3 C5-.5 C5-.5 C5-.5 G4-.5 G4-.5 G4-.5 E4-.5 E4-.5 E4-.5 C4-.5 C4-.5 C4-.5 G4 F4-.5 E4 D4-.5 C4-3',
    chords: 'C C C C C C G C',
  },
]

const STEPS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

export function toMidi(name) {
  const match = /^([A-G])(#?)(\d)$/.exec(name)
  if (!match) throw new Error(`알 수 없는 음: ${name}`)
  return 12 * (Number(match[3]) + 1) + STEPS[match[1]] + (match[2] ? 1 : 0)
}

export function parseMelody(text) {
  let beat = 0
  const notes = []
  for (const token of text.trim().split(/\s+/)) {
    const [name, length = '1'] = token.split('-')
    const beats = Number(length)
    if (!(beats > 0)) throw new Error(`잘못된 박자: ${token}`)
    if (name !== 'R') notes.push({ beat, beats, midi: toMidi(name) })
    beat += beats
  }
  return { notes, beats: beat }
}

/** Higher pitches land further right, like a piano. */
export function laneForPitch(midi, pitches) {
  const rank = pitches.indexOf(midi)
  return Math.min(4, Math.floor((rank * 5) / pitches.length))
}

export function buildChart(song, mode) {
  const { notes, beats } = parseMelody(song.melody)
  const pitches = [...new Set(notes.map((note) => note.midi))].sort((a, b) => a - b)
  const beatMs = 60000 / (song.bpm * mode.tempo)
  const roots = song.chords.trim().split(/\s+/)
  const chart = []
  const bass = []
  for (let round = 0; round < song.repeat; round++) {
    const offset = round * beats
    notes.forEach((note) => chart.push({
      id: chart.length, time: (offset + note.beat) * beatMs, midi: note.midi,
      length: note.beats * beatMs, lane: laneForPitch(note.midi, pitches),
    }))
    roots.forEach((root, index) => {
      const midi = toMidi(`${root}2`)
      for (let step = 0; step < song.chordBeats; step++) {
        // Oom-pah: root on the strong beat, fifth in between.
        bass.push({ time: (offset + index * song.chordBeats + step) * beatMs, midi: step % 2 ? midi + 7 : midi })
      }
    })
  }
  return { notes: chart, bass, duration: song.repeat * beats * beatMs, beatMs }
}

/** Earliest unjudged note in the lane that is close enough to count. */
export function findHit(notes, results, lane, time, window) {
  let best = null
  for (const note of notes) {
    if (note.time - time > window) break
    if (note.lane !== lane || results[note.id] || Math.abs(note.time - time) > window) continue
    best = note
    break
  }
  return best
}

export function judge(delta, mode) {
  const off = Math.abs(delta)
  if (off <= mode.perfect) return 'perfect'
  if (off <= mode.good) return 'good'
  return null
}

export const POINTS = { perfect: 100, good: 60 }

export function scoreFor(grade, combo) {
  return POINTS[grade] + Math.min(combo, 50) * 2
}

export function starsFor(results, total) {
  if (!total) return 0
  const credit = Object.values(results).reduce((sum, grade) => sum + (grade === 'perfect' ? 1 : grade === 'good' ? .7 : 0), 0)
  const ratio = credit / total
  return ratio >= .9 ? 3 : ratio >= .7 ? 2 : ratio >= .4 ? 1 : 0
}
