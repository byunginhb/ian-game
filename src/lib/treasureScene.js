import Phaser from 'phaser'
import terrainUrl from '../assets/treasure/terrain.webp'
import propsUrl from '../assets/treasure/props.webp'
import heroUrl from '../assets/treasure/hero-walk-v2.webp'
import actorsUrl from '../assets/treasure/actors.webp'
import { MAP, WORLDS, bossZones, clampPosition, createExpedition, findWalkPath, hazardsFor, heartsFor, sceneryFor, stepExpedition, treasuresFor } from './treasureKingdom'
import { createArtCanvas, createHazardCanvas, drawHeart, drawRelic, drawTablet } from './treasureArt'
import { paintTerrain } from './treasureTerrain'
import { createCombatVisuals } from './treasureCombat'
import { gameClock } from './gameClock'
import { advanceGait } from './treasureGait'
import { distanceToTrail, trailsFor } from './treasureContent'

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
  const cellHeight = source.height / rows
  // The authored sheets use irregular gutters. Arithmetic cells included neighboring
  // roots/heads above props and clipped guardian feet below them.
  const bounds = key === 'props' ? [
    [0, 0, 420, 395], [420, 0, 338, 395], [759, 0, 310, 395], [1080, 0, 368, 395],
    [0, 396, 395, 335], [420, 396, 325, 340], [748, 396, 303, 338], [1078, 400, 370, 330],
    [0, 737, 392, 349], [396, 752, 355, 310], [765, 724, 288, 362], [1100, 712, 328, 374],
  ] : key === 'actors' ? [
    [0, 0, 335, 380], [337, 0, 420, 375], [761, 0, 300, 355], [1067, 0, 381, 376],
    [0, 380, 402, 352], [365, 380, 374, 365], [744, 365, 311, 385], [1048, 351, 400, 402],
    [0, 742, 355, 344], [430, 746, 270, 340], [818, 753, 199, 333], [1120, 740, 294, 346],
  ] : null
  for (let index = 0; index < columns * rows; index++) {
    const row = Math.floor(index / columns), cellWidth = bounds?.[index][2] || source.width / columns
    const left = bounds?.[index][0] ?? Math.round(index % columns * cellWidth)
    // The new walk sheet is an equal 4x3 grid: side, back and front gait cycles.
    const top = solidify ? Math.round(row * cellHeight) : bounds?.[index][1] ?? Math.round(row * cellHeight)
    const height = solidify ? cellHeight : bounds?.[index][3] || cellHeight
    let minX = cellWidth, minY = height, maxX = 0, maxY = 0
    for (let y = 0; y < height; y++) for (let x = 0; x < cellWidth; x++) {
      if (pixels[((top + y) * source.width + left + x) * 4 + 3] > 85) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y) }
    }
    texture.add(index, 0, left + minX, top + minY, Math.max(1, maxX - minX + 1), Math.max(1, maxY - minY + 1))
    if (key === 'actors' && index === 4) {
      // The dinosaur tail shares a gutter with the neighboring octopus arm.
      // Keep the tail at the top while removing the detached arm below it.
      const isolated = document.createElement('canvas'); isolated.width = cellWidth; isolated.height = height
      const isolatedContext = isolated.getContext('2d')
      isolatedContext.drawImage(source, left, top, cellWidth, height, 0, 0, cellWidth, height)
      isolatedContext.clearRect(363, 95, cellWidth - 363, height - 95)
      scene.textures.addCanvas('guardian-jungle', isolated).add(index, 0, minX, minY, Math.max(1, maxX - minX + 1), Math.max(1, maxY - minY + 1))
    }
    if (solidify) {
      // Anchor under the hips, rather than the forward boot; changing the planted
      // foot must not make the entire torso jump sideways between frames.
      const anchorX = cellWidth * .57
      texture.get(index).customData.footOrigin = (anchorX - minX) / (maxX - minX + 1)
    }
  }
  return solidify ? `${key}-render` : key
}

