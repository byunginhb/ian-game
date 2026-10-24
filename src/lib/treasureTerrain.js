import { MAP, distanceToTrail, trailsFor } from './treasureContent.js'

// Ground and understory blend across the physical trail edge; there is no border stroke.
export function paintTerrain(worldId, source) {
  const canvas = document.createElement('canvas'); canvas.width = MAP.width; canvas.height = MAP.height
  const ctx = canvas.getContext('2d'), trails = trailsFor(worldId)
  let seed = 872 + worldId
  const random = () => { seed = seed * 16807 % 2147483647; return seed / 2147483647 }
  ctx.filter = 'brightness(.81) saturate(.77)'
  for (let row = 0; row < 2; row++) for (let column = 0; column < 2; column++) {
    ctx.save(); ctx.translate(column ? MAP.width : 0, row ? MAP.height : 0); ctx.scale(column ? -1 : 1, row ? -1 : 1)
    ctx.drawImage(source, worldId % 2 * source.width / 2, Math.floor(worldId / 2) * source.height / 2, source.width / 2, source.height / 2, 0, 0, MAP.width / 2, MAP.height / 2); ctx.restore()
  }
  ctx.filter = 'none'
  const distance = (point) => Math.min(...trails.map((trail) => distanceToTrail(point, trail) - trail.width + 10))
  const mask = document.createElement('canvas'); mask.width = Math.ceil(MAP.width / 5); mask.height = Math.ceil(MAP.height / 5)
  const maskContext = mask.getContext('2d'), pixels = maskContext.createImageData(mask.width, mask.height)
  const tint = [[39, 63, 35], [95, 101, 64], [58, 57, 83], [55, 76, 34]][worldId]
  for (let y = 0; y < mask.height; y++) for (let x = 0; x < mask.width; x++) {
    const d = distance({ x: x * 5, y: y * 5 }) + Math.sin(x * .29) * 4 + Math.cos(y * .41) * 4
    const t = Math.max(0, Math.min(1, (d + 12) / 32)), offset = (y * mask.width + x) * 4
    pixels.data[offset] = tint[0]; pixels.data[offset + 1] = tint[1]; pixels.data[offset + 2] = tint[2]; pixels.data[offset + 3] = t * t * (3 - 2 * t) * 95
  }
  maskContext.putImageData(pixels, 0, 0); ctx.drawImage(mask, 0, 0, MAP.width, MAP.height)
  // Feathered samples of the authored ground supply natural moss, coral and rubble.
  const cover = document.createElement('canvas'); cover.width = 100; cover.height = 70
  const brush = cover.getContext('2d'), sample = [[335, 10], [1300, 10], [40, 570], [1100, 520]][worldId]
  brush.drawImage(source, sample[0], sample[1], 120, 90, 0, 0, 100, 70)
  const feather = brush.createRadialGradient(50, 35, 10, 50, 35, 50); feather.addColorStop(0, '#ffffffff'); feather.addColorStop(.6, '#ffffffbb'); feather.addColorStop(1, '#ffffff00')
  brush.globalCompositeOperation = 'destination-in'; brush.fillStyle = feather; brush.fillRect(0, 0, 100, 70)
  for (let i = 0; i < 2700; i++) {
    const x = random() * MAP.width, y = random() * MAP.height, d = distance({ x, y })
    if (d < -8 || (d < 12 && random() > .4)) continue
    ctx.save(); ctx.translate(x, y); ctx.rotate(random() * Math.PI * 2); ctx.globalAlpha = .55
    const width = 30 + random() * 32; ctx.drawImage(cover, -width / 2, -width * .35, width, width * .7); ctx.restore()
  }
  return canvas
}
