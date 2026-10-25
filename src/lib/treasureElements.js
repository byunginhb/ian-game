import Phaser from 'phaser'

function attackPoints(zones) {
  return zones.flatMap((zone) => {
    let points
    if (zone.kind === 'line') points = Array.from({ length: 15 }, (_, i) => ({ x: zone.x + Math.cos(zone.angle) * zone.length * (i + .5) / 15, y: zone.y + Math.sin(zone.angle) * zone.length * (i + .5) / 15 }))
    else if (zone.kind === 'rect') points = Array.from({ length: 18 }, (_, i) => ({ x: zone.x + zone.width * (zone.width > zone.height ? (i + .5) / 18 : .5), y: zone.y + zone.height * (zone.height > zone.width ? (i + .5) / 18 : .5) }))
    else if (zone.kind === 'cone') points = Array.from({ length: 24 }, (_, i) => { const a = zone.angle - zone.spread + zone.spread * 2 * (i % 8) / 7, r = zone.radius * (.35 + Math.floor(i / 8) * .25); return { x: zone.x + Math.cos(a) * r, y: zone.y + Math.sin(a) * r } })
    else if (zone.kind === 'ring') points = Array.from({ length: 28 }, (_, i) => { const angle = i * Math.PI / 14, r = (zone.radius + zone.inner) / 2; return { x: zone.x + Math.cos(angle) * r, y: zone.y + Math.sin(angle) * r * .74, angle } })
    else points = Array.from({ length: 8 }, (_, i) => ({ x: zone.x + Math.cos(i * 2.4) * zone.radius * .45, y: zone.y + Math.sin(i * 2.4) * zone.radius * .3 }))
    return points.map((point) => ({ ...point, zone }))
  })
}
export function createElementalAttacks(scene, reducedMotion) {
  const live = []
  const fire = document.createElement('canvas'); fire.width = 96; fire.height = 160
  const c = fire.getContext('2d')
  for (let layer = 0; layer < 4; layer++) {
    const g = c.createRadialGradient(48, 137, 3, 48, 104, 76 - layer * 12); g.addColorStop(0, '#fffbd9'); g.addColorStop(.25, '#ffe887'); g.addColorStop(.5, layer % 2 ? '#ff9b3acb' : '#f76b25bd'); g.addColorStop(1, '#a82b1500')
    c.fillStyle = g; c.beginPath(); c.moveTo(48, 156); c.bezierCurveTo(3 + layer * 5, 155, 3, 94, 30, 57); c.quadraticCurveTo(31, 82, 42, 91); c.bezierCurveTo(55, 65, 31, 44, 56, 6 + layer * 8); c.bezierCurveTo(44, 54, 89, 67, 79, 109); c.quadraticCurveTo(96, 142, 48, 156); c.fill()
  }
  scene.textures.addCanvas('element-flame', fire)
  const smoke = document.createElement('canvas'); smoke.width = smoke.height = 96
  const sc = smoke.getContext('2d'), mist = sc.createRadialGradient(48, 48, 1, 48, 48, 48); mist.addColorStop(0, '#b7c9cba0'); mist.addColorStop(.45, '#9db3b43d'); mist.addColorStop(1, '#60777800'); sc.fillStyle = mist; sc.fillRect(0, 0, 96, 96); scene.textures.addCanvas('element-mist', smoke)
  const wave = document.createElement('canvas'); wave.width = 128; wave.height = 150
  const wc = wave.getContext('2d'), ocean = wc.createLinearGradient(0, 15, 0, 150)
  ocean.addColorStop(0, '#d8ffffe6'); ocean.addColorStop(.27, '#6bdfedde'); ocean.addColorStop(.6, '#208db8b0'); ocean.addColorStop(1, '#12496300')
  wc.fillStyle = ocean; wc.beginPath(); wc.moveTo(4, 147); wc.bezierCurveTo(25, 124, 6, 73, 37, 34); wc.bezierCurveTo(64, 0, 113, 8, 119, 40); wc.bezierCurveTo(98, 23, 72, 35, 74, 58); wc.bezierCurveTo(77, 86, 117, 106, 124, 146); wc.closePath(); wc.fill()
  for (let layer = 0; layer < 5; layer++) {
    wc.strokeStyle = ['#ebffffed', '#bff9ffb0', '#6bcad680', '#c9faff88', '#7ecada66'][layer]; wc.lineWidth = layer ? 1.5 : 4
    wc.beginPath(); wc.moveTo(9 + layer * 5, 133); wc.bezierCurveTo(30 + layer * 8, 91, 12 + layer * 4, 50, 47 + layer * 3, 28 + layer * 5); wc.bezierCurveTo(74, 9 + layer * 5, 102, 19, 115 - layer * 5, 35 + layer * 5); wc.stroke()
  }
  for (let i = 0; i < 58; i++) {
    const x = 27 + Math.sin(i * 2.39) * 24 + i % 6 * 9, y = 26 + Math.cos(i * 1.72) * 15 + i % 5 * 8
    wc.fillStyle = i % 3 ? '#eaffffad' : '#ffffff'; wc.beginPath(); wc.ellipse(x, y, 1 + i % 3 * .6, .7 + i % 4 * .6, -.4, 0, Math.PI * 2); wc.fill()
  }
  scene.textures.addCanvas('element-wave', wave)
  function start(event) {
    const element = event.boss.element || 'fire', points = attackPoints(event.zones)
    const gfx = scene.add.graphics().setDepth(9010), sprites = []
    if (element === 'fire' || element === 'water') for (const [i, point] of points.entries()) {
      const x = point.x + (element === 'fire' ? Math.sin(i * 5.73) * 14 : 0), y = point.y + Math.cos(i * 3.79) * 9
      const sprite = scene.add.image(x, y + 6, element === 'fire' ? 'element-flame' : 'element-wave').setOrigin(.5, 1).setDisplaySize(element === 'fire' ? 36 + i % 4 * 11 : 45 + i % 4 * 8, element === 'fire' ? 75 + i % 4 * 19 : 65 + i % 4 * 15).setDepth(10001 + i / 100)
      if (element === 'fire') sprite.setBlendMode(Phaser.BlendModes.ADD)
      else sprite.setFlipX(i % 3 === 0)
      sprites.push({ sprite, x, y, width: sprite.displayWidth, height: sprite.displayHeight, i, wave: element === 'water', point })
    }
    for (const [i, point] of points.entries()) if (i % 2 === 0) {
      const sprite = scene.add.image(point.x, point.y, 'glow').setTint(element === 'fire' ? 0xf78a3e : element === 'water' ? 0x64d5ed : 0x75b9ff).setDisplaySize(element === 'electric' ? 68 : 85, element === 'electric' ? 78 : 36).setAlpha(.3).setDepth(9009).setBlendMode(Phaser.BlendModes.ADD)
      sprites.push({ sprite, x: point.x, y: point.y, glow: true, i })
    }
    for (let i = 0; i < Math.min(36, points.length * 2); i++) {
      const point = points[i % points.length], sprite = scene.add.image(point.x, point.y, 'element-mist').setTint(element === 'fire' ? 0xa69583 : element === 'water' ? 0xa4e5ef : 0x9ebde9).setDepth(10005).setAlpha(.3).setScale(.3)
      sprites.push({ sprite, x: point.x, y: point.y, mist: true, i })
    }
    live.push({ element, zones: event.zones, points, gfx, sprites, age: 0, life: reducedMotion ? .65 : 1.3 })
  }
  const lightning = (gfx, a, b, seed, alpha, time) => {
    const points = Array.from({ length: 8 }, (_, i) => { const t = i / 7, offset = i && i < 7 ? Math.sin(i * 13 + seed * 9 + Math.floor(time * 18)) * 16 : 0; return { x: a.x + (b.x - a.x) * t + offset, y: a.y + (b.y - a.y) * t + offset * .35 } })
    for (const [width, color, power] of [[12, 0x4288ed, .16], [5, 0x81d7ff, .65], [1.6, 0xf0fbff, 1]]) { gfx.lineStyle(width, color, alpha * power); gfx.strokePoints(points, false) }
    return points
  }
  function update(dt, time) {
    for (let index = live.length - 1; index >= 0; index--) {
      const effect = live[index]; effect.age += dt
      if (effect.age >= effect.life) { effect.gfx.destroy(); effect.sprites.forEach(({ sprite }) => sprite.destroy()); live.splice(index, 1); continue }
      const p = effect.age / effect.life, alpha = Math.min(1, (1 - p) * 2), gfx = effect.gfx; gfx.clear()
      for (const entry of effect.sprites) {
        if (entry.glow) entry.sprite.setAlpha(alpha * .3)
        else if (entry.mist) entry.sprite.setPosition(entry.x + Math.sin(entry.i * 3 + p) * p * 30, entry.y - p * (effect.element === 'fire' ? 100 : 60)).setScale(.3 + p * 1.2).setAlpha((1 - p) * .24)
        else if (entry.wave) {
          const point = entry.point, zone = point.zone, radius = (zone.inner || 0) + (zone.radius - (zone.inner || 0)) * Math.min(1, p * 1.6)
          const x = zone.kind === 'ring' ? zone.x + Math.cos(point.angle) * radius : entry.x, y = zone.kind === 'ring' ? zone.y + Math.sin(point.angle) * radius * .74 : entry.y
          entry.sprite.setPosition(x, y).setDisplaySize(entry.width * (1 + p * .35), entry.height * (reducedMotion ? 1 : .5 + Math.sin(Math.min(1, p * 1.6) * Math.PI) * .65)).setAlpha(alpha * .85)
        } else entry.sprite.setPosition(entry.x + (reducedMotion ? 0 : Math.sin(time * 11 + entry.i) * 4), entry.y + 6).setDisplaySize(entry.width * (reducedMotion ? 1 : .8 + Math.sin(time * 18 + entry.i) * .2), entry.height * (reducedMotion ? 1 : .8 + Math.cos(time * 14 + entry.i) * .22)).setAlpha(alpha * .9)
      }
      if (effect.element === 'electric') {
        for (const [i, point] of effect.points.entries()) {
          const a = { x: point.x + Math.sin(i * 3) * 28, y: point.y - 135 - i % 4 * 22 }, b = point
          const line = lightning(gfx, a, b, i, alpha * (reducedMotion ? .4 : .75 + Math.sin(time * 12 + i) ** 2 * .25), reducedMotion ? 0 : time)
          if (i % 2 === 0) lightning(gfx, line[4], { x: point.x + 30, y: point.y - 20 }, i + 20, alpha * .6, reducedMotion ? 0 : time)
          gfx.fillStyle(0xe4faff, alpha).fillCircle(point.x, point.y, 3)
          for (let spark = 0; spark < 4; spark++) { const a = i * 2.4 + spark * Math.PI / 2 + p, r = 8 + p * 30; gfx.lineStyle(1.5, 0xd5f7ff, alpha * (1 - p)).lineBetween(point.x + Math.cos(a) * r, point.y + Math.sin(a) * r * .5, point.x + Math.cos(a) * (r + 9), point.y + Math.sin(a) * (r + 9) * .5) }
          if (i > 0 && i % 3) lightning(gfx, effect.points[i - 1], point, i, alpha * .4, reducedMotion ? 0 : time)
        }
      } else if (effect.element === 'water') {
        for (const zone of effect.zones) {
          const wave = []
          if (zone.kind === 'ring' || zone.kind === 'circle') {
            const inner = zone.inner || 0, radius = inner + (zone.radius - inner) * Math.min(1, p * 1.8)
            for (let i = 0; i <= 50; i++) { const a = i / 50 * Math.PI * 2; wave.push({ x: zone.x + Math.cos(a) * radius, y: zone.y + Math.sin(a) * radius * .74 + Math.sin(a * 9 + time * 8) * 4 }) }
          } else if (zone.kind === 'cone') {
            const r = zone.radius * Math.min(1, p * 1.8)
            for (let i = 0; i <= 30; i++) { const a = zone.angle - zone.spread + 2 * zone.spread * i / 30; wave.push({ x: zone.x + Math.cos(a) * r, y: zone.y + Math.sin(a) * r }) }
          } else {
            const a = zone, b = zone.kind === 'line' ? { x: zone.x + Math.cos(zone.angle) * zone.length, y: zone.y + Math.sin(zone.angle) * zone.length } : { x: zone.x + zone.width, y: zone.y + zone.height }
            for (let i = 0; i <= 35; i++) { const t = i / 35; wave.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t + Math.sin(t * 28 - time * 12) * 12 }) }
          }
          for (const [width, color, strength] of [[34, 0x167687, .16], [12, 0x63c7d4, .3]]) { gfx.lineStyle(width, color, alpha * strength); gfx.strokePoints(wave, false) }
          for (let i = 0; i < wave.length; i += 3) { const point = wave[i]; gfx.fillStyle(0xdafcff, alpha * .8).fillEllipse(point.x + Math.sin(i * 8) * 7, point.y - p * 24, 3, 5) }
        }
      } else {
        for (const [i, point] of effect.points.entries()) {
          const rise = (effect.age * (80 + i % 5 * 18)) % 100
          gfx.fillStyle(i % 2 ? 0xffbf62 : 0xffecb1, alpha * (1 - rise / 100)).fillCircle(point.x + Math.sin(i + time * 3) * 16, point.y - rise, 1.5 + i % 3)
          gfx.lineStyle(1, 0xffb45f, alpha * .4).lineBetween(point.x - 12, point.y + 5, point.x + 16, point.y + 8)
        }
      }
    }
  }
  return { start, update }
}
