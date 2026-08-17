import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useGameScale } from '../hooks/useGameScale'
import { useTouchLock } from '../hooks/useTouchLock'
import { GRADE_8, GRADE_7, MAGIC_HANJA } from '../data/magicHanjaData'
import './MagicHanja.css'

const GAME_W = 360
const HUD_H = 46
const CANVAS_H = 226
const Q_H = 84
const OPT_H = 168
const STAGE_H = HUD_H + CANVAS_H + Q_H + OPT_H
const START_LIVES = 5
const PARTICLE_CAP = 90

const ELEMENT_COLORS = {
  火: '#F0553A', 水: '#3B9EDB', 木: '#46B36B', 金: '#E0B341', 土: '#B5793A',
  日: '#FF9F1C', 月: '#C7CEDB', 山: '#6BA368', 川: '#4FA8D8', 天: '#5BB4E0',
  心: '#F1948A', 江: '#3B9EDB', 海: '#2E86C1', 花: '#EC7FB0', 草: '#52BE80',
  電: '#F4D03F', 林: '#46B36B', 靑: '#5499C7', 白: '#E5E8E8', 力: '#EC7063',
}
const PALETTE = ['#8B5CF6', '#E06C9F', '#5DADE2', '#48C9B0', '#F5B041', '#EC7063', '#52BE80', '#AF7AC5', '#5499C7', '#F39C12']
function hanjaColor(c) { return ELEMENT_COLORS[c] || PALETTE[c.charCodeAt(0) % PALETTE.length] }
function toObj([c, m, s]) { return { c, m, s, col: hanjaColor(c) } }

const MAGIC_VOLUMES_BY_CHAR = MAGIC_HANJA.reduce((map, [char, , , volume]) => {
  const volumes = map.get(char) || []
  map.set(char, [...volumes, volume])
  return map
}, new Map())

const GRADE_BY_CHAR = new Map([
  ...GRADE_8.map(([char]) => [char, '8급']),
  ...GRADE_7.map(([char]) => [char, '7급']),
])

const GRADES = [
  { name: '8급', list: GRADE_8.map((item) => ({ ...toObj(item), source: 'grade', sourceLabel: '8급 배정 한자' })) },
  { name: '7급', list: GRADE_7.map((item) => ({ ...toObj(item), source: 'grade', sourceLabel: '7급 신습 한자' })) },
]
const MAGIC = MAGIC_HANJA.map(([c, m, s, volume]) => ({
  ...toObj([c, m, s]), source: 'magic', sourceLabel: `마법천자문 ${volume}권`, volume,
}))
const ALL = [...GRADES.flatMap((g) => g.list), ...MAGIC]

