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
export function drawHeart(ctx) {
  ctx.save(); ctx.translate(0, -4)
  ctx.shadowColor = '#f97c8a'; ctx.shadowBlur = 9
  const gradient = ctx.createLinearGradient(0, -31, 0, -2); gradient.addColorStop(0, '#ffb1a4'); gradient.addColorStop(.4, '#e65c6f'); gradient.addColorStop(1, '#8c344e')
  ctx.fillStyle = gradient; ctx.strokeStyle = '#ffd6b8'; ctx.lineWidth = 1.3
  ctx.beginPath(); ctx.moveTo(0, -2); ctx.bezierCurveTo(-31, -19, -15, -42, 0, -26); ctx.bezierCurveTo(15, -42, 31, -19, 0, -2); ctx.fill(); ctx.stroke()
  ctx.shadowBlur = 0; ctx.strokeStyle = '#ffe7ce'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-11, -26); ctx.quadraticCurveTo(-15, -20, -8, -16); ctx.stroke(); ctx.restore()
}

export function createHazardCanvas(worldId) {
  const canvas = document.createElement('canvas'); canvas.width = 300; canvas.height = 190
  const ctx = canvas.getContext('2d'), palettes = [['#071915', '#243e21', '#799547'], ['#081e30', '#2e626c', '#9bc2c1'], ['#101025', '#3a3158', '#8d7db3'], ['#201615', '#47352b', '#95814b']][worldId]
  let seed = 113
  const random = () => { seed = seed * 16807 % 2147483647; return seed / 2147483647 }
  ctx.translate(150, 95)
  ctx.shadowColor = '#071515'; ctx.shadowBlur = 12
  const bank = new Path2D()
  for (let i = 0; i < 96; i++) {
    const angle = i / 96 * Math.PI * 2, radius = 1 + Math.sin(i * 1.7) * .025 + Math.cos(i * .81) * .03
    const x = Math.cos(angle) * 132 * radius, y = Math.sin(angle) * 72 * radius
    if (!i) bank.moveTo(x, y); else bank.lineTo(x, y)
  }
  bank.closePath(); ctx.fillStyle = '#18251c'; ctx.fill(bank)
  ctx.shadowBlur = 0; ctx.strokeStyle = '#62664a'; ctx.lineWidth = 5; ctx.stroke(bank)
  ctx.save(); ctx.clip(bank)
  const water = ctx.createRadialGradient(-25, -20, 5, 0, 0, 140); water.addColorStop(0, palettes[0]); water.addColorStop(.7, palettes[1]); water.addColorStop(1, '#0a1416')
  ctx.fillStyle = water; ctx.fillRect(-150, -95, 300, 190)
  for (let i = 0; i < 1800; i++) {
    const x = random() * 300 - 150, y = random() * 190 - 95
    ctx.fillStyle = i % 3 ? `${palettes[2]}25` : '#00000035'; ctx.fillRect(x, y, random() * 8 + 1, .8 + random() * 2)
  }
  for (let i = 0; i < 50; i++) {
    const angle = i * 2.3999, radius = .6 + random() * .5
    ctx.strokeStyle = `${palettes[2]}77`; ctx.lineWidth = random() * 2 + 1; ctx.beginPath(); ctx.ellipse(Math.cos(angle) * 120 * radius, Math.sin(angle) * 62 * radius, 4 + random() * 12, 1 + random() * 2, random() * .3, 0, Math.PI * 2); ctx.stroke()
  }
  ctx.restore()
  for (let i = 0; i < 100; i++) {
    const angle = random() * Math.PI * 2, x = Math.cos(angle) * 133, y = Math.sin(angle) * 72
    ctx.strokeStyle = i % 2 ? '#6b7447bb' : '#2c4829'; ctx.lineWidth = 1 + random() * 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 5, y - 8, x + random() * 14 - 7, y - 5 - random() * 9); ctx.stroke()
  }
  return canvas
}
