import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SONGS, MODES, parseMelody, buildChart, findHit, judge, starsFor, toMidi, nextOpenNote } from '../src/lib/rhythm.js'

test('twelve songs whose melodies line up with their bass chords', () => {
  assert.equal(SONGS.length, 12)
  assert.equal(new Set(SONGS.map((song) => song.id)).size, 12)
  for (const song of SONGS) {
    const { beats } = parseMelody(song.melody)
    const bars = song.chords.trim().split(/\s+/).length
    assert.equal(beats, bars * song.chordBeats, song.id)
  }
})

test('charts use all five lanes in time order and kid mode is slower', () => {
  for (const song of SONGS) {
    const adult = buildChart(song, MODES.adult)
    const kid = buildChart(song, MODES.kid)
    assert.ok(kid.duration > adult.duration)
    assert.ok(adult.notes.every((note, i) => note.lane >= 0 && note.lane <= 4 && (i === 0 || note.time >= adult.notes[i - 1].time)))
    assert.ok(new Set(adult.notes.map((note) => note.lane)).size >= 3, song.id)
  }
})

test('higher notes never sit in a lower lane', () => {
  const { notes } = buildChart(SONGS[0], MODES.adult)
  for (const a of notes) for (const b of notes) if (a.midi > b.midi) assert.ok(a.lane >= b.lane)
})

test('hits pick the nearest open note in the pressed lane only', () => {
  const notes = [{ id: 0, lane: 1, time: 1000 }, { id: 1, lane: 2, time: 1100 }, { id: 2, lane: 1, time: 1500 }]
  assert.equal(findHit(notes, {}, 1, 1050, 140).id, 0)
  assert.equal(findHit(notes, { 0: 'perfect' }, 1, 1050, 140), null)
  assert.equal(findHit(notes, {}, 3, 1100, 140), null)
  assert.equal(findHit(notes, {}, 1, 1450, 140).id, 2)
  assert.equal(judge(40, MODES.adult), 'perfect')
  assert.equal(judge(-80, MODES.adult), 'good')
  assert.equal(judge(150, MODES.adult), null)
  assert.equal(judge(150, MODES.kid), 'good')
})

test('stars and note names', () => {
  assert.equal(toMidi('C4'), 60)
  assert.equal(toMidi('A4'), 69)
  assert.equal(toMidi('Bb3'), 58)
  assert.equal(toMidi('F#4'), 66)
  assert.equal(parseMelody('G4-2/3 E5-2/3 G5-2/3 A5').beats, 3)
  assert.equal(starsFor({ 0: 'perfect', 1: 'perfect' }, 2), 3)
  assert.equal(starsFor({ 0: 'good' }, 2), 0)
  assert.equal(starsFor({}, 0), 0)
})

test('backing has bass plus kick, snare and hi-hat inside the song', () => {
  for (const song of SONGS) {
    const chart = buildChart(song, MODES.adult)
    const kinds = new Set(chart.backing.map((event) => event.kind))
    assert.deepEqual([...kinds].sort(), ['bass', 'hat', 'kick', 'snare'], song.id)
    assert.ok(chart.backing.every((event, i) => event.time < chart.duration && (i === 0 || event.time >= chart.backing[i - 1].time)))
  }
})

test('kid mode waits for missed notes, adult mode is faster and stricter', () => {
  assert.equal(MODES.kid.waits, true)
  assert.equal(MODES.adult.waits, false)
  assert.ok(MODES.adult.tempo > MODES.kid.tempo && MODES.adult.good < MODES.kid.good && MODES.adult.travel < MODES.kid.travel)
  const notes = [{ id: 0 }, { id: 1 }, { id: 2 }]
  assert.equal(nextOpenNote(notes, { 0: 'perfect', 1: 'late' }), 2)
  assert.equal(nextOpenNote(notes, {}, 1), 1)
  assert.equal(starsFor({ 0: 'late', 1: 'late' }, 2), 1)
})