function sourceBadges(char) {
  const badges = []
  const grade = GRADE_BY_CHAR.get(char)
  if (grade) badges.push({ kind: 'grade', label: grade === '7급' ? '7급 신습' : grade })
  for (const volume of MAGIC_VOLUMES_BY_CHAR.get(char) || []) {
    badges.push({ kind: 'magic', label: `마법천자문 ${volume}권` })
  }
  return badges
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function makeQuestion(grade, learnedSet, magicLearnedSet) {
  const magicQuestion = Math.random() < 0.45
  const sourceList = magicQuestion ? MAGIC : grade.list
  const sourceLearned = magicQuestion ? magicLearnedSet : learnedSet
  const unlearned = sourceList.filter((h) => !sourceLearned.has(h.c))
  const pool = unlearned.length ? unlearned : sourceList
  const data = pool[Math.floor(Math.random() * pool.length)]
  const mode = Math.floor(Math.random() * 3)
  let promptText, sub, correct, key, big
  if (mode === 0) { promptText = data.c; sub = '이 한자의 뜻은?'; correct = data.m; key = 'm'; big = true }
  else if (mode === 1) { promptText = data.c; sub = '이 한자의 음(소리)은?'; correct = data.s; key = 's'; big = true }
  else { promptText = `${data.m} ${data.s}`; sub = '알맞은 한자는?'; correct = data.c; key = 'c'; big = false }

  const set = new Set([correct])
  const opts = [correct]
  let guard = 0
  while (opts.length < 4 && guard++ < 300) {
    const v = ALL[Math.floor(Math.random() * ALL.length)][key]
    if (!set.has(v)) { set.add(v); opts.push(v) }
  }
  shuffle(opts)
  return {
    char: data.c, meaning: data.m, sound: data.s, color: data.col,
    source: data.source, sourceLabel: data.sourceLabel, sourceBadges: sourceBadges(data.c),
    promptText, promptBig: big, sub,
    options: opts, correctIdx: opts.indexOf(correct), optBig: mode === 2,
    answered: false, pickedIdx: -1,
  }
}

// ── 악당 로스터 ─────────────────────────────────────
// 이름뿐인 색상 변형이 되지 않도록 각 악당에게 성격, 말투, 실루엣을 부여한다.
const HONSE = {
  key: 'honse', name: '혼세마왕', title: '기억을 잃은 혼돈의 전사', color: '#7A3AB0', boss: true,
  look: { type: 'warrior', accent: '#F3C969', skin: '#B66E55', hair: '#20202B', eyes: '#FFE169', weapon: 'spear', crown: 'horns', sigil: '混', aura: 'flame' },
  lines: { intro: '내 안의 혼돈을… 네가 잠재울 수 있겠느냐?', hit: '크윽… 이 한자는 기억난다!', attack: '망설이면 혼돈에 삼켜진다!' },
}
const ROSTER = [
  {
    key: 'heuksim', name: '흑심마왕', title: '마음을 훔치는 책략가', color: '#532B72',
    look: { type: 'mage', accent: '#E45A84', skin: '#A96978', hair: '#17131E', eyes: '#FF88B5', weapon: 'orb', crown: 'spikes', sigil: '心', aura: 'mist' },
    lines: { intro: '네 마음속 작은 욕심, 내가 전부 키워 주마.', hit: '내 속셈을 읽었다고?', attack: '마음이 흔들리는구나!' },
  },
  {
    key: 'jiltu', name: '질투마녀', title: '거울 숲의 마녀', color: '#176B4A',
    look: { type: 'witch', accent: '#B9F06A', skin: '#D49A78', hair: '#143D32', eyes: '#E8FF8B', weapon: 'mirror', crown: 'hat', sigil: '妬', aura: 'spark' },
    lines: { intro: '흥, 네가 나보다 한자를 잘 안다고?', hit: '그 반짝이는 지식… 얄미워!', attack: '틀린 네 모습이나 비춰 봐!' },
  },
  {
    key: 'tarak', name: '타락마왕', title: '빛을 버린 기사', color: '#57452A',
    look: { type: 'warrior', accent: '#D7A84B', skin: '#8E675B', hair: '#211E25', eyes: '#FFB447', weapon: 'sword', crown: 'helm', sigil: '墮', aura: 'mist' },
    lines: { intro: '나도 한때는 빛을 지키던 자였다.', hit: '아직… 빛이 남아 있었나.', attack: '너도 어둠으로 내려와라!' },
  },
  {
    key: 'tamyok', name: '탐욕마왕', title: '황금 금고의 주인', color: '#9A5A12',
    look: { type: 'brute', accent: '#FFD34E', skin: '#BC7350', hair: '#4A2818', eyes: '#FFF08A', weapon: 'coins', crown: 'coin', sigil: '欲', aura: 'spark' },
    lines: { intro: '한자도 보물도 전부 내 것이다!', hit: '내 황금보다 귀한 답이라고?', attack: '네 점수까지 몽땅 내놔!' },
  },
  {
    key: 'bunno', name: '분노군단장', title: '화염 갑옷의 장군', color: '#A62920',
    look: { type: 'brute', accent: '#FF8B35', skin: '#A94E3D', hair: '#521A15', eyes: '#FFF3A0', weapon: 'axe', crown: 'horns', sigil: '怒', aura: 'flame' },
    lines: { intro: '내 불길은 틀린 답을 먹고 더 커진다!', hit: '좋아! 더 뜨겁게 덤벼라!', attack: '으아아! 분노의 일격!' },
  },
  {
    key: 'nate', name: '나태군단장', title: '잠구름의 몽상가', color: '#536174',
    look: { type: 'mage', accent: '#BFD5EE', skin: '#A98578', hair: '#354052', eyes: '#D9F3FF', weapon: 'pillow', crown: 'nightcap', sigil: '眠', aura: 'cloud' },
    lines: { intro: '그냥… 모른다고 하고 같이 자면 안 돼?', hit: '아야… 잠이 다 깼잖아.', attack: '하암… 꿈속으로 보내 줄게.' },
  },
  {
    key: 'gyoman', name: '교만지왕', title: '공작 깃의 폭군', color: '#8A3E12',
    look: { type: 'king', accent: '#4ED4B7', skin: '#C98763', hair: '#442218', eyes: '#FFF2A1', weapon: 'scepter', crown: 'peacock', sigil: '慢', aura: 'spark' },
    lines: { intro: '감히 나와 지혜를 겨루겠다고?', hit: '우연히 맞힌 것뿐이다!', attack: '왕 앞에 고개를 숙여라!' },
  },
  {
    key: 'janhok', name: '잔혹마왕', title: '붉은 낫의 심판자', color: '#731D22',
    look: { type: 'reaper', accent: '#FF5D57', skin: '#8D5657', hair: '#1F171A', eyes: '#FFB5A7', weapon: 'scythe', crown: 'hood', sigil: '酷', aura: 'mist' },
    lines: { intro: '한 번의 실수도 자비는 없다.', hit: '제법 날카로운 한자로군.', attack: '그 오답, 내가 거두어 주지!' },
  },
  {
    key: 'bulmyeol', name: '불멸대왕', title: '얼어붙은 시간의 왕', color: '#367FAB',
    look: { type: 'king', accent: '#C9F5FF', skin: '#8CC4D6', hair: '#E8FAFF', eyes: '#FFFFFF', weapon: 'staff', crown: 'ice', sigil: '永', aura: 'ice' },
    lines: { intro: '시간은 멎고, 나만 영원하리라.', hit: '얼음에… 금이 갔다.', attack: '영원한 겨울에 갇혀라!' },
  },
  {
    key: 'oman', name: '오만군단장', title: '보랏빛 부채의 귀족', color: '#633477',
    look: { type: 'witch', accent: '#F1A7E2', skin: '#D39A86', hair: '#291933', eyes: '#FFD5F5', weapon: 'fan', crown: 'tiara', sigil: '傲', aura: 'spark' },
    lines: { intro: '내 품격에 어울리는 답을 골라 보렴.', hit: '어머, 제법이네? 아주 조금.', attack: '무례한 오답은 벌을 받아야지.' },
  },
  {
    key: 'amheungnoya', name: '암흑노야', title: '천 년 밤의 현자', color: '#303A49',
    look: { type: 'elder', accent: '#8D7ADB', skin: '#89766F', hair: '#C2BFCA', eyes: '#BFAEFF', weapon: 'staff', crown: 'hood', sigil: '闇', aura: 'mist' },
    lines: { intro: '오래된 글자에는 오래된 저주가 깃들지.', hit: '허허… 그 뜻을 아는 아이로구나.', attack: '밤의 지혜를 얕보지 마라.' },
  },
  {
    key: 'heukryong', name: '흑룡', title: '먹구름을 삼킨 용', color: '#182531',
    look: { type: 'dragon', accent: '#48C7D9', skin: '#263A48', hair: '#101820', eyes: '#A8F4FF', weapon: 'claw', crown: 'horns', sigil: '龍', aura: 'storm' },
    lines: { intro: '크르르… 글자의 힘을 증명해 보아라.', hit: '이 비늘을 뚫다니!', attack: '검은 번개를 받아라!' },
  },
  {
    key: 'daemawang', name: '대마왕', title: '마계 군단의 지배자', color: '#432052',
    look: { type: 'king', accent: '#FF6B6B', skin: '#8D5268', hair: '#160F1C', eyes: '#FFD166', weapon: 'scepter', crown: 'crown', sigil: '魔', aura: 'flame' },
    lines: { intro: '여기까지 온 용기는 칭찬해 주마.', hit: '내 왕관을 노리는 것이냐!', attack: '마계의 문이 열릴 것이다!' },
  },
  {
    key: 'geomeun', name: '검은마왕', title: '말없는 월식의 검객', color: '#1D2932',
    look: { type: 'warrior', accent: '#C8D0DA', skin: '#6F7880', hair: '#0C1116', eyes: '#FF4F64', weapon: 'sword', crown: 'helm', sigil: '黑', aura: 'mist' },
    lines: { intro: '……답으로 말해라.', hit: '좋은 일격이다.', attack: '빈틈.' },
  },
  {
    key: 'amheuksangje', name: '암흑상제', title: '별 없는 하늘의 제왕', color: '#11141B',
    look: { type: 'emperor', accent: '#B88CFF', skin: '#7A687C', hair: '#0A0B10', eyes: '#FFFFFF', weapon: 'orb', crown: 'halo', sigil: '帝', aura: 'void' },
    lines: { intro: '모든 글자가 사라진 세상을 보여 주마.', hit: '작은 빛이 어둠을 가르는군.', attack: '지식도 기억도, 무로 돌아가라.' },
  },
]
function villainForStage(stage) {
  if (stage % 3 === 0) return HONSE
  const idx = (stage - 1) - Math.floor((stage - 1) / 3)
  return ROSTER[idx % ROSTER.length]
}
function makeEnemy(stage) {
  const v = villainForStage(stage)
  const maxHp = Math.min(v.boss ? 12 : 8, (v.boss ? 5 : 3) + Math.floor(stage / 2))
  return {
    key: v.key, name: v.name, title: v.title, color: v.color, look: { ...v.look, color: v.color }, lines: v.lines, boss: !!v.boss,
    hp: maxHp, maxHp, x: 278, y: 138, dying: false, dieAt: 0, shakeUntil: 0, attackUntil: 0,
  }
}

// ── 스프라이트 로더 (있으면 이미지, 없으면 캔버스 폴백) ──
// 이미지를 직접 넣으려면: public/mh/<key>.png (배경 투명 PNG 권장)
const sprites = {}
function getSprite(key) {
  let s = sprites[key]
  if (!s) {
    const sources = [
      `${import.meta.env.BASE_URL}mh/sprites/${key}.webp`,
      `${import.meta.env.BASE_URL}mh/${key}.png`,
    ]
    s = { img: new Image(), ready: false, sourceIdx: 0 }
    s.img.onload = () => { s.ready = true }
    s.img.onerror = () => {
      s.ready = false
      s.sourceIdx += 1
      if (s.sourceIdx < sources.length) s.img.src = sources[s.sourceIdx]
    }
    s.img.src = sources[0]
    sprites[key] = s
  }
  return s
}
function drawSprite(ctx, img, cx, baselineY, targetH, maxW = Infinity) {
  let h = targetH
  let w = h * (img.width / img.height)
  if (w > maxW) { h *= maxW / w; w = maxW }
  ctx.drawImage(img, cx - w / 2, baselineY - h, w, h)
}

// ── 학습 진행 저장/복원 ────────────────────────────
function loadLearned() {
  const obj = {}
  for (const g of GRADES) {
    try { obj[g.name] = new Set(JSON.parse(localStorage.getItem('mh-learned-' + g.name) || '[]')) }
    catch { obj[g.name] = new Set() }
  }
  return obj
}
function loadMagicLearned() {
  try { return new Set(JSON.parse(localStorage.getItem('mh-learned-magic') || '[]')) }
  catch { return new Set() }
}
function saveLearned(name, set) {
  try { localStorage.setItem('mh-learned-' + name, JSON.stringify([...set])) } catch { /* ignore */ }
}
function deriveGradeIdx(learned) {
  for (let i = 0; i < GRADES.length; i++) {
    if (learned[GRADES[i].name].size < GRADES[i].list.length) return i
  }
  return GRADES.length - 1
}

// ── 효과음 (Web Audio 합성, 외부 파일 없음) ───────────
function beep(ac, { freq = 440, to, dur = 0.12, type = 'square', vol = 0.2, delay = 0 }) {
  const t0 = ac.currentTime + delay
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur)
  gain.gain.setValueAtTime(vol, t0)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(gain); gain.connect(ac.destination)
  osc.start(t0); osc.stop(t0 + dur + 0.02)
}
const SFX = {
  correct: (ac) => [660, 880, 1175].forEach((f, i) => beep(ac, { freq: f, dur: 0.12, type: 'square', vol: 0.18, delay: i * 0.07 })),
  wrong: (ac) => beep(ac, { freq: 300, to: 110, dur: 0.32, type: 'sawtooth', vol: 0.22 }),
  cast: (ac) => beep(ac, { freq: 480, to: 1150, dur: 0.24, type: 'sine', vol: 0.2 }),
  hit: (ac) => beep(ac, { freq: 420, to: 150, dur: 0.13, type: 'triangle', vol: 0.22 }),
  hurt: (ac) => beep(ac, { freq: 200, to: 80, dur: 0.22, type: 'square', vol: 0.22 }),
  defeat: (ac) => [523, 659, 784, 1047].forEach((f, i) => beep(ac, { freq: f, dur: 0.14, type: 'square', vol: 0.2, delay: i * 0.09 })),
  gradeup: (ac) => [523, 659, 784, 1047, 1319].forEach((f, i) => beep(ac, { freq: f, dur: 0.16, type: 'square', vol: 0.22, delay: i * 0.1 })),
  over: (ac) => [440, 330, 247, 165].forEach((f, i) => beep(ac, { freq: f, dur: 0.3, type: 'sawtooth', vol: 0.2, delay: i * 0.16 })),
}

