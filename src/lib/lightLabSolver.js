/** 빛 꺾기 실험실 풀이기: 레벨 검증·생성과 테스트에서만 쓴다 (게임 번들에는 들어가지 않는다). */
import { emptyBoard, evaluate, trace } from './lightLab.js'

/**
 * 거울 수를 0개부터 늘려 가며 가장 적은 거울로 푸는 방법을 모두 찾는다.
 * 거울은 지금 빛이 지나가는 빈칸에만 놓아 본다: 빛이 닿지 않는 거울은 아무 일도 하지 않기 때문이다.
 */
export function solve(level, { maxMirrors = level.mirrors, needMarble = false, limit = 20, budget = 400000 } = {}) {
  let steps = 0
  for (let count = 0; count <= maxMirrors; count++) {
    const solutions = new Map(), visited = new Set()
    const search = (placed, used) => {
      if (steps++ > budget || solutions.size >= limit) return
      const traced = trace(level, placed)
      if (used === count) {
        const result = evaluate(level, placed, traced)
        if (result.solved && (!needMarble || result.marble)) solutions.set(placed.join(''), [...placed].map((mirror, index) => [index, mirror]).filter((entry) => entry[1]))
        return
      }
      for (let index = 0; index < placed.length; index++) {
        if (!traced.through[index] || placed[index] || level.cells[index].type !== 'empty') continue
        for (const mirror of [1, 2]) {
          const next = new Uint8Array(placed)
          next[index] = mirror
          const key = next.join('')
          if (visited.has(key)) continue
          visited.add(key)
          search(next, used + 1)
        }
      }
    }
    search(emptyBoard(level), 0)
    if (solutions.size) return { par: count, solutions: [...solutions.values()], exhausted: steps > budget }
  }
  return { par: -1, solutions: [], exhausted: steps > budget }
}
