export const WORLDS = [
  { id: 0, name: '잊힌 수로의 정글', short: '공룡 정글', chapter: '잊힌 수로', subtitle: '멈춰 버린 물길 아래, 첫 번째 기록이 남아 있다.', color: '#96b393', light: '#152e29', ground: '#344b38', edge: '#132a25', sky: '#101f21', friend: '유적 조사관 레온', item: '수로 설계도', bosses: ['수로의 파수꾼', '화염의 수문장', '백악의 수호자'], theme: 'jungle', relic: '수로의 기록핵', hazard: '수로 분출', objective: '유적의 전력 회로를 연결하고 수로의 기록을 회수하라.', report: '수로는 무너진 것이 아니었다. 중앙에서 누군가 물길을 끊었다.', records: ['침수된 석판에는 같은 날짜가 반복된다. 왕국이 멈춘 날이다.', '수로의 설계도에는 물이 아니라 빛을 운반하는 통로가 그려져 있다.', '첫 수호자의 명령 기록: “중앙의 심장을 분리하라. 시민을 먼저 보호하라.”'] },
  { id: 1, name: '해적의 조류 군도', short: '바다와 섬', chapter: '침몰한 나침반', subtitle: '지워진 항로를 따라, 바다가 감춘 신호를 추적한다.', color: '#8dbac2', light: '#142e39', ground: '#927f5c', edge: '#3d5152', sky: '#152b38', friend: '항해사 세라', item: '항로 기록판', bosses: ['철갑 선장', '폭풍의 항해자', '심해의 감시자'], theme: 'ocean', relic: '조류의 기록핵', hazard: '밀려오는 조류', objective: '조류를 피해 항로 장치를 복구하고 침몰선의 신호를 찾아라.', report: '나침반은 북쪽이 아니라 하늘의 균열을 가리켰다.', records: ['모든 배가 같은 날 방향을 잃었다. 나침반의 바늘은 하늘을 향했다.', '마지막 항해 일지: 심장의 파편은 우연히 흩어진 것이 아니다.', '수호자는 침몰선을 공격하지 않았다. 기록핵을 싣고 안전한 곳으로 옮기고 있었다.'] },
  { id: 2, name: '고요한 궤도 관측소', short: '우주 행성', chapter: '궤도 밖의 신호', subtitle: '응답 없는 관측소, 끊긴 신호의 발신지는 왕국이다.', color: '#afa9d7', light: '#20223d', ground: '#4c4663', edge: '#24253f', sky: '#10182b', friend: '관측기 AL-7', item: '별자리 데이터', bosses: ['궤도 집행기', '전류의 감시자', '자오선 수호자'], theme: 'space', relic: '궤도의 기록핵', hazard: '중력 파동', objective: '낮은 중력을 이용해 관측소에 도달하고 신호의 좌표를 해독하라.', report: '심장을 한곳에 다시 모으면, 같은 붕괴가 반복된다.', records: ['왕국의 심장은 무한한 동력이 아니었다. 과부하가 임계점에 도달해 있었다.', '누군가 심장을 네 세계로 분산시켜 폭주를 멈췄다. 왕국의 멈춤은 구조 작전이었다.', '복구 조건을 찾았다. 한 개의 심장이 아니라 서로 연결된 네 개의 동력원이 필요하다.'] },
  { id: 3, name: '거인의 유리 정원', short: '거대한 정원', chapter: '다시, 왕국으로', subtitle: '풀잎 아래 숨겨진 마지막 선택. 되살릴 것은 무엇인가.', color: '#c2b88c', light: '#27302b', ground: '#49533b', edge: '#293628', sky: '#162522', friend: '기록 관리인 이리스', item: '생장 연구 노트', bosses: ['가시의 기사', '생명의 문지기', '정원의 마지막 수호자'], theme: 'garden', relic: '생명의 기록핵', hazard: '가시 덩굴', objective: '정원의 생장 장치를 재가동하고 마지막 수호자의 봉인을 해제하라.', report: '이제 왕국을 되살릴 수 있다. 네 세계가 서로를 지탱하는 방식으로.', records: ['정원의 나무들은 네 세계에서 모인 빛으로 자라고 있었다. 해결책은 이미 여기에 있었다.', '마지막 수호자는 적이 아니다. 다시는 심장이 폭주하지 않도록 봉인을 지키고 있었다.', '네 개의 기록이 연결됐다. 왕국은 돌아올 것이다. 이번에는 혼자 버티지 않아도 된다.'] },
]

