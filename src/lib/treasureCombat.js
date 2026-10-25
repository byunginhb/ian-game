import Phaser from 'phaser'
import { createElementalAttacks } from './treasureElements'

export function createCombatVisuals(scene, reducedMotion) {
  const shots = new Map(), effects = [], particles = [], loot = []
  const elements = createElementalAttacks(scene, reducedMotion)
  const trails = scene.add.graphics().setDepth(10010), charging = scene.add.graphics().setDepth(10012)
  const missile = document.createElement('canvas'); missile.width = 80; missile.height = 36
  const ctx = missile.getContext('2d'); ctx.translate(40, 18)
  const metal = ctx.createLinearGradient(0, -8, 0, 8); metal.addColorStop(0, '#fff2c3'); metal.addColorStop(.4, '#c9b482'); metal.addColorStop(1, '#4e6268')
  ctx.fillStyle = metal; ctx.strokeStyle = '#e1dfc0'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(24, 0); ctx.lineTo(9, -7); ctx.lineTo(-15, -6); ctx.lineTo(-21, -12); ctx.lineTo(-19, 0); ctx.lineTo(-21, 12); ctx.lineTo(-15, 6); ctx.lineTo(9, 7); ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.fillStyle = '#a4f4e6'; ctx.fillRect(-9, -3, 16, 6)
  scene.textures.addCanvas('homing-missile', missile)
  const ring = (x, y, color, major = false) => {
    const object = scene.add.ellipse(x, y, 40, 22).setStrokeStyle(major ? 5 : 2, color).setDepth(10005).setBlendMode(Phaser.BlendModes.ADD)
    effects.push({ object, life: major ? .9 : .5, total: major ? .9 : .5, kind: 'ring', major })
  }
  const sparks = (x, y, count, color, strength = 1) => {
    if (reducedMotion) return
    for (let i = 0; i < count; i++) {
      const angle = i * 2.39996, speed = (70 + i * 37 % 190) * strength
      const object = i % 4 ? scene.add.circle(x, y, i % 3 ? 1.5 : 3, color) : scene.add.polygon(x, y, [-4, -3, 5, 0, 2, 5], color)
      object.setDepth(10015).setBlendMode(Phaser.BlendModes.ADD)
      particles.push({ object, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed * .55 - 55, life: .45 + i % 7 * .08, total: .45 + i % 7 * .08 })
    }
  }
  const glow = (x, y, color, size, duration) => {
    const object = scene.add.image(x, y, 'glow').setTint(color).setScale(size).setDepth(10006).setBlendMode(Phaser.BlendModes.ADD)
    effects.push({ object, life: duration, total: duration, kind: 'glow', size })
  }
  function event(event) {
    if (event.type === 'missileLaunch') {
      const { player } = scene.simulation
      glow(player.x, player.y - 45, event.charged ? 0x9cecff : 0xffd590, event.charged ? 1.4 : .45, .3)
      if (event.charged) { ring(player.x, player.y, 0xb2e9f0, true); sparks(player.x, player.y - 45, 32, 0xb8f5ff); if (!reducedMotion) scene.cameras.main.shake(130, .003) }
    }
    if (event.type === 'missileImpact') {
      glow(event.x, event.y, event.charged ? 0xb7ecff : 0xffd495, event.charged ? 2.1 : .9, event.charged ? .7 : .35)
      ring(event.x, event.y + 25, event.charged ? 0xb5f1ff : 0xffd79d, event.charged)
      sparks(event.x, event.y, event.charged ? 70 : 24, event.charged ? 0xb9f0ff : 0xffd398, event.charged ? 1.5 : 1)
      if (!reducedMotion) scene.cameras.main.shake(event.charged ? 230 : 85, event.charged ? .006 : .0018)
      if (event.charged && !reducedMotion) { scene.impact = .8; scene.hitStop = .075 }
      const object = scene.add.text(event.x + 30, event.y - 25, `${event.charged ? '필살기  ' : ''}−${event.damage}`, { fontSize: event.charged ? '25px' : '17px', color: event.charged ? '#cbf5ff' : '#ffe3b1', stroke: '#132630', strokeThickness: 4 }).setDepth(10020)
      effects.push({ object, kind: 'text', life: .8, total: .8 })
    }
    if (event.type === 'bossAttack') {
      elements.start(event)
      if (!reducedMotion) scene.cameras.main.shake(260, .005)
    }
    if (event.type === 'bossFall') {
      if (event.rewardCount === 3) for (let i = 0; i < 3; i++) {
        const sprite = scene.add.image(event.x + 45, event.y - 30, 'boss-loot-gem').setTint([0xffdc8e, 0x9fe1f2, 0xa9e3ab][i]).setDepth(10025).setScale(.8)
        loot.push({ sprite, x: event.x + 45, y: event.y - 30, vx: (i - 1) * 160, age: 0, i })
      }
      ring(event.x, event.y + 5, 0xe0be86, true); glow(event.x, event.y, 0xd9b887, 1.7, .9); sparks(event.x, event.y, 80, 0xc6b28e, 1.25)
      if (!reducedMotion) scene.cameras.main.shake(430, .011)
    }
  }
  function update(state, dt) {
    trails.clear(); charging.clear(); elements.update(dt, state.time)
    for (let i = loot.length - 1; i >= 0; i--) {
      const gem = loot[i]; gem.age += dt
      if (gem.age >= 1.35) { gem.sprite.destroy(); loot.splice(i, 1); continue }
      const t = gem.age / 1.35, home = Math.max(0, (t - .42) / .58)
      const x = gem.x + gem.vx * Math.min(gem.age, .65), y = gem.y - Math.sin(Math.min(1, t / .65) * Math.PI) * (110 + gem.i * 15)
      gem.sprite.setPosition(x + (state.player.x - x) * home * home, y + (state.player.y - 40 - y) * home * home).setRotation(reducedMotion ? 0 : Math.sin(t * 5) * .3).setAlpha(1 - home * .5)
      trails.lineStyle(3, [0xffdb91, 0xa2e6f4, 0xa7ebb9][gem.i], .6 * (1 - t)).lineBetween(gem.sprite.x, gem.sprite.y, gem.sprite.x - gem.vx * .08, gem.sprite.y + 12)
    }
    const activeIds = new Set(state.missiles.map((shot) => shot.id))
    for (const [id, shot] of shots) if (!activeIds.has(id)) { shot.sprite.destroy(); shots.delete(id) }
    for (const shot of state.missiles) {
      if (!shots.has(shot.id)) shots.set(shot.id, { sprite: scene.add.image(shot.x, shot.y, 'homing-missile').setDepth(10011).setDisplaySize(shot.charged ? 72 : 38, shot.charged ? 32 : 17), history: [] })
      const view = shots.get(shot.id), boss = state.boss
      view.sprite.setPosition(shot.x, shot.y).setRotation(Math.atan2(boss.y - 65 - shot.y, boss.x - shot.x))
      view.history.push({ x: shot.x, y: shot.y }); if (view.history.length > 9) view.history.shift()
      if (!reducedMotion) for (let i = 1; i < view.history.length; i++) {
        const a = view.history[i - 1], b = view.history[i]
        trails.lineStyle((shot.charged ? 13 : 5) * i / view.history.length, shot.charged ? 0x93dcf5 : 0xf1c77d, i / view.history.length * .7).lineBetween(a.x, a.y, b.x, b.y)
      }
    }
    const charge = state.weapon.charge / 1.35
    if (charge > 0 && state.boss?.phase !== 'defeated') {
      const x = state.player.x, y = state.player.y - 48
      charging.lineStyle(2 + charge * 2, 0xa5e4f2, .9).beginPath().arc(x, y, 22 + charge * 8, -Math.PI / 2, -Math.PI / 2 + charge * Math.PI * 2).strokePath()
      if (!reducedMotion) for (let i = 0; i < 7; i++) {
        const a = state.time * 5 + i * Math.PI * 2 / 7, r = 42 - charge * 20
        charging.fillStyle(0xc6efff, .4 + charge * .6).fillCircle(x + Math.cos(a) * r, y + Math.sin(a) * r * .6, 1 + charge * 2)
      }
    }
    for (let i = effects.length - 1; i >= 0; i--) {
      const effect = effects[i]; effect.life -= dt
      if (effect.life <= 0) { effect.object.destroy(); effects.splice(i, 1); continue }
      const age = 1 - effect.life / effect.total
      effect.object.setAlpha((1 - age) ** (effect.kind === 'strike' ? .65 : 1.5))
      if (effect.kind === 'ring' && !reducedMotion) effect.object.setScale(1 + age * (effect.major ? 14 : 5))
      if (effect.kind === 'glow') effect.object.setScale(effect.size * (reducedMotion ? 1 : 1 + age * .5))
      if (effect.kind === 'text' && !reducedMotion) effect.object.y -= dt * 30
      if (effect.kind === 'pillar') effect.object.setScale(1 + age * 3, 1 - age * .6)
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.life -= dt
      if (p.life <= 0) { p.object.destroy(); particles.splice(i, 1); continue }
      p.object.x += p.vx * dt; p.object.y += p.vy * dt; p.vy += 190 * dt; p.object.setAlpha(p.life / p.total)
    }
  }
  return { event, update }
}