function MagicHanja() {
  const scale = useGameScale(GAME_W, STAGE_H, { reservedH: 84, maxScale: 1.25 })
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  useTouchLock(containerRef)

  const [phase, setPhase] = useState('menu')
  const [hud, setHud] = useState({ lives: START_LIVES, score: 0, combo: 0, stage: 1, gradeName: '8급', gLearned: 0, gTotal: 50, enemy: '', enemyTitle: '', boss: false })
  const [q, setQ] = useState(null)
  const [best, setBest] = useState(() => {
    try { return Number(localStorage.getItem('magic-hanja-best')) || 0 } catch { return 0 }
  })
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem('mh-muted') === '1' } catch { return false }
  })
  const [menuProgress, setMenuProgress] = useState(() => {
    const l = loadLearned(); const magic = loadMagicLearned(); const gi = deriveGradeIdx(l)
    return {
      gradeName: GRADES[gi].name, learned: l[GRADES[gi].name].size, total: GRADES[gi].list.length,
      magicLearned: magic.size, magicTotal: MAGIC.length,
    }
  })

  const G = useRef(null)
  if (G.current === null) G.current = fresh()
  const audioRef = useRef(null)
  const mutedRef = useRef(muted)

  useEffect(() => { mutedRef.current = muted }, [muted])
  useEffect(() => {
    getSprite('sonogong')
    getSprite(villainForStage(1).key)
  }, [])

  const play = useCallback((name) => {
    if (mutedRef.current) return
    const ac = audioRef.current
    if (!ac) return
    try { if (ac.state === 'suspended') ac.resume(); SFX[name](ac) } catch { /* ignore */ }
  }, [])

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m
      try { localStorage.setItem('mh-muted', next ? '1' : '0') } catch { /* ignore */ }
      return next
    })
  }, [])

  const syncHud = useCallback(() => {
    const g = G.current
    const grade = GRADES[g.gradeIdx]
    setHud({
      lives: g.lives, score: g.score, combo: g.combo, stage: g.stage,
      gradeName: grade.name, gLearned: g.learnedByGrade[grade.name].size, gTotal: grade.list.length,
      enemy: g.enemy.name, enemyTitle: g.enemy.title, boss: g.enemy.boss,
    })
  }, [])

  // ── 게임 루프 (캔버스 연출) ──
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = GAME_W * dpr
    canvas.height = CANVAS_H * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    let raf = 0
    let last = performance.now()

    const burst = (x, y, color, n, opt = {}) => {
      const g = G.current
      for (let i = 0; i < n; i++) {
        if (g.parts.length >= PARTICLE_CAP) break
        const a = Math.random() * Math.PI * 2
        const sp = (opt.spread || 80) * (0.4 + Math.random() * 0.6)
        g.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opt.up || 20), life: opt.life || 0.5, max: opt.life || 0.5, size: opt.size || 3, color })
      }
    }

    const update = (dt, now) => {
      const g = G.current
      if (g.proj) {
        g.proj.t += dt * 2.6
        if (g.proj.t >= 1) {
          const e = g.enemy
          burst(e.x, e.y, g.proj.color, 16, { spread: 130, life: 0.55, size: 4 })
          play('hit')
          e.hp -= 1
          e.shakeUntil = now + 280
          g.speech = { speaker: 'enemy', text: e.lines.hit, until: now + 1500 }
          if (e.hp <= 0 && !e.dying) {
            e.dying = true; e.dieAt = now
            burst(e.x, e.y, '#FFE08A', 22, { spread: 150, life: 0.7, size: 5 })
            play('defeat')
          }
          g.proj = null
        }
      }
      if (g.proj2) {
        g.proj2.t += dt * 2.4
        if (g.proj2.t >= 1) {
          burst(g.hero.x, g.hero.y - 6, '#7B4BA8', 14, { spread: 110, life: 0.5 })
          g.heroHurtUntil = now + 360
          play('hurt')
          g.proj2 = null
        }
      }
      for (const p of g.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 140 * dt }
      if (g.parts.some((p) => p.life <= 0)) g.parts = g.parts.filter((p) => p.life > 0)
    }

    const drawBg = (now) => {
      const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H)
      sky.addColorStop(0, '#17152F'); sky.addColorStop(0.6, '#39305B'); sky.addColorStop(1, '#5B3853')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, GAME_W, CANVAS_H)
      // 먼 산과 마왕성 실루엣
      ctx.fillStyle = 'rgba(18,14,38,0.72)'
      ctx.beginPath(); ctx.moveTo(0, 146); ctx.lineTo(42, 104); ctx.lineTo(77, 137); ctx.lineTo(126, 84); ctx.lineTo(176, 143); ctx.lineTo(233, 91); ctx.lineTo(281, 137); ctx.lineTo(326, 102); ctx.lineTo(360, 138); ctx.lineTo(360, 190); ctx.lineTo(0, 190); ctx.closePath(); ctx.fill()
      ctx.fillStyle = 'rgba(10,8,25,0.76)'
      ctx.fillRect(250, 69, 48, 84); ctx.fillRect(258, 51, 11, 28); ctx.fillRect(281, 45, 10, 34)
      tri(ctx, 256, 53, 264, 36, 272, 53, 'rgba(10,8,25,0.76)')
      tri(ctx, 278, 47, 286, 28, 294, 47, 'rgba(10,8,25,0.76)')
      const moonGlow = 0.07 + Math.sin(now / 900) * 0.02
      fillc(ctx, 48, 45, 23, `rgba(255,224,160,${moonGlow})`)
      fillc(ctx, 48, 45, 12, 'rgba(255,228,168,0.76)')
      // 봉인진이 새겨진 전장
      const floor = ctx.createLinearGradient(0, 168, 0, CANVAS_H)
      floor.addColorStop(0, 'rgba(42,25,55,0.9)'); floor.addColorStop(1, '#171225')
      ctx.fillStyle = floor; ctx.fillRect(0, 166, GAME_W, CANVAS_H - 166)
      ctx.strokeStyle = 'rgba(255,205,112,0.09)'; ctx.lineWidth = 1
      for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.ellipse(GAME_W / 2, 213, i * 51, i * 11, 0, 0, Math.PI * 2); ctx.stroke() }
      ctx.beginPath(); ctx.moveTo(180, 166); ctx.lineTo(180, 226); ctx.moveTo(22, 196); ctx.lineTo(338, 196); ctx.stroke()
    }

    const draw = (now) => {
      const g = G.current
      drawBg(now)
      if (g.phase === 'play' || g.phase === 'over') {
        drawEnemy(ctx, g.enemy, now)
        const hb = g.heroHurtUntil > now ? Math.sin(now / 28) * 3 : 0
        const casting = g.castUntil > now
        const hsp = getSprite('sonogong')
        if (hsp.ready) {
          const heroBob = Math.sin(now / 330) * 1.6
          ctx.fillStyle = 'rgba(3,2,12,0.48)'; ctx.beginPath(); ctx.ellipse(g.hero.x + hb, g.hero.y + 46, 39, 9, 0, 0, Math.PI * 2); ctx.fill()
          ctx.save()
          ctx.translate(g.hero.x + hb, g.hero.y + 47 + heroBob)
          ctx.rotate(casting ? -0.025 : Math.sin(now / 650) * 0.008)
          drawSprite(ctx, hsp.img, 0, 0, casting ? 137 : 132, 154)
          ctx.restore()
          if (casting) drawMagicCircle(ctx, g.hero.x + hb + 57, g.hero.y - 23, now, g.castColor, g.castChar)
        } else {
          drawSonOhgong(ctx, g.hero.x + hb, g.hero.y, now, casting, g.castChar, g.castColor)
        }
        if (g.proj) {
          const p = g.proj
          const x = g.hero.x + 18 + (g.enemy.x - g.hero.x - 18) * p.t
          const y = g.hero.y - 12 + (g.enemy.y - g.hero.y + 12) * p.t - Math.sin(p.t * Math.PI) * 36
          ctx.globalAlpha = 0.5; fillc(ctx, x, y, 13, p.color); ctx.globalAlpha = 1
          fillc(ctx, x, y, 8, p.color)
          fillc(ctx, x, y, 4, '#fff')
        }
        if (g.proj2) {
          const p = g.proj2
          const x = g.enemy.x - 16 + (g.hero.x - g.enemy.x + 16) * p.t
          const y = g.enemy.y + 8 + (g.hero.y - g.enemy.y - 8) * p.t
          fillc(ctx, x, y, 8, '#3A1B5A'); fillc(ctx, x, y, 4, '#B388E0')
        }
      }
      for (const p of g.parts) {
        ctx.globalAlpha = Math.max(0, p.life / p.max)
        fillc(ctx, p.x, p.y, p.size, p.color)
      }
      ctx.globalAlpha = 1
      if (g.speech?.until > now) drawSpeech(ctx, g.speech, g)
      const fl = (g.flashUntil - now) / 300
      if (fl > 0) { ctx.fillStyle = 'rgba(231,76,60,' + (fl * 0.4) + ')'; ctx.fillRect(0, 0, GAME_W, CANVAS_H) }

      // 급수 완성 배너
      if (now < g.gradeBannerUntil) {
        const left = g.gradeBannerUntil - now
        const fade = left < 500 ? left / 500 : 1
        ctx.save()
        ctx.globalAlpha = fade
        ctx.fillStyle = 'rgba(18,10,40,0.8)'
        ctx.fillRect(0, CANVAS_H / 2 - 30, GAME_W, 60)
        ctx.fillStyle = '#FFE08A'
        ctx.fillRect(0, CANVAS_H / 2 - 30, GAME_W, 3)
        ctx.fillRect(0, CANVAS_H / 2 + 27, GAME_W, 3)
        ctx.font = 'bold 22px system-ui'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(g.gradeBannerText, GAME_W / 2, CANVAS_H / 2)
        ctx.restore()
      }
    }

    const loop = (now) => {
      let dt = (now - last) / 1000
      last = now
      if (dt > 0.05) dt = 0.05
      const g = G.current
      if (g.phase === 'play') update(dt, now)
      draw(now)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [play])

  const nextQuestion = useCallback(() => {
    const g = G.current
    const grade = GRADES[g.gradeIdx]
    setQ(makeQuestion(grade, g.learnedByGrade[grade.name], g.learnedMagic))
  }, [])

  const nextStage = useCallback(() => {
    const g = G.current
    g.stage += 1
    g.enemy = makeEnemy(g.stage)
    getSprite(villainForStage(g.stage + 1).key)
    g.speech = { speaker: 'enemy', text: g.enemy.lines.intro, until: performance.now() + 2200 }
    syncHud()
    nextQuestion()
  }, [syncHud, nextQuestion])

  const answer = useCallback((idx) => {
    const g = G.current
    if (!q || q.answered || g.phase !== 'play') return
    const now = performance.now()
    const correct = idx === q.correctIdx
    setQ({ ...q, answered: true, pickedIdx: idx })

    if (correct) {
      g.score += 10 + g.combo * 2
      g.combo += 1
      const grade = GRADES[g.gradeIdx]
      const magicQuestion = q.source === 'magic'
      const set = magicQuestion ? g.learnedMagic : g.learnedByGrade[grade.name]
      if (!set.has(q.char)) { set.add(q.char); saveLearned(magicQuestion ? 'magic' : grade.name, set) }
      g.castUntil = now + 440
      g.castChar = q.char
      g.castColor = q.color
      g.proj = { t: 0, color: q.color }
      g.speech = { speaker: 'hero', text: `${q.meaning} ${q.sound}(${q.char})!`, until: now + 900 }
      play('correct'); play('cast')
      // 급수 완성 체크
      if (!magicQuestion && set.size >= grade.list.length && g.gradeIdx < GRADES.length - 1) {
        g.gradeIdx += 1
        g.gradeBannerUntil = now + 2600
        g.gradeBannerText = `${grade.name} 완성! 🎉 ${GRADES[g.gradeIdx].name} 도전!`
        play('gradeup')
      }
      syncHud()
      setTimeout(() => {
        if (G.current.phase !== 'play') return
        if (G.current.enemy.hp <= 0) nextStage()
        else nextQuestion()
      }, 1050)
    } else {
      g.combo = 0
      g.lives -= 1
      g.enemy.attackUntil = now + 460
      g.proj2 = { t: 0 }
      g.speech = { speaker: 'enemy', text: g.enemy.lines.attack, until: now + 1450 }
      g.flashUntil = now + 300
      play('wrong')
      syncHud()
      setTimeout(() => {
        if (G.current.phase !== 'play') return
        if (G.current.lives <= 0) {
          G.current.phase = 'over'
          setPhase('over')
          play('over')
          const l = loadLearned(); const magic = loadMagicLearned(); const gi = deriveGradeIdx(l)
          setMenuProgress({
            gradeName: GRADES[gi].name, learned: l[GRADES[gi].name].size, total: GRADES[gi].list.length,
            magicLearned: magic.size, magicTotal: MAGIC.length,
          })
          setBest((prev) => {
            const s = G.current.score
            if (s <= prev) return prev
            try { localStorage.setItem('magic-hanja-best', String(s)) } catch { /* ignore */ }
            return s
          })
        } else {
          nextQuestion()
        }
      }, 1500)
    }
  }, [q, play, syncHud, nextQuestion, nextStage])

  const startGame = useCallback(() => {
    if (!audioRef.current) {
      try { audioRef.current = new (window.AudioContext || window.webkitAudioContext)() } catch { /* no audio */ }
    }
    try { audioRef.current?.resume() } catch { /* ignore */ }
    const g = G.current
    Object.assign(g, fresh())
    g.phase = 'play'
    g.enemy = makeEnemy(1)
    getSprite(villainForStage(2).key)
    g.speech = { speaker: 'enemy', text: g.enemy.lines.intro, until: performance.now() + 2400 }
    setPhase('play')
    syncHud()
    nextQuestion()
  }, [syncHud, nextQuestion])

  return (
    <div className="mh-container" ref={containerRef}>
      <Link to="/" className="mh-back">← 홈으로</Link>
      <div className="mh-wrapper" style={{ width: GAME_W * scale, height: STAGE_H * scale }}>
        <div className="mh-stage" style={{ width: GAME_W, height: STAGE_H, transform: `scale(${scale})` }}>
          {/* HUD */}
          <div className="mh-top" style={{ height: HUD_H }}>
            <div className="mh-hearts">{'❤️'.repeat(Math.max(0, hud.lives))}{'🖤'.repeat(Math.max(0, START_LIVES - hud.lives))}</div>
            <div className="mh-stat">⭐{hud.score}</div>
            <div className="mh-grade">{hud.gradeName} {hud.gLearned}/{hud.gTotal}</div>
            {hud.combo > 1 && <div className="mh-combo">🔥{hud.combo}</div>}
            <button className="mh-mute" onClick={toggleMute}>{muted ? '🔇' : '🔊'}</button>
          </div>

          {/* 배틀 캔버스 */}
          <div className="mh-field" style={{ height: CANVAS_H }}>
            <canvas ref={canvasRef} style={{ width: GAME_W, height: CANVAS_H }} />
            {phase === 'play' && (
              <div className={`mh-stagetag${hud.boss ? ' boss' : ''}`}>
                <span>제 {hud.stage}관문 · {hud.boss ? '★ ' : ''}{hud.enemy}</span>
                <small>{hud.enemyTitle}</small>
              </div>
            )}
          </div>

          {/* 문제 */}
          <div className="mh-q" style={{ height: Q_H }}>
            {q && (
              <>
                <div className="mh-q-meta">
                  <div className="mh-q-sources" aria-label="한자 출처">
                    {q.sourceBadges.map((badge) => (
                      <span key={`${badge.kind}-${badge.label}`} className={`mh-q-source ${badge.kind}`}>{badge.label}</span>
                    ))}
                  </div>
                  <span className="mh-q-sub">{q.sub}</span>
                </div>
                <div className={`mh-q-prompt${q.promptBig ? ' big' : ''}`} style={{ color: q.color }}>{q.promptText}</div>
              </>
            )}
          </div>

          {/* 선택지 */}
          <div className="mh-opts" style={{ height: OPT_H }}>
            {q && q.options.map((opt, i) => {
              let cls = 'mh-opt'
              if (q.optBig) cls += ' big'
              if (q.answered) {
                if (i === q.correctIdx) cls += ' correct'
                else if (i === q.pickedIdx) cls += ' wrong'
                else cls += ' dim'
              }
              return <button key={i} className={cls} disabled={q.answered} onClick={() => answer(i)}>{opt}</button>
            })}
          </div>

          {/* 오버레이 */}
          {(phase === 'menu' || phase === 'over') && (
            <div className="mh-overlay">
              <div className="mh-box">
                {phase === 'menu' ? (
                  <>
                    <div className="mh-logo">🔮 한자 마법 배틀</div>
                    <p>한자의 <b>뜻·음</b>을 맞혀 마법을 외치고<br />요괴를 물리치세요!</p>
                    <p className="mh-tip">손오공이 되어 마왕들을 물리쳐요!<br />마법천자문 1·2권 + 8급→7급 도전!</p>
                  </>
                ) : (
                  <>
                    <div className="mh-logo">💫 도전 끝!</div>
                    <p>제 {hud.stage}관문 · 점수 {hud.score}</p>
                  </>
                )}
                <p className="mh-prog">📚 {menuProgress.gradeName} {menuProgress.learned}/{menuProgress.total} 학습</p>
                <p className="mh-prog mh-prog-magic">✨ 마법천자문 1·2권 {menuProgress.magicLearned}/{menuProgress.magicTotal}</p>
                {best > 0 && <p className="mh-best">최고 점수 {best}</p>}
                <button className="mh-start" onClick={startGame}>{phase === 'menu' ? '시작하기' : '다시 하기'}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function fresh() {
  const learnedByGrade = loadLearned()
  const learnedMagic = loadMagicLearned()
  return {
    phase: 'menu', lives: START_LIVES, score: 0, combo: 0, stage: 1,
    learnedByGrade, learnedMagic, gradeIdx: deriveGradeIdx(learnedByGrade),
    hero: { x: 80, y: 144 }, enemy: makeEnemy(1), parts: [],
    proj: null, proj2: null, castUntil: 0, castChar: '', castColor: '#fff', speech: null,
    heroHurtUntil: 0, flashUntil: 0, gradeBannerUntil: 0, gradeBannerText: '',
  }
}

// ── 캔버스 드로잉 ───────────────────────────────────
function fillc(ctx, x, y, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill() }
function tri(ctx, x1, y1, x2, y2, x3, y3, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath(); ctx.fill() }

function drawMagicCircle(ctx, mx, my, now, color, char) {
  ctx.save()
  ctx.translate(mx, my)
  ctx.rotate(now / 240)
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.stroke()
  ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.stroke()
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; fillc(ctx, Math.cos(a) * 18, Math.sin(a) * 18, 2, color) }
  ctx.restore()
  ctx.fillStyle = color
  ctx.font = 'bold 20px serif'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(char, mx, my)
}

function heroBase(ctx, x, y) {
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(x, y + 40, 26, 7, 0, 0, Math.PI * 2); ctx.fill()
}
function heroArms(ctx, x, cy, casting, color) {
  ctx.lineWidth = 7; ctx.lineCap = 'round'
  ctx.beginPath()
  if (casting) { ctx.moveTo(x + 12, cy + 12); ctx.lineTo(x + 30, cy - 14) }
  else { ctx.moveTo(x + 12, cy + 12); ctx.lineTo(x + 24, cy + 24) }
  ctx.moveTo(x - 12, cy + 12); ctx.lineTo(x - 22, cy + 26)
  ctx.strokeStyle = color
  ctx.stroke()
  ctx.lineCap = 'butt'
}

// 손오공 (삐죽 검은머리 + 긴고아 금테 + 원숭이 꼬리 + 마법 붓)
function drawSonOhgong(ctx, x, y, now, casting, char, color) {
  const cy = y + Math.sin(now / 360) * 3
  heroBase(ctx, x, y)
  // 꼬리 (S자)
  ctx.strokeStyle = '#A86A3C'; ctx.lineWidth = 5; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(x + 15, cy + 30); ctx.quadraticCurveTo(x + 42, cy + 32, x + 36, cy + 8); ctx.stroke()
  ctx.lineCap = 'butt'
  fillc(ctx, x + 36, cy + 7, 3, '#C68642')
  // 몸 (노랑 도복 + 붉은 조끼)
  ctx.fillStyle = '#F0C03A'
  ctx.beginPath(); ctx.moveTo(x - 19, cy + 38); ctx.lineTo(x - 13, cy + 4); ctx.lineTo(x + 13, cy + 4); ctx.lineTo(x + 19, cy + 38); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#D6453B'
  ctx.beginPath(); ctx.moveTo(x - 15, cy + 28); ctx.lineTo(x - 12, cy + 4); ctx.lineTo(x + 12, cy + 4); ctx.lineTo(x + 15, cy + 28); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#8E2A24'; ctx.fillRect(x - 2, cy + 4, 4, 24)
  heroArms(ctx, x, cy, casting, '#F0C03A')
  // 마법 붓 (왼손)
  ctx.strokeStyle = '#C9A36A'; ctx.lineWidth = 4
  ctx.beginPath(); ctx.moveTo(x - 22, cy + 26); ctx.lineTo(x - 34, cy + 2); ctx.stroke()
  tri(ctx, x - 37, cy + 4, x - 31, cy + 4, x - 36, cy - 8, '#1A1A1A') // 붓털
  // 얼굴 (원숭이 소년)
  fillc(ctx, x, cy - 13, 15, '#D6A36A')
  fillc(ctx, x - 14, cy - 12, 5.5, '#D6A36A'); fillc(ctx, x + 14, cy - 12, 5.5, '#D6A36A')
  fillc(ctx, x - 14, cy - 12, 2.6, '#EFC79E'); fillc(ctx, x + 14, cy - 12, 2.6, '#EFC79E')
  ctx.fillStyle = '#F2D8B0'; ctx.beginPath(); ctx.ellipse(x, cy - 8, 9, 7, 0, 0, Math.PI * 2); ctx.fill()
  // 삐죽 검은 머리
  ctx.fillStyle = '#1C1C1C'
  ctx.beginPath(); ctx.arc(x, cy - 15, 15, Math.PI * 1.02, Math.PI * 1.98); ctx.fill()
  tri(ctx, x - 12, cy - 24, x - 16, cy - 36, x - 5, cy - 26, '#1C1C1C')
  tri(ctx, x - 2, cy - 27, x, cy - 40, x + 5, cy - 27, '#1C1C1C')
  tri(ctx, x + 8, cy - 25, x + 15, cy - 35, x + 13, cy - 24, '#1C1C1C')
  // 긴고아 (금테 + 앞 보석)
  ctx.strokeStyle = '#F2C200'; ctx.lineWidth = 3.5
  ctx.beginPath(); ctx.arc(x, cy - 13, 15, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke()
  fillc(ctx, x, cy - 28, 3.2, '#FF4D4D')
  // 눈/입 (활기찬)
  fillc(ctx, x - 5, cy - 11, 2.8, '#222'); fillc(ctx, x + 5, cy - 11, 2.8, '#222')
  fillc(ctx, x - 4, cy - 12, 1, '#fff'); fillc(ctx, x + 6, cy - 12, 1, '#fff')
  ctx.strokeStyle = '#8A3B1E'; ctx.lineWidth = 1.8; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.arc(x, cy - 4, 3.5, 0.08 * Math.PI, 0.92 * Math.PI); ctx.stroke(); ctx.lineCap = 'butt'
  if (casting) drawMagicCircle(ctx, x + 40, cy - 22, now, color, char)
}

function drawEnemy(ctx, e, now) {
  const dead = e.dying
  let sc = 1, alpha = 1
  if (dead) { const k = Math.min(1, (now - e.dieAt) / 450); sc = 1 - k; alpha = 1 - k }
  if (alpha <= 0) return
  const shake = e.shakeUntil > now ? Math.sin(now / 24) * 4 : 0
  const attacking = e.attackUntil > now
  const lunge = attacking ? Math.sin(((e.attackUntil - now) / 460) * Math.PI) * 12 : 0
  const x = e.x + shake - lunge, y = e.y
  const sp = getSprite(e.key)
  ctx.save()
  ctx.globalAlpha = alpha
  const shadowW = e.look.type === 'dragon' ? 53 : e.boss ? 43 : 38
  ctx.fillStyle = 'rgba(3,2,12,0.5)'; ctx.beginPath(); ctx.ellipse(x, y + 49, shadowW * sc, 9 * sc, 0, 0, Math.PI * 2); ctx.fill()
  const glow = ctx.createRadialGradient(x, y + 15, 3, x, y + 15, 60)
  glow.addColorStop(0, `${e.look.accent}38`); glow.addColorStop(1, `${e.look.accent}00`)
  ctx.fillStyle = glow; ctx.fillRect(x - 65, y - 55, 130, 120)
  if (sp.ready) {
    const bob = Math.sin(now / (e.boss ? 270 : 340)) * (e.look.type === 'dragon' ? 3 : 1.7)
    const targetH = (e.look.type === 'dragon' ? 121 : e.boss ? 149 : 139) * sc
    const maxW = (e.look.type === 'dragon' ? 167 : e.boss ? 155 : 145) * sc
    ctx.save()
    ctx.translate(x, y + 50 + bob)
    ctx.rotate(attacking ? -0.035 : Math.sin(now / 720) * 0.006)
    drawSprite(ctx, sp.img, 0, 0, targetH, maxW)
    ctx.restore()
  } else {
    ctx.translate(x, y); ctx.scale(sc, sc)
    drawVillain(ctx, e, now, attacking)
  }
  ctx.restore()
  if (!dead) {
    const w = e.boss ? 88 : 76, ratio = Math.max(0, e.hp / e.maxHp)
    const barY = y + 54
    ctx.fillStyle = 'rgba(7,4,16,0.78)'; ctx.beginPath(); ctx.roundRect(x - w / 2 - 2, barY - 2, w + 4, 8, 4); ctx.fill()
    ctx.fillStyle = ratio > 0.5 ? '#2ECC71' : ratio > 0.25 ? '#F1C40F' : '#E74C3C'
    ctx.beginPath(); ctx.roundRect(x - w / 2, barY, w * ratio, 4, 2); ctx.fill()
  }
}

function drawSpeech(ctx, speech, g) {
  const hero = speech.speaker === 'hero'
  const w = 174, h = 36, x = 93, y = 42
  ctx.save()
  ctx.shadowColor = 'rgba(6,4,18,0.42)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3
  ctx.fillStyle = hero ? 'rgba(255,248,220,0.96)' : 'rgba(28,21,43,0.96)'
  ctx.strokeStyle = hero ? '#D9A62E' : g.enemy.look.accent
  ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill(); ctx.stroke()
  ctx.shadowColor = 'transparent'
  const tailX = hero ? x + 28 : x + w - 28
  ctx.fillStyle = hero ? 'rgba(255,248,220,0.96)' : 'rgba(28,21,43,0.96)'
  tri(ctx, tailX - 7, y + h - 1, tailX + 6, y + h - 1, hero ? g.hero.x + 5 : g.enemy.x, 91, ctx.fillStyle)
  ctx.fillStyle = hero ? '#44331C' : '#FFF3D0'
  ctx.font = '800 10.5px "Noto Sans KR", sans-serif'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  const lines = splitKoreanLine(speech.text, 22)
  if (lines.length === 1) ctx.fillText(lines[0], x + w / 2, y + h / 2)
  else {
    ctx.fillText(lines[0], x + w / 2, y + 12)
    ctx.fillText(lines[1], x + w / 2, y + 25)
  }
  ctx.restore()
}

function splitKoreanLine(text, max) {
  if (text.length <= max) return [text]
  let cut = text.lastIndexOf(' ', max)
  if (cut < max * 0.55) cut = max
  return [text.slice(0, cut), text.slice(cut).trim()]
}

function drawVillain(ctx, e, now, attacking) {
  if (e.look.type === 'dragon') {
    drawDragonVillain(ctx, e.look, now, attacking)
    return
  }
  drawVillainAura(ctx, e.look, now)
  drawHumanoidVillain(ctx, e.look, now, attacking)
}

function drawVillainAura(ctx, look, now) {
  const pulse = 0.65 + Math.sin(now / 240) * 0.18
  ctx.save(); ctx.globalAlpha = pulse
  if (look.aura === 'flame') {
    for (let i = 0; i < 5; i++) {
      const x = -28 + i * 14, rise = (now / 14 + i * 13) % 22
      tri(ctx, x - 4, 35 - rise, x + 4, 35 - rise, x, 23 - rise, look.accent)
    }
  } else if (look.aura === 'ice') {
    ctx.strokeStyle = look.accent; ctx.lineWidth = 1.2
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3 + now / 900, x = Math.cos(a) * 31, y = Math.sin(a) * 20
      ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x + 3, y); ctx.moveTo(x, y - 3); ctx.lineTo(x, y + 3); ctx.stroke()
    }
  } else if (look.aura === 'cloud') {
    for (let i = 0; i < 4; i++) fillc(ctx, -25 + i * 17, 32 + Math.sin(now / 400 + i) * 2, 9, 'rgba(207,224,240,0.25)')
  } else if (look.aura === 'storm') {
    ctx.strokeStyle = look.accent; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(-31, -11); ctx.lineTo(-24, -3); ctx.lineTo(-30, 4); ctx.stroke()
  } else if (look.aura === 'void') {
    ctx.strokeStyle = look.accent; ctx.lineWidth = 1.4
    ctx.beginPath(); ctx.ellipse(0, -5, 35, 48, now / 700, 0, Math.PI * 2); ctx.stroke()
  } else {
    for (let i = 0; i < 4; i++) {
      const a = now / 800 + i * Math.PI / 2
      fillc(ctx, Math.cos(a) * 31, -3 + Math.sin(a) * 29, 2, look.accent)
    }
  }
  ctx.restore()
}

function drawHumanoidVillain(ctx, look, now, attacking) {
  const sleepy = look.crown === 'nightcap'
  const bob = Math.sin(now / (sleepy ? 520 : 320)) * (sleepy ? 1.2 : 2.2)
  const lean = attacking ? -0.12 : 0
  ctx.save(); ctx.translate(0, bob); ctx.rotate(lean)

  // 망토와 하체: 직업마다 먼저 읽히는 실루엣을 만든다.
  ctx.fillStyle = darken(look.color, 0.42)
  ctx.beginPath(); ctx.moveTo(-18, 2); ctx.quadraticCurveTo(-32, 17, -29, 42); ctx.lineTo(0, 35); ctx.lineTo(29, 42); ctx.quadraticCurveTo(32, 17, 18, 2); ctx.closePath(); ctx.fill()
  if (look.type === 'warrior' || look.type === 'brute') {
    ctx.fillStyle = darken(look.color, 0.25); ctx.fillRect(-18, 14, 15, 25); ctx.fillRect(3, 14, 15, 25)
    ctx.fillStyle = look.accent; ctx.fillRect(-20, 37, 17, 5); ctx.fillRect(3, 37, 17, 5)
  } else {
    ctx.fillStyle = look.color
    ctx.beginPath(); ctx.moveTo(-14, 8); ctx.lineTo(14, 8); ctx.lineTo(27, 42); ctx.quadraticCurveTo(0, 35, -27, 42); ctx.closePath(); ctx.fill()
  }

  // 몸통과 어깨 장식
  const shoulder = look.type === 'brute' ? 23 : look.type === 'warrior' ? 20 : 16
  ctx.fillStyle = look.color; ctx.beginPath(); ctx.roundRect(-shoulder, 0, shoulder * 2, 29, look.type === 'brute' ? 7 : 11); ctx.fill()
  ctx.strokeStyle = look.accent; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(-shoulder + 3, 7); ctx.lineTo(0, 17); ctx.lineTo(shoulder - 3, 7); ctx.stroke()
  fillc(ctx, 0, 18, 8, darken(look.color, 0.48))
  ctx.fillStyle = look.accent; ctx.font = 'bold 10px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(look.sigil, 0, 18)
  if (look.type === 'brute') {
    fillc(ctx, -21, 7, 7, darken(look.color, 0.22)); fillc(ctx, 21, 7, 7, darken(look.color, 0.22))
  }

  drawVillainWeapon(ctx, look, attacking)

  // 얼굴, 머리카락, 눈썹의 각도로 기분을 표현한다.
  const faceY = -13
  if (look.type === 'reaper' || look.type === 'elder') {
    ctx.fillStyle = darken(look.color, 0.55)
    ctx.beginPath(); ctx.arc(0, faceY - 1, 19, Math.PI, 0); ctx.lineTo(15, 3); ctx.lineTo(-15, 3); ctx.closePath(); ctx.fill()
  }
  fillc(ctx, 0, faceY, look.type === 'brute' ? 16 : 14.5, look.skin)
  ctx.fillStyle = look.hair
  ctx.beginPath(); ctx.arc(0, faceY - 3, look.type === 'brute' ? 16 : 15, Math.PI, Math.PI * 2); ctx.fill()
  if (look.type === 'witch') {
    ctx.beginPath(); ctx.moveTo(-14, faceY - 6); ctx.quadraticCurveTo(-23, faceY + 7, -16, faceY + 17); ctx.lineTo(-8, faceY + 7); ctx.fill()
    ctx.beginPath(); ctx.moveTo(14, faceY - 6); ctx.quadraticCurveTo(23, faceY + 7, 16, faceY + 17); ctx.lineTo(8, faceY + 7); ctx.fill()
  }
  if (look.type === 'elder') {
    ctx.fillStyle = look.hair; ctx.beginPath(); ctx.moveTo(-10, faceY + 6); ctx.quadraticCurveTo(0, faceY + 29, 10, faceY + 6); ctx.quadraticCurveTo(0, faceY + 13, -10, faceY + 6); ctx.fill()
  }
  const eyeY = faceY + 1
  ctx.strokeStyle = darken(look.hair, 0.25); ctx.lineWidth = 2.2; ctx.lineCap = 'round'
  ctx.beginPath()
  if (sleepy) {
    ctx.moveTo(-9, eyeY); ctx.quadraticCurveTo(-5, eyeY + 3, -1, eyeY)
    ctx.moveTo(2, eyeY); ctx.quadraticCurveTo(6, eyeY + 3, 10, eyeY)
  } else {
    ctx.moveTo(-10, eyeY - 5); ctx.lineTo(-2, eyeY - 2); ctx.moveTo(10, eyeY - 5); ctx.lineTo(2, eyeY - 2)
  }
  ctx.stroke(); ctx.lineCap = 'butt'
  if (!sleepy) {
    fillc(ctx, -6, eyeY, 3.1, look.eyes); fillc(ctx, 6, eyeY, 3.1, look.eyes)
    fillc(ctx, -6, eyeY, 1.35, '#151018'); fillc(ctx, 6, eyeY, 1.35, '#151018')
  }
  ctx.strokeStyle = darken(look.skin, 0.45); ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.arc(0, faceY + 6, 4.5, attacking ? 0 : 0.15 * Math.PI, attacking ? Math.PI : 0.85 * Math.PI); ctx.stroke()
  drawHeadpiece(ctx, look, faceY)
  ctx.restore()
}

function drawHeadpiece(ctx, look, faceY) {
  const y = faceY - 14
  ctx.fillStyle = look.accent; ctx.strokeStyle = darken(look.accent, 0.35); ctx.lineWidth = 1.4
  if (look.crown === 'horns') {
    tri(ctx, -12, y + 5, -21, y - 13, -4, y + 3, look.accent); tri(ctx, 12, y + 5, 21, y - 13, 4, y + 3, look.accent)
  } else if (look.crown === 'hat') {
    ctx.beginPath(); ctx.ellipse(0, y + 3, 25, 5, -0.08, 0, Math.PI * 2); ctx.fill()
    tri(ctx, -11, y + 1, 5, y - 29, 13, y + 2, look.color)
  } else if (look.crown === 'helm') {
    ctx.fillStyle = darken(look.color, 0.3); ctx.beginPath(); ctx.arc(0, faceY - 3, 17, Math.PI, Math.PI * 2); ctx.fill()
    ctx.fillStyle = look.accent; ctx.fillRect(-2, faceY - 27, 4, 14)
  } else if (look.crown === 'nightcap') {
    ctx.fillStyle = look.accent; ctx.beginPath(); ctx.moveTo(-13, y + 4); ctx.quadraticCurveTo(0, y - 25, 19, y - 12); ctx.lineTo(9, y + 5); ctx.closePath(); ctx.fill(); fillc(ctx, 19, y - 12, 4, '#ECF5FF')
  } else if (look.crown === 'peacock') {
    for (let i = -2; i <= 2; i++) { fillc(ctx, i * 6, y - 7 - Math.abs(i) * 2, 6, look.accent); fillc(ctx, i * 6, y - 7 - Math.abs(i) * 2, 2.4, '#254B73') }
  } else if (look.crown === 'ice') {
    for (let i = -2; i <= 2; i++) tri(ctx, i * 7 - 4, y + 5, i * 7, y - 12 + Math.abs(i) * 3, i * 7 + 4, y + 5, look.accent)
  } else if (look.crown === 'tiara') {
    ctx.strokeStyle = look.accent; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, faceY - 3, 15, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke(); fillc(ctx, 0, y - 2, 3, '#FFE27A')
  } else if (look.crown === 'crown') {
    ctx.beginPath(); ctx.moveTo(-14, y + 5); ctx.lineTo(-13, y - 10); ctx.lineTo(-5, y - 2); ctx.lineTo(0, y - 14); ctx.lineTo(6, y - 2); ctx.lineTo(14, y - 10); ctx.lineTo(13, y + 5); ctx.closePath(); ctx.fill()
  } else if (look.crown === 'halo') {
    ctx.strokeStyle = look.accent; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, y - 8, 23, 6, 0, 0, Math.PI * 2); ctx.stroke()
  } else if (look.crown === 'spikes') {
    for (let i = -2; i <= 2; i++) tri(ctx, i * 7 - 3, y + 4, i * 7, y - 9 - (i === 0 ? 5 : 0), i * 7 + 3, y + 4, look.accent)
  } else if (look.crown === 'coin') {
    fillc(ctx, 0, y - 4, 9, look.accent); ctx.fillStyle = darken(look.accent, 0.45); ctx.font = 'bold 8px serif'; ctx.textAlign = 'center'; ctx.fillText('金', 0, y - 3)
  }
}