export const PROLOGUE = ['왕국의 심장이 멈춘 날, 하늘에 네 개의 균열이 생겼다.', '폐허에서 발견한 마지막 기록은 단 한 문장. “파괴가 아니었다. 누군가는 우리를 지키려 했다.”', '네 세계에 흩어진 보물 100개를 회수하라. 왕국이 무너진 진짜 이유가 그 안에 있다.']
export const MAP = { width: 1900, height: 1320, spawn: { x: 240, y: 1110 } }
const TYPES = ['explore', 'explore', 'hidden', 'puzzle', 'friend', 'jump', 'hidden', 'explore', 'friend', 'jump', 'explore', 'puzzle', 'boss', 'hidden', 'jump', 'friend', 'jump', 'puzzle', 'explore', 'hidden', 'puzzle', 'boss', 'bossReward', 'bossReward', 'boss']
const NAMES = ['붕괴 직전의 지도', '사라진 탐사대', '봉인된 정찰 기록', '끊어진 회로', '흩어진 설계도', '무너진 교각', '뒤집힌 석판', '경계의 표식', '연결 장치의 행방', '절벽 위 관측점', '퇴색한 왕국의 문장', '침묵의 수문', '첫 번째 봉인', '그늘에 숨긴 신호', '부서진 계단', '탐사대의 흔적', '상층 유적의 기록', '균형의 방', '외곽의 경보', '세 번째 감지 신호', '돌아오지 않은 전령', '최종 설계의 조각', '바람을 건너서', '마지막 항로', '중앙 봉인의 해제']
const CONTACTS = ['유적 조사관 레온', '항해사 세라', '관측기 AL-7', '기록 관리인 이리스']
const BRIEFINGS = ['원본 설계도가 세 조각으로 흩어졌다. 주변의 기록을 회수해 줘. 설계도를 연결해야 장치의 목적을 알 수 있다.', '지도와 실제 항로가 일치하지 않아. 인근 중계기에 남은 좌표 세 개를 찾아오면 정확한 위치를 복원할 수 있어.', '탐사 데이터 손상 감지. 누락된 복원 모듈 세 개가 인근에 있다. 접근하면 위치 신호를 전송하겠다.', '서로 다른 필체가 같은 기록에 남아 있다. 흩어진 세 장을 연결하면 마지막 명령을 내린 사람이 누구인지 알 수 있을 거야.']
export const TYPE_LABELS = { explore: '탐사', hidden: '감지 신호', jump: '상층 유적', puzzle: '장치 복구', friend: '현장 임무', boss: '봉인 수호자', bossReward: '최종 보스 보상', missionSite: '현장 조사' }
export const clampPosition = ({ x, y }) => ({ x: Math.max(160, Math.min(MAP.width - 160, x)), y: Math.max(175, Math.min(MAP.height - 160, y)) })

