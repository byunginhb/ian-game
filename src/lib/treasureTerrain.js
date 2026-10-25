import { MAP, trailsFor } from './treasureContent.js'

// The same trail network defines land, shoreline and collision; everything else is water.
export function paintTerrain(worldId, source) {
  const canvas = document.createElement('canvas'); canvas.width = MAP.width; canvas.height = MAP.height
  const ctx = canvas.getContext('2d'), trails = trailsFor(worldId)
  let seed = 872 + worldId
  const random = () => { seed = seed * 16807 % 2147483647; return seed / 2147483647 }
  const colors = [['#103d4a', '#1c6e78', '#8bc8bc'], ['#0d3d60', '#238a9d', '#b1e4d5'], ['#172e51', '#30598a', '#96c7e6'], ['#134b48', '#337f70', '#a4d9b1']][worldId]
  const water = ctx.createLinearGradient(0, 0, MAP.width, MAP.height); water.addColorStop(0, colors[0]); water.addColorStop(.55, colors[1]); water.addColorStop(1, colors[0])
  ctx.fillStyle = water; ctx.fillRect(0, 0, MAP.width, MAP.height)
  for (let i = 0; i < 4400; i++) {
    const x = random() * MAP.width, y = random() * MAP.height, width = 5 + random() * 24
    ctx.strokeStyle = `${colors[2]}${i % 3 ? '17' : '32'}`; ctx.lineWidth = .6 + random()
    ctx.beginPath(); ctx.ellipse(x, y, width, 1.2 + random() * 3, -.15, .1, 2.8); ctx.stroke()
  }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  for (const [extra, color] of [[20, '#53a7a457'], [10, worldId === 1 ? '#b6aa7d' : '#7c9177'], [3, '#c5bc945e']]) {
    ctx.strokeStyle = color
    for (const { a, b, width } of trails) { ctx.lineWidth = width * 2 + extra; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); if (a.x === b.x && a.y === b.y) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(a.x, a.y, width + extra / 2, 0, Math.PI * 2); ctx.fill() } else ctx.stroke() }
  }
  const land = new Path2D()
  for (const { a, b, width } of trails) {
    const angle = Math.atan2(b.y - a.y, b.x - a.x), sx = -Math.sin(angle) * width, sy = Math.cos(angle) * width
    land.moveTo(a.x - sx, a.y - sy); land.lineTo(b.x - sx, b.y - sy); land.lineTo(b.x + sx, b.y + sy); land.lineTo(a.x + sx, a.y + sy); land.closePath()
    for (const point of [a, b]) { land.moveTo(point.x + width, point.y); land.arc(point.x, point.y, width, 0, Math.PI * 2); land.closePath() }
  }
  ctx.save(); ctx.clip(land); ctx.filter = 'brightness(.83) saturate(.77)'
  for (let row = 0; row < 2; row++) for (let column = 0; column < 2; column++) {
    ctx.save(); ctx.translate(column ? MAP.width : 0, row ? MAP.height : 0); ctx.scale(column ? -1 : 1, row ? -1 : 1)
    ctx.drawImage(source, worldId % 2 * source.width / 2, Math.floor(worldId / 2) * source.height / 2, source.width / 2, source.height / 2, 0, 0, MAP.width / 2, MAP.height / 2); ctx.restore()
  }
  ctx.restore(); return canvas
}