export function mountTreasureScene(host, worldId, bridge) {
  const world = WORLDS[worldId], items = treasuresFor(worldId)
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let scene, destroyed = false, releasePointer = () => {}
  class ExpeditionScene extends Phaser.Scene {
    preload() {
      this.load.image('terrain', terrainUrl); this.load.image('props', propsUrl); this.load.image('hero', heroUrl); this.load.image('actors', actorsUrl)
      this.load.on('loaderror', () => bridge.onError?.())
    }
    create() {
      scene = this
      if (['terrain', 'props', 'hero', 'actors'].some((key) => !this.textures.exists(key))) { bridge.onError?.(); return }
      this.simulation = createExpedition(worldId, bridge.progress)
      this.elapsedUI = 0; this.scenery = []; this.treasureViews = new Map(); this.questViews = new Map(); this.particles = []; this.escortViews = new Map(); this.rewardFX = []; this.impact = 0; this.hitStop = 0; this.gait = { distance: 0, direction: 'east' }; this.footprints = []
      for (const key of ['props', 'actors']) atlasFrames(this, key, 4, 3)
      this.heroKey = atlasFrames(this, 'hero', 4, 3, true)
      this.textures.addCanvas('ground', paintTerrain(worldId, this.textures.get('terrain').getSourceImage()))
      this.add.image(0, 0, 'ground').setOrigin(0).setDepth(-1000)
      this.makeEffects(); this.buildWorld()
      this.water = this.add.graphics().setDepth(-990)
      const trails = trailsFor(worldId)
      this.waterPoints = Array.from({ length: 90 }, (_, i) => ({ x: (i * 293 + 91) % MAP.width, y: (i * 157 + 43) % MAP.height })).filter((point) => !trails.some((trail) => distanceToTrail(point, trail) < trail.width + 14))
      this.shadow = this.add.image(0, 0, 'contact-shadow').setDisplaySize(41, 14)
      this.hero = this.add.image(this.simulation.player.x, this.simulation.player.y, this.heroKey, 0).setOrigin(.5, 1).setScale(.24)
      this.lantern = this.add.image(this.hero.x, this.hero.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setAlpha(.42)
      this.cameraTarget = this.add.zone(this.hero.x, this.hero.y - 40, 1, 1)
      this.cameras.main.setBounds(0, 0, MAP.width, MAP.height).startFollow(this.cameraTarget, true, .13, .13)
      this.hazardFloor = this.add.graphics().setDepth(-900)
      this.hazardPools = hazardsFor(worldId, 0).map((hazard) => this.add.image(hazard.x, hazard.y, 'hazard').setDisplaySize(hazard.rx * 2.3, hazard.ry * 2.5).setDepth(-950))
      this.hazardViews = hazardsFor(worldId, 0).map((hazard) => this.add.text(hazard.x, hazard.y - hazard.ry - 15, '', { fontSize: '11px', color: '#eed8a2', backgroundColor: '#142523dd', padding: { x: 8, y: 5 } }).setOrigin(.5).setDepth(8000))
      this.warning = this.add.graphics().setDepth(9000)
      this.scanRing = this.add.graphics().setDepth(9001)
      this.combat = createCombatVisuals(this, reducedMotion)
      bridge.setHandlers({ celebrate: ({ tier = 'relic' } = {}) => {
        this.burst(this.simulation.player.x, this.simulation.player.y - 42, tier)
        this.impact = reducedMotion ? 0 : 1
        this.hitStop = reducedMotion ? 0 : .1
        if (!reducedMotion) this.cameras.main.flash(tier === 'guardian' ? 180 : 100, 242, 221, 167, false)
      } })
      this.motes = Array.from({ length: 36 }, (_, i) => this.add.circle((i * 193 + 44) % MAP.width, (i * 109 + 80) % MAP.height, i % 3 === 0 ? 1.8 : .9, worldId === 2 ? 0xa8badb : 0xd6c89f, .4).setDepth(8000))
      this.destination = this.add.ellipse(0, 0, 30, 18).setStrokeStyle(2, 0xe2d49d, .8).setDepth(8001).setVisible(false)
      this.setupPointer()
      this.resize(); bridge.ready = true; bridge.onReady()
    }
    makeEffects() {
      const gem = document.createElement('canvas'); gem.width = 50; gem.height = 70
      const gc = gem.getContext('2d'), gemGradient = gc.createLinearGradient(0, 0, 50, 70); gemGradient.addColorStop(0, '#ffffe6'); gemGradient.addColorStop(.5, '#f5dea1'); gemGradient.addColorStop(1, '#9f8e66')
      gc.shadowColor = '#e5f5cb'; gc.shadowBlur = 7; gc.fillStyle = gemGradient; gc.strokeStyle = '#ffffdd'; gc.lineWidth = 1.5
      gc.beginPath(); gc.moveTo(25, 7); gc.lineTo(42, 28); gc.lineTo(34, 57); gc.lineTo(25, 64); gc.lineTo(16, 57); gc.lineTo(8, 28); gc.closePath(); gc.fill(); gc.stroke(); gc.strokeStyle = '#ffffffaa'; gc.beginPath(); gc.moveTo(25, 7); gc.lineTo(25, 64); gc.moveTo(8, 28); gc.lineTo(42, 28); gc.stroke(); this.textures.addCanvas('boss-loot-gem', gem)
      const shadow = document.createElement('canvas'); shadow.width = 100; shadow.height = 40
      const shadowContext = shadow.getContext('2d'); shadowContext.scale(1, .4)
      const shade = shadowContext.createRadialGradient(50, 50, 0, 50, 50, 50); shade.addColorStop(0, '#07151ca3'); shade.addColorStop(.38, '#07151c6b'); shade.addColorStop(1, '#07151c00')
      shadowContext.fillStyle = shade; shadowContext.fillRect(0, 0, 100, 100); this.textures.addCanvas('contact-shadow', shadow)
      this.textures.addCanvas('hazard', createHazardCanvas(worldId))
      this.textures.addCanvas('heart', createArtCanvas(drawHeart, 52, 64))
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
      sprite.setData('baseScale', sprite.scaleX)
      return sprite
    }
    buildWorld() {
      this.heartViews = heartsFor(worldId).map((heart) => ({ ...heart, sprite: this.add.image(heart.x, heart.y - 10, 'heart').setOrigin(.5, 1).setDepth(heart.y + 2) }))
      for (const object of sceneryFor(worldId)) {
        this.add.ellipse(object.x + 8, object.y, 65 * object.scale, 21 * object.scale, 0x07191a, .3).setDepth(object.y - 5)
        const frame = object.variant === 2 ? 8 : worldId
        const sprite = this.prop(object.x, object.y, frame, (object.variant === 2 ? 64 : 163) * object.scale)
        this.scenery.push({ ...object, sprite })
      }
      this.prop(MAP.spawn.x - 75, MAP.spawn.y - 30, 11, 82)
      for (const item of items) {
        let object, relic, glint, jumpCue, seal
        if (item.type === 'puzzle') object = this.prop(item.x, item.y + 3, 4 + worldId, 135)
        if (item.type === 'hidden') object = this.prop(item.x, item.y + 3, 8, 47)
        if (item.type === 'explore') object = this.prop(item.x + 8, item.y + 3, 8, 33 + item.index % 3 * 3)
        if (item.type === 'jump') object = this.prop(item.x, item.y + 8, 8, 62)
        if (item.type === 'jump') jumpCue = this.add.text(item.x, item.y - 97, '↑ 점프', { fontSize: '17px', color: '#ffe1a1', stroke: '#152c2b', strokeThickness: 5, padding: { x: 7, y: 4 } }).setOrigin(.5).setDepth(9002).setVisible(false)
        if (item.type === 'friend') object = this.prop(item.x, item.y, 8 + item.contactIndex, 90, 'actors')
        if (item.type === 'boss') { object = this.prop(item.x, item.y, item.bossRank === 2 ? 4 + worldId : item.bossRank === 1 ? (worldId + 1) % 4 : worldId, item.bossRank === 2 ? 206 : item.bossRank === 1 ? 182 : 164, item.bossRank === 2 && worldId === 0 ? 'guardian-jungle' : 'actors'); seal = this.add.text(item.x, item.y - (item.bossRank === 2 ? 225 : 195), `${item.required} · 봉인`, { fontSize: '14px', color: '#e0cfa4', stroke: '#15262d', strokeThickness: 4 }).setOrigin(.5).setDepth(9001) }
        if (['explore', 'hidden', 'jump'].includes(item.type)) {
          const offsetX = item.type === 'hidden' ? -25 : item.type === 'jump' ? -17 : -10
          const offsetY = item.type === 'jump' ? -44 : -2
          relic = this.add.image(item.x + offsetX, item.y + offsetY, 'relic').setOrigin(.5, 52 / 64).setDepth(item.y - 2).setScale(.88).setRotation((item.index % 3 - 1) * .13)
          glint = this.add.image(item.x + offsetX, item.y + offsetY - 17, 'glint').setOrigin(.5, .4).setDepth(item.y + 4).setVisible(false)
        }
        this.treasureViews.set(item.id, { item, object, relic, glint, jumpCue, seal })
        if (item.type === 'friend') for (const target of item.targets) {
          const sprite = this.add.image(target.x, target.y - 5, 'tablet').setOrigin(.5, 1).setScale(.9).setDepth(target.y + 1).setVisible(false)
          const glow = this.add.image(target.x, target.y - 15, 'glow').setScale(.32).setBlendMode(Phaser.BlendModes.ADD).setVisible(false)
          const label = this.add.text(target.x, target.y - 57, `${item.targets.indexOf(target) + 1} · 조사`, { fontSize: '12px', color: '#c8eadb', stroke: '#14352d', strokeThickness: 4 }).setOrigin(.5).setDepth(9001).setVisible(false)
          this.questViews.set(target.id, { sprite, glow, label, questId: item.id })
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
    setupPointer() {
      const canvas = this.game.canvas
      const locate = (event) => { const box = canvas.getBoundingClientRect(); return { x: (event.clientX - box.left) * this.scale.width / box.width, y: (event.clientY - box.top) * this.scale.height / box.height } }
      const down = (event) => {
        if (this.pointer || event.button !== 0 || bridge.blocked || gameClock.isPaused()) return
        event.preventDefault(); canvas.setPointerCapture(event.pointerId)
        const point = locate(event)
        this.pointer = { ...point, startX: point.x, startY: point.y, id: event.pointerId, since: performance.now(), moved: false, lastRoute: 0 }
        bridge.resetInput(); bridge.setInput('pointerActive', true)
        this.setDestination(this.pointer); host.focus({ preventScroll: true })
      }
      const move = (event) => {
        if (this.pointer?.id !== event.pointerId) return
        const point = locate(event)
        Object.assign(this.pointer, point)
        this.pointer.reaim = true
        if (!this.pointer.moved && Math.hypot(point.x - this.pointer.startX, point.y - this.pointer.startY) > 7) { this.pointer.moved = true; this.pointer.lastRoute = 0 }
      }
      const up = (event) => {
        if (this.pointer?.id !== event.pointerId) return
        const stop = event.type !== 'pointerup' || this.pointer.moved || performance.now() - this.pointer.since >= 220
        this.pointer = null
        if (stop) { bridge.setInput('target', null); bridge.setInput('path', []); this.destination.setVisible(false) }
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
      }
      for (const [name, listener] of [['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointercancel', up], ['lostpointercapture', up]]) canvas.addEventListener(name, listener)
      releasePointer = () => { for (const [name, listener] of [['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointercancel', up], ['lostpointercapture', up]]) canvas.removeEventListener(name, listener) }
    }
    setDestination(point, continuous = false) {
      const raw = this.cameras.main.getWorldPoint(point.x, point.y), player = this.simulation.player
      if (!point.heading || point.reaim) {
        const distance = Math.hypot(raw.x - player.x, raw.y - player.y)
        point.heading = distance > 8 ? { x: (raw.x - player.x) / distance, y: (raw.y - player.y) / distance } : { x: 0, y: 0 }
        point.reaim = false
      }
      const target = clampPosition(continuous ? { x: player.x + point.heading.x * 230, y: player.y + point.heading.y * 230 } : raw)
      const path = findWalkPath(this.simulation.player, target, worldId)
      bridge.setInput('path', path); bridge.setInput('target', path.shift() || null)
      const destination = path.at(-1) || bridge.input.target
      if (destination) this.destination.setPosition(destination.x, destination.y).setVisible(true)
    }
    update(_stamp, delta) {
      if (!this.simulation || destroyed) return
      if (bridge.blocked || gameClock.isPaused()) { this.pointer = null; this.destination.setVisible(false); bridge.resetInput(); return }
      if (this.pointer && !bridge.input.pointerActive) this.pointer = null
      if (this.pointer && (this.pointer.moved || performance.now() - this.pointer.since >= 220) && performance.now() - this.pointer.lastRoute > 140) { this.setDestination(this.pointer, true); this.pointer.lastRoute = performance.now() }
      const fxDelta = Math.min(delta / 1000, .045)
      this.hitStop = Math.max(0, this.hitStop - fxDelta)
      const advanced = this.hitStop <= 0
      const result = advanced ? stepExpedition(this.simulation, bridge.input, delta / 1000, bridge.progress) : { state: this.simulation, events: [] }
      const previousPlayer = this.simulation.player
      this.simulation = result.state
      this.gait = advanceGait(this.gait, previousPlayer, this.simulation.player)
      if (this.gait.footstep) {
        bridge.onEvent({ type: 'footstep', surface: world.theme })
        if (!reducedMotion) {
          const { player } = this.simulation, x = player.x + this.gait.side * 6, y = player.y + 1
          const print = this.add.ellipse(x, y, 7, 3, worldId === 1 ? 0x514632 : 0xb3ad8d, .35).setDepth(player.y - 3)
          this.footprints.push({ object: print, life: .65, total: .65, dust: false })
          for (let i = 0; i < 3; i++) {
            const dust = this.add.circle(x + i * 2 - 2, y - 1, 1 + i % 2, 0xc4b99e, .24).setDepth(player.y + 3)
            this.footprints.push({ object: dust, life: .3, total: .3, dust: true })
          }
        }
      }
      for (let i = this.footprints.length - 1; i >= 0; i--) {
        const mark = this.footprints[i]; mark.life -= fxDelta
        if (mark.life <= 0) { mark.object.destroy(); this.footprints.splice(i, 1) }
        else { mark.object.setAlpha(mark.life / mark.total * (mark.dust ? .24 : .35)); if (mark.dust) mark.object.y -= fxDelta * 9 }
      }
      if (advanced) { bridge.input.cancelShot = false; bridge.input.primaryTap = false }
      if (this.previousBoss && !this.simulation.boss) bridge.setInput('jump', false)
      if (this.previousBoss !== this.simulation.boss?.id) this.game.canvas.setAttribute('aria-label', this.simulation.boss ? `${world.name} 수호자 전투. 스페이스를 짧게 눌러 자동 조준 미사일, 길게 눌러 필살기, 시프트 회피.` : `${world.name} 탐사 지도. 터치·드래그 이동, 스페이스 점프, 시프트 회피, E 조사.`)
      this.previousBoss = this.simulation.boss?.id
      for (const event of result.events) {
        this.combat.event(event)
        if (event.type === 'arrived') bridge.input.target = bridge.input.path?.shift() || null
        if (event.type === 'hurt' && !reducedMotion) this.cameras.main.shake(130, .003)
        if (event.type === 'heal') {
          const glow = this.add.image(this.simulation.player.x, this.simulation.player.y - 25, 'glow').setTint(0xb5f2c4).setDepth(10000).setBlendMode(Phaser.BlendModes.ADD)
          this.rewardFX.push({ object: glow, life: .7, total: .7, kind: 'glow', major: false })
        }
        bridge.onEvent(event)
      }
      const { player, time, boss, scan } = this.simulation
      if (!bridge.input.target) this.destination.setVisible(false)
      for (const heart of this.heartViews) { heart.sprite.setVisible(time >= (this.simulation.heartTimers[heart.id] || 0)); heart.sprite.y = heart.y - 10 - (reducedMotion ? 0 : Math.sin(time * 2.5) * 3) }
      const jumpDuration = worldId === 2 ? 1.05 : .76
      const jumpHeight = player.jump ? Math.sin((1 - player.jump / jumpDuration) * Math.PI) * (worldId === 2 ? 100 : 68) : 0
      const frame = reducedMotion ? (this.gait.direction === 'north' ? 4 : this.gait.direction === 'south' ? 8 : 0) : this.gait.frame
      const footOrigin = this.textures.get(this.heroKey).get(frame).customData.footOrigin
      const flipped = this.gait.direction === 'west'
      this.hero.setFrame(frame).setOrigin(flipped ? 1 - footOrigin : footOrigin, 1).setPosition(player.x, player.y - jumpHeight).setFlipX(flipped).setDepth(player.y + 4)
      this.hero.setDisplaySize(this.hero.frame.width / this.hero.frame.height * 96, 96 * (1 + (reducedMotion ? 0 : this.gait.compression)))
      this.hero.setRotation(reducedMotion || player.jump ? 0 : this.gait.moving ? Math.sin(this.gait.distance / 144 * Math.PI * 2) * .012 : 0)
      this.hero.setAlpha(player.invulnerable > 0 && player.hp < 4 && Math.floor(time * 12) % 2 ? .72 : 1)
      this.shadow.setPosition(player.x, player.y - 2).setDisplaySize(41 - jumpHeight * .12, 14 - jumpHeight * .04).setAlpha(1 - jumpHeight / 180).setDepth(player.y - 1)
      this.lantern.setPosition(player.x + player.facing * 16, player.y - 38 - jumpHeight).setDepth(player.y + 5)
      this.cameraTarget.setPosition(boss ? (player.x + boss.x) / 2 : player.x, boss ? (player.y + boss.y) / 2 - 65 : player.y - 45)
      for (const { item, object, relic, glint, jumpCue, seal } of this.treasureViews.values()) {
        const found = bridge.progress.collected.includes(item.id), distance = Math.hypot(item.x - player.x, item.y - player.y)
        if (seal) seal.setVisible(!found && !boss && distance < 280)
        if (jumpCue) jumpCue.setVisible(!found && !boss && distance < 120).setY(item.y - 97 - (reducedMotion ? 0 : Math.sin(time * 6) * 6))
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
          const scale = object.getData('baseScale')
          if (boss?.id === item.id && boss.phase === 'defeated') {
            const age = 1.9 - boss.timer, fall = Math.max(0, Math.min(1, (age - .55) / .4))
            object.setAlpha(1 - Math.max(0, age - 1.2) * .8).clearTint()
            object.setRotation(reducedMotion ? 0 : fall ? fall * 1.18 : Math.sin(age * 23) * (.04 + age * .18))
            object.setScale(scale, scale * (1 - fall * .42))
          } else if (found) object.setAlpha(.17).setRotation(reducedMotion ? 0 : 1.18).setScale(scale, scale * .58).clearTint()
          else {
            object.setAlpha(1).setScale(scale)
            if (boss?.id === item.id) { object.setTint(boss.phase === 'vulnerable' ? 0xa5d5db : 0xffffff); object.rotation = boss.phase === 'attack' && !reducedMotion ? Math.sin(time * 45) * .025 : 0 }
            else { object.clearTint(); object.rotation = 0 }
          }
        }
      }
      for (const [id, { sprite, glow, label, questId }] of this.questViews) {
        const quest = items.find((item) => item.id === questId), next = quest.targets.find((target) => !bridge.progress.questItems.includes(target.id))
        const visible = bridge.progress.quests.includes(questId) && !bridge.progress.collected.includes(questId) && next?.id === id
        sprite.setVisible(visible); glow.setVisible(visible); label.setVisible(visible)
      }
      for (const item of items.filter((item) => item.missionMode === 'rescue')) {
        const escort = this.simulation.escorts[item.id]
        if (!this.escortViews.has(item.id)) this.escortViews.set(item.id, this.prop(player.x, player.y, 8 + item.contactIndex, 75, 'actors').setTint(0xb6daca).setVisible(false))
        const sprite = this.escortViews.get(item.id); sprite.setVisible(Boolean(escort))
        if (escort) sprite.setPosition(escort.x, escort.y).setDepth(escort.y + 2)
      }
      this.water.clear()
      if (!reducedMotion) for (const [i, point] of this.waterPoints.entries()) { const phase = (time * .22 + i * .13) % 1; this.water.lineStyle(1, 0xb5e5de, Math.sin(phase * Math.PI) * .19).strokeEllipse(point.x + phase * 12, point.y, 15 + phase * 35, 3 + phase * 9) }
      for (const object of this.scenery) object.sprite.setAlpha(player.y < object.y && object.y - player.y < object.sprite.displayHeight && Math.abs(player.x - object.x) < object.sprite.displayWidth * .43 ? .42 : 1)
      this.drawWarnings(boss, time)
      this.combat.update(this.simulation, fxDelta)
      this.scanRing.clear()
      if (scan > 1.8) { this.scanRing.lineStyle(2, 0xbcd7cc, (scan - 1.8) / .7 * .55).strokeEllipse(player.x, player.y, (2.5 - scan) / .7 * 420, (2.5 - scan) / .7 * 300) }
      if (!reducedMotion) this.motes.forEach((mote, i) => { mote.x = ((i * 193 + time * (i % 2 ? 5 : -3)) % MAP.width + MAP.width) % MAP.width; mote.y = (i * 109 + 80 + Math.sin(time * .35 + i) * 18) % MAP.height; mote.alpha = .15 + Math.sin(time + i) ** 2 * .35 })
      this.updateParticles(fxDelta)
      this.impact = Math.max(0, this.impact - fxDelta * 2.7)
      const fit = boss ? Math.min(this.baseZoom, (this.scale.width - 45) / (Math.abs(player.x - boss.x) + 185), (this.scale.height - 215) / (Math.abs(player.y - boss.y) + 230)) : this.baseZoom
      const targetZoom = Math.max(.45, fit)
      this.combatZoom = reducedMotion ? targetZoom : (this.combatZoom || this.baseZoom) + (targetZoom - (this.combatZoom || this.baseZoom)) * Math.min(1, fxDelta * 5)
      this.cameras.main.setZoom(this.combatZoom * (1 + Math.sin(this.impact * Math.PI) * .022))
      this.elapsedUI += delta
      if (this.elapsedUI >= 100) { this.elapsedUI = 0; bridge.onContext({ nearest: this.simulation.nearest, boss: boss ? { ...boss } : null, weapon: { ...this.simulation.weapon }, position: { x: player.x, y: player.y }, hp: player.hp, stamina: player.stamina, scan, jumping: player.jump > 0 }) }
    }
    drawZone(zone, color, alpha, graphics = this.warning) {
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
      if (boss && boss.phase !== 'defeated') {
        if (boss.phase === 'warning') for (const zone of bossZones(boss)) this.drawZone(zone, boss.element === 'fire' ? 0xe68a50 : boss.element === 'water' ? 0x70d0d5 : 0xa7b4f5, .1 + Math.sin(time * 9) ** 2 * .04)
        else { this.warning.lineStyle(2, 0xb3e4dd, .5); this.warning.strokeEllipse(boss.x, boss.y, 150, 95) }
      }
      this.drawHazards(time, boss)
    }
    drawHazards(time, boss) {
      const floor = this.hazardFloor; floor.clear()
      hazardsFor(worldId, time).forEach((hazard, index) => {
        const { x, y, rx, ry, active, warning } = hazard
        const colors = [[0x101b13, 0x4e743b, 0xa7d865], [0x102f3b, 0x407d87, 0x91d8e1], [0x15182e, 0x62578e, 0xb39aff], [0x241b1e, 0x6d5545, 0xd49a76]][worldId]
        this.hazardPools[index].setPosition(x, y)
        for (let i = 0; i < 9; i++) {
          const angle = i * 2.3999, radius = .25 + i % 3 * .22
          const age = reducedMotion ? .5 : (time * .7 + i * .21) % 1
          floor.lineStyle(1, colors[2], (active ? .9 : .4) * (1 - age)); floor.strokeEllipse(x + Math.cos(angle) * rx * radius, y + Math.sin(angle) * ry * radius, 3 + age * 13, 2 + age * 6)
        }
        if (!boss && (active || warning)) { floor.lineStyle(warning ? 3 : 5, warning ? 0xefb95f : 0xe48c5f, reducedMotion ? .8 : .5 + Math.sin(time * 6) ** 2 * .5); floor.strokeEllipse(x, y, rx * 2 + 8, ry * 2 + 8) }
        this.hazardViews[index].setPosition(x, y - ry - 15).setText(`⚠ ${hazard.kind}${boss ? ' · 비활성' : active ? ' · 위험' : warning ? ' · 곧 분출' : ''}`)
      })
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
  const game = new Phaser.Game({ type: Phaser.AUTO, parent: host, width: host.clientWidth, height: host.clientHeight, backgroundColor: '#14232b', scene: ExpeditionScene, antialias: true, banner: false, audio: { noAudio: true }, input: { keyboard: false, touch: { capture: false } }, fps: { target: 60 }, callbacks: { postBoot: () => game.canvas.setAttribute('aria-label', `${world.name} 탐사 지도. 터치한 곳으로 이동, 길게 누르거나 드래그해 연속 이동. 방향키 이동, 스페이스 점프, 시프트 회피, E 조사.`) } })
  const observer = new ResizeObserver(() => scene?.resize()); observer.observe(host)
  return { checkpoint() { if (scene) scene.pointer = null; const player = scene?.simulation?.player; if (player) bridge.onEvent({ type: 'position', position: { x: player.x, y: player.y } }) }, destroy() { destroyed = true; releasePointer(); observer.disconnect(); bridge.resetInput(); bridge.setHandlers({ celebrate: null }); bridge.ready = false; game.destroy(true) } }
}
