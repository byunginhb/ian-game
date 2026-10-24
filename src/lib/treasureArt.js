// Runtime FX textures; environment and character art is authored in src/assets/treasure.
export function createArtCanvas(draw, width = 100, height = 120) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
  const ctx = canvas.getContext('2d'); ctx.translate(width / 2, height - 12); draw(ctx); return canvas
}
export function drawRelic(ctx) {
  const light = ctx.createRadialGradient(0, -30, 0, 0, -30, 39)
  light.addColorStop(0, '#f5d7a460'); light.addColorStop(1, '#f5d7a400')
  ctx.fillStyle = light; ctx.fillRect(-40, -70, 80, 80)
  const faces = [
    [[0, -56], [-13, -36], [0, -21], '#f2dfb0'],
    [[0, -56], [15, -35], [0, -21], '#c4a367'],
    [[-13, -36], [0, -21], [-6, -13], '#8d784f'],
    [[15, -35], [0, -21], [6, -13], '#ad8c4e'],
    [[-6, -13], [0, -21], [6, -13], '#d5bd82'],
  ]
  for (const [a, b, c, color] of faces) { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.lineTo(...c); ctx.closePath(); ctx.fill() }
  ctx.strokeStyle = '#ead3a170'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(0, -56); ctx.lineTo(15, -35); ctx.lineTo(6, -13); ctx.lineTo(-6, -13); ctx.lineTo(-13, -36); ctx.closePath(); ctx.stroke()
}
export function drawTablet(ctx) {
  ctx.save(); ctx.rotate(-.15); ctx.fillStyle = '#a5bab0'; ctx.fillRect(-11, -30, 22, 28); ctx.fillStyle = '#263d40'; ctx.fillRect(-8, -27, 16, 22)
  ctx.strokeStyle = '#d0bf84'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-4, -22); ctx.lineTo(4, -18); ctx.lineTo(-4, -13); ctx.lineTo(3, -7); ctx.stroke(); ctx.restore()
}
