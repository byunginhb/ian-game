import { MAP, trailsFor } from './treasureContent.js'

// Painted from the exact same trail widths used by physics and the field map.
export function paintTerrain(worldId, source) {
  const canvas = document.createElement('canvas'); canvas.width = MAP.width; canvas.height = MAP.height
  const ctx = canvas.getContext('2d'), trails = trailsFor(worldId)
  const palettes = [
    ['#182d24', '#324835', '#777866', '#4d5748', '#b3ad87'],
    ['#293c3b', '#4c5d50', '#a69b7c', '#6b7060', '#d0c29a'],
    ['#222837', '#393d50', '#7a8091', '#4b5165', '#bac3cb'],
    ['#25372a', '#3e5235', '#85816a', '#596447', '#c0b98c'],
  ][worldId]
  let seed = 872 + worldId
  const random = () => { seed = seed * 16807 % 2147483647; return seed / 2147483647 }
  const texture = (brightness) => {
    ctx.save(); ctx.filter = `brightness(${brightness}) saturate(.75)`
    for (let row = 0; row < 2; row++) for (let column = 0; column < 2; column++) {
      ctx.save(); ctx.translate(column ? MAP.width : 0, row ? MAP.height : 0); ctx.scale(column ? -1 : 1, row ? -1 : 1)
      ctx.drawImage(source, worldId % 2 * source.width / 2, Math.floor(worldId / 2) * source.height / 2, source.width / 2, source.height / 2, 0, 0, MAP.width / 2, MAP.height / 2); ctx.restore()
    }
    ctx.restore()
  }
  texture(.3)
  ctx.fillStyle = `${palettes[0]}55`; ctx.fillRect(0, 0, MAP.width, MAP.height)
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  for (const [extra, color] of [[14, '#061814bb'], [5, '#9b9c7f88'], [0, palettes[2]]]) {
    ctx.strokeStyle = color
    for (const trail of trails) { ctx.lineWidth = trail.width * 2 + extra; ctx.beginPath(); ctx.moveTo(trail.a.x, trail.a.y); ctx.lineTo(trail.b.x, trail.b.y); ctx.stroke() }
  }
  const mask = new Path2D()
  for (const { a, b, width } of trails) {
    const angle = Math.atan2(b.y - a.y, b.x - a.x), sx = -Math.sin(angle) * width, sy = Math.cos(angle) * width
    mask.moveTo(a.x - sx, a.y - sy); mask.lineTo(b.x - sx, b.y - sy); mask.lineTo(b.x + sx, b.y + sy); mask.lineTo(a.x + sx, a.y + sy); mask.closePath()
    for (const point of [a, b]) { mask.moveTo(point.x + width, point.y); mask.arc(point.x, point.y, width, 0, Math.PI * 2); mask.closePath() }
  }
  ctx.save(); ctx.clip(mask)
  texture(.82)
  // Scattered pale grit keeps traversable areas distinct from the dark undergrowth.
  for (let i = 0; i < 8500; i++) {
    ctx.fillStyle = i % 2 ? '#101e1920' : '#d7c8a112'; ctx.fillRect(random() * MAP.width, random() * MAP.height, 1 + random() * 3, 1 + random() * 2)
  }
  ctx.restore()
  return canvas
}
