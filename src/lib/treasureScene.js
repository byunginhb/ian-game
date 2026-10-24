import Phaser from 'phaser'
import terrainUrl from '../assets/treasure/terrain.webp'
import propsUrl from '../assets/treasure/props.webp'
import heroUrl from '../assets/treasure/hero.webp'
import actorsUrl from '../assets/treasure/actors.webp'
import { MAP, WORLDS, bossZones, clampPosition, createExpedition, findWalkPath, hazardsFor, sceneryFor, stepExpedition, treasuresFor } from './treasureKingdom'
import { createArtCanvas, drawRelic, drawTablet } from './treasureArt'
import { gameClock } from './gameClock'

function atlasFrames(scene, key, columns, rows, solidify = false) {
  let texture = scene.textures.get(key)
  const source = texture.getSourceImage()
  const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(source, 0, 0)
  const imageData = ctx.getImageData(0, 0, source.width, source.height), pixels = imageData.data
  if (solidify) {
    for (let index = 3; index < pixels.length; index += 4) pixels[index] = Math.min(255, pixels[index] * 1.4)
    ctx.putImageData(imageData, 0, 0)
    texture = scene.textures.addCanvas(`${key}-render`, canvas)
  }
  const cellWidth = source.width / columns, cellHeight = source.height / rows
  for (let index = 0; index < columns * rows; index++) {
    const left = Math.round(index % columns * cellWidth), top = Math.round(Math.floor(index / columns) * cellHeight)
    let minX = cellWidth, minY = cellHeight, maxX = 0, maxY = 0
    for (let y = 0; y < cellHeight; y++) for (let x = 0; x < cellWidth; x++) {
      if (pixels[((top + y) * source.width + left + x) * 4 + 3] > 85) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y) }
    }
    texture.add(index, 0, left + minX, top + minY, Math.max(1, maxX - minX + 1), Math.max(1, maxY - minY + 1))
  }
  return solidify ? `${key}-render` : key
}