function drawVillainWeapon(ctx, look, attacking) {
  const wx = attacking ? -30 : -27
  ctx.strokeStyle = '#5A3A2C'; ctx.lineWidth = 4; ctx.lineCap = 'round'
  if (look.weapon === 'sword') {
    ctx.strokeStyle = look.accent; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(wx, 31); ctx.lineTo(wx - 9, -11); ctx.stroke()
    ctx.strokeStyle = '#4A2B23'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(wx - 2, 20); ctx.lineTo(wx + 7, 18); ctx.stroke()
  } else if (look.weapon === 'axe') {
    ctx.beginPath(); ctx.moveTo(wx, 34); ctx.lineTo(wx - 7, -10); ctx.stroke(); tri(ctx, wx - 8, -15, wx - 26, -7, wx - 7, 2, look.accent)
  } else if (look.weapon === 'scythe') {
    ctx.beginPath(); ctx.moveTo(wx, 38); ctx.lineTo(wx - 7, -20); ctx.stroke(); ctx.strokeStyle = look.accent; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(wx - 16, -16, 14, Math.PI * 1.12, Math.PI * 1.82); ctx.stroke()
  } else if (look.weapon === 'staff' || look.weapon === 'scepter' || look.weapon === 'spear') {
    ctx.beginPath(); ctx.moveTo(wx, 39); ctx.lineTo(wx - 5, -19); ctx.stroke()
    if (look.weapon === 'spear') tri(ctx, wx - 10, -17, wx - 5, -34, wx, -17, look.accent)
    else fillc(ctx, wx - 5, -22, look.weapon === 'scepter' ? 7 : 6, look.accent)
  } else if (look.weapon === 'mirror') {
    ctx.beginPath(); ctx.moveTo(wx, 32); ctx.lineTo(wx - 3, 3); ctx.stroke(); fillc(ctx, wx - 4, -5, 10, look.accent); fillc(ctx, wx - 4, -5, 6, '#DDF9EA')
  } else if (look.weapon === 'fan') {
    ctx.fillStyle = look.accent; ctx.beginPath(); ctx.moveTo(wx + 4, 22); ctx.arc(wx - 4, 14, 14, Math.PI * 1.05, Math.PI * 1.55); ctx.closePath(); ctx.fill()
  } else if (look.weapon === 'pillow') {
    ctx.fillStyle = look.accent; ctx.beginPath(); ctx.roundRect(wx - 11, 8, 20, 25, 7); ctx.fill(); ctx.strokeStyle = '#7A8CA1'; ctx.lineWidth = 1; ctx.stroke()
  } else if (look.weapon === 'coins') {
    for (let i = 0; i < 3; i++) { fillc(ctx, wx - i * 5, 22 - i * 6, 5, look.accent); ctx.fillStyle = '#8A5712'; ctx.font = '6px serif'; ctx.textAlign = 'center'; ctx.fillText('金', wx - i * 5, 24 - i * 6) }
  } else if (look.weapon === 'orb') {
    fillc(ctx, wx, 10, 11, look.accent); fillc(ctx, wx - 3, 7, 3, '#FFFFFF')
  }
  ctx.lineCap = 'butt'
}