export function treasuresFor(worldId) {
  const items = TYPES.map((type, i) => {
    const column = i % 5, row = Math.floor(i / 5)
    const x = [330, 620, 940, 1260, 1560][column] + (row % 2 ? 45 : 0) + (worldId && i > 1 ? Math.sin(i * 3 + worldId) * 52 : 0)
    const y = [1100, 880, 650, 420, 210][row] + (column % 2 ? -25 : 0) + (worldId && row > 0 ? Math.cos(i + worldId) * 25 : 0)
    const position = clampPosition({ x, y })
    const contactIndex = [4, 8, 15].indexOf(i)
    const targets = type === 'friend' ? [[-145, -90], [90, -115], [-100, 65]].map(([dx, dy], index) => ({ ...clampPosition({ x: x + dx, y: y + dy }), id: `${worldId}-${i}:${index}` })) : []
    return { id: `${worldId}-${i}`, index: i, worldId, type, name: NAMES[i], ...position, targets, target: targets[0], contactIndex, contact: CONTACTS[contactIndex], briefing: BRIEFINGS[contactIndex], clue: type === 'hidden' ? ['석판 뒤에서 미세한 공명이 감지된다.', '반쯤 묻힌 구조물에서 신호가 나온다.', '수로의 끝, 그림자가 겹치는 곳을 조사하라.', '가장자리의 오래된 흔적을 탐지하라.'][Math.floor(i / 6)] : undefined }
  })
  for (const item of items) {
    if (item.type === 'boss') Object.assign(item, { bossRank: [12, 21, 24].indexOf(item.index), required: { 12: 10, 21: 20, 24: 22 }[item.index], name: WORLDS[worldId].bosses[[12, 21, 24].indexOf(item.index)] })
    if (item.type === 'bossReward') Object.assign(item, { x: items[24].x, y: items[24].y, name: `${WORLDS[worldId].relic} · ${item.index === 22 ? '용기' : '지혜'}` })
    if (item.type === 'friend') {
      const mode = ['survey', 'relay', 'rescue'][item.contactIndex]
      const sites = [[2, 10, 17], [7, 13, 18], [11, 6, 3]][item.contactIndex]
      const rotated = sites.map((index) => (index + worldId * 5) % 20)
      item.targets = rotated.map((index, step) => ({ x: items[index].x + (step % 2 ? 32 : -30), y: items[index].y + 20, id: `${item.id}:${step}`, name: `${['관측소', '중계기', '구조 지점'][item.contactIndex]} ${step + 1}`, code: 3 + (worldId * 11 + item.index * 7 + step * 13) % 29 }))
      item.target = item.targets[0]; item.missionMode = mode
      item.briefing = mode === 'survey' ? `${WORLDS[worldId].item}를 해독하려면 세 관측소를 순서대로 조사해야 한다. 기록값을 읽고 마지막 암호를 추론해 돌아와라.` : mode === 'relay' ? '끊긴 중계망 세 곳을 차례대로 동기화해야 한다. 움직이는 신호를 안정 구간에 맞춘 뒤 돌아와 출력 순서를 보고하라.' : '실종 대원이 남긴 세 신호를 추적하라. 현장의 위험을 판단해 구출한 뒤, 대원을 데리고 이곳까지 호위하라.'
    }
  }
  return items
}

export function sceneryFor(worldId) {
  const items = treasuresFor(worldId), trails = trailsFor(worldId)
  let seed = 13 + worldId * 41
  const random = () => { seed = seed * 16807 % 2147483647; return seed / 2147483647 }
  const objects = []
  const groves = [[190, 350], [450, 720], [800, 1010], [1090, 950], [1400, 910], [1650, 730], [1450, 330], [1100, 300], [800, 460], [440, 260], [190, 850], [1700, 1050]]
  for (let i = 0; i < 48; i++) {
    const grove = groves[Math.floor(i / 4)]
    const x = grove[0] + (random() - .5) * 135, y = grove[1] + (random() - .5) * 100, scale = .72 + random() * .45
    if (items.some((item) => Math.hypot(item.x - x, item.y - y) < (item.type === 'boss' ? item.bossRank === 2 ? 220 : 185 : 104) || item.targets.some((point) => Math.hypot(point.x - x, point.y - y) < 70))) continue
    if (Math.hypot(x - MAP.spawn.x, y - MAP.spawn.y) < 120) continue
    if (!trails.some((trail) => distanceToTrail({ x, y }, trail) < trail.width - 18)) continue
    objects.push({ x, y, scale, variant: i % 4 === 0 ? 2 : i % 2, radius: (i % 4 === 0 ? 32 : 38) * scale })
  }
  return objects
}

