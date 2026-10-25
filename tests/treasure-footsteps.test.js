import test from 'node:test'
import assert from 'node:assert/strict'
import { MAP, WORLDS, trailsFor } from '../src/lib/treasureContent.js'
import { createFootstepVisuals } from '../src/lib/treasureFootsteps.js'
import { isWater } from '../src/lib/treasureTerrain.js'

function view() {
  const objects = new Set()
  const make = (x, y) => {
    const object = { x, y, setStrokeStyle() { return this }, setDepth() { return this }, setName(name) { this.name = name; return this }, setVisible() { return this }, setScale() { return this }, setAlpha() { return this }, setRotation() { return this }, destroy() { objects.delete(this) } }
    objects.add(object); return object
  }
  return { scene: { add: { ellipse: make, circle: make } }, objects }
}
const water = [{ x: 740, y: 480 }, { x: 680, y: 480 }, { x: 760, y: 500 }, { x: 760, y: 520 }]

test('foot contacts use the painted shore and distinguish water from land in all worlds', () => {
  const segment = [{ a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, width: 20 }]
  assert.equal(isWater({ x: 50, y: 25 }, segment), false)
  assert.equal(isWater({ x: 50, y: 26 }, segment), true)
  for (const world of WORLDS) {
    const { scene, objects } = view(), fx = createFootstepVisuals(scene, world.id, false)
    assert.equal(isWater(water[world.id], trailsFor(world.id)), true)
    assert.equal(fx.step(water[world.id], { side: 1 }), 'water')
    assert.ok([...objects].some((object) => object.name === 'water-droplet'))
    fx.update(1)
    assert.equal(objects.size, 0)
    assert.equal(fx.step(MAP.spawn, { side: -1 }), null)
    assert.ok([...objects].some((object) => object.name === 'land-footprint'))
    assert.ok([...objects].every((object) => !object.name?.startsWith('water-')))
  }
})

test('splashes move ballistically, stay bounded during long walks and fully expire at rest', () => {
  const { scene, objects } = view(), fx = createFootstepVisuals(scene, 0, false)
  fx.step(water[0], { side: 1 })
  const drop = [...objects].filter((object) => object.name === 'water-droplet')[2], originalY = drop.y
  fx.update(.05); assert.ok(drop.y < originalY)
  for (let i = 0; i < 5; i++) fx.update(.05)
  const highY = drop.y
  for (let i = 0; i < 3; i++) fx.update(.05)
  assert.ok(drop.y > highY)
  for (let step = 0; step < 1000; step++) {
    fx.step(water[0], { side: step % 2 ? -1 : 1 }); fx.update(.28)
    assert.ok(objects.size < 50)
  }
  fx.update(1); assert.equal(objects.size, 0)
  fx.update(1); assert.equal(objects.size, 0)
})

test('reduced motion suppresses animated surface particles while retaining the surface sound', () => {
  const { scene, objects } = view(), fx = createFootstepVisuals(scene, 0, true)
  assert.equal(fx.step(water[0], { side: 1 }), 'water')
  assert.equal(fx.step(MAP.spawn, { side: -1 }), null)
  fx.update(.1); assert.equal(objects.size, 0)
})
