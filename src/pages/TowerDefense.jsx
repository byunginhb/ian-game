import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useGameScale } from '../hooks/useGameScale'
import { useTouchLock } from '../hooks/useTouchLock'
import './TowerDefense.css'

// ── 논리 해상도 / 그리드 ─────────────────────────────
const COLS = 10
const ROWS = 12
const CELL = 42
const GAME_W = COLS * CELL // 420
const GAME_H = ROWS * CELL // 504
const TOP_H = 52
const BOT_H = 96
const STAGE_H = TOP_H + GAME_H + BOT_H
const TOTAL_WAVES = 20
const START_GOLD = 75
const START_LIVES = 10
const PARTICLE_CAP = 120
const BURST_CAP = 36
const PREP_TIME = 3000
const INTER_TIME = 3000
const COMBO_WINDOW = 1200
const METEOR_CD = 34000
const METEOR_DMG = 85
const METEOR_R = 62
const FREEZE_CD = 50000
const FREEZE_DUR = 1600
const CONFUSE_CD = 46000
const CONFUSE_DUR = 3000
const THUNDER_CD = 42000
const THUNDER_KILLS = 3
const BOSS_NAMES = ['여왕', '마왕', '대장여왕', '대마왕']
const BOSS_COLORS = ['#FF6FB5', '#E74C3C', '#9B59B6', '#C0392B']
const BOSS_BANNER_DUR = 2300

// ── 경로(serpentine) waypoint: [col,row] ──
const WAY = [
  [-1, 0], [8, 0], [8, 2], [1, 2], [1, 4], [8, 4],
  [8, 6], [1, 6], [1, 8], [8, 8], [8, 10], [1, 10], [1, 12],
]
const PATH = WAY.map(([c, r]) => ({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 }))

const PATH_CELLS = (() => {
  const set = new Set()
  for (let i = 0; i < WAY.length - 1; i++) {
    let [c0, r0] = WAY[i]
    const [c1, r1] = WAY[i + 1]
    const dc = Math.sign(c1 - c0)
    const dr = Math.sign(r1 - r0)
    while (c0 !== c1 || r0 !== r1) {
      if (c0 >= 0 && c0 < COLS && r0 >= 0 && r0 < ROWS) set.add(c0 + ',' + r0)
      c0 += dc
      r0 += dr
    }
    if (c1 >= 0 && c1 < COLS && r1 >= 0 && r1 < ROWS) set.add(c1 + ',' + r1)
  }
  return set
})()

// ── 타워 5종 (levels[0]=건설, [1]=Lv2, [2]=Lv3) ─────────
const TOWERS = {
  arrow: {
    name: '화살탑', emoji: '🏹', color: '#7CC36B', kind: 'single',
    levels: [
      { cost: 50, dmg: 10, range: 120, cd: 1000, pspeed: 320 },
      { cost: 40, dmg: 16, range: 140, cd: 800, pspeed: 340 },
      { cost: 70, dmg: 24, range: 160, cd: 667, pspeed: 360 },
    ],
  },
  frost: {
    name: '서리탑', emoji: '❄️', color: '#6EC8E8', kind: 'frost',
    levels: [
      { cost: 70, dmg: 4, range: 110, cd: 1000, pspeed: 260, splash: 40, slow: 0.35, slowDur: 2000 },
      { cost: 60, dmg: 6, range: 110, cd: 1000, pspeed: 260, splash: 55, slow: 0.45, slowDur: 2500 },
      { cost: 100, dmg: 9, range: 110, cd: 1000, pspeed: 260, splash: 70, slow: 0.55, slowDur: 3000 },
    ],
  },
  cannon: {
    name: '대포탑', emoji: '💣', color: '#E8893C', kind: 'splash',
    levels: [
      { cost: 90, dmg: 18, range: 100, cd: 1430, pspeed: 220, splash: 50 },
      { cost: 80, dmg: 28, range: 110, cd: 1250, pspeed: 240, splash: 60 },
      { cost: 130, dmg: 42, range: 120, cd: 1110, pspeed: 260, splash: 75 },
    ],
  },
  bolt: {
    name: '번개탑', emoji: '⚡', color: '#9B6FE0', kind: 'chain',
    levels: [
      { cost: 180, dmg: 30, range: 150, cd: 1110, chain: 2, chainRange: 80, falloff: 0.7 },
      { cost: 150, dmg: 45, range: 170, cd: 1000, chain: 3, chainRange: 80, falloff: 0.7 },
      { cost: 220, dmg: 65, range: 190, cd: 909, chain: 4, chainRange: 80, falloff: 0.7 },
    ],
  },
  sniper: {
    name: '저격탑', emoji: '🎯', color: '#5D8233', kind: 'single',
    levels: [
      { cost: 150, dmg: 60, range: 200, cd: 1600, pspeed: 520 },
      { cost: 120, dmg: 95, range: 230, cd: 1500, pspeed: 560 },
      { cost: 200, dmg: 150, range: 260, cd: 1400, pspeed: 600 },
    ],
  },
}
const TOWER_ORDER = ['arrow', 'frost', 'cannon', 'bolt', 'sniper']

// ── 적 (8종 + 분열 자식 mini) ──────────────────────────
const ENEMIES = {
  basic: { name: '콩알이', color: '#7CC36E', hp: 38, speed: 55, gold: 4, dmg: 1, r: 13 },
  fast: { name: '쌩쌩이', color: '#59B6E8', hp: 20, speed: 122, gold: 5, dmg: 1, r: 11 },
  tank: { name: '둥글탱', color: '#B5793A', hp: 180, speed: 34, gold: 9, dmg: 3, r: 17 },
  swarm: { name: '옹기종', color: '#F4D03F', hp: 16, speed: 72, gold: 2, dmg: 1, r: 10 },
  boss: { name: '왕방울', color: '#9B59B6', hp: 980, speed: 30, gold: 55, dmg: 6, r: 24 },
  dart: { name: '번개돌이', color: '#FF7043', hp: 24, speed: 150, gold: 6, dmg: 1, r: 10 },
  brute: { name: '우락부락', color: '#6B7280', hp: 340, speed: 28, gold: 16, dmg: 4, r: 20 },
  splitter: { name: '퐁퐁이', color: '#EC7FB0', hp: 70, speed: 60, gold: 8, dmg: 2, r: 14 },
  mini: { name: '퐁알', color: '#F5A9C8', hp: 16, speed: 88, gold: 1, dmg: 1, r: 8 },
}
// 홈/미리보기용 이모지
const ENEMY_EMOJI = { basic: '🟢', fast: '💨', tank: '🛡️', swarm: '🐤', boss: '👑', dart: '🦊', brute: '🦏', splitter: '🫧', mini: '🫧' }

// ── 20웨이브 ────────────────────────────────────────
const WAVES = [
  { bonus: 25, gap: 1100, groups: [['basic', 6]] },
  { bonus: 28, gap: 1000, groups: [['basic', 8], ['fast', 3]] },
  { bonus: 30, gap: 850, groups: [['basic', 6], ['swarm', 12]] },
  { bonus: 33, gap: 880, groups: [['basic', 8], ['fast', 5], ['tank', 2]] },
  { bonus: 50, gap: 780, groups: [['boss', 1], ['basic', 10], ['fast', 4]] },
  { bonus: 38, gap: 780, groups: [['tank', 4], ['fast', 8]] },
  { bonus: 42, gap: 560, groups: [['swarm', 20], ['basic', 8]] },
  { bonus: 45, gap: 700, groups: [['tank', 5], ['dart', 6]] },
  { bonus: 48, gap: 680, groups: [['basic', 14], ['tank', 4], ['fast', 8]] },
  { bonus: 75, gap: 620, groups: [['boss', 1], ['tank', 5], ['swarm', 16]] },
  { bonus: 52, gap: 560, groups: [['dart', 10], ['fast', 12]] },
  { bonus: 55, gap: 430, groups: [['swarm', 34], ['tank', 6]] },
  { bonus: 58, gap: 600, groups: [['splitter', 6], ['tank', 8], ['fast', 12]] },
  { bonus: 62, gap: 520, groups: [['brute', 3], ['swarm', 24], ['dart', 8]] },
  { bonus: 80, gap: 560, groups: [['boss', 1], ['brute', 2], ['tank', 6], ['fast', 10]] },
  { bonus: 60, gap: 500, groups: [['splitter', 10], ['dart', 12], ['tank', 6]] },
  { bonus: 64, gap: 440, groups: [['brute', 4], ['swarm', 30], ['fast', 14]] },
  { bonus: 68, gap: 460, groups: [['dart', 16], ['splitter', 10], ['tank', 8]] },
  { bonus: 72, gap: 420, groups: [['brute', 6], ['tank', 10], ['swarm', 28], ['dart', 12]] },
  { bonus: 120, gap: 480, groups: [['boss', 2], ['brute', 4], ['splitter', 8], ['dart', 14], ['tank', 8]] },
]