// One source for the painted trail, collision, navigation and map.
export function trailsFor(worldId) {
  const items = treasuresFor(worldId), trails = [{ a: MAP.spawn, b: items[0], width: 78 }]
  const lanes = [[0, 5, 10, 15, 20, 21, 24], [0, 6, 12, 18, 24], [0, 1, 2, 3, 4, 9, 14, 19, 24], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19]]
  lanes.forEach((lane, laneIndex) => lane.slice(1).forEach((index, step) => trails.push({ a: items[lane[step]], b: items[index], width: laneIndex < 3 ? 72 : 58 })))
  for (const item of items) {
    if (item.type === 'boss') trails.push({ a: item, b: item, width: item.bossRank === 2 ? 165 : 135 })
    for (const target of item.targets) {
      const nearest = items.filter((entry) => entry.type !== 'bossReward').reduce((a, b) => Math.hypot(a.x - target.x, a.y - target.y) < Math.hypot(b.x - target.x, b.y - target.y) ? a : b)
      trails.push({ a: nearest, b: target, width: 58 })
    }
  }
  return trails
}
export function distanceToTrail(point, { a, b }) {
  const dx = b.x - a.x, dy = b.y - a.y
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(point.x - a.x - dx * t, point.y - a.y - dy * t)
}
export function heartsFor(worldId) {
  const items = treasuresFor(worldId)
  return [[0, 1], [6, 7], [12, 13], [15, 16], [20, 21]].map(([a, b], index) => ({ id: `heart-${index}`, x: (items[a].x + items[b].x) / 2, y: (items[a].y + items[b].y) / 2 }))
}

export function hazardsFor(worldId, time) {
  const phase = time % 8
  const active = phase > 5.4
  const warning = phase > 3.8 && !active
  const origins = [[790, 1075], [620, 625], [1410, 640]]
  return origins.map(([x, y], index) => ({ x: x + (worldId === 2 ? Math.sin(time * .65 + index) * 65 : 0), y, rx: worldId === 1 ? 125 : 76, ry: worldId === 1 ? 45 : 42, active, warning, kind: worldId === 0 ? '독성 늪' : WORLDS[worldId].hazard }))
}

export const RESTORATIONS = [
  { at: 0, name: '멈춘 왕국', text: '중앙 심장에 전력이 없다. 첫 기록핵을 확보해야 한다.' },
  { at: 1, name: '중앙 관문 재가동', text: '중앙 관문이 응답했다. 왕국 내부로 진입할 수 있다.' },
  { at: 10, name: '서쪽 교량 복구', text: '끊긴 교량이 연결됐다. 왕국 밖으로 대피했던 주민들이 돌아온다.' },
  { at: 20, name: '거주 구역 전력 복원', text: '거주 구역의 전력이 돌아왔다. 첫 번째 밤을 밝힐 수 있다.' },
  { at: 30, name: '교역 지구 연결', text: '식량과 부품의 운송로를 확보했다. 왕국은 스스로 움직이기 시작했다.' },
  { at: 40, name: '중앙 수로 복구', text: '지하 수로가 순환한다. 꺼져 있던 광장의 장치가 깨어났다.' },
  { at: 50, name: '생태 정원 회복', text: '정원의 뿌리가 네 세계의 빛을 받아들이기 시작했다.' },
  { at: 60, name: '관측탑 재연결', text: '하늘의 신호가 잡혔다. 기록핵이 흩어진 이유가 밝혀지고 있다.' },
  { at: 75, name: '내성 방호 복원', text: '왕국의 성벽이 제 모습을 찾았다. 마지막 탐사의 준비가 끝났다.' },
  { at: 90, name: '네 세계의 연결', text: '분산된 동력원이 연결됐다. 이번에는 한곳에 모든 부담이 쏠리지 않는다.' },
  { at: 100, name: '왕국의 새로운 아침', text: '백 개의 보물과 네 개의 기록. 왕국은 다시 움직인다. 그 시작을 만든 이름은 이안이다.' },
]