function drawDragonVillain(ctx, look, now, attacking) {
  drawVillainAura(ctx, look, now)
  const bob = Math.sin(now / 280) * 2
  ctx.save(); ctx.translate(attacking ? -8 : 0, bob)
  // 꼬리와 날개
  ctx.strokeStyle = darken(look.skin, 0.25); ctx.lineWidth = 13; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(12, 24); ctx.quadraticCurveTo(43, 31, 35, 46); ctx.quadraticCurveTo(29, 53, 19, 43); ctx.stroke(); ctx.lineCap = 'butt'
  ctx.fillStyle = darken(look.skin, 0.35)
  tri(ctx, -12, 4, -38, -26, -32, 22, darken(look.skin, 0.22)); tri(ctx, 13, 4, 38, -26, 31, 22, darken(look.skin, 0.22))
  ctx.strokeStyle = look.accent; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(-15, 3); ctx.lineTo(-34, -21); ctx.moveTo(15, 3); ctx.lineTo(34, -21); ctx.stroke()
  // 몸과 비늘
  ctx.fillStyle = look.skin; ctx.beginPath(); ctx.ellipse(0, 18, 22, 27, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = look.accent; ctx.globalAlpha = 0.28; ctx.beginPath(); ctx.ellipse(0, 22, 10, 19, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1
  fillc(ctx, 0, -11, 20, look.skin)
  ctx.fillStyle = darken(look.skin, 0.24)
  ctx.beginPath(); ctx.ellipse(-13, -8, 13, 9, -0.25, 0, Math.PI * 2); ctx.fill()
  tri(ctx, -13, -21, -21, -40, -4, -24, look.accent); tri(ctx, 9, -22, 17, -41, 20, -18, look.accent)
  // 긴 주둥이와 콧김
  ctx.fillStyle = darken(look.skin, 0.16); ctx.beginPath(); ctx.ellipse(-16, -4, 15, 9, -0.08, 0, Math.PI * 2); ctx.fill()
  fillc(ctx, -24, -6, 1.7, '#0A1015'); fillc(ctx, -14, -7, 1.7, '#0A1015')
  ctx.strokeStyle = '#111820'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-14, -16); ctx.lineTo(-2, -13); ctx.stroke()
  fillc(ctx, -8, -11, 4, look.eyes); fillc(ctx, -9, -11, 1.5, '#10161B')
  // 발톱
  ctx.strokeStyle = look.accent; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-17, 30); ctx.lineTo(-29, 34); ctx.moveTo(17, 30); ctx.lineTo(27, 35); ctx.stroke()
  ctx.fillStyle = look.accent; ctx.font = 'bold 10px serif'; ctx.textAlign = 'center'; ctx.fillText(look.sigil, 0, 24)
  ctx.restore()
}

function darken(hex, amount) {
  const value = Number.parseInt(hex.slice(1), 16)
  const r = Math.max(0, Math.round(((value >> 16) & 255) * (1 - amount)))
  const g = Math.max(0, Math.round(((value >> 8) & 255) * (1 - amount)))
  const b = Math.max(0, Math.round((value & 255) * (1 - amount)))
  return `rgb(${r},${g},${b})`
}

export default MagicHanja
