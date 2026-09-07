import test from 'node:test'
import assert from 'node:assert/strict'
import { conquestSoundEvents, createConquestAudio, readSoundPreference } from '../src/lib/conquestAudio.js'
import { createWorld, sendTroops } from '../src/lib/conquest.js'

test('sound defaults on, remembers mute, and tolerates unavailable storage', () => {
  assert.equal(readSoundPreference(null), true)
  assert.equal(readSoundPreference({ getItem: () => 'off' }), false)
  assert.equal(readSoundPreference({ getItem: () => 'on' }), true)
  assert.equal(readSoundPreference({ getItem() { throw new Error('blocked') } }), true)
})

test('only a new player order makes the departure sound', () => {
  const before = createWorld(1, 0)
  const from = before.territories.find((land) => land.owner === 0)
  const target = before.territories.find((land) => land.owner < 0)
  const after = sendTroops(before, from.id, target.id)
  assert.deepEqual(conquestSoundEvents(before, after), ['dispatch'])
  assert.deepEqual(conquestSoundEvents(after, after), [])
  const enemy = before.territories.find((land) => land.owner === 1)
  assert.deepEqual(conquestSoundEvents(before, sendTroops(before, enemy.id, target.id, 1)), [])
})

test('simultaneous collisions make one accent and old sparks do not replay', () => {
  const before = createWorld(1, 0)
  const after = { ...before, clashes: Array.from({ length: 120 }, (_, id) => ({ id: String(id) })) }
  assert.deepEqual(conquestSoundEvents(before, after), ['clash'])
  assert.deepEqual(conquestSoundEvents(after, { ...after, time: .1 }), [])
})

test('ownership changes distinguish claiming land from losing it', () => {
  const before = createWorld(1, 0)
  const ours = before.territories.find((land) => land.owner === 0).id
  const neutral = before.territories.find((land) => land.owner < 0).id
  const after = { ...before, territories: before.territories.map((land) => ({ ...land, owner: land.id === ours ? 2 : land.id === neutral ? 0 : land.owner })) }
  assert.deepEqual(conquestSoundEvents(before, after), ['capture', 'retreat'])
  assert.deepEqual(conquestSoundEvents(after, after), [])
})

test('results play once, take priority over capture sounds, and resets stay quiet', () => {
  const before = { ...createWorld(1, 0), time: 25 }
  const won = { ...before, status: 'won', territories: before.territories.map((land) => ({ ...land, owner: 0 })) }
  assert.deepEqual(conquestSoundEvents(before, won), ['victory'])
  assert.deepEqual(conquestSoundEvents(won, won), [])
  assert.deepEqual(conquestSoundEvents(before, { ...before, status: 'lost' }), ['defeat'])
  assert.deepEqual(conquestSoundEvents(before, createWorld(1, 0)), [])
  assert.deepEqual(conquestSoundEvents(before, createWorld(2, 0)), [])
  assert.deepEqual(conquestSoundEvents(null, before), [])
  assert.deepEqual(conquestSoundEvents(before, null), [])
})

test('audio creation waits for a gesture, respects mute and degrades gracefully', () => {
  let attempts = 0
  const audio = createConquestAudio({ createContext() { attempts++; throw new Error('no audio device') } })
  audio.setScene('battle')
  audio.play('start')
  assert.equal(attempts, 0)
  audio.setEnabled(false)
  audio.unlock()
  assert.equal(attempts, 0)
  audio.setEnabled(true)
  audio.unlock()
  assert.equal(attempts, 1)
  assert.doesNotThrow(() => { audio.play('dispatch'); audio.setScene('menu'); audio.dispose() })
})
