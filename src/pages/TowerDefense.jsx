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
const START_GOLD = 80
const START_LIVES = 10
const PARTICLE_CAP = 90
const PREP_TIME = 3000
const INTER_TIME = 3000
const COMBO_WINDOW = 1200
const METEOR_CD = 32000
const METEOR_DMG = 85
const METEOR_R = 62
const FREEZE_CD = 48000
const FREEZE_DUR = 1600
const CONFUSE_CD = 45000
const CONFUSE_DUR = 3000

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

// ── 타워 4종 (levels[0]=건설, [1]=Lv2, [2]=Lv3) ─────────
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
}
const TOWER_ORDER = ['arrow', 'frost', 'cannon', 'bolt']

// ── 적 5종 ──────────────────────────────────────────
const ENEMIES = {
  basic: { name: '콩알이', emoji: '🟢', color: '#7CC36E', hp: 38, speed: 55, gold: 4, dmg: 1, r: 13 },
  fast: { name: '쌩쌩이', emoji: '💨', color: '#59B6E8', hp: 20, speed: 122, gold: 5, dmg: 1, r: 11 },
  tank: { name: '둥글탱', emoji: '🛡️', color: '#B5793A', hp: 180, speed: 34, gold: 9, dmg: 3, r: 17 },
  swarm: { name: '옹기종', emoji: '🐤', color: '#F4D03F', hp: 16, speed: 72, gold: 2, dmg: 1, r: 10 },
  boss: { name: '왕방울', emoji: '👑', color: '#9B59B6', hp: 980, speed: 30, gold: 55, dmg: 6, r: 24 },
}

// ── 15웨이브 (강화) ─────────────────────────────────
const WAVES = [
  { bonus: 25, gap: 1100, groups: [['basic', 6]] },
  { bonus: 28, gap: 1000, groups: [['basic', 8], ['fast', 3]] },
  { bonus: 30, gap: 850, groups: [['basic', 6], ['swarm', 12]] },
  { bonus: 33, gap: 880, groups: [['basic', 8], ['fast', 5], ['tank', 2]] },
  { bonus: 50, gap: 780, groups: [['boss', 1], ['basic', 10], ['fast', 4]] },
  { bonus: 38, gap: 780, groups: [['tank', 4], ['fast', 8]] },
  { bonus: 42, gap: 560, groups: [['swarm', 20], ['basic', 8]] },
  { bonus: 45, gap: 720, groups: [['tank', 5], ['fast', 10]] },
  { bonus: 48, gap: 680, groups: [['basic', 14], ['tank', 5], ['fast', 8]] },
  { bonus: 75, gap: 620, groups: [['boss', 1], ['tank', 5], ['swarm', 16]] },
  { bonus: 52, gap: 600, groups: [['tank', 8], ['fast', 14]] },
  { bonus: 55, gap: 430, groups: [['swarm', 34], ['tank', 6]] },
  { bonus: 58, gap: 560, groups: [['tank', 10], ['fast', 16], ['basic', 14]] },
  { bonus: 62, gap: 460, groups: [['tank', 11], ['swarm', 28], ['fast', 12]] },
  { bonus: 90, gap: 500, groups: [['boss', 2], ['tank', 9], ['fast', 16], ['swarm', 14]] },
]

