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
  // Kid mode freezes on a note that reaches the line until the right pad is pressed.
  kid: { label: '아이', hint: '기다려 줘요', tempo: .85, travel: 2300, perfect: 110, good: 200, waits: true },
  // Adult mode is faster, tighter and a stray press breaks the combo.
  adult: { label: '어른', hint: '빠르고 어렵게', tempo: 1.12, travel: 1250, perfect: 50, good: 100, waits: false },
}

// Songs US/Canadian kids learn in elementary school music class, checked against published scores.
// Melody tokens: NOTE[-beats], R = rest. Chords hold one bass root per `chordBeats`.
export const SONGS = [
  {
    id: 'saints', title: 'When the Saints Go Marching In', ko: '성자들의 행진', host: 'lloyd', bpm: 120, repeat: 2, meter: 4, chordBeats: 2,
    melody: 'R-1 C4-1 E4-1 F4-1 G4-4 R-1 C4-1 E4-1 F4-1 G4-4 R-1 C4-1 E4-1 F4-1 G4-2 E4-2 C4-2 E4-2 D4-4 R-1 E4-1 E4-1 D4-1 C4-4 E4-2 G4-2 G4-1 F4-3 R-2 E4-1 F4-1 G4-2 E4-2 C4-2 D4-2 C4-4',
    chords: 'C C C C C C C C C C C C C C G G G G C C C C F F F C C C C G C C',
  },
  {
    // Pitches: noobnotes.net letter notes; rhythm: Wikipedia score (eighths doubled).
    id: 'wheels-bus', title: 'The Wheels on the Bus', ko: '버스 바퀴가 빙글빙글', host: 'pikachu', bpm: 170, repeat: 4, meter: 4, chordBeats: 2,
    melody: 'R-3 G3-1 C4-1 C4-.5 C4-.5 C4-1 E4-1 G4-1 E4-1 C4-2 D4-1 B3-1 G3-2 E4-1 D4-1 C4-1.5 G3-.5 C4-1 C4-.5 C4-.5 C4-1 E4-1 G4-1 E4-1 C4-2 D4-2 G3-1.5 G3-.5 C4-3 R-1',
    chords: 'C C C C C C G G C C C C C C G G C C',
  },
  {
    id: 'oh-susanna', title: 'Oh! Susanna', ko: '오! 수재너', host: 'sonic', bpm: 160, repeat: 2, meter: 4, chordBeats: 2,
    melody: 'R-3 C4-.5 D4-.5 E4-1 G4-1 G4-1.5 A4-.5 G4-1 E4-1 C4-1.5 D4-.5 E4-1 E4-1 D4-1 C4-1 D4-3 C4-.5 D4-.5 E4-1 G4-1 G4-1.5 A4-.5 G4-1 E4-1 C4-1.5 D4-.5 E4-1 E4-1 D4-1 D4-1 C4-3 R-1 F4-2 F4-2 A4-1 A4-2 A4-1 G4-1 G4-1 E4-1 C4-1 D4-3 C4-.5 D4-.5 E4-1 G4-1 G4-1.5 A4-.5 G4-1 E4-1 C4-1.5 D4-.5 E4-1 E4-1 D4-1 D4-1 C4-3 R-1',
    chords: 'C C C C C C C C G G C C C C C G C C F F F F C C G G C C C C C G C C',
  },
  {
    id: 'ball-game', title: 'Take Me Out to the Ball Game', ko: '야구장에 데려가 줘', host: 'mario', bpm: 170, repeat: 2, meter: 3, chordBeats: 3,
    melody: 'C4-2 C5-1 A4-1 G4-1 E4-1 G4-3 D4-3 C4-2 C5-1 A4-1 G4-1 E4-1 G4-5 R-1 A4-1 G#4-1 A4-1 E4-1 F4-1 G4-1 A4-2 F4-1 D4-3 A4-2 A4-1 A4-1 B4-1 C5-1 D5-1 B4-1 A4-1 G4-1 E4-1 D4-1 C4-2 C5-1 A4-1 G4-1 E4-1 G4-3 D4-2 D4-1 C4-2 D4-1 E4-1 F4-1 G4-1 A4-4 A4-1 B4-1 C5-3 C5-3 C5-1 B4-1 A4-1 G4-1 F#4-1 G4-1 A4-3 B4-3 C5-4 R-2',
    chords: 'C C G G C C G G A A D D D D G G C C G G C C F F F F C A D G C C',
  },
  {
    id: 'sunshine', title: 'You Are My Sunshine', ko: '너는 나의 햇살', host: 'pikachu', bpm: 110, repeat: 2, meter: 4, chordBeats: 2,
    melody: 'R-1 G3-1 C4-1 D4-1 E4-2 E4-3 E4-1 D#4-1 E4-1 C4-2 C4-3 C4-1 D4-1 E4-1 F4-2 A4-3 A4-1 G4-1 F4-1 E4-5 C4-1 D4-1 E4-1 F4-2 A4-3 A4-1 G4-1 F4-1 E4-2 C4-3 R-1 C4-1 D4-1 E4-3 F4-1 D4-1 D4-2 E4-1 C4-4',
    chords: 'C C C C C C C C C C F F F F C C C C F F F F C C A A C C G G C C',
  },
  {
    id: 'this-land', title: 'This Land Is Your Land', ko: '이 땅은 너의 땅', host: 'luigi', bpm: 100, repeat: 3, meter: 4, chordBeats: 2,
    melody: 'R-2.5 C4-.5 D4-.5 E4-.5 F4-1 F4-1.5 F4-.5 C4-.5 D4-.5 E4-1 E4-1.5 C4-.5 C4-.5 E4-.5 D4-1 D4-1.5 D4-.25 D4-.25 C4-.5 D4-.5 E4-1 E4-1.5 C4-.25 C4-.25 D4-.5 E4-.5 F4-1 F4-1.5 F4-.25 F4-.25 C4-.5 D4-.5 E4-1 E4-3 D4-.5 D4-1 C4-.5 B3-.5 B3-.5 C4-.5 D4-.5 C4-2.5 R-1.5',
    chords: 'C C F F C C G G C C F F C C G G C C',
  },
  {
    id: 'mountain', title: "She'll Be Coming 'Round the Mountain", ko: '산을 돌아 그녀가 온다네', host: 'knuckles', bpm: 120, repeat: 3, meter: 2, chordBeats: 2,
    melody: 'R-1 D4-.5 E4-.5 G4-.5 G4-.5 G4-.5 G4-.5 E4-.5 D4-.5 B3-.5 D4-.5 G4-2 R-1 G4-.5 A4-.5 B4-.5 B4-.5 B4-.5 B4-.5 D5-.5 B4-.5 A4-.5 G4-.5 A4-2 R-1 D5-.5 C5-.5 B4-.5 B4-.5 B4-.5 B4-.5 A4-.5 G4-.5 G4-.5 G4-.5 E4-.5 E4-.5 E4-.5 E4-.5 A4-.5 G4-.5 F#4-.5 E4-.5 D4-.5 D4-.5 D4-.5 D4-.5 B4-.5 A4-.5 F#4-.5 D4-.5 G4-2 R-2',
    chords: 'G G G G G G G D D G G C C G D G G',
  },
  {
    id: 'yankee-doodle', title: 'Yankee Doodle', ko: '양키 두들', host: 'jay', bpm: 115, repeat: 3, meter: 2, chordBeats: 2,
    melody: 'G4-.5 G4-.5 A4-.5 B4-.5 G4-.5 B4-.5 A4-.5 D4-.5 G4-.5 G4-.5 A4-.5 B4-.5 G4-1 F#4-1 G4-.5 G4-.5 A4-.5 B4-.5 C5-.5 B4-.5 A4-.5 G4-.5 F#4-.5 D4-.5 E4-.5 F#4-.5 G4-1 G4-1 E4-.75 F#4-.25 E4-.5 D4-.5 E4-.5 F#4-.5 G4-1 D4-.75 E4-.25 D4-.5 C4-.5 B3-1 D4-1 E4-.75 F#4-.25 E4-.5 D4-.5 E4-.5 F#4-.5 G4-.5 E4-.5 D4-.5 G4-.5 F#4-.5 A4-.5 G4-1 G4-.5 R-.5',
    chords: 'G G G D G C D G C G D G C C D G',
  },
  {
    id: 'ode-to-joy', title: 'Ode to Joy', ko: '환희의 송가', host: 'jigglypuff', bpm: 104, repeat: 2, meter: 4, chordBeats: 2,
    melody: 'E4-1 E4-1 F4-1 G4-1 G4-1 F4-1 E4-1 D4-1 C4-1 C4-1 D4-1 E4-1 E4-1.5 D4-.5 D4-2 E4-1 E4-1 F4-1 G4-1 G4-1 F4-1 E4-1 D4-1 C4-1 C4-1 D4-1 E4-1 D4-1.5 C4-.5 C4-2 D4-1 D4-1 E4-1 C4-1 D4-1 E4-.5 F4-.5 E4-1 C4-1 D4-1 E4-.5 F4-.5 E4-1 D4-1 C4-1 D4-1 G3-2 E4-1 E4-1 F4-1 G4-1 G4-1 F4-1 E4-1 D4-1 C4-1 C4-1 D4-1 E4-1 D4-1.5 C4-.5 C4-2',
    chords: 'C C G G C C G G C C G G C C G C G C G C G G C G C C G G C C G C',
  },
  {
    id: 'o-canada', title: 'O Canada', ko: '오 캐나다', host: 'kai', bpm: 84, repeat: 1, meter: 4, chordBeats: 2,
    melody: 'E4-2 G4-1.5 G4-.5 C4-3 D4-1 E4-1 F4-1 G4-1 A4-1 D4-4 E4-2 F#4-1.5 F#4-.5 G4-3 A4-1 B4-1 B4-1 A4-1 A4-1 G4-3 D4-.75 E4-.25 F4-1.5 E4-.5 D4-1 E4-.75 F4-.25 G4-1.5 F4-.5 E4-1 F4-.75 G4-.25 A4-1 G4-1 F4-1 E4-1 D4-3 D4-.75 E4-.25 F4-1.5 E4-.5 D4-1 E4-.75 F4-.25 G4-1.5 F4-.5 E4-1 E4-1 D4-1 G4-1 G4-.5 F#4-.5 E4-.5 F#4-.5 G4-4 E4-2 G4-1.5 G4-.5 C4-4 F4-2 A4-1.5 A4-.5 D4-4 G4-2 G#4-1.5 G#4-.5 A4-1 F4-1 E4-1 D4-1 C4-2 D4-2 E4-4 G4-2 C5-1.5 C5-.5 A4-1 F4-1 E4-1 D4-1 G4-2 B3-2 C4-4',
    chords: 'C G A A C C G G C B E E G D G G G G C C F D G G G G C C G D G G C G A A D F G G C E F C C G C C C A F C C G C C',
  },
  {
    id: 'jingle-bells', title: 'Jingle Bells', ko: '징글벨', host: 'tails', bpm: 130, repeat: 1, meter: 4, chordBeats: 2,
    melody: 'G3-1 E4-1 D4-1 C4-1 G3-3 G3-.5 G3-.5 G3-1 E4-1 D4-1 C4-1 A3-4 A3-1 F4-1 E4-1 D4-1 B3-4 G4-1 G4-1 F4-1 D4-1 E4-4 G3-1 E4-1 D4-1 C4-1 G3-4 G3-1 E4-1 D4-1 C4-1 A3-3 R-.5 A3-.5 A3-1 F4-1 E4-1 D4-1 G4-1 G4-1 G4-1.5 G4-.5 A4-1 G4-1 F4-1 D4-1 C4-2 R-2 E4-1 E4-1 E4-2 E4-1 E4-1 E4-2 E4-1 G4-1 C4-1.5 D4-.5 E4-4 F4-1 F4-1 F4-1.5 F4-.5 F4-1 E4-1 E4-1 E4-.5 E4-.5 E4-1 D4-1 D4-1 E4-1 D4-2 G4-2 E4-1 E4-1 E4-2 E4-1 E4-1 E4-2 E4-1 G4-1 C4-1.5 D4-.5 E4-4 F4-1 F4-1 F4-1.5 F4-.5 F4-1 E4-1 E4-1 E4-.5 E4-.5 G4-1 G4-1 F4-1 D4-1 C4-2 R-2',
    chords: 'C C C C C C F F D D G G G G C C C C C C C C F F D D G G G G C G C C C C C C C C F F C C D D G G C C C C C C C C F F C C G G C C',
  },
]