function waveHp(type, wave, bossSeen) {
  const base = ENEMIES[type].hp
  if (type === 'boss') return Math.round(base * (1 + 0.78 * (bossSeen - 1)))
  return Math.round(base * (1 + 0.23 * (wave - 1)))
}
function waveSpeed(type, wave) {
  return ENEMIES[type].speed * Math.min(1.5, 1 + 0.028 * (wave - 1))
}
function buildQueue(waveIdx) {
  const w = WAVES[waveIdx]
  const q = []
  for (const [type, n] of w.groups) for (let i = 0; i < n; i++) q.push(type)
  return q
}

const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx, dy = ay - by
  return dx * dx + dy * dy
}

function TowerDefense() {
  const scale = useGameScale(GAME_W, STAGE_H, { reservedH: 16, maxScale: 1.4 })
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const bgRef = useRef(null)
  useTouchLock(containerRef)

  const [phase, setPhase] = useState('menu') // menu | intermission | wave | won | lost
  const [hud, setHud] = useState({ gold: START_GOLD, lives: START_LIVES, wave: 1, score: 0 })
  const [selected, setSelected] = useState(null)
  const [speed, setSpeed] = useState(1)
  const [inspect, setInspect] = useState(null)
  const [best, setBest] = useState(0)
  const [inter, setInter] = useState(null)
  const [streak, setStreak] = useState(0)
  const [skill, setSkill] = useState({ meteor: 0, freeze: 0, confuse: 0, thunder: 0, aiming: false })

  const G = useRef(null)
  if (G.current === null) G.current = freshState()
  const hudCache = useRef({ gold: -1, lives: -1, score: -1, wave: -1 })
  const skillCache = useRef({ meteor: -1, freeze: -1, confuse: -1, thunder: -1, aiming: null })
  const audioRef = useRef(null)
  const mutedRef = useRef(false)
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    try { setBest(Number(localStorage.getItem('tower-defense-best')) || 0) } catch { /* ignore */ }
    try { setMuted(localStorage.getItem('td-muted') === '1') } catch { /* ignore */ }
  }, [])

  useEffect(() => { mutedRef.current = muted }, [muted])

  const play = useCallback((name) => {
    if (mutedRef.current) return
    const ac = audioRef.current
    if (!ac) return
    try { if (ac.state === 'suspended') ac.resume(); SFX[name](ac) } catch { /* ignore */ }
  }, [])

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m
      try { localStorage.setItem('td-muted', next ? '1' : '0') } catch { /* ignore */ }
      return next
    })
  }, [])

  useEffect(() => { G.current.phase = phase }, [phase])
  useEffect(() => { G.current.speed = speed }, [speed])
  useEffect(() => { G.current.selected = selected; if (selected) { setInspect(null); G.current.aiming = false; setSkill((s) => ({ ...s, aiming: false })) } }, [selected])

  // 배경(잔디+길) 오프스크린 1회 렌더
  useEffect(() => {
    const bg = document.createElement('canvas')
    bg.width = GAME_W
    bg.height = GAME_H
    const c = bg.getContext('2d')
    for (let r = 0; r < ROWS; r++) {
      for (let col = 0; col < COLS; col++) {
        const onPath = PATH_CELLS.has(col + ',' + r)
        c.fillStyle = onPath ? '#E2B96F' : '#7BC67E'
        c.fillRect(col * CELL, r * CELL, CELL, CELL)
        c.strokeStyle = onPath ? 'rgba(0,0,0,0.10)' : 'rgba(0,0,0,0.06)'
        c.lineWidth = 1
        c.strokeRect(col * CELL + 0.5, r * CELL + 0.5, CELL, CELL)
      }
    }
    bgRef.current = bg
  }, [])

  // 캔버스 DPR
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = GAME_W * dpr
    canvas.height = GAME_H * dpr
    canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0)
  }, [])

  const pushHud = useCallback(() => {
    const g = G.current
    const wv = Math.min(g.waveIdx + 1, TOTAL_WAVES)
    hudCache.current = { gold: g.gold, lives: g.lives, score: g.score, wave: wv }
    setHud({ gold: g.gold, lives: g.lives, wave: wv, score: g.score })
  }, [])

  const saveBest = useCallback((s) => {
    setBest((prev) => {
      if (s <= prev) return prev
      try { localStorage.setItem('tower-defense-best', String(s)) } catch { /* ignore */ }
      return s
    })
  }, [])

  const startWave = useCallback(() => {
    const g = G.current
    g.queue = buildQueue(g.waveIdx)
    g.spawnTimer = 0
    g.livesAtWave = g.lives
    g.combo = 0
    g.inspectId = null
    setInspect(null)
    setInter(null)
    g.phase = 'wave'
    setPhase('wave')
    play('wave')
  }, [play])

  // ── 게임 루프 ──
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let raf = 0
    let last = performance.now()

    const spawnParts = (x, y, color, count, opt = {}) => {
      const g = G.current
      for (let i = 0; i < count; i++) {
        if (g.parts.length >= PARTICLE_CAP) break
        const a = Math.random() * Math.PI * 2
        const sp = (opt.spread || 60) * (0.4 + Math.random() * 0.6)
        g.parts.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opt.up || 0),
          life: opt.life || 0.4, max: opt.life || 0.4, size: opt.size || 3, color, grav: opt.grav ?? 120,
        })
      }
    }
    const pushFloater = (x, y, text, color) => {
      const g = G.current
      if (g.floaters.length > 24) return
      g.floaters.push({ x, y, text, color, born: performance.now() })
    }

    const spawnEnemy = (type, wave, x, y, seg) => {
      const g = G.current
      const def = ENEMIES[type]
      const hp = waveHp(type, wave, g.bossSeen)
      g.enemies.push({
        id: ++g.ids, type, color: def.color, r: def.r, gold: def.gold, dmg: def.dmg,
        x, y, seg, hp, maxHp: hp, base: waveSpeed(type, wave),
        slowMul: 1, slowUntil: 0, confusedUntil: 0,
        bossIdx: type === 'boss' ? Math.min(g.bossSeen - 1, BOSS_NAMES.length - 1) : 0,
      })
    }

    const killEnemy = (e) => {
      const g = G.current
      const now = performance.now()
      let gain = e.gold
      g.combo = (now - g.lastKill < COMBO_WINDOW) ? g.combo + 1 : 1
      g.lastKill = now
      g.score += Math.round(10 * (1 + Math.min(g.combo, 10) * 0.1))
      if (g.combo >= 3) pushFloater(e.x, e.y - e.r - 4, 'x' + g.combo, '#FFE08A')
      if (e.type === 'boss') play('boss')
      else if (now - g.lastHitSfx > 45) { play('hit'); g.lastHitSfx = now }
      // 폭발 타격감: 확장 링 + 색 파편
      if (g.bursts.length < BURST_CAP) {
        g.bursts.push({ x: e.x, y: e.y, r0: e.r * 0.5, r1: e.r * (e.type === 'boss' ? 3.4 : 2.4), color: e.color, born: now, dur: e.type === 'boss' ? 0.45 : 0.3 })
      }
      spawnParts(e.x, e.y, e.color, e.type === 'boss' ? 18 : e.r > 15 ? 10 : 7, { life: 0.5, size: e.r > 16 ? 5 : 3, spread: e.r * 6 })
      if (e.type === 'boss') {
        gain += 30
        g.score += 200
        g.flashUntil = now + 160
        pushFloater(e.x, e.y, 'BOSS 처치! +' + gain, '#FFD166')
      } else if (e.type === 'splitter') {
        const wave = g.waveIdx + 1
        spawnEnemy('mini', wave, e.x - 12, e.y, e.seg)
        spawnEnemy('mini', wave, e.x + 12, e.y, e.seg)
      }
      g.gold += gain
    }

    const update = (dt) => {
      const g = G.current
      const now = performance.now()

      // 스킬 발동 요청
      if (g.meteorReq) {
        const { x, y } = g.meteorReq
        g.meteorReq = null
        const r2 = METEOR_R * METEOR_R
        for (const e of g.enemies) {
          if (e.dead) continue
          if (dist2(x, y, e.x, e.y) <= r2) { e.hp -= METEOR_DMG; if (e.hp <= 0) { e.dead = true; killEnemy(e) } }
        }
        spawnParts(x, y, '#FF8C42', 16, { life: 0.6, size: 6, spread: 110 })
        g.flashUntil = now + 110
        g.meteorCd = METEOR_CD
        play('skill')
      }
      if (g.freezeReq) {
        g.freezeReq = false
        for (const e of g.enemies) { if (!e.dead) { e.slowMul = 0; e.slowUntil = now + FREEZE_DUR } }
        g.freezeTintUntil = now + 320
        g.freezeCd = FREEZE_CD
        play('skill')
      }
      if (g.confuseReq) {
        g.confuseReq = false
        for (const e of g.enemies) {
          if (e.dead) continue
          e.confusedUntil = now + CONFUSE_DUR
          spawnParts(e.x, e.y, '#B07BEB', 2, { life: 0.4 })
        }
        g.confuseTintUntil = now + 300
        g.confuseCd = CONFUSE_CD
        play('skill')
      }
      if (g.thunderReq) {
        g.thunderReq = false
        const cand = g.enemies.filter((e) => !e.dead && e.type !== 'boss')
        cand.sort((a, b) => (b.seg * 100000 + b.x + b.y) - (a.seg * 100000 + a.x + a.y))
        for (let i = 0; i < THUNDER_KILLS && i < cand.length; i++) { cand[i].dead = true; killEnemy(cand[i]) }
        g.thunderBolts = makeScreenBolts()
        g.thunderUntil = now + 260
        g.flashUntil = now + 130
        g.thunderCd = THUNDER_CD
        play('thunder')
      }

      // 스폰
      if (g.queue.length > 0) {
        g.spawnTimer -= dt * 1000
        if (g.spawnTimer <= 0) {
          const type = g.queue.shift()
          if (type === 'boss') {
            g.bossSeen += 1
            const bi = Math.min(g.bossSeen - 1, BOSS_NAMES.length - 1)
            g.bossBannerName = BOSS_NAMES[bi]
            g.bossBannerColor = BOSS_COLORS[bi]
            g.bossBannerUntil = now + BOSS_BANNER_DUR
            play('bossAppear')
          }
          spawnEnemy(type, g.waveIdx + 1, PATH[0].x, PATH[0].y, 0)
          g.spawnTimer = WAVES[g.waveIdx].gap
        }
      }

      // 적 이동
      for (const e of g.enemies) {
        if (e.slowUntil && now > e.slowUntil) { e.slowMul = 1; e.slowUntil = 0 }
        let move = e.base * e.slowMul * dt
        if (now < e.confusedUntil) {
          while (move > 0 && e.seg >= 0) {
            const t = PATH[e.seg]
            const dx = t.x - e.x, dy = t.y - e.y
            const d = Math.hypot(dx, dy)
            if (d <= move) { e.x = t.x; e.y = t.y; e.seg--; move -= d }
            else { e.x += (dx / d) * move; e.y += (dy / d) * move; move = 0 }
          }
          if (e.seg < 0) e.seg = 0
          continue
        }
        while (move > 0 && e.seg < PATH.length - 1) {
          const t = PATH[e.seg + 1]
          const dx = t.x - e.x, dy = t.y - e.y
          const d = Math.hypot(dx, dy)
          if (d <= move) { e.x = t.x; e.y = t.y; e.seg++; move -= d }
          else { e.x += (dx / d) * move; e.y += (dy / d) * move; move = 0 }
        }
        if (e.seg >= PATH.length - 1) {
          e.dead = true
          g.lives -= e.dmg
          spawnParts(e.x, e.y, '#FF7675', 4, { life: 0.3 })
          if (now - g.lastLeakSfx > 120) { play('leak'); g.lastLeakSfx = now }
        }
      }

      // 타워 발사
      for (const tw of g.towers) {
        const st = mergeStats(tw.key, tw.level)
        if (now - tw.last < st.cd) continue
        const kind = TOWERS[tw.key].kind
        const rng2 = st.range * st.range
        let target = null, bestProg = -1
        for (const e of g.enemies) {
          if (e.dead) continue
          if (dist2(tw.x, tw.y, e.x, e.y) > rng2) continue
          const prog = e.seg * 10000 + (e.x + e.y)
          if (prog > bestProg) { bestProg = prog; target = e }
        }
        if (!target) continue
        tw.last = now
        if (kind === 'chain') {
          const hitPts = [{ x: tw.x, y: tw.y }]
          let dmg = st.dmg
          let from = target
          const used = new Set()
          for (let j = 0; j <= st.chain; j++) {
            if (!from || from.dead) break
            from.hp -= dmg
            used.add(from.id)
            hitPts.push({ x: from.x, y: from.y })
            if (from.hp <= 0) { from.dead = true; killEnemy(from) }
            let next = null, nd = st.chainRange * st.chainRange
            for (const e of g.enemies) {
              if (e.dead || used.has(e.id)) continue
              const d = dist2(from.x, from.y, e.x, e.y)
              if (d < nd) { nd = d; next = e }
            }
            from = next
            dmg *= st.falloff
          }
          g.bolts.push({ pts: hitPts, life: 0.13 })
        } else {
          g.shots.push({
            x: tw.x, y: tw.y, target, speed: st.pspeed, dmg: st.dmg,
            color: TOWERS[tw.key].color, kind, splash: st.splash || 0,
            slow: st.slow || 0, slowDur: st.slowDur || 0,
          })
        }
      }

      // 투사체 (target 객체 참조 → find 불필요)
      for (const s of g.shots) {
        const t = s.target
        if (!t || t.dead) { s.dead = true; continue }
        const dx = t.x - s.x, dy = t.y - s.y
        const d = Math.hypot(dx, dy) || 1
        const step = s.speed * dt
        if (d <= step + t.r) {
          s.dead = true
          if (s.kind === 'splash') {
            const sr2 = s.splash * s.splash
            for (const e of g.enemies) {
              if (e.dead) continue
              if (dist2(t.x, t.y, e.x, e.y) <= sr2) { e.hp -= s.dmg; if (e.hp <= 0) { e.dead = true; killEnemy(e) } }
            }
            spawnParts(t.x, t.y, '#E8893C', 6, { life: 0.35, size: 4 })
          } else if (s.kind === 'frost') {
            const sr2 = s.splash * s.splash
            for (const e of g.enemies) {
              if (e.dead) continue
              if (dist2(t.x, t.y, e.x, e.y) <= sr2) {
                e.hp -= s.dmg
                const mul = 1 - s.slow
                if (mul < e.slowMul) e.slowMul = mul
                e.slowUntil = now + s.slowDur
                if (e.hp <= 0) { e.dead = true; killEnemy(e) }
              }
            }
            spawnParts(t.x, t.y, '#6EC8E8', 4, { life: 0.3 })
          } else {
            t.hp -= s.dmg
            spawnParts(t.x, t.y, '#FFD166', 3, { life: 0.25, size: 2 })
            if (t.hp <= 0) { t.dead = true; killEnemy(t) }
          }
        } else {
          s.x += (dx / d) * step
          s.y += (dy / d) * step
        }
      }

      // 파티클 / 번개선
      for (const p of g.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt }
      for (const b of g.bolts) b.life -= dt

      if (g.enemies.some((e) => e.dead)) g.enemies = g.enemies.filter((e) => !e.dead)
      if (g.shots.some((s) => s.dead)) g.shots = g.shots.filter((s) => !s.dead)
      if (g.parts.some((p) => p.life <= 0)) g.parts = g.parts.filter((p) => p.life > 0)
      if (g.bolts.some((b) => b.life <= 0)) g.bolts = g.bolts.filter((b) => b.life > 0)

      if (g.lives <= 0) {
        g.lives = 0
        g.phase = 'lost'
        setPhase('lost')
        saveBest(g.score)
        pushHud()
        play('lose')
        return
      }
      if (g.queue.length === 0 && g.enemies.length === 0) {
        const w = WAVES[g.waveIdx]
        if (g.lives >= g.livesAtWave) g.streak += 1
        else g.streak = 0
        g.gold += w.bonus + Math.min(g.streak, 5) * 10
        g.score += 100
        g.waveIdx += 1
        if (g.waveIdx >= WAVES.length) {
          g.score += g.lives * 50 + g.gold + (g.lives >= START_LIVES ? 500 : 0)
          g.phase = 'won'
          setPhase('won')
          saveBest(g.score)
          play('win')
        } else {
          g.phase = 'intermission'
          setPhase('intermission')
          g.interTimer = INTER_TIME
          g.interTotal = INTER_TIME
        }
        setStreak(g.streak)
        pushHud()
      }
    }

    const showRange = (x, y, range, ok) => {
      ctx.save()
      ctx.setLineDash([5, 5])
      ctx.strokeStyle = ok ? 'rgba(255,255,255,0.4)' : 'rgba(231,76,60,0.5)'
      ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.arc(x, y, range, 0, Math.PI * 2); ctx.stroke()
      ctx.restore()
    }

    const draw = (now) => {
      const g = G.current
      ctx.drawImage(bgRef.current, 0, 0)

      if (g.selected && (g.phase === 'intermission' || g.phase === 'wave')) {
        ctx.fillStyle = 'rgba(168,240,192,0.30)'
        for (let r = 0; r < ROWS; r++) {
          for (let col = 0; col < COLS; col++) {
            if (PATH_CELLS.has(col + ',' + r)) continue
            if (g.towers.some((t) => t.col === col && t.row === r)) continue
            ctx.fillRect(col * CELL + 2, r * CELL + 2, CELL - 4, CELL - 4)
          }
        }
      }

      // 타워
      for (const tw of g.towers) {
        const tdef = TOWERS[tw.key]
        ctx.fillStyle = 'rgba(0,0,0,0.16)'
        ctx.beginPath(); ctx.ellipse(tw.x, tw.y + 12, 13, 5, 0, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = tdef.color
        ctx.beginPath(); ctx.arc(tw.x, tw.y, 15, 0, Math.PI * 2); ctx.fill()
        ctx.font = '17px serif'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(tdef.emoji, tw.x, tw.y + 1)
        ctx.fillStyle = '#2D3436'
        ctx.beginPath(); ctx.arc(tw.x + 11, tw.y + 11, 7, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#FFEAA7'
        ctx.font = 'bold 10px system-ui'
        ctx.fillText(String(tw.level + 1), tw.x + 11, tw.y + 12)
      }

      // 적
      for (const e of g.enemies) {
        drawEnemy(ctx, e, now)
        if (now < e.confusedUntil) {
          ctx.strokeStyle = 'rgba(180,120,255,0.9)'
          ctx.lineWidth = 2
          ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 3, 0, Math.PI * 2); ctx.stroke()
        }
        if (e.hp < e.maxHp) {
          const w = e.r * 1.9
          const ratio = Math.max(0, e.hp / e.maxHp)
          const top = e.y - e.r - (e.type === 'boss' ? e.r * 0.55 : 0) - 8
          ctx.fillStyle = '#636E72'
          ctx.fillRect(e.x - w / 2, top, w, 3)
          ctx.fillStyle = ratio > 0.5 ? '#00B894' : ratio > 0.25 ? '#FDCB6E' : '#D63031'
          ctx.fillRect(e.x - w / 2, top, w * ratio, 3)
        }
      }

      // 투사체
      for (const s of g.shots) {
        ctx.fillStyle = s.color
        ctx.beginPath(); ctx.arc(s.x, s.y, s.kind === 'splash' ? 5 : 4, 0, Math.PI * 2); ctx.fill()
      }

      // 번개탑 체인
      for (const b of g.bolts) {
        ctx.save()
        ctx.globalAlpha = Math.max(0, b.life / 0.13)
        ctx.strokeStyle = '#FDE047'
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.moveTo(b.pts[0].x, b.pts[0].y)
        for (let i = 1; i < b.pts.length; i++) ctx.lineTo(b.pts[i].x, b.pts[i].y)
        ctx.stroke()
        ctx.restore()
      }

      // 폭발 링
      g.bursts = g.bursts.filter((b) => now - b.born < b.dur * 1000)
      for (const b of g.bursts) {
        const k = (now - b.born) / (b.dur * 1000)
        ctx.globalAlpha = Math.max(0, 1 - k)
        ctx.strokeStyle = b.color
        ctx.lineWidth = 3 * (1 - k) + 1
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r0 + (b.r1 - b.r0) * k, 0, Math.PI * 2); ctx.stroke()
      }
      ctx.globalAlpha = 1

      // 파티클
      for (const p of g.parts) {
        ctx.globalAlpha = Math.max(0, p.life / p.max)
        ctx.fillStyle = p.color
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalAlpha = 1

      // 플로팅 텍스트
      g.floaters = g.floaters.filter((f) => now - f.born < 900)
      if (g.floaters.length) {
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        for (const f of g.floaters) {
          const age = (now - f.born) / 900
          ctx.globalAlpha = Math.max(0, 1 - age)
          ctx.fillStyle = f.color
          ctx.font = 'bold 13px system-ui'
          ctx.fillText(f.text, f.x, f.y - age * 24)
        }
        ctx.globalAlpha = 1
      }

      // 고스트 프리뷰
      if (g.selected && g.hover) {
        const { col, row } = g.hover
        const ok = !PATH_CELLS.has(col + ',' + row) && !g.towers.some((t) => t.col === col && t.row === row)
        const x = col * CELL + CELL / 2, y = row * CELL + CELL / 2
        showRange(x, y, TOWERS[g.selected].levels[0].range, ok)
        ctx.globalAlpha = 0.55
        ctx.fillStyle = ok ? TOWERS[g.selected].color : 'rgba(231,76,60,0.7)'
        ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.fill()
        ctx.globalAlpha = 1
        if (!ok) {
          ctx.strokeStyle = 'rgba(231,76,60,0.9)'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(x - 10, y - 10); ctx.lineTo(x + 10, y + 10)
          ctx.moveTo(x + 10, y - 10); ctx.lineTo(x - 10, y + 10)
          ctx.stroke()
        }
      }
      if (g.inspectId) {
        const tw = g.towers.find((t) => t.id === g.inspectId)
        if (tw) showRange(tw.x, tw.y, mergeStats(tw.key, tw.level).range, true)
      }

      if (g.aiming) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)'
        ctx.fillRect(0, 0, GAME_W, GAME_H)
        ctx.fillStyle = '#FFE08A'
        ctx.font = 'bold 15px system-ui'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText('☄️ 운석 떨어뜨릴 곳을 탭!', GAME_W / 2, 30)
      }

      // 전체화면 번개
      if (now < g.thunderUntil && g.thunderBolts) {
        ctx.save()
        ctx.globalAlpha = Math.max(0, (g.thunderUntil - now) / 260)
        ctx.fillStyle = 'rgba(253,224,71,0.18)'
        ctx.fillRect(0, 0, GAME_W, GAME_H)
        ctx.strokeStyle = '#FDE047'
        ctx.lineWidth = 3
        ctx.lineCap = 'round'
        for (const pts of g.thunderBolts) {
          ctx.beginPath()
          ctx.moveTo(pts[0].x, pts[0].y)
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
          ctx.stroke()
        }
        ctx.restore()
      }

      const fa = (g.flashUntil - now) / 160
      if (fa > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (fa * 0.55) + ')'; ctx.fillRect(0, 0, GAME_W, GAME_H) }
      const ftn = (g.freezeTintUntil - now) / 320
      if (ftn > 0) { ctx.fillStyle = 'rgba(120,212,248,' + (ftn * 0.4) + ')'; ctx.fillRect(0, 0, GAME_W, GAME_H) }
      const ct = (g.confuseTintUntil - now) / 300
      if (ct > 0) { ctx.fillStyle = 'rgba(170,110,235,' + (ct * 0.4) + ')'; ctx.fillRect(0, 0, GAME_W, GAME_H) }

      // 보스 등장 배너
      if (now < g.bossBannerUntil) {
        const left = g.bossBannerUntil - now
        const sIn = Math.min(1, (BOSS_BANNER_DUR - left) / 220)
        const fade = left < 450 ? left / 450 : 1
        const cy = GAME_H / 2
        ctx.save()
        ctx.globalAlpha = fade
        ctx.fillStyle = 'rgba(18,8,26,0.74)'
        ctx.fillRect(0, cy - 40, GAME_W, 80)
        ctx.fillStyle = g.bossBannerColor
        ctx.fillRect(0, cy - 40, GAME_W, 4)
        ctx.fillRect(0, cy + 36, GAME_W, 4)
        ctx.translate(GAME_W / 2, cy)
        ctx.scale(sIn, sIn)
        ctx.font = 'bold 30px system-ui'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillStyle = g.bossBannerColor
        ctx.fillText(g.bossBannerName + ' 등장!!!', 0, 0)
        ctx.restore()
      }
    }

    const loop = (now) => {
      let dt = (now - last) / 1000
      last = now
      if (dt > 0.05) dt = 0.05
      const g = G.current

      if (g.phase === 'wave' || g.phase === 'intermission') {
        if (g.meteorCd > 0) g.meteorCd = Math.max(0, g.meteorCd - dt * 1000)
        if (g.freezeCd > 0) g.freezeCd = Math.max(0, g.freezeCd - dt * 1000)
        if (g.confuseCd > 0) g.confuseCd = Math.max(0, g.confuseCd - dt * 1000)
        if (g.thunderCd > 0) g.thunderCd = Math.max(0, g.thunderCd - dt * 1000)
        const m = Math.ceil(g.meteorCd / 1000), f = Math.ceil(g.freezeCd / 1000)
        const cf = Math.ceil(g.confuseCd / 1000), th = Math.ceil(g.thunderCd / 1000)
        const sc = skillCache.current
        if (sc.meteor !== m || sc.freeze !== f || sc.confuse !== cf || sc.thunder !== th || sc.aiming !== g.aiming) {
          sc.meteor = m; sc.freeze = f; sc.confuse = cf; sc.thunder = th; sc.aiming = g.aiming
          setSkill({ meteor: m, freeze: f, confuse: cf, thunder: th, aiming: g.aiming })
        }
      }

      if (g.phase === 'wave') {
        update(dt * g.speed)
        const wv = Math.min(g.waveIdx + 1, TOTAL_WAVES)
        const hc = hudCache.current
        if (hc.gold !== g.gold || hc.lives !== g.lives || hc.score !== g.score || hc.wave !== wv) {
          hc.gold = g.gold; hc.lives = g.lives; hc.score = g.score; hc.wave = wv
          setHud({ gold: g.gold, lives: g.lives, wave: wv, score: g.score })
        }
      } else if (g.phase === 'intermission') {
        g.interTimer -= dt * 1000
        if (g.interTimer <= 0) {
          startWave()
        } else {
          const sec = Math.ceil(g.interTimer / 1000)
          setInter((p) => (p && p.sec === sec ? p : { sec, total: Math.ceil(g.interTotal / 1000) }))
        }
      }

      draw(now)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [pushHud, saveBest, startWave, play])

  // ── 입력 ──
  const onPointerDown = useCallback((ev) => {
    const g = G.current
    if (g.phase === 'menu' || g.phase === 'won' || g.phase === 'lost') return
    const rect = canvasRef.current.getBoundingClientRect()
    const px = (ev.clientX - rect.left) / scale
    const py = (ev.clientY - rect.top) / scale
    if (px < 0 || py < 0 || px >= GAME_W || py >= GAME_H) return

    if (g.aiming) {
      g.meteorReq = { x: px, y: py }
      g.aiming = false
      setSkill((s) => ({ ...s, aiming: false }))
      return
    }

    const col = Math.floor(px / CELL), row = Math.floor(py / CELL)
    const existing = g.towers.find((t) => t.col === col && t.row === row)
    if (existing) {
      setSelected(null)
      g.inspectId = existing.id
      setInspect({ ...existing })
      return
    }
    if (g.selected) {
      const onPath = PATH_CELLS.has(col + ',' + row)
      const cost = TOWERS[g.selected].levels[0].cost
      if (!onPath && g.gold >= cost) {
        g.gold -= cost
        g.towers.push({
          id: ++g.ids, key: g.selected, level: 0, col, row,
          x: col * CELL + CELL / 2, y: row * CELL + CELL / 2, last: 0,
        })
        pushHud()
        play('build')
      }
    } else {
      g.inspectId = null
      setInspect(null)
    }
  }, [scale, pushHud, play])

  const onPointerMove = useCallback((ev) => {
    const g = G.current
    if (!g.selected) { g.hover = null; return }
    const rect = canvasRef.current.getBoundingClientRect()
    const px = (ev.clientX - rect.left) / scale
    const py = (ev.clientY - rect.top) / scale
    g.hover = (px < 0 || py < 0 || px >= GAME_W || py >= GAME_H) ? null : { col: Math.floor(px / CELL), row: Math.floor(py / CELL) }
  }, [scale])

  const onPointerLeave = useCallback(() => { G.current.hover = null }, [])

  // ── 컨트롤 ──
  const startGame = useCallback(() => {
    const g = G.current
    if (!audioRef.current) {
      try { audioRef.current = new (window.AudioContext || window.webkitAudioContext)() } catch { /* no audio */ }
    }
    try { audioRef.current?.resume() } catch { /* ignore */ }
    Object.assign(g, freshState())
    g.phase = 'intermission'
    g.interTimer = PREP_TIME
    g.interTotal = PREP_TIME
    hudCache.current = { gold: -1, lives: -1, score: -1, wave: -1 }
    skillCache.current = { meteor: -1, freeze: -1, confuse: -1, thunder: -1, aiming: null }
    setSelected(null); setInspect(null); setSpeed(1); setStreak(0)
    setSkill({ meteor: 0, freeze: 0, confuse: 0, thunder: 0, aiming: false })
    setPhase('intermission')
    pushHud()
  }, [pushHud])

  const armMeteor = useCallback(() => {
    const g = G.current
    if (g.phase !== 'wave' || g.meteorCd > 0) return
    g.aiming = !g.aiming
    setSkill((s) => ({ ...s, aiming: g.aiming }))
  }, [])
  const castFreeze = useCallback(() => {
    const g = G.current
    if (g.phase !== 'wave' || g.freezeCd > 0) return
    g.freezeReq = true
  }, [])
  const castConfuse = useCallback(() => {
    const g = G.current
    if (g.phase !== 'wave' || g.confuseCd > 0) return
    g.confuseReq = true
  }, [])
  const castThunder = useCallback(() => {
    const g = G.current
    if (g.phase !== 'wave' || g.thunderCd > 0) return
    g.thunderReq = true
  }, [])

  const upgrade = useCallback(() => {
    const g = G.current
    const tw = g.towers.find((t) => t.id === g.inspectId)
    if (!tw || tw.level >= 2) return
    const cost = TOWERS[tw.key].levels[tw.level + 1].cost
    if (g.gold < cost) return
    g.gold -= cost
    tw.level += 1
    pushHud()
    setInspect({ ...tw })
  }, [pushHud])

  const sell = useCallback(() => {
    const g = G.current
    const tw = g.towers.find((t) => t.id === g.inspectId)
    if (!tw) return
    let invested = 0
    for (let i = 0; i <= tw.level; i++) invested += TOWERS[tw.key].levels[i].cost
    g.gold += Math.floor(invested * 0.7)
    g.towers = g.towers.filter((t) => t.id !== tw.id)
    g.inspectId = null
    setInspect(null)
    pushHud()
  }, [pushHud])

  const closeInspect = useCallback(() => { G.current.inspectId = null; setInspect(null) }, [])
  const toggleSpeed = useCallback(() => setSpeed((s) => (s === 1 ? 2 : 1)), [])

  const inspTw = inspect && G.current.towers.find((t) => t.id === inspect.id)
  const inspDef = inspTw && TOWERS[inspTw.key]
  const upCost = inspTw && inspTw.level < 2 ? inspDef.levels[inspTw.level + 1].cost : null
  let sellAmt = 0
  if (inspTw) { for (let i = 0; i <= inspTw.level; i++) sellAmt += inspDef.levels[i].cost; sellAmt = Math.floor(sellAmt * 0.7) }

  const previewWave = inter && hud.wave <= TOTAL_WAVES
    ? WAVES[Math.min(hud.wave - 1, TOTAL_WAVES - 1)].groups.map(([t, n]) => `${ENEMY_EMOJI[t]}×${n}`).join(' ')
    : ''

  return (
    <div className="td-container" ref={containerRef}>
      <Link to="/" className="td-back">← 홈으로</Link>
      <div className="td-wrapper" style={{ width: GAME_W * scale, height: STAGE_H * scale }}>
        <div className="td-stage" style={{ width: GAME_W, height: STAGE_H, transform: `scale(${scale})` }}>
          {/* 상단 HUD */}
          <div className="td-top" style={{ height: TOP_H }}>
            <div className="td-stat"><span>💰</span><b style={{ color: '#F1C40F' }}>{hud.gold}</b></div>
            <div className="td-stat"><span>❤️</span><b style={{ color: '#FF7675' }}>{hud.lives}</b></div>
            <div className="td-stat"><span>🌊</span><b style={{ color: '#00CEC9' }}>{hud.wave}/{TOTAL_WAVES}</b></div>
            <div className="td-stat"><span>⭐</span><b style={{ color: '#A29BFE' }}>{hud.score}</b></div>
            {streak > 1 && <div className="td-streak">🔥{streak}</div>}
            <button className="td-speed td-mute" onClick={toggleMute}>{muted ? '🔇' : '🔊'}</button>
            <button className={`td-speed${speed === 2 ? ' on' : ''}`} onClick={toggleSpeed}>{speed}x</button>
          </div>

          {/* 게임 필드 */}
          <div className="td-field" style={{ width: GAME_W, height: GAME_H }}>
            <canvas
              ref={canvasRef}
              className="td-canvas"
              style={{ width: GAME_W, height: GAME_H }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerLeave={onPointerLeave}
            />

            {phase === 'intermission' && inter && (
              <div className="td-countdown">
                <div className="td-cd-top">다음 웨이브 {hud.wave} · {inter.sec}초</div>
                {previewWave && <div className="td-cd-prev">{previewWave}</div>}
                <div className="td-cd-bar"><div className="td-cd-fill" style={{ width: `${(inter.sec / inter.total) * 100}%` }} /></div>
              </div>
            )}

            {(phase === 'wave' || phase === 'intermission') && (
              <div className="td-skills">
                <button className={`td-skill${skill.aiming ? ' arm' : ''}`} disabled={phase !== 'wave' || skill.meteor > 0} onClick={armMeteor}>
                  <span>☄️</span>{skill.meteor > 0 && <em>{skill.meteor}</em>}
                </button>
                <button className="td-skill" disabled={phase !== 'wave' || skill.freeze > 0} onClick={castFreeze}>
                  <span>❄️</span>{skill.freeze > 0 && <em>{skill.freeze}</em>}
                </button>
                <button className="td-skill" disabled={phase !== 'wave' || skill.confuse > 0} onClick={castConfuse}>
                  <span>🌀</span>{skill.confuse > 0 && <em>{skill.confuse}</em>}
                </button>
                <button className="td-skill" disabled={phase !== 'wave' || skill.thunder > 0} onClick={castThunder}>
                  <span>🌩️</span>{skill.thunder > 0 && <em>{skill.thunder}</em>}
                </button>
              </div>
            )}

            {inspTw && (
              <div
                className="td-popup"
                style={{
                  left: Math.max(8, Math.min(GAME_W - 148, inspTw.x - 70)),
                  top: inspTw.y > GAME_H - 110 ? inspTw.y - 92 : inspTw.y + 22,
                }}
              >
                <div className="td-popup-head">{inspDef.emoji} {inspDef.name} <span>Lv{inspTw.level + 1}</span></div>
                <div className="td-popup-btns">
                  <button disabled={!upCost || hud.gold < upCost} onClick={upgrade}>
                    {upCost ? `⬆ ${upCost}💰` : 'MAX'}
                  </button>
                  <button className="td-sell" onClick={sell}>💵 {sellAmt}</button>
                  <button className="td-close" onClick={closeInspect}>✕</button>
                </div>
              </div>
            )}
          </div>

          {/* 하단 타워 바 */}
          <div className="td-bottom" style={{ height: BOT_H }}>
            <div className="td-towers">
              {TOWER_ORDER.map((key) => {
                const t = TOWERS[key]
                const cost = t.levels[0].cost
                const can = hud.gold >= cost
                return (
                  <button
                    key={key}
                    className={`td-card${selected === key ? ' sel' : ''}${can ? '' : ' poor'}`}
                    style={{ '--tc': t.color }}
                    onClick={() => setSelected(selected === key ? null : key)}
                  >
                    <span className="td-card-emoji">{t.emoji}</span>
                    <span className="td-card-cost">{cost}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 오버레이 */}
          {(phase === 'menu' || phase === 'won' || phase === 'lost') && (
            <div className="td-overlay">
              <div className="td-card-box">
                {phase === 'menu' && (
                  <>
                    <h1>으악! 오지마</h1>
                    <p>길을 따라 몰려오는 젤리몽을<br />타워를 세워 막아내세요!</p>
                    <p className="td-tip">자동 진행 · ☄️❄️🌀🌩️ 스킬 · {TOTAL_WAVES}웨이브 사수</p>
                  </>
                )}
                {phase === 'won' && (
                  <>
                    <h1>🎉 클리어!</h1>
                    <p>{TOTAL_WAVES}웨이브를 모두 막아냈어요!</p>
                    <p className="td-score">점수 {hud.score} · 생명 {hud.lives}</p>
                  </>
                )}
                {phase === 'lost' && (
                  <>
                    <h1>💥 뚫렸어요</h1>
                    <p>{hud.wave}웨이브에서 무너졌어요</p>
                    <p className="td-score">점수 {hud.score}</p>
                  </>
                )}
                {best > 0 && <p className="td-best">최고 점수 {best}</p>}
                <button className="td-start" onClick={startGame}>
                  {phase === 'menu' ? '게임 시작' : '다시 하기'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function freshState() {
  return {
    gold: START_GOLD, lives: START_LIVES, score: 0, waveIdx: 0, bossSeen: 0,
    towers: [], enemies: [], shots: [], bolts: [], parts: [], floaters: [], bursts: [],
    queue: [], spawnTimer: 0, ids: 0,
    phase: 'menu', speed: 1, selected: null, hover: null, inspectId: null,
    interTimer: 0, interTotal: PREP_TIME, livesAtWave: START_LIVES, streak: 0,
    combo: 0, lastKill: 0, lastHitSfx: 0, lastLeakSfx: 0,
    meteorCd: 0, freezeCd: 0, confuseCd: 0, thunderCd: 0, aiming: false,
    meteorReq: null, freezeReq: false, confuseReq: false, thunderReq: false,
    thunderBolts: null, thunderUntil: 0,
    flashUntil: 0, freezeTintUntil: 0, confuseTintUntil: 0,
    bossBannerUntil: 0, bossBannerName: '', bossBannerColor: '#FFD166',
  }
}

function mergeStats(key, level) {
  const L = TOWERS[key].levels
  const base = { ...L[0] }
  for (let i = 1; i <= level; i++) Object.assign(base, L[i])
  return base
}

// ── 효과음 (Web Audio 합성음, 외부 파일 없음) ───────
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
  hit: (ac) => beep(ac, { freq: 300, to: 150, dur: 0.06, type: 'triangle', vol: 0.12 }),
  boss: (ac) => { beep(ac, { freq: 180, to: 60, dur: 0.5, type: 'sawtooth', vol: 0.24 }); beep(ac, { freq: 90, to: 40, dur: 0.6, type: 'square', vol: 0.18, delay: 0.05 }) },
  bossAppear: (ac) => [110, 110, 165, 220].forEach((f, i) => beep(ac, { freq: f, dur: 0.24, type: 'square', vol: 0.26, delay: i * 0.16 })),
  build: (ac) => beep(ac, { freq: 520, to: 800, dur: 0.12, type: 'square', vol: 0.18 }),
  skill: (ac) => beep(ac, { freq: 700, to: 1300, dur: 0.18, type: 'sawtooth', vol: 0.2 }),
  thunder: (ac) => { beep(ac, { freq: 1300, to: 200, dur: 0.26, type: 'sawtooth', vol: 0.26 }); beep(ac, { freq: 80, dur: 0.3, type: 'square', vol: 0.18, delay: 0.02 }) },
  leak: (ac) => beep(ac, { freq: 220, to: 110, dur: 0.18, type: 'sine', vol: 0.2 }),
  wave: (ac) => beep(ac, { freq: 300, to: 460, dur: 0.16, type: 'square', vol: 0.16 }),
  win: (ac) => [523, 659, 784, 1047].forEach((f, i) => beep(ac, { freq: f, dur: 0.18, type: 'square', vol: 0.2, delay: i * 0.12 })),
  lose: (ac) => [400, 300, 200].forEach((f, i) => beep(ac, { freq: f, dur: 0.26, type: 'sawtooth', vol: 0.2, delay: i * 0.14 })),
}

function makeScreenBolts() {
  const bolts = []
  for (let i = 0; i < 4; i++) {
    const x = 50 + i * 105 + (Math.random() * 30 - 15)
    const pts = [{ x, y: 0 }]
    let yy = 0
    while (yy < GAME_H) {
      yy += 32 + Math.random() * 30
      pts.push({ x: x + (Math.random() * 44 - 22), y: Math.min(yy, GAME_H) })
    }
    bolts.push(pts)
  }
  return bolts
}

// ── 몬스터 캔버스 드로잉 (경량 path 조합) ────────────
function fc(ctx, x, y, rad, color) {
  ctx.fillStyle = color
  ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill()
}
function fe(ctx, x, y, rx, ry, rot, color) {
  ctx.fillStyle = color
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fill()
}
function tri(ctx, x1, y1, x2, y2, x3, y3, color) {
  ctx.fillStyle = color
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath(); ctx.fill()
}

function drawSlime(ctx, cx, cy, r, now) {
  const t = Math.sin(now / 380)
  const sx = 1 - t * 0.07, sy = 1 + t * 0.12
  fe(ctx, cx, cy + r * 0.1, r * sx, r * 0.88 * sy, 0, '#7CC36E')
  ctx.fillStyle = '#5BA355'
  ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.35 * sy, r * 0.75 * sx, r * 0.32, 0, 0, Math.PI); ctx.fill()
  fe(ctx, cx - r * 0.3, cy - r * 0.25 * sy, r * 0.22, r * 0.15, -0.4, '#A8E09F')
  fc(ctx, cx - r * 0.32, cy - r * 0.1, r * 0.21, '#fff')
  fc(ctx, cx - r * 0.22, cy - r * 0.08, r * 0.1, '#2D5A27')
  fc(ctx, cx + r * 0.3, cy - r * 0.1, r * 0.21, '#fff')
  fc(ctx, cx + r * 0.4, cy - r * 0.08, r * 0.1, '#2D5A27')
}

function drawBat(ctx, cx, cy, r, now) {
  const wf = Math.sin(now / 130)
  fe(ctx, cx + r * 1.0, cy, r * 0.9, r * 0.45, 0, 'rgba(89,182,232,0.35)')
  ctx.fillStyle = '#3A9FD4'
  ctx.beginPath()
  ctx.moveTo(cx + r * 0.4, cy - r * 0.2)
  ctx.quadraticCurveTo(cx + r * 1.6, cy - r * (0.8 + wf * 0.35), cx + r * 0.7, cy + r * 0.2)
  ctx.closePath(); ctx.fill()
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.26)
  ctx.fillStyle = '#59B6E8'
  ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.78, 0, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
  fe(ctx, cx - r * 0.25, cy - r * 0.25, r * 0.3, r * 0.2, -0.4, '#8DD4F7')
  fc(ctx, cx - r * 0.2, cy - r * 0.1, r * 0.22, '#fff')
  fc(ctx, cx - r * 0.11, cy - r * 0.08, r * 0.11, '#1A5A80')
  ctx.strokeStyle = '#1A5A80'; ctx.lineWidth = 1.8
  ctx.beginPath(); ctx.moveTo(cx - r * 0.42, cy - r * 0.38); ctx.lineTo(cx + r * 0.02, cy - r * 0.3); ctx.stroke()
}

function drawGolem(ctx, cx, cy, r, now) {
  const y = cy + Math.sin(now / 720) * r * 0.03
  fc(ctx, cx, y, r, '#B5793A')
  ctx.fillStyle = '#7A4F20'
  ctx.fillRect(cx - r * 0.48, y - r * 0.08, r * 0.96, r * 0.68)
  ctx.beginPath(); ctx.arc(cx - r * 0.62, y - r * 0.42, r * 0.42, Math.PI * 0.5, Math.PI * 1.5); ctx.fill()
  ctx.beginPath(); ctx.arc(cx + r * 0.62, y - r * 0.42, r * 0.42, -Math.PI * 0.5, Math.PI * 0.5); ctx.fill()
  fc(ctx, cx - r * 0.35, y - r * 0.32, r * 0.18, '#D4956B')
  fc(ctx, cx - r * 0.22, y + r * 0.18, r * 0.08, '#4A3010')
  fc(ctx, cx + r * 0.22, y + r * 0.18, r * 0.08, '#4A3010')
  fc(ctx, cx - r * 0.28, y - r * 0.15, r * 0.17, '#fff')
  fc(ctx, cx - r * 0.2, y - r * 0.12, r * 0.09, '#3D2000')
  fc(ctx, cx + r * 0.28, y - r * 0.15, r * 0.17, '#fff')
  fc(ctx, cx + r * 0.36, y - r * 0.12, r * 0.09, '#3D2000')
  ctx.strokeStyle = '#3D2000'; ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(cx - r * 0.48, y - r * 0.36); ctx.lineTo(cx - r * 0.12, y - r * 0.3)
  ctx.moveTo(cx + r * 0.48, y - r * 0.36); ctx.lineTo(cx + r * 0.12, y - r * 0.3)
  ctx.stroke()
}

function drawChick(ctx, cx, cy, r, now) {
  const y = cy - Math.abs(Math.sin(now / 290)) * r * 0.28
  fc(ctx, cx, y, r, '#F4D03F')
  ctx.fillStyle = '#D4A800'
  ctx.beginPath(); ctx.arc(cx + r * 0.65, y + r * 0.1, r * 0.38, -Math.PI * 0.7, Math.PI * 0.7); ctx.fill()
  fc(ctx, cx - r * 0.28, y - r * 0.2, r * 0.22, '#FFF8A0')
  tri(ctx, cx - r * 0.18, y - r * 0.05, cx - r * 0.55, y + r * 0.1, cx - r * 0.18, y + r * 0.25, '#FF8C00')
  fc(ctx, cx - r * 0.08, y - r * 0.15, r * 0.13, '#2C2C2C')
  fc(ctx, cx - r * 0.02, y - r * 0.2, r * 0.05, '#fff')
  fc(ctx, cx - r * 0.38, y + r * 0.08, r * 0.18, 'rgba(255,148,80,0.45)')
}

// 대장여왕 (보라 + 큰 골드 왕관) — 기존 보스 외형
function drawGrandQueen(ctx, cx, cy, r, now) {
  const p = 1 + Math.sin(now / 480) * 0.045
  fc(ctx, cx, cy, r * p, '#9B59B6')
  ctx.fillStyle = '#7D3C98'
  ctx.beginPath(); ctx.arc(cx, cy + r * 0.25, r * 0.8 * p, 0, Math.PI); ctx.fill()
  fe(ctx, cx - r * 0.35, cy - r * 0.32, r * 0.28, r * 0.2, -0.5, '#C39BD3')
  ctx.fillStyle = '#F1C40F'
  ctx.beginPath()
  ctx.moveTo(cx - r * 0.58, cy - r * 0.8 * p)
  ctx.lineTo(cx + r * 0.58, cy - r * 0.8 * p)
  ctx.lineTo(cx + r * 0.52, cy - r * 0.55 * p)
  ctx.lineTo(cx - r * 0.52, cy - r * 0.55 * p)
  ctx.closePath()
  ctx.moveTo(cx - r * 0.52, cy - r * 0.82 * p); ctx.lineTo(cx - r * 0.68, cy - r * 1.22 * p); ctx.lineTo(cx - r * 0.35, cy - r * 0.82 * p); ctx.closePath()
  ctx.moveTo(cx - r * 0.12, cy - r * 0.82 * p); ctx.lineTo(cx, cy - r * 1.38 * p); ctx.lineTo(cx + r * 0.12, cy - r * 0.82 * p); ctx.closePath()
  ctx.moveTo(cx + r * 0.35, cy - r * 0.82 * p); ctx.lineTo(cx + r * 0.68, cy - r * 1.22 * p); ctx.lineTo(cx + r * 0.52, cy - r * 0.82 * p); ctx.closePath()
  ctx.fill()
  fc(ctx, cx - r * 0.38, cy - r * 0.05, r * 0.3, '#fff')
  fc(ctx, cx + r * 0.38, cy - r * 0.05, r * 0.3, '#fff')
  fc(ctx, cx - r * 0.28, cy - r * 0.01, r * 0.16, '#4A1A6B')
  fc(ctx, cx + r * 0.48, cy - r * 0.01, r * 0.16, '#4A1A6B')
  fc(ctx, cx - r * 0.22, cy - r * 0.07, r * 0.06, '#fff')
  fc(ctx, cx + r * 0.54, cy - r * 0.07, r * 0.06, '#fff')
  fc(ctx, cx - r * 0.63, cy + r * 0.22, r * 0.2, 'rgba(255,120,200,0.42)')
  fc(ctx, cx + r * 0.63, cy + r * 0.22, r * 0.2, 'rgba(255,120,200,0.42)')
  ctx.strokeStyle = '#4A1A6B'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - r * 0.62, cy - r * 0.42); ctx.lineTo(cx - r * 0.18, cy - r * 0.35)
  ctx.moveTo(cx + r * 0.62, cy - r * 0.42); ctx.lineTo(cx + r * 0.18, cy - r * 0.35)
  ctx.stroke()
  ctx.lineCap = 'butt'
}

function drawDart(ctx, cx, cy, r, now) {
  const wob = Math.sin(now / 90) * r * 0.12
  fe(ctx, cx + r * 0.9, cy, r * 0.85, r * 0.3, 0, 'rgba(255,112,67,0.30)') // 속도 잔상
  tri(ctx, cx - r * 1.05, cy + wob, cx - r * 0.3, cy - r * 0.45, cx - r * 0.3, cy + r * 0.45, '#E64A19') // 꼬리지느러미
  fe(ctx, cx, cy, r * 1.05, r * 0.68, 0, '#FF7043') // 유선형 몸통
  fe(ctx, cx - r * 0.1, cy - r * 0.28, r * 0.4, r * 0.16, -0.2, '#FFAB91') // 하이라이트
  fc(ctx, cx + r * 0.42, cy - r * 0.08, r * 0.2, '#fff')
  fc(ctx, cx + r * 0.49, cy - r * 0.06, r * 0.1, '#3A1500')
}

function drawBrute(ctx, cx, cy, r, now) {
  const y = cy + Math.sin(now / 560) * r * 0.025
  fc(ctx, cx, y, r, '#6B7280')
  fe(ctx, cx, y + r * 0.22, r * 0.86, r * 0.42, 0, '#4B5563') // 아래 음영
  fe(ctx, cx - r * 0.34, y - r * 0.34, r * 0.22, r * 0.14, -0.4, '#9CA3AF') // 하이라이트
  tri(ctx, cx - r * 0.5, y - r * 0.66, cx - r * 0.8, y - r * 1.16, cx - r * 0.18, y - r * 0.74, '#E5E7EB') // 왼 뿔
  tri(ctx, cx + r * 0.5, y - r * 0.66, cx + r * 0.8, y - r * 1.16, cx + r * 0.18, y - r * 0.74, '#E5E7EB') // 오른 뿔
  fc(ctx, cx - r * 0.3, y - r * 0.04, r * 0.16, '#fff')
  fc(ctx, cx - r * 0.26, y - r * 0.01, r * 0.08, '#111')
  fc(ctx, cx + r * 0.3, y - r * 0.04, r * 0.16, '#fff')
  fc(ctx, cx + r * 0.34, y - r * 0.01, r * 0.08, '#111')
  ctx.strokeStyle = '#1F2937'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - r * 0.5, y - r * 0.34); ctx.lineTo(cx - r * 0.12, y - r * 0.2)
  ctx.moveTo(cx + r * 0.5, y - r * 0.34); ctx.lineTo(cx + r * 0.12, y - r * 0.2)
  ctx.stroke()
  ctx.lineCap = 'butt'
}

function drawSplitter(ctx, cx, cy, r, now) {
  const t = Math.sin(now / 300)
  const R = r * (1 + t * 0.05)
  fc(ctx, cx - r * 0.5, cy + r * 0.5, r * 0.3, 'rgba(236,127,176,0.65)') // 작은 방울(분열 암시)
  fc(ctx, cx + r * 0.55, cy + r * 0.45, r * 0.26, 'rgba(236,127,176,0.65)')
  fc(ctx, cx, cy, R, '#EC7FB0')
  fe(ctx, cx - r * 0.3, cy - r * 0.3, r * 0.24, r * 0.16, -0.4, '#F8BBD0')
  fc(ctx, cx - r * 0.22, cy - r * 0.05, r * 0.17, '#fff')
  fc(ctx, cx - r * 0.16, cy - r * 0.03, r * 0.08, '#6A1B4D')
  fc(ctx, cx + r * 0.22, cy - r * 0.05, r * 0.17, '#fff')
  fc(ctx, cx + r * 0.28, cy - r * 0.03, r * 0.08, '#6A1B4D')
}

function drawMini(ctx, cx, cy, r, now) {
  const t = Math.sin(now / 220)
  fc(ctx, cx, cy, r * (1 + t * 0.06), '#F5A9C8')
  fc(ctx, cx - r * 0.25, cy - r * 0.05, r * 0.18, '#fff')
  fc(ctx, cx - r * 0.19, cy - r * 0.03, r * 0.09, '#6A1B4D')
  fc(ctx, cx + r * 0.25, cy - r * 0.05, r * 0.18, '#fff')
  fc(ctx, cx + r * 0.31, cy - r * 0.03, r * 0.09, '#6A1B4D')
}

// 여왕 (분홍 + 보석 티아라, 귀엽고 우아)
function drawQueen(ctx, cx, cy, r, now) {
  const p = 1 + Math.sin(now / 480) * 0.04
  const R = r * p
  fc(ctx, cx, cy, R, '#FF6FB5')
  ctx.fillStyle = '#E0559B'; ctx.beginPath(); ctx.arc(cx, cy + r * 0.25, r * 0.8 * p, 0, Math.PI); ctx.fill()
  fe(ctx, cx - r * 0.35, cy - r * 0.3, r * 0.26, r * 0.18, -0.5, '#FFC0DD')
  // 티아라
  ctx.fillStyle = '#FFD700'
  ctx.beginPath()
  ctx.moveTo(cx - r * 0.52, cy - r * 0.6)
  ctx.quadraticCurveTo(cx, cy - r * 0.96, cx + r * 0.52, cy - r * 0.6)
  ctx.lineTo(cx + r * 0.42, cy - r * 0.48)
  ctx.quadraticCurveTo(cx, cy - r * 0.76, cx - r * 0.42, cy - r * 0.48)
  ctx.closePath(); ctx.fill()
  fc(ctx, cx, cy - r * 0.8, r * 0.1, '#FF4D6D')
  fc(ctx, cx - r * 0.34, cy - r * 0.6, r * 0.06, '#7DD4F8')
  fc(ctx, cx + r * 0.34, cy - r * 0.6, r * 0.06, '#7DD4F8')
  // 큰 눈 + 반짝
  fc(ctx, cx - r * 0.32, cy - r * 0.02, r * 0.2, '#fff')
  fc(ctx, cx - r * 0.28, cy + r * 0.02, r * 0.11, '#5A2A4A')
  fc(ctx, cx - r * 0.24, cy - r * 0.03, r * 0.04, '#fff')
  fc(ctx, cx + r * 0.32, cy - r * 0.02, r * 0.2, '#fff')
  fc(ctx, cx + r * 0.36, cy + r * 0.02, r * 0.11, '#5A2A4A')
  fc(ctx, cx + r * 0.4, cy - r * 0.03, r * 0.04, '#fff')
  ctx.strokeStyle = '#5A2A4A'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - r * 0.52, cy - r * 0.16); ctx.lineTo(cx - r * 0.4, cy - r * 0.2)
  ctx.moveTo(cx + r * 0.52, cy - r * 0.16); ctx.lineTo(cx + r * 0.4, cy - r * 0.2)
  ctx.stroke(); ctx.lineCap = 'butt'
  fc(ctx, cx - r * 0.55, cy + r * 0.26, r * 0.16, 'rgba(255,120,170,0.5)')
  fc(ctx, cx + r * 0.55, cy + r * 0.26, r * 0.16, 'rgba(255,120,170,0.5)')
  ctx.strokeStyle = '#A03A6A'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.arc(cx, cy + r * 0.26, r * 0.18, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke()
}

// 마왕 (빨강 + 뿔 + 송곳니, 사악)
function drawDemon(ctx, cx, cy, r, now) {
  const p = 1 + Math.sin(now / 360) * 0.05
  const R = r * p
  tri(ctx, cx - r * 0.55, cy - r * 0.55, cx - r * 0.95, cy - r * 1.25, cx - r * 0.2, cy - r * 0.7, '#7A1B1B')
  tri(ctx, cx + r * 0.55, cy - r * 0.55, cx + r * 0.95, cy - r * 1.25, cx + r * 0.2, cy - r * 0.7, '#7A1B1B')
  fc(ctx, cx, cy, R, '#E74C3C')
  ctx.fillStyle = '#B03A2E'; ctx.beginPath(); ctx.arc(cx, cy + r * 0.25, r * 0.8 * p, 0, Math.PI); ctx.fill()
  fe(ctx, cx - r * 0.35, cy - r * 0.3, r * 0.24, r * 0.16, -0.5, '#F1948A')
  // 사악한 눈 (노란 흰자 + 검은 동공)
  tri(ctx, cx - r * 0.5, cy - r * 0.12, cx - r * 0.1, cy - r * 0.2, cx - r * 0.14, cy + r * 0.06, '#FFE08A')
  tri(ctx, cx + r * 0.5, cy - r * 0.12, cx + r * 0.1, cy - r * 0.2, cx + r * 0.14, cy + r * 0.06, '#FFE08A')
  fc(ctx, cx - r * 0.28, cy - r * 0.06, r * 0.07, '#2A0000')
  fc(ctx, cx + r * 0.28, cy - r * 0.06, r * 0.07, '#2A0000')
  ctx.strokeStyle = '#5A0E0E'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - r * 0.52, cy - r * 0.3); ctx.lineTo(cx - r * 0.12, cy - r * 0.12)
  ctx.moveTo(cx + r * 0.52, cy - r * 0.3); ctx.lineTo(cx + r * 0.12, cy - r * 0.12)
  ctx.stroke(); ctx.lineCap = 'butt'
  // 송곳니 입
  ctx.fillStyle = '#3A0808'
  ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.4, r * 0.3, r * 0.15, 0, 0, Math.PI * 2); ctx.fill()
  tri(ctx, cx - r * 0.16, cy + r * 0.33, cx - r * 0.08, cy + r * 0.56, cx - r * 0.0, cy + r * 0.33, '#fff')
  tri(ctx, cx + r * 0.16, cy + r * 0.33, cx + r * 0.08, cy + r * 0.56, cx + r * 0.0, cy + r * 0.33, '#fff')
}

// 대마왕 (검붉은 + 큰 뿔 + 가시 왕관 + 화염 눈, 최종보스)
function drawDarkLord(ctx, cx, cy, r, now) {
  const p = 1 + Math.sin(now / 300) * 0.05
  const R = r * p
  tri(ctx, cx - r * 0.6, cy - r * 0.5, cx - r * 1.1, cy - r * 1.45, cx - r * 0.15, cy - r * 0.72, '#2A1010')
  tri(ctx, cx + r * 0.6, cy - r * 0.5, cx + r * 1.1, cy - r * 1.45, cx + r * 0.15, cy - r * 0.72, '#2A1010')
  fc(ctx, cx, cy, R, '#7A2222')
  ctx.fillStyle = '#4A1414'; ctx.beginPath(); ctx.arc(cx, cy + r * 0.25, r * 0.8 * p, 0, Math.PI); ctx.fill()
  fe(ctx, cx - r * 0.35, cy - r * 0.3, r * 0.24, r * 0.16, -0.5, '#A84B4B')
  // 가시 왕관
  for (let i = -2; i <= 2; i++) {
    const sx = cx + i * r * 0.27
    const peak = cy - r * 0.92 - (i === 0 ? r * 0.22 : 0)
    tri(ctx, sx - r * 0.12, cy - r * 0.58, sx, peak, sx + r * 0.12, cy - r * 0.58, '#0A0505')
  }
  // 화염 눈
  fc(ctx, cx - r * 0.3, cy - r * 0.02, r * 0.17, '#FF6B00')
  fc(ctx, cx + r * 0.3, cy - r * 0.02, r * 0.17, '#FF6B00')
  fc(ctx, cx - r * 0.3, cy - r * 0.02, r * 0.09, '#FFE08A')
  fc(ctx, cx + r * 0.3, cy - r * 0.02, r * 0.09, '#FFE08A')
  ctx.strokeStyle = '#1A0505'; ctx.lineWidth = 3; ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - r * 0.54, cy - r * 0.3); ctx.lineTo(cx - r * 0.1, cy - r * 0.1)
  ctx.moveTo(cx + r * 0.54, cy - r * 0.3); ctx.lineTo(cx + r * 0.1, cy - r * 0.1)
  ctx.stroke(); ctx.lineCap = 'butt'
  ctx.fillStyle = '#1A0505'
  ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.42, r * 0.32, r * 0.15, 0, 0, Math.PI * 2); ctx.fill()
  tri(ctx, cx - r * 0.18, cy + r * 0.34, cx - r * 0.1, cy + r * 0.6, cx - r * 0.02, cy + r * 0.34, '#fff')
  tri(ctx, cx + r * 0.18, cy + r * 0.34, cx + r * 0.1, cy + r * 0.6, cx + r * 0.02, cy + r * 0.34, '#fff')
}

const ENEMY_DRAW = {
  basic: drawSlime, fast: drawBat, tank: drawGolem, swarm: drawChick,
  dart: drawDart, brute: drawBrute, splitter: drawSplitter, mini: drawMini,
}
const BOSS_DRAW = [drawQueen, drawDemon, drawGrandQueen, drawDarkLord]

function drawEnemy(ctx, e, now) {
  if (e.type === 'boss') (BOSS_DRAW[e.bossIdx] || drawGrandQueen)(ctx, e.x, e.y, e.r, now)
  else ENEMY_DRAW[e.type](ctx, e.x, e.y, e.r, now)
  if (e.slowMul < 1) {
    ctx.globalAlpha = 0.32
    fc(ctx, e.x, e.y, e.r, '#7BD4F8')
    ctx.globalAlpha = 1
  }
}

export default TowerDefense