function waveHp(type, wave, bossSeen) {
  const base = ENEMIES[type].hp
  if (type === 'boss') return Math.round(base * (1 + 0.7 * (bossSeen - 1)))
  return Math.round(base * (1 + 0.22 * (wave - 1)))
}
function waveSpeed(type, wave) {
  return ENEMIES[type].speed * Math.min(1.45, 1 + 0.028 * (wave - 1))
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
  const [inter, setInter] = useState(null) // {sec, bonus, total}
  const [streak, setStreak] = useState(0)
  const [skill, setSkill] = useState({ meteor: 0, freeze: 0, confuse: 0, aiming: false })

  const G = useRef(null)
  if (G.current === null) {
    G.current = freshState()
  }

  useEffect(() => {
    try { setBest(Number(localStorage.getItem('tower-defense-best')) || 0) } catch { /* ignore */ }
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
    setHud({ gold: g.gold, lives: g.lives, wave: Math.min(g.waveIdx + 1, 15), score: g.score })
  }, [])

  const saveBest = useCallback((s) => {
    setBest((prev) => {
      if (s <= prev) return prev
      try { localStorage.setItem('tower-defense-best', String(s)) } catch { /* ignore */ }
      return s
    })
  }, [])

  // 다음 웨이브 시작 (자동/early)
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
  }, [])

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
      if (g.floaters.length > 30) return
      g.floaters.push({ x, y, text, color, born: performance.now() })
    }

    const killEnemy = (e) => {
      const g = G.current
      const now = performance.now()
      let gain = e.gold
      g.combo = (now - g.lastKill < COMBO_WINDOW) ? g.combo + 1 : 1
      g.lastKill = now
      g.score += Math.round(10 * (1 + Math.min(g.combo, 10) * 0.1))
      if (g.combo >= 3) pushFloater(e.x, e.y - e.r - 4, 'x' + g.combo, '#FFE08A')
      if (e.type === 'boss') {
        gain += 30
        g.score += 200
        g.flashUntil = now + 160
        spawnParts(e.x, e.y, e.color, 20, { life: 0.7, size: 6 })
        pushFloater(e.x, e.y, 'BOSS 처치! +' + gain, '#FFD166')
      } else {
        spawnParts(e.x, e.y, e.color, 5, { life: 0.45, size: 4 })
      }
      g.gold += gain
    }

    const update = (dt) => {
      const g = G.current
      const now = performance.now()

      // 스킬 발동 요청 처리
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
      }
      if (g.freezeReq) {
        g.freezeReq = false
        for (const e of g.enemies) { if (!e.dead) { e.slowMul = 0; e.slowUntil = now + FREEZE_DUR } }
        g.freezeTintUntil = now + 320
        g.freezeCd = FREEZE_CD
      }
      if (g.confuseReq) {
        g.confuseReq = false
        for (const e of g.enemies) {
          if (e.dead) continue
          e.confusedUntil = now + CONFUSE_DUR
          spawnParts(e.x, e.y, '#B07BEB', 3, { life: 0.4 })
        }
        g.confuseTintUntil = now + 300
        g.confuseCd = CONFUSE_CD
      }

      // 스폰
      if (g.queue.length > 0) {
        g.spawnTimer -= dt * 1000
        if (g.spawnTimer <= 0) {
          const type = g.queue.shift()
          if (type === 'boss') g.bossSeen += 1
          const wave = g.waveIdx + 1
          const hp = waveHp(type, wave, g.bossSeen)
          g.enemies.push({
            id: ++g.ids, type, color: ENEMIES[type].color,
            r: ENEMIES[type].r, gold: ENEMIES[type].gold, dmg: ENEMIES[type].dmg,
            x: PATH[0].x, y: PATH[0].y, seg: 0, hp, maxHp: hp,
            base: waveSpeed(type, wave), slowMul: 1, slowUntil: 0,
          })
          g.spawnTimer = WAVES[g.waveIdx].gap
        }
      }

      // 적 이동
      for (const e of g.enemies) {
        if (e.slowUntil && now > e.slowUntil) { e.slowMul = 1; e.slowUntil = 0 }
        let move = e.base * e.slowMul * dt
        // 혼란: 왔던 길로 역행
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
            x: tw.x, y: tw.y, targetId: target.id, speed: st.pspeed, dmg: st.dmg,
            color: TOWERS[tw.key].color, kind, splash: st.splash || 0,
            slow: st.slow || 0, slowDur: st.slowDur || 0,
          })
        }
      }

      // 투사체
      for (const s of g.shots) {
        const t = g.enemies.find((e) => e.id === s.targetId && !e.dead)
        if (!t) { s.dead = true; continue }
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

      // 파티클
      for (const p of g.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt }
      for (const b of g.bolts) b.life -= dt

      if (g.enemies.some((e) => e.dead)) g.enemies = g.enemies.filter((e) => !e.dead)
      if (g.shots.some((s) => s.dead)) g.shots = g.shots.filter((s) => !s.dead)
      if (g.parts.some((p) => p.life <= 0)) g.parts = g.parts.filter((p) => p.life > 0)
      if (g.bolts.some((b) => b.life <= 0)) g.bolts = g.bolts.filter((b) => b.life > 0)

      // 패배
      if (g.lives <= 0) {
        g.lives = 0
        g.phase = 'lost'
        setPhase('lost')
        saveBest(g.score)
        pushHud()
        return
      }
      // 웨이브 종료
      if (g.queue.length === 0 && g.enemies.length === 0) {
        const w = WAVES[g.waveIdx]
        if (g.lives >= g.livesAtWave) g.streak += 1
        else g.streak = 0
        const streakBonus = Math.min(g.streak, 5) * 10
        g.gold += w.bonus + streakBonus
        g.score += 100
        g.waveIdx += 1
        if (g.waveIdx >= WAVES.length) {
          g.score += g.lives * 50 + g.gold + (g.lives >= START_LIVES ? 500 : 0)
          g.phase = 'won'
          setPhase('won')
          saveBest(g.score)
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

      // 건설 가능 타일 하이라이트
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

      // 번개
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

      // 파티클
      for (const p of g.parts) {
        ctx.globalAlpha = Math.max(0, p.life / p.max)
        ctx.fillStyle = p.color
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalAlpha = 1

      // 플로팅 텍스트(콤보/보스)
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

      // 운석 조준 안내
      if (g.aiming) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)'
        ctx.fillRect(0, 0, GAME_W, GAME_H)
        ctx.fillStyle = '#FFE08A'
        ctx.font = 'bold 15px system-ui'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText('☄️ 운석 떨어뜨릴 곳을 탭!', GAME_W / 2, 30)
      }

      // 보스 처치 플래시
      const fa = (g.flashUntil - now) / 160
      if (fa > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (fa * 0.55) + ')'; ctx.fillRect(0, 0, GAME_W, GAME_H) }
      // 빙결 틴트
      const ft = (g.freezeTintUntil - now) / 320
      if (ft > 0) { ctx.fillStyle = 'rgba(120,212,248,' + (ft * 0.4) + ')'; ctx.fillRect(0, 0, GAME_W, GAME_H) }
      // 혼란 틴트
      const ct = (g.confuseTintUntil - now) / 300
      if (ct > 0) { ctx.fillStyle = 'rgba(170,110,235,' + (ct * 0.4) + ')'; ctx.fillRect(0, 0, GAME_W, GAME_H) }
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
        setSkill((p) => {
          const m = Math.ceil(g.meteorCd / 1000), f = Math.ceil(g.freezeCd / 1000), cf = Math.ceil(g.confuseCd / 1000)
          return (p.meteor === m && p.freeze === f && p.confuse === cf && p.aiming === g.aiming)
            ? p : { meteor: m, freeze: f, confuse: cf, aiming: g.aiming }
        })
      }

      if (g.phase === 'wave') {
        update(dt * g.speed)
        setHud((h) => (h.gold === g.gold && h.lives === g.lives && h.score === g.score
          ? h : { gold: g.gold, lives: g.lives, wave: Math.min(g.waveIdx + 1, 15), score: g.score }))
      } else if (g.phase === 'intermission') {
        g.interTimer -= dt * 1000 // 실시간(배속 무관)
        if (g.interTimer <= 0) {
          startWave()
        } else {
          const sec = Math.ceil(g.interTimer / 1000)
          const bonus = Math.ceil((g.interTimer / 1000) * 4)
          const total = Math.ceil(g.interTotal / 1000)
          setInter((p) => (p && p.sec === sec ? p : { sec, bonus, total }))
        }
      }

      draw(now)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [pushHud, saveBest, startWave])

  // ── 입력 ──
  const onPointerDown = useCallback((ev) => {
    const g = G.current
    if (g.phase === 'menu' || g.phase === 'won' || g.phase === 'lost') return
    const rect = canvasRef.current.getBoundingClientRect()
    const px = (ev.clientX - rect.left) / scale
    const py = (ev.clientY - rect.top) / scale
    if (px < 0 || py < 0 || px >= GAME_W || py >= GAME_H) return

    // 운석 조준
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
      }
    } else {
      g.inspectId = null
      setInspect(null)
    }
  }, [scale, pushHud])

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
    Object.assign(g, freshState())
    g.phase = 'intermission'
    g.interTimer = PREP_TIME
    g.interTotal = PREP_TIME
    setSelected(null); setInspect(null); setSpeed(1); setStreak(0)
    setSkill({ meteor: 0, freeze: 0, confuse: 0, aiming: false })
    setPhase('intermission')
    pushHud()
  }, [pushHud])

  const callNow = useCallback(() => {
    const g = G.current
    if (g.phase !== 'intermission') return
    const bonus = Math.ceil((g.interTimer / 1000) * 4)
    g.gold += bonus
    g.score += bonus
    g.interTimer = 0
    pushHud()
    startWave()
  }, [pushHud, startWave])

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

  const previewWave = inter && hud.wave <= 15
    ? WAVES[Math.min(hud.wave - 1, 14)].groups.map(([t, n]) => `${ENEMIES[t].emoji}×${n}`).join(' ')
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
            <div className="td-stat"><span>🌊</span><b style={{ color: '#00CEC9' }}>{hud.wave}/15</b></div>
            <div className="td-stat"><span>⭐</span><b style={{ color: '#A29BFE' }}>{hud.score}</b></div>
            {streak > 1 && <div className="td-streak">🔥{streak}</div>}
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

            {/* 카운트다운 */}
            {phase === 'intermission' && inter && (
              <div className="td-countdown">
                <div className="td-cd-top">다음 웨이브 {hud.wave} · {inter.sec}초</div>
                {previewWave && <div className="td-cd-prev">{previewWave}</div>}
                <div className="td-cd-bar"><div className="td-cd-fill" style={{ width: `${(inter.sec / inter.total) * 100}%` }} /></div>
              </div>
            )}

            {/* 스킬 버튼 */}
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
                    <span className="td-card-cost">{cost}💰</span>
                  </button>
                )
              })}
            </div>
            <button className="td-wave-btn" disabled={phase !== 'intermission'} onClick={callNow}>
              {phase === 'intermission' && inter ? <>지금!<em>+{inter.bonus}</em></> : '진행중'}
            </button>
          </div>

          {/* 오버레이 */}
          {(phase === 'menu' || phase === 'won' || phase === 'lost') && (
            <div className="td-overlay">
              <div className="td-card-box">
                {phase === 'menu' && (
                  <>
                    <h1>으악! 오지마</h1>
                    <p>길을 따라 몰려오는 젤리몽을<br />타워를 세워 막아내세요!</p>
                    <p className="td-tip">웨이브 자동 진행 · ☄️❄️🌀 스킬로 위기 탈출 · 15웨이브 사수</p>
                  </>
                )}
                {phase === 'won' && (
                  <>
                    <h1>🎉 클리어!</h1>
                    <p>15웨이브를 모두 막아냈어요!</p>
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
    towers: [], enemies: [], shots: [], bolts: [], parts: [], floaters: [],
    queue: [], spawnTimer: 0, ids: 0,
    phase: 'menu', speed: 1, selected: null, hover: null, inspectId: null,
    interTimer: 0, interTotal: PREP_TIME, livesAtWave: START_LIVES, streak: 0,
    combo: 0, lastKill: 0,
    meteorCd: 0, freezeCd: 0, confuseCd: 0, aiming: false,
    meteorReq: null, freezeReq: false, confuseReq: false,
    flashUntil: 0, freezeTintUntil: 0, confuseTintUntil: 0,
  }
}

function mergeStats(key, level) {
  const L = TOWERS[key].levels
  const base = { ...L[0] }
  for (let i = 1; i <= level; i++) Object.assign(base, L[i])
  return base
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

function drawBoss(ctx, cx, cy, r, now) {
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

const ENEMY_DRAW = { basic: drawSlime, fast: drawBat, tank: drawGolem, swarm: drawChick, boss: drawBoss }

function drawEnemy(ctx, e, now) {
  ENEMY_DRAW[e.type](ctx, e.x, e.y, e.r, now)
  if (e.slowMul < 1) {
    ctx.globalAlpha = 0.32
    fc(ctx, e.x, e.y, e.r, '#7BD4F8')
    ctx.globalAlpha = 1
  }
}

export default TowerDefense