const STEPS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

export function toMidi(name) {
  const match = /^([A-G])([#b]?)(\d)$/.exec(name)
  if (!match) throw new Error(`알 수 없는 음: ${name}`)
  return 12 * (Number(match[3]) + 1) + STEPS[match[1]] + (match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0)
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

const DRUMS = {
  // Beat positions within a bar, in beats.
  4: { kick: [0, 2, 2.5], snare: [1, 3], hat: [0, .5, 1, 1.5, 2, 2.5, 3, 3.5] },
  3: { kick: [0], snare: [1, 2], hat: [0, .5, 1, 1.5, 2, 2.5] },
  2: { kick: [0], snare: [1], hat: [0, .5, 1, 1.5] },
}

export function buildChart(song, mode) {
  const { notes, beats } = parseMelody(song.melody)
  const pitches = [...new Set(notes.map((note) => note.midi))].sort((a, b) => a - b)
  const beatMs = 60000 / (song.bpm * mode.tempo)
  const roots = song.chords.trim().split(/\s+/)
  const meter = song.meter ?? 4
  const chart = []
  const backing = []
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
        backing.push({ time: (offset + index * song.chordBeats + step) * beatMs, kind: 'bass', midi: step % 2 ? midi + 7 : midi })
      }
    })
    for (let bar = 0; bar < Math.floor(beats / meter); bar++) {
      for (const [kind, hits] of Object.entries(DRUMS[meter])) {
        hits.forEach((at) => backing.push({ time: (offset + bar * meter + at) * beatMs, kind }))
      }
    }
  }
  backing.sort((a, b) => a.time - b.time)
  return { notes: chart, backing, duration: song.repeat * beats * beatMs, beatMs }
}

/** First note in time order that has not been judged yet, starting from `from`. */
export function nextOpenNote(notes, results, from = 0) {
  let index = from
  while (index < notes.length && results[notes[index].id]) index++
  return index
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

export const POINTS = { perfect: 100, good: 60, late: 30 }

export function scoreFor(grade, combo) {
  return POINTS[grade] + Math.min(combo, 50) * 2
}

export function starsFor(results, total) {
  if (!total) return 0
  const credit = Object.values(results).reduce((sum, grade) => sum + (grade === 'perfect' ? 1 : grade === 'good' ? .7 : grade === 'late' ? .4 : 0), 0)
  const ratio = credit / total
  return ratio >= .9 ? 3 : ratio >= .7 ? 2 : ratio >= .4 ? 1 : 0
}