function seeded(seed) { let value = seed + 19; return () => { value = value * 16807 % 2147483647; return value / 2147483647 } }
export function puzzleFor(item) {
  const mode = ['circuit', 'sequence', 'balance', 'route'][[3, 11, 17, 20].indexOf(item.index)], seed = item.worldId, random = seeded(seed * 97 + item.index)
  if (mode === 'circuit') {
    const size = seed ? 4 : 3
    const routes = [[0, 1, 4, 3, 6, 7, 8], [0, 4, 8, 9, 5, 6, 10, 14, 15], [0, 1, 5, 4, 8, 12, 13, 9, 10, 6, 7, 11, 15], [0, 4, 5, 1, 2, 6, 10, 9, 13, 14, 15]]
    const route = routes[seed], solution = Array.from({ length: size * size }, () => [3, 5, 6, 9, 10, 12][Math.floor(random() * 6)])
    route.forEach((cell, index) => {
      let mask = index === 0 ? 8 : 0
      for (const next of [route[index - 1], route[index + 1]]) if (next !== undefined) mask |= next === cell - size ? 1 : next === cell + 1 ? 2 : next === cell + size ? 4 : 8
      if (index === route.length - 1) mask |= 2
      solution[cell] = mask
    })
    return { mode, size, source: 0, exit: size * size - 1, relays: [route[Math.floor(route.length / 3)], route[Math.floor(route.length * 2 / 3)]], solution, question: '두 중계기를 모두 통과해 전원과 수신부를 연결하라.', hint: '금빛 중계기 두 곳이 같은 전력망에 포함되어야 한다. 빈 곳으로 이어진 선은 전력이 끊긴다.', tiles: solution.map((mask) => ({ mask, turns: 1 + Math.floor(random() * 3) })) }
  }
  if (mode === 'sequence') {
    const playback = Array.from({ length: 6 + seed }, (_, i) => (Math.floor(random() * 4) + i + seed) % 4)
    return { mode, question: seed === 2 ? '수신한 신호를 거꾸로 재현하라.' : '기록된 신호의 순서를 재현하라.', hint: seed === 2 ? '마지막 문양부터 첫 문양까지 역순으로 입력한다.' : '관측 신호를 재생한 뒤 같은 순서로 입력한다.', playback, sequence: seed === 2 ? [...playback].reverse() : playback, symbols: ['◇', '△', '○', '▣'] }
  }
  if (mode === 'balance') {
    const weights = Array.from({ length: 8 }, (_, i) => 4 + i * 5 + Math.floor(random() * 4)), requiredCount = seed === 3 ? 4 : 3
    const groups = new Map()
    for (let mask = 1; mask < 256; mask++) {
      const indices = weights.map((_, i) => i).filter((i) => mask & (1 << i))
      if (indices.length !== requiredCount) continue
      const sum = indices.reduce((n, i) => n + weights[i], 0)
      groups.set(sum, [...(groups.get(sum) || []), indices])
    }
    const unique = [...groups].filter(([, values]) => values.length === 1), [target, values] = unique[(seed * 3 + 2) % unique.length]
    return { mode, weights, requiredCount, target, solutionIndices: values[0], question: `부품을 정확히 ${requiredCount}개 사용해 목표 출력에 맞춰라.`, hint: '부품 수와 출력의 합을 모두 맞춰야 한다. 큰 부품부터 넣는 방법만으로는 해결되지 않는다.' }
  }
  const size = seed < 2 ? 4 : 5
  const routes = [[0, 4, 5, 9, 8, 12, 13, 14, 10, 11, 15], [0, 1, 2, 6, 5, 9, 13, 14, 15], [0, 5, 6, 1, 2, 3, 8, 13, 12, 17, 16, 21, 22, 23, 24], [0, 1, 6, 5, 10, 15, 16, 11, 12, 13, 18, 19, 24]]
  const solution = routes[seed], relays = [solution[3], solution[solution.length - 4]]
  return { mode, size, start: 0, exit: size * size - 1, relays, maxSteps: solution.length, solution, blocked: Array.from({ length: size * size }, (_, i) => i).filter((i) => !solution.includes(i) && i % 3 === seed % 3), question: `중계기 1 → 2 순서로 연결하라. 이동 에너지는 ${solution.length - 1}칸이다.`, hint: '중계기의 순서와 에너지 제한이 모두 중요하다. 현재 칸을 누르면 한 칸 되돌린다.' }
}