export function mountTreasureScene(host, worldId, bridge) {
  const world = WORLDS[worldId], items = treasuresFor(worldId)
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let scene, destroyed = false
  class ExpeditionScene extends Phaser.Scene {
    preload() {
      this.load.image('terrain', terrainUrl); this.load.image('props', propsUrl); this.load.image('hero', heroUrl); this.load.image('actors', actorsUrl)
      this.load.on('loaderror', () => bridge.onError?.())
    }
    create() {
      scene = this
      if (['terrain', 'props', 'hero', 'actors'].some((key) => !this.textures.exists(key))) { bridge.onError?.(); return }
      this.simulation = createExpedition(worldId, bridge.progress)
      this.elapsedUI = 0; this.scenery = []; this.treasureViews = new Map(); this.questViews = new Map(); this.particles = []; this.rewardFX = []; this.impact = 0; this.hitStop = 0
      for (const key of ['props', 'actors']) atlasFrames(this, key, 4, 3)
      this.heroKey = atlasFrames(this, 'hero', 4, 2, true)
      const terrain = this.textures.get('terrain'), source = terrain.getSourceImage()
      const ground = document.createElement('canvas'); ground.width = MAP.width; ground.height = MAP.height
      const groundContext = ground.getContext('2d')
      groundContext.filter = worldId === 1 ? 'saturate(.8) brightness(.82)' : 'saturate(.78) brightness(.76)'
      // Mirrored repeats keep the ground sharp at play scale and eliminate tile seams.
      for (let row = 0; row < 2; row++) for (let column = 0; column < 2; column++) {
        groundContext.save(); groundContext.translate(column ? MAP.width : 0, row ? MAP.height : 0); groundContext.scale(column ? -1 : 1, row ? -1 : 1)
        groundContext.drawImage(source, worldId % 2 * source.width / 2, Math.floor(worldId / 2) * source.height / 2, source.width / 2, source.height / 2, 0, 0, MAP.width / 2, MAP.height / 2); groundContext.restore()
      }
      this.textures.addCanvas('ground', ground)
      this.add.image(0, 0, 'ground').setOrigin(0).setDepth(-1000)
      this.makeEffects(); this.buildWorld()
      this.shadow = this.add.ellipse(0, 0, 35, 13, 0x07151c, .55)
      this.hero = this.add.image(this.simulation.player.x, this.simulation.player.y, this.heroKey, 0).setOrigin(.5, 1).setScale(.24)
      this.lantern = this.add.image(this.hero.x, this.hero.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setAlpha(.42)
      this.cameraTarget = this.add.zone(this.hero.x, this.hero.y - 40, 1, 1)
      this.cameras.main.setBounds(0, 0, MAP.width, MAP.height).startFollow(this.cameraTarget, true, .13, .13)
      this.warning = this.add.graphics().setDepth(9000)
      this.scanRing = this.add.graphics().setDepth(9001)
      bridge.setHandlers({ celebrate: ({ tier = 'relic' } = {}) => {
        this.burst(this.simulation.player.x, this.simulation.player.y - 42, tier)
        this.impact = reducedMotion ? 0 : 1
        this.hitStop = reducedMotion ? 0 : .1
        if (!reducedMotion) this.cameras.main.flash(tier === 'guardian' ? 180 : 100, 242, 221, 167, false)
      } })
      this.motes = Array.from({ length: 36 }, (_, i) => this.add.circle((i * 193 + 44) % MAP.width, (i * 109 + 80) % MAP.height, i % 3 === 0 ? 1.8 : .9, worldId === 2 ? 0xa8badb : 0xd6c89f, .4).setDepth(8000))
      this.input.on('pointerdown', (pointer) => {
        if (bridge.blocked || gameClock.isPaused()) return
        const target = clampPosition(this.cameras.main.getWorldPoint(pointer.x, pointer.y))
        bridge.input.path = findWalkPath(this.simulation.player, target, worldId)
        bridge.input.target = bridge.input.path.shift() || null
        host.focus({ preventScroll: true })
      })
      this.resize(); bridge.ready = true; bridge.onReady()
    }
    makeEffects() {
      this.textures.addCanvas('relic', createArtCanvas((ctx) => drawRelic(ctx, worldId), 64, 64))
      this.textures.addCanvas('glint', createArtCanvas((ctx) => {
        ctx.strokeStyle = '#eee4c8'; ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(-3, -4); ctx.lineTo(3, -4); ctx.moveTo(0, -7); ctx.lineTo(0, -1); ctx.stroke()
      }, 20, 20))
      this.textures.addCanvas('tablet', createArtCanvas(drawTablet, 64, 70))
      const light = document.createElement('canvas'); light.width = light.height = 200
      const ctx = light.getContext('2d'), gradient = ctx.createRadialGradient(100, 100, 0, 100, 100, 100)
      gradient.addColorStop(0, '#e9c87980'); gradient.addColorStop(.22, '#d5ae5735'); gradient.addColorStop(1, '#d5ae5700'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 200, 200)
      this.textures.addCanvas('glow', light)
    }
    prop(x, y, frame, height = 150, key = 'props') {
      const sprite = this.add.image(x, y, key, frame).setOrigin(.5, 1).setDepth(y)
      sprite.setScale(height / sprite.frame.height)
      return sprite
    }
    buildWorld() {
      for (const object of sceneryFor(worldId)) {
        this.add.ellipse(object.x + 8, object.y, 65 * object.scale, 21 * object.scale, 0x07191a, .3).setDepth(object.y - 5)
        const frame = object.variant === 2 ? 8 : worldId
        const sprite = this.prop(object.x, object.y + 4, frame, (object.variant === 2 ? 64 : 163) * object.scale)
        this.scenery.push({ ...object, sprite })
      }
      this.prop(MAP.spawn.x - 75, MAP.spawn.y - 30, 11, 82)
      for (const item of items) {
        let object, relic, glint
        if (item.type === 'puzzle') object = this.prop(item.x, item.y + 3, 4 + worldId, 135)
        if (item.type === 'hidden') object = this.prop(item.x, item.y + 3, 8, 47)
        if (item.type === 'explore') object = this.prop(item.x + 8, item.y + 3, 8, 33 + item.index % 3 * 3)
        if (item.type === 'jump') object = this.prop(item.x, item.y + 8, 8, 62)
        if (item.type === 'friend') object = this.prop(item.x, item.y, 8 + item.contactIndex, 90, 'actors')
        if (item.type === 'boss') object = this.prop(item.x, item.y, (item.index === 24 ? 4 : 0) + worldId, item.index === 24 ? 206 : 164, 'actors')
        if (['explore', 'hidden', 'jump'].includes(item.type)) {
          const offsetX = item.type === 'hidden' ? -25 : item.type === 'jump' ? -17 : -10
          const offsetY = item.type === 'jump' ? -44 : -2
          relic = this.add.image(item.x + offsetX, item.y + offsetY, 'relic').setOrigin(.5, 52 / 64).setDepth(item.y - 2).setScale(.88).setRotation((item.index % 3 - 1) * .13)
          glint = this.add.image(item.x + offsetX, item.y + offsetY - 17, 'glint').setOrigin(.5, .4).setDepth(item.y + 4).setVisible(false)
        }
        this.treasureViews.set(item.id, { item, object, relic, glint })
        if (item.type === 'friend') for (const target of item.targets) {
          const sprite = this.add.image(target.x, target.y - 5, 'tablet').setOrigin(.5, 1).setScale(.9).setDepth(target.y + 1).setVisible(false)
          const glow = this.add.image(target.x, target.y - 15, 'glow').setScale(.32).setBlendMode(Phaser.BlendModes.ADD).setVisible(false)
          this.questViews.set(target.id, { sprite, glow, questId: item.id })
        }
      }
    }
    resize() {
      if (!this.cameras?.main) return
      const { width, height } = host.getBoundingClientRect()
      this.scale.resize(Math.max(1, width), Math.max(1, height))
      this.baseZoom = width < 600 ? .96 : Math.max(.94, Math.min(1.2, width / 1250))
      this.cameras.main.setZoom(this.baseZoom)
    }
    update(_stamp, delta) {
      if (!this.simulation || destroyed) return
      if (bridge.blocked || gameClock.isPaused()) { bridge.resetInput(); return }
      const fxDelta = Math.min(delta / 1000, .045)
      this.hitStop = Math.max(0, this.hitStop - fxDelta)
      const result = this.hitStop > 0 ? { state: this.simulation, events: [] } : stepExpedition(this.simulation, bridge.input, delta / 1000, bridge.progress)
      this.simulation = result.state
      for (const event of result.events) {
        if (event.type === 'arrived') bridge.input.target = bridge.input.path?.shift() || null
        if (event.type === 'hurt' && !reducedMotion) this.cameras.main.shake(130, .003)
        bridge.onEvent(event)
      }
      const { player, time, boss, scan } = this.simulation
      const jumpDuration = worldId === 2 ? 1.05 : .76
      const jumpHeight = player.jump ? Math.sin((1 - player.jump / jumpDuration) * Math.PI) * (worldId === 2 ? 100 : 68) : 0
      const frame = (player.movingNorth ? 4 : 0) + (this.simulation.moving && !reducedMotion ? Math.floor(time * (player.dash ? 15 : 7)) % 4 : 0)
      this.hero.setFrame(frame).setPosition(player.x, player.y - jumpHeight).setFlipX(!player.movingNorth && player.facing < 0).setDepth(player.y + 4)
      this.hero.setAlpha(player.invulnerable > 0 && Math.floor(time * 12) % 2 ? .6 : 1)
      this.shadow.setPosition(player.x, player.y + 1).setScale(1 - jumpHeight / 200).setDepth(player.y - 1)
      this.lantern.setPosition(player.x + player.facing * 16, player.y - 38 - jumpHeight).setDepth(player.y + 5)
      this.cameraTarget.setPosition(player.x, player.y - 45)
      for (const { item, object, relic, glint } of this.treasureViews.values()) {
        const found = bridge.progress.collected.includes(item.id), distance = Math.hypot(item.x - player.x, item.y - player.y)
        if (relic) {
          const proximity = Math.max(0, 1 - distance / 200)
          const scanned = scan > 0 && distance < 210
          const known = item.type !== 'hidden' || bridge.progress.revealed.includes(item.id)
          relic.setVisible(!found).setAlpha(scanned ? .98 : (known ? .61 : .41) + proximity * .23)
          relic.setTint(scanned ? 0xe5dcc0 : 0xb8c0ad)
          const phase = (time + item.index * .73) % 4.8
          const glimmer = scanned ? .65 : !reducedMotion && distance < 185 && phase < .65 ? Math.sin(phase / .65 * Math.PI) * .58 : 0
          glint.setVisible(!found && glimmer > 0).setAlpha(glimmer)
        }
        if (object && item.type === 'boss') {
          object.setAlpha(found ? .24 : 1)
          if (boss?.id === item.id) { object.setTint(boss.phase === 'vulnerable' ? 0xa5d5db : 0xffffff); object.rotation = boss.phase === 'attack' && !reducedMotion ? Math.sin(time * 45) * .025 : 0 }
          else { object.clearTint(); object.rotation = 0 }
        }
      }
      for (const [id, { sprite, glow, questId }] of this.questViews) {
        const visible = bridge.progress.quests.includes(questId) && !bridge.progress.collected.includes(questId) && !bridge.progress.questItems.includes(id)
        sprite.setVisible(visible); glow.setVisible(visible)
      }
      for (const object of this.scenery) object.sprite.setAlpha(player.y < object.y && object.y - player.y < 160 && Math.abs(player.x - object.x) < 65 ? .38 : 1)
      this.drawWarnings(boss, time)
      this.scanRing.clear()
      if (scan > 1.8) { this.scanRing.lineStyle(2, 0xbcd7cc, (scan - 1.8) / .7 * .55).strokeEllipse(player.x, player.y, (2.5 - scan) / .7 * 420, (2.5 - scan) / .7 * 300) }
      if (!reducedMotion) this.motes.forEach((mote, i) => { mote.x = ((i * 193 + time * (i % 2 ? 5 : -3)) % MAP.width + MAP.width) % MAP.width; mote.y = (i * 109 + 80 + Math.sin(time * .35 + i) * 18) % MAP.height; mote.alpha = .15 + Math.sin(time + i) ** 2 * .35 })
      this.updateParticles(fxDelta)
      this.impact = Math.max(0, this.impact - fxDelta * 2.7)
      this.cameras.main.setZoom(this.baseZoom * (1 + Math.sin(this.impact * Math.PI) * .022))
      this.elapsedUI += delta
      if (this.elapsedUI >= 100) { this.elapsedUI = 0; bridge.onContext({ nearest: this.simulation.nearest, boss: boss ? { ...boss } : null, position: { x: player.x, y: player.y }, hp: player.hp, stamina: player.stamina, scan, jumping: player.jump > 0 }) }
    }
    drawZone(zone, color, alpha) {
      const graphics = this.warning
      graphics.fillStyle(color, alpha); graphics.lineStyle(1.5, color, .85)
      if (zone.kind === 'rect') { graphics.fillRect(zone.x, zone.y, zone.width, zone.height); graphics.strokeRect(zone.x, zone.y, zone.width, zone.height); return }
      if (zone.kind === 'line') {
        const sideX = -Math.sin(zone.angle) * zone.width / 2, sideY = Math.cos(zone.angle) * zone.width / 2
        const x = zone.x + Math.cos(zone.angle) * zone.length, y = zone.y + Math.sin(zone.angle) * zone.length
        const points = [{ x: zone.x + sideX, y: zone.y + sideY }, { x: x + sideX, y: y + sideY }, { x: x - sideX, y: y - sideY }, { x: zone.x - sideX, y: zone.y - sideY }]
        graphics.fillPoints(points, true); graphics.strokePoints(points, true); return
      }
      if (zone.kind === 'cone') { graphics.slice(zone.x, zone.y, zone.radius, zone.angle - zone.spread, zone.angle + zone.spread, false); graphics.fillPath(); graphics.strokePath(); return }
      if (zone.kind === 'ring') {
        // The unfilled center is the actual safe region used by collision checks.
        for (let index = 0; index < 48; index++) {
          const a = index * Math.PI / 24, b = (index + 1) * Math.PI / 24
          const point = (angle, radius) => ({ x: zone.x + Math.cos(angle) * radius, y: zone.y + Math.sin(angle) * radius * .74 })
          graphics.fillPoints([point(a, zone.radius), point(b, zone.radius), point(b, zone.inner), point(a, zone.inner)], true)
        }
        graphics.strokeEllipse(zone.x, zone.y, zone.radius * 2, zone.radius * 1.48)
        graphics.lineStyle(1.5, 0xd9d7b7, .7); graphics.strokeEllipse(zone.x, zone.y, zone.inner * 2, zone.inner * 1.48)
        return
      }
      graphics.fillEllipse(zone.x, zone.y, zone.radius * 2, zone.radius * 1.48); graphics.strokeEllipse(zone.x, zone.y, zone.radius * 2, zone.radius * 1.48)
    }
    drawWarnings(boss, time) {
      this.warning.clear()
      if (boss) {
        if (boss.phase !== 'vulnerable') for (const zone of bossZones(boss)) this.drawZone(zone, boss.phase === 'attack' ? 0xe7a476 : 0xc46c54, boss.phase === 'attack' ? .43 : .14 + Math.sin(time * 9) ** 2 * .07)
        else { this.warning.lineStyle(2, 0xb3e4dd, .5); this.warning.strokeEllipse(boss.x, boss.y, 150, 95) }
      } else for (const hazard of hazardsFor(worldId, time)) {
        if (hazard.active || hazard.warning) { this.warning.fillStyle(hazard.active ? 0x9bbfc0 : 0xc2a879, hazard.active ? .3 : .1); this.warning.lineStyle(1, 0xd6c19a, .6); this.warning.fillEllipse(hazard.x, hazard.y, hazard.rx * 2, hazard.ry * 2); this.warning.strokeEllipse(hazard.x, hazard.y, hazard.rx * 2, hazard.ry * 2) }
      }
    }
    burst(x, y, tier) {
      const major = tier !== 'relic'
      const colors = [0xffedba, 0xe6bf70, 0xc2e9e3, 0xffffff]
      const glow = this.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(10000).setScale(reducedMotion ? .65 : .3)
      this.rewardFX.push({ object: glow, life: reducedMotion ? .65 : 1.25, total: reducedMotion ? .65 : 1.25, kind: 'glow', x, y, major })
      if (reducedMotion) return
      for (let i = 0; i < (major ? 100 : 64); i++) {
        const angle = i * 2.399963, speed = 75 + (i * 47 % 215)
        const dot = i % 3 === 0 ? this.add.polygon(x, y, [0, -7, 3, 0, 0, 7, -3, 0], colors[i % 4]) : this.add.circle(x, y, i % 5 === 0 ? 2.5 : 1.4, colors[i % 4])
        dot.setBlendMode(Phaser.BlendModes.ADD).setDepth(10003)
        this.particles.push({ dot, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed * .7 - 35, life: .8 + i % 7 * .12, total: .8 + i % 7 * .12 })
      }
      for (let i = 0; i < 3; i++) {
        const ring = this.add.ellipse(x, y + 25, 30, 15).setStrokeStyle(i === 0 ? 3 : 1.5, colors[i], .9).setDepth(10001).setBlendMode(Phaser.BlendModes.ADD)
        this.rewardFX.push({ object: ring, life: 1.05 + i * .14, total: 1.05 + i * .14, kind: 'ring', x, y, major })
      }
      const beam = this.add.rectangle(x, y - 75, 5, 230, 0xffedba, .6).setBlendMode(Phaser.BlendModes.ADD).setDepth(10002)
      this.rewardFX.push({ object: beam, life: .5, total: .5, kind: 'beam', x, y, major })
    }
    updateParticles(delta) {
      this.particles = this.particles.filter((particle) => { particle.life -= delta; if (particle.life <= 0) { particle.dot.destroy(); return false } particle.dot.x += particle.vx * delta; particle.dot.y += particle.vy * delta; particle.vy += 70 * delta; particle.dot.rotation += delta * 2; particle.dot.alpha = Math.min(1, particle.life / .5); return true })
      this.rewardFX = this.rewardFX.filter((effect) => {
        effect.life -= delta
        if (effect.life <= 0) { effect.object.destroy(); return false }
        const age = 1 - effect.life / effect.total
        if (effect.kind === 'ring') effect.object.setScale(1 + age * (effect.major ? 17 : 12)).setAlpha((1 - age) ** 2)
        if (effect.kind === 'glow') effect.object.setScale(.4 + age * (effect.major ? 2.6 : 1.8)).setAlpha((1 - age) * .85)
        if (effect.kind === 'beam') effect.object.setScale(1 + age * 5, 1 + age * .4).setAlpha((1 - age) ** 2 * .65)
        return true
      })
    }
  }
  const game = new Phaser.Game({ type: Phaser.AUTO, parent: host, width: host.clientWidth, height: host.clientHeight, backgroundColor: '#14232b', scene: ExpeditionScene, antialias: true, banner: false, audio: { noAudio: true }, input: { keyboard: false, touch: { capture: false } }, fps: { target: 60 }, callbacks: { postBoot: () => game.canvas.setAttribute('aria-label', `${world.name} 탐사 지도. 방향키 이동, 스페이스 도약, 시프트 회피, E 조사.`) } })
  const observer = new ResizeObserver(() => scene?.resize()); observer.observe(host)
  return { checkpoint() { const player = scene?.simulation?.player; if (player) bridge.onEvent({ type: 'position', position: { x: player.x, y: player.y } }) }, destroy() { destroyed = true; observer.disconnect(); bridge.resetInput(); bridge.setHandlers({ celebrate: null }); bridge.ready = false; game.destroy(true) } }
}
