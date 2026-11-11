/** 숫자 특공대: 렌더러와 분리된 순수 게임 규칙 (스테이지 생성, 진행, 저장). */
export const STAGE_COUNT = 20
export const MAX_COUNT = 999
export const TRACK_HALF = 5
export const ROW_GAP = 26
export const FIRST_ROW_Z = 34
export const SAVE_KEY = 'ian-number-squad-v1'
const LEADER_LIMIT = TRACK_HALF - 0.8

export const WORLDS = [
  { id: 'jungle', name: '공룡 정글', boss: '티라노 로봇' },
  { id: 'ocean', name: '산호 바다', boss: '대왕 문어' },
  { id: 'lava', name: '용암 화산', boss: '용암 골렘' },
  { id: 'space', name: '별빛 우주', boss: '우주 해적선' },
]

export const SKINS = [
  { id: 'basic', name: '하늘 특공대', cost: 0, suit: '#2f7bff', robot: '#ffd447', cape: '#ff4d5e' },
  { id: 'leaf', name: '숲 특공대', cost: 60, suit: '#1f9d55', robot: '#b8f25c', cape: '#ffb020' },
  { id: 'coral', name: '산호 특공대', cost: 120, suit: '#ff6f91', robot: '#7fe7ff', cape: '#ffffff' },
  { id: 'ember', name: '불꽃 특공대', cost: 200, suit: '#e8451e', robot: '#ffb347', cape: '#2b2d42' },
  { id: 'nebula', name: '은하 특공대', cost: 320, suit: '#7b4dff', robot: '#5ef2d0', cape: '#ff7ad9' },
  { id: 'gold', name: '황금 특공대', cost: 500, suit: '#f2b705', robot: '#fff3b0', cape: '#7b2cbf' },
]

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const int = (rng, min, max) => min + Math.floor(rng() * (max - min + 1))
const pick = (rng, list) => list[Math.floor(rng() * list.length)]
const shuffled = (rng, list) => {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** 특공대 인원은 항상 1명(이안) 이상, MAX_COUNT 이하로 유지된다. */
export function applyOp(op, count) {
  const next = op.kind === 'add' ? count + op.value
    : op.kind === 'sub' ? count - op.value
      : op.kind === 'mul' ? count * op.value
        : Math.ceil(count / op.value)
  return clamp(next, 1, MAX_COUNT)
}

export const opLabel = (op) => `${{ add: '+', sub: '−', mul: '×', div: '÷' }[op.kind]}${op.value}`
export const opIsGain = (op) => op.kind === 'add' || op.kind === 'mul'

export function stageConfig(stage, easy = true) {
  const s = clamp(Math.round(Number(stage) || 1), 1, STAGE_COUNT)
  return {
    stage: s,
    easy,
    world: Math.floor((s - 1) / 5),
    rows: 7 + Math.floor(s * 0.45),
    speed: (12 + s * 0.3) * (easy ? 0.82 : 1),
    addMax: 3 + Math.ceil(s * 1.2),
    subMax: s < 3 ? 0 : 2 + Math.floor(s * 0.8),
    mul: s < 5 ? [] : s < 9 ? [2] : [2, 3],
    div: s >= 8,
    mulLimit: s < 12 ? 2 : 3,
    bossRatio: easy ? 0.38 : 0.52,
    hazardLoss: 2 + Math.floor(s / 4),
    hazardSway: s >= 7 ? 1.6 : 0,
    quizTier: Math.min(3, Math.floor((s - 1) / 5)),
    quizBonus: 4 + Math.floor(s / 2),
  }
}

const ENGLISH = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']
const HANJA = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

function mathQuiz(tier, rng) {
  if (tier === 0) {
    const a = int(rng, 1, 8), b = int(rng, 1, 9 - a)
    return { prompt: `${a} + ${b}`, answer: a + b }
  }
  if (tier === 1) {
    if (rng() < 0.5) { const a = int(rng, 4, 12), b = int(rng, 2, 8); return { prompt: `${a} + ${b}`, answer: a + b } }
    const a = int(rng, 6, 15), b = int(rng, 1, a - 1)
    return { prompt: `${a} − ${b}`, answer: a - b }
  }
  if (tier === 2 && rng() < 0.4) {
    const a = int(rng, 11, 20), b = int(rng, 3, 10)
    return rng() < 0.5 ? { prompt: `${a} + ${b}`, answer: a + b } : { prompt: `${a} − ${b}`, answer: a - b }
  }
  const a = int(rng, 2, tier === 2 ? 5 : 9), b = int(rng, 2, 9)
  if (tier === 3 && rng() < 0.3) return { prompt: `${a * b} ÷ ${a}`, answer: b }
  return { prompt: `${a} × ${b}`, answer: a * b }
}

export function makeQuiz(tier, rng) {
  const roll = rng()
  let quiz
  if (tier >= 1 && roll < 0.22) {
    const answer = int(rng, 1, tier >= 3 ? 20 : 12)
    quiz = { kind: 'english', prompt: ENGLISH[answer], answer }
  } else if (tier >= 2 && roll < 0.4) {
    const answer = int(rng, 1, 10)
    quiz = { kind: 'hanja', prompt: HANJA[answer], answer }
  } else quiz = { kind: 'math', ...mathQuiz(tier, rng) }
  const wrong = shuffled(rng, [1, -1, 2, -2, 10].map((d) => quiz.answer + d).filter((value) => value >= 0)).slice(0, 2)
  return { ...quiz, choices: shuffled(rng, [quiz.answer, ...wrong]) }
}

function makeGate(cfg, best, mulUsed, allowLoss, rng) {
  const add = () => ({ kind: 'add', value: int(rng, 2, cfg.addMax) })
  const kinds = ['addadd']
  if (cfg.subMax) kinds.push('addsub')
  if (cfg.mul.length && mulUsed < cfg.mulLimit) kinds.push('addmul', 'addmul')
  if (cfg.div && allowLoss && best >= 8) kinds.push('subdiv')
  const kind = pick(rng, kinds)
  if (kind === 'addmul') {
    const factor = pick(rng, cfg.mul)
    if (best * factor <= MAX_COUNT) {
      // 곱하기와 더하기 결과가 비슷해지도록 만들어 직접 계산해 봐야 답이 보인다.
      const even = best * (factor - 1), spread = Math.max(2, Math.round(best * 0.4))
      let value = Math.max(1, even + int(rng, -spread, spread))
      if (value === even) value += 1
      return shuffled(rng, [{ kind: 'mul', value: factor }, { kind: 'add', value }])
    }
  }
  if (kind === 'subdiv') {
    const even = best - Math.ceil(best / 2)
    let value = clamp(even + int(rng, -3, 3), 1, best - 1)
    if (value === even) value = Math.max(1, value - 1)
    return shuffled(rng, [{ kind: 'div', value: 2 }, { kind: 'sub', value }])
  }
  if (kind === 'addsub') return shuffled(rng, [add(), { kind: 'sub', value: int(rng, 1, cfg.subMax) }])
  const first = add()
  let second = add()
  if (second.value === first.value) second = { kind: 'add', value: first.value + 1 }
  return [first, second]
}

/** 같은 seed는 항상 같은 코스를 만든다. best는 모든 문에서 가장 좋은 선택을 했을 때의 인원이다. */
export function createStage(stage, { easy = true, seed = 1 } = {}) {
  const cfg = stageConfig(stage, easy)
  const rng = mulberry32(seed * 7919 + cfg.stage * 104729)
  const rows = [], coins = []
  let best = 1, mulUsed = 0, lossRows = 0
  for (let i = 0; i < cfg.rows; i++) {
    const z = FIRST_ROW_Z + i * ROW_GAP
    const slot = i % 4
    let type = 'gate'
    if (i > 0 && i < cfg.rows - 1) {
      if (slot === 2) type = 'quiz'
      else if (slot === 3 && cfg.stage >= 2) type = best >= 6 && rng() < 0.5 ? 'enemy' : 'hazard'
    }
    if (type === 'gate') {
      // 둘 다 줄어드는 문은 코스마다 한 번만, 보스 직전에는 나오지 않는다.
      const options = makeGate(cfg, best, mulUsed, lossRows === 0 && i < cfg.rows - 1, rng)
      if (options.some((op) => op.kind === 'mul')) mulUsed += 1
      if (options.every((op) => !opIsGain(op))) lossRows += 1
      best = Math.max(...options.map((op) => applyOp(op, best)))
      rows.push({ type, z, options })
    } else if (type === 'quiz') {
      rows.push({ type, z, quiz: makeQuiz(cfg.quizTier, rng), bonus: cfg.quizBonus, penalty: 2 })
      best = clamp(best + cfg.quizBonus, 1, MAX_COUNT)
    } else if (type === 'enemy') {
      const value = Math.max(2, Math.round(best * (0.2 + rng() * 0.15)))
      rows.push({ type, z, value })
      best -= value
    } else {
      rows.push({ type, z, x: pick(rng, [-2.6, 0, 2.6]), half: 1.7, sway: cfg.hazardSway, phase: rng() * 6.28, loss: cfg.hazardLoss })
    }
    const lane = pick(rng, [-3, 0, 3])
    for (let j = 0; j < 5; j++) coins.push({ x: lane, z: z - ROW_GAP / 2 + (j - 2) * 1.7 })
  }
  const length = FIRST_ROW_Z + (cfg.rows - 1) * ROW_GAP + 30
  return { cfg, seed, rows, coins, best, bossHp: Math.max(2, Math.round(best * cfg.bossRatio)), length }
}

export const hazardX = (row, time) => row.x + (row.sway ? Math.sin(time * 1.5 + row.phase) * row.sway : 0)
export const gateIndex = (x) => (x < 0 ? 0 : 1)
export const quizIndex = (x) => (x < -TRACK_HALF / 3 ? 0 : x > TRACK_HALF / 3 ? 2 : 1)
export const starsFor = (count, best) => (count >= best * 0.85 ? 3 : count >= best * 0.6 ? 2 : 1)

// 60fps 루프에서 매 프레임 호출되므로 run 객체는 이 모듈 안에서만 직접 갱신한다.
export function createRun(stage) {
  return {
    stage, time: 0, z: 0, x: 0, speedK: 0, braking: false, count: 1, coins: 0, combo: 0, fever: false, picks: 0, goodPicks: 0,
    rowIndex: 0, coinIndex: 0, taken: new Uint8Array(stage.coins.length), phase: 'run',
    bossTime: 0, fired: 0, fireAcc: 0, toFire: 0, win: false, endWait: 0, result: null, events: [],
  }
}

function judge(run, good) {
  run.picks += 1
  if (good) { run.goodPicks += 1; run.combo += 1 } else run.combo = 0
  run.fever = run.combo >= 3
}

function resolveRow(run, row, index) {
  const before = run.count
  if (row.type === 'gate') {
    const results = row.options.map((op) => applyOp(op, before))
    const choice = gateIndex(run.x)
    const good = results[choice] === Math.max(...results)
    run.count = results[choice]
    judge(run, good)
    run.events.push({ type: 'gate', row: index, choice, good, before, after: run.count, label: opLabel(row.options[choice]) })
  } else if (row.type === 'quiz') {
    const choice = quizIndex(run.x)
    const good = row.quiz.choices[choice] === row.quiz.answer
    run.count = clamp(before + (good ? row.bonus : -row.penalty), 1, MAX_COUNT)
    judge(run, good)
    run.events.push({ type: 'quiz', row: index, choice, good, before, after: run.count, prompt: row.quiz.prompt, answer: row.quiz.answer })
  } else if (row.type === 'enemy') {
    run.count = Math.max(1, before - row.value)
    run.events.push({ type: 'enemy', row: index, before, after: run.count, value: row.value })
  } else {
    const hit = Math.abs(run.x - hazardX(row, run.time)) < row.half + 0.6
    if (hit) { run.count = Math.max(1, before - row.loss); run.combo = 0; run.fever = false }
    run.events.push({ type: 'hazard', row: index, hit, before, after: run.count })
  }
}

function finish(run) {
  const { stage } = run
  const stars = run.win ? starsFor(run.count, stage.best) : 0
  const leftover = Math.max(0, run.count - stage.bossHp)
  const coins = run.win ? run.coins + stars * 5 + Math.min(30, leftover) : Math.floor(run.coins / 2)
  run.result = { win: run.win, stars, coins, count: run.count, best: stage.best, bossHp: stage.bossHp, picks: run.picks, goodPicks: run.goodPicks }
  run.phase = run.win ? 'won' : 'lost'
  run.events.push({ type: 'end', ...run.result })
}

export const BRAKE_SPEED = 0.35

/** brake를 누르고 있는 동안에는 천천히 달려 문 앞에서 계산할 시간을 번다. */
export function stepRun(run, dt, targetX, brake = false) {
  const { stage } = run
  run.time += dt
  if (run.phase === 'run') {
    run.x += (clamp(targetX, -LEADER_LIMIT, LEADER_LIMIT) - run.x) * Math.min(1, dt * 14)
    const next = stage.rows[run.rowIndex]
    const thinking = stage.cfg.easy && next && next.type !== 'enemy' && next.z - run.z < 11
    run.braking = brake
    run.speedK += ((brake ? BRAKE_SPEED : thinking ? 0.6 : 1) - run.speedK) * Math.min(1, dt * (brake ? 7 : 4))
    run.z += stage.cfg.speed * run.speedK * dt
    while (run.coinIndex < stage.coins.length && stage.coins[run.coinIndex].z <= run.z + 0.4) {
      const index = run.coinIndex++
      if (Math.abs(stage.coins[index].x - run.x) < 1.4) {
        run.taken[index] = 1
        run.coins += run.fever ? 2 : 1
        run.events.push({ type: 'coin', index, total: run.coins })
      }
    }
    while (run.rowIndex < stage.rows.length && stage.rows[run.rowIndex].z <= run.z) {
      resolveRow(run, stage.rows[run.rowIndex], run.rowIndex)
      run.rowIndex += 1
    }
    if (run.z >= stage.length) {
      run.z = stage.length
      run.phase = 'boss'
      run.win = run.count >= stage.bossHp
      run.toFire = Math.min(run.count, stage.bossHp)
      run.events.push({ type: 'boss', hp: stage.bossHp, count: run.count })
    }
  } else if (run.phase === 'boss') {
    run.bossTime += dt
    if (run.bossTime < 1.3) return run
    if (run.fired < run.toFire) {
      run.fireAcc += Math.max(5, run.toFire / 3.2) * dt
      while (run.fireAcc >= 1 && run.fired < run.toFire) {
        run.fireAcc -= 1
        run.fired += 1
        run.events.push({ type: 'shot', fired: run.fired, hpLeft: stage.bossHp - run.fired, squadLeft: run.count - run.fired })
      }
    } else {
      run.endWait += dt
      if (run.endWait > 1.1) finish(run)
    }
  }
  return run
}

export const defaultProgress = () => ({ v: 1, stars: Array(STAGE_COUNT).fill(0), coins: 0, skins: ['basic'], skin: 'basic', easy: true, sound: true })

export function readProgress(storage) {
  const base = defaultProgress()
  try {
    const data = JSON.parse(storage.getItem(SAVE_KEY))
    if (!data || typeof data !== 'object') return base
    const skins = SKINS.map((skin) => skin.id).filter((id) => id === 'basic' || (Array.isArray(data.skins) && data.skins.includes(id)))
    return {
      ...base,
      stars: base.stars.map((_, i) => clamp(Math.floor(Number(data.stars?.[i]) || 0), 0, 3)),
      coins: clamp(Math.floor(Number(data.coins) || 0), 0, 999999),
      skins,
      skin: skins.includes(data.skin) ? data.skin : 'basic',
      easy: data.easy !== false,
      sound: data.sound !== false,
    }
  } catch { return base }
}

export function saveProgress(storage, progress) {
  try { storage.setItem(SAVE_KEY, JSON.stringify(progress)) } catch { /* 저장 없이도 계속 놀 수 있다. */ }
}

export const unlockedStage = (progress) => Math.min(STAGE_COUNT, progress.stars.filter((value) => value > 0).length + 1)

export function recordResult(progress, stage, result) {
  return {
    ...progress,
    coins: progress.coins + result.coins,
    stars: progress.stars.map((value, i) => (i === stage - 1 ? Math.max(value, result.stars) : value)),
  }
}

export function buySkin(progress, id) {
  const skin = SKINS.find((item) => item.id === id)
  if (!skin) return progress
  if (progress.skins.includes(id)) return { ...progress, skin: id }
  if (progress.coins < skin.cost) return progress
  return { ...progress, coins: progress.coins - skin.cost, skins: [...progress.skins, id], skin: id }
}
