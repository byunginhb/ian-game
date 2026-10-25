import { trailsFor } from './treasureContent.js'
import { isWater } from './treasureTerrain.js'

export function createFootstepVisuals(scene, worldId, reducedMotion) {
  const trails = trailsFor(worldId), marks = []
  const add = (object, kind, life, extra = {}) => marks.push({ object, kind, life, total: life, ...extra })
  return {
    step(player, gait) {
      const x = player.x + gait.side * 6, y = player.y + 1
      const water = isWater({ x, y }, trails)
      if (reducedMotion) return water ? 'water' : null
      if (water) {
        for (let i = 0; i < 2; i++) {
          const ring = scene.add.ellipse(x, y, 16, 6).setStrokeStyle(i ? 1 : 1.4, i ? 0x71ccde : 0xd1f6f5, .75).setDepth(player.y - 5).setName('water-ripple')
          add(ring, 'ripple', .85, { delay: i * .1 })
        }
        const foam = scene.add.ellipse(x, y, 21, 7, 0xd9ffff, .65).setDepth(player.y + 1).setName('water-foam')
        add(foam, 'foam', .24)
        for (let i = 0; i < 8; i++) {
          const angle = i / 8 * Math.PI * 2 + gait.side * .2, speed = 25 + Math.random() * 38
          const drop = scene.add.ellipse(x + Math.cos(angle) * 5, y + Math.sin(angle) * 2, 2 + i % 2, 4 + i % 3, i % 3 ? 0xc9f5ff : 0x77d7ed, .9).setDepth(player.y + 6).setName('water-droplet')
          add(drop, 'drop', .4 + i % 3 * .07, { vx: Math.cos(angle) * speed, vy: -60 - Math.random() * 65 })
        }
      } else {
        const print = scene.add.ellipse(x, y, 7, 3, worldId === 1 ? 0x514632 : 0xb3ad8d, .35).setDepth(player.y - 3).setName('land-footprint')
        add(print, 'print', .65)
        for (let i = 0; i < 3; i++) {
          const dust = scene.add.circle(x + i * 2 - 2, y - 1, 1 + i % 2, 0xc4b99e, .24).setDepth(player.y + 3)
          add(dust, 'dust', .3)
        }
      }
      return water ? 'water' : null
    },
    update(delta) {
      for (let i = marks.length - 1; i >= 0; i--) {
        const mark = marks[i]; mark.life -= delta
        if (mark.life <= 0) { mark.object.destroy(); marks.splice(i, 1); continue }
        const age = mark.total - mark.life, remaining = mark.life / mark.total
        if (mark.kind === 'ripple') {
          const phase = Math.max(0, (age - mark.delay) / (mark.total - mark.delay))
          mark.object.setVisible(age >= mark.delay).setScale(1 + phase * 3, 1 + phase * 2).setAlpha((1 - phase) ** 2 * .75)
        } else if (mark.kind === 'drop') {
          mark.object.x += mark.vx * delta; mark.object.y += mark.vy * delta; mark.vy += 380 * delta
          mark.object.setRotation(Math.atan2(mark.vy, mark.vx) - Math.PI / 2).setAlpha(Math.min(1, remaining * 3) * .9)
        } else if (mark.kind === 'foam') mark.object.setScale(1 + age * 2).setAlpha(remaining ** 2 * .65)
        else {
          mark.object.setAlpha(remaining * (mark.kind === 'dust' ? .24 : .35))
          if (mark.kind === 'dust') mark.object.y -= delta * 9
        }
      }
    },
  }
}
