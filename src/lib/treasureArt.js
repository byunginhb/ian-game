// Runtime FX textures; environment and character art is authored in src/assets/treasure.
export function createArtCanvas(draw, width = 100, height = 120) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
  const ctx = canvas.getContext('2d'); ctx.translate(width / 2, height - 12); draw(ctx); return canvas
}
export function drawRelic(ctx, worldId = 0) {
  // A weathered, half-buried fragment, with enough exposed metal to recognize by eye.
  const colors = [['#a5aa8b', '#626f61'], ['#b6ae96', '#797361'], ['#a5a8b6', '#626b80'], ['#a2aa84', '#63735d']][worldId]
  ctx.fillStyle = colors[1]; ctx.beginPath(); ctx.moveTo(-6, -21); ctx.lineTo(2, -25); ctx.lineTo(8, -16); ctx.lineTo(5, -3); ctx.lineTo(-5, -1); ctx.closePath(); ctx.fill()
  ctx.fillStyle = colors[0]; ctx.beginPath(); ctx.moveTo(-6, -21); ctx.lineTo(2, -25); ctx.lineTo(1, -10); ctx.lineTo(-5, -1); ctx.closePath(); ctx.fill()
  ctx.strokeStyle = '#c0b8949c'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(-2, -19); ctx.lineTo(4, -16); ctx.lineTo(-1, -12); ctx.lineTo(3, -8); ctx.stroke()
  ctx.strokeStyle = '#d8cfac80'; ctx.beginPath(); ctx.moveTo(-5, -21); ctx.lineTo(1, -24); ctx.stroke()
}
export function drawTablet(ctx) {
  ctx.save(); ctx.rotate(-.15); ctx.fillStyle = '#a5bab0'; ctx.fillRect(-11, -30, 22, 28); ctx.fillStyle = '#263d40'; ctx.fillRect(-8, -27, 16, 22)
  ctx.strokeStyle = '#d0bf84'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-4, -22); ctx.lineTo(4, -18); ctx.lineTo(-4, -13); ctx.lineTo(3, -7); ctx.stroke(); ctx.restore()
}