export function missionChallenge(item, step, final = false) {
  const seed = item.worldId * 17 + item.index + step * 7, codes = item.targets.map((target) => target.code)
  if (final) {
    const sorted = codes.map((value, i) => ({ value, i })).sort((a, b) => a.value - b.value).map(({ i }) => i + 1)
    const orders = [sorted, [...sorted].reverse(), [sorted[1], sorted[0], sorted[2]], [sorted[2], sorted[0], sorted[1]]]
    const ordered = orders[item.worldId].join(' → ')
    const choices = [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]].map((order) => order.join(' → '))
    const offset = (seed + 1) % choices.length, shuffled = [...choices.slice(offset), ...choices.slice(0, offset)]
    return { mode: 'choice', question: ['관측값이 작은 지점부터 큰 지점 순으로 보고하라.', '관측값이 큰 지점부터 작은 지점 순으로 보고하라.', '관측값이 중간인 지점 → 가장 작은 지점 → 가장 큰 지점 순으로 보고하라.', '관측값이 가장 큰 지점 → 가장 작은 지점 → 중간인 지점 순으로 보고하라.'][item.worldId], notes: codes.map((value, i) => `${i + 1}번 지점: ${value}`).join(' · '), choices: shuffled, correct: shuffled.indexOf(ordered) }
  }
  if (item.missionMode === 'relay') return { mode: 'timing', question: '신호가 푸른 안정 구간 안에 있을 때 동기화하라.', center: 28 + seed % 45, width: 24 - item.worldId * 2, speed: .28 + item.worldId * .04 + step * .025 }
  const a = 4 + seed % 9, b = 2 + (seed * 3) % 7
  const rescue = item.missionMode === 'rescue'
  const answer = rescue ? [Math.max(1, Math.floor((a * 3 - b) / 2)), a + b, Math.ceil((a + b) / 3)][step] : [a * 2 + b, a * 3 - b, a * b][step]
  const question = rescue ? [
    `구조 전력 ${a * 3}, 예비 전력 ${b}. 대원 한 명당 전력 2가 필요하다. 안전하게 구조할 수 있는 최대 인원은?`,
    `침수 구간 통과에 ${a}초, 문을 여는 데 ${b}초가 필요하다. 다음 범람 전에 확보해야 할 최소 안전 시간은?`,
    `대원 ${a + b}명이 있다. 구조선 한 대에 3명씩 탈 수 있다. 전원을 옮길 최소 운항 횟수는?`,
  ][step] : [
    `관측기는 한 주기에 ${a}의 신호를 두 번 보내고 보조 신호 ${b}를 더한다. 이번 관측 총량은?`,
    `중계기 세 대의 출력이 각각 ${a}다. 손실 ${b}를 제외한 실제 수신 출력은?`,
    `수문 한 곳당 초당 ${a}의 물을 흘려보낸다. 수문 ${b}곳을 모두 열면 초당 유량은?`,
  ][step]
  const choices = [answer, answer + 2 + step, Math.max(0, answer - 2 - item.worldId)], correct = seed % 3
  ;[choices[0], choices[correct]] = [choices[correct], choices[0]]
  return { mode: 'choice', question, notes: `${item.targets[step].name} · 현장 기록값 ${codes[step]}`, choices: choices.map(String), correct }
}

export const rotateMask = (mask, turns = 1) => { let value = mask; for (let i = 0; i < turns; i++) value = ((value << 1) & 15) | (value >> 3); return value }
export function circuitConnected(tiles, puzzle = {}) {
  const size = puzzle.size || Math.sqrt(tiles.length), exit = puzzle.exit ?? tiles.length - 1, source = puzzle.source || 0
  if (!(tiles[source] & 8) || !(tiles[exit] & 2)) return false
  const seen = new Set([source]), queue = [source]
  const directions = [[1, -size, 4], [2, 1, 8], [4, size, 1], [8, -1, 2]]
  while (queue.length) {
    const index = queue.shift()
    for (const [bit, offset, opposite] of directions) {
      const next = index + offset
      if (!(tiles[index] & bit) || next < 0 || next >= tiles.length || (offset === 1 && index % size === size - 1) || (offset === -1 && index % size === 0) || !(tiles[next] & opposite) || seen.has(next)) continue
      seen.add(next); queue.push(next)
    }
  }
  return seen.has(exit) && (puzzle.relays || []).every((cell) => seen.has(cell))
}

export function routeValid(puzzle, path) {
  const size = puzzle.size || 4, relayOrder = puzzle.relays.map((cell) => path.indexOf(cell))
  return path[0] === puzzle.start && path.at(-1) === puzzle.exit && path.length <= (puzzle.maxSteps || size * size) && new Set(path).size === path.length && path.every((cell, i) => cell >= 0 && cell < size * size && !puzzle.blocked.includes(cell) && (i === 0 || Math.abs(cell % size - path[i - 1] % size) + Math.abs(Math.floor(cell / size) - Math.floor(path[i - 1] / size)) === 1)) && relayOrder.every((index, i) => index >= 0 && (i === 0 || index > relayOrder[i - 1]))
}
