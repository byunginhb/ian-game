export function fitGameScale(gameW, gameH, width, height, { maxScale = 2, padding = 24, reservedH = 100 } = {}) {
  const availableW = Math.max(1, width - padding)
  // Short landscape screens may scroll vertically; controls must stay readable.
  const readableScale = Math.min(1, Math.min(340, availableW) / gameW)
  const availableH = Math.max(gameH * readableScale, height - reservedH - 64)
  return Math.max(0.01, Math.min(availableW / gameW, availableH / gameH, maxScale))
}
