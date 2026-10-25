export const WALK_FRAME_DISTANCE = 36
export function advanceGait(gait, before, player) {
  const dx = player.x - before.x, dy = player.y - before.y
  const travelled = Math.hypot(dx, dy / .82), moving = travelled > .1
  const distance = (gait.distance || 0) + travelled
  let direction = gait.direction || 'east'
  if (moving) direction = Math.abs(dy) > Math.abs(dx) * .8 ? dy < 0 ? 'north' : 'south' : dx < 0 ? 'west' : 'east'
  const row = direction === 'north' ? 1 : direction === 'south' ? 2 : 0
  const frame = row * 4 + (moving ? Math.floor(distance / WALK_FRAME_DISTANCE) % 4 : 0)
  const planted = Math.floor(distance / (WALK_FRAME_DISTANCE * 2))
  const footstep = moving && !player.jump && !player.dash && planted > Math.floor((gait.distance || 0) / (WALK_FRAME_DISTANCE * 2))
  return { distance, direction, frame, moving, footstep, side: planted % 2 ? -1 : 1, compression: moving && !player.jump ? Math.sin(distance / WALK_FRAME_DISTANCE * Math.PI) * .012 : 0 }
}
