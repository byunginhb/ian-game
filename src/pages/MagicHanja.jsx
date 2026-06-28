import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useGameScale } from '../hooks/useGameScale'
import { useTouchLock } from '../hooks/useTouchLock'
import './MagicHanja.css'

const GAME_W = 360
const HUD_H = 46
const CANVAS_H = 230
const Q_H = 86
const OPT_H = 158
const STAGE_H = HUD_H + CANVAS_H + Q_H + OPT_H
const START_LIVES = 5
const PARTICLE_CAP = 90

// ── 한자 데이터 (대표 훈음 + 마법색) ──────────────────
const HANJA = [
  { c: '一', m: '한', s: '일', col: '#8B5CF6' },
  { c: '二', m: '두', s: '이', col: '#8B5CF6' },
  { c: '三', m: '석', s: '삼', col: '#8B5CF6' },
  { c: '四', m: '넉', s: '사', col: '#8B5CF6' },
  { c: '五', m: '다섯', s: '오', col: '#8B5CF6' },
  { c: '六', m: '여섯', s: '육', col: '#8B5CF6' },
  { c: '七', m: '일곱', s: '칠', col: '#8B5CF6' },
  { c: '八', m: '여덟', s: '팔', col: '#8B5CF6' },
  { c: '九', m: '아홉', s: '구', col: '#8B5CF6' },
  { c: '十', m: '열', s: '십', col: '#8B5CF6' },
  { c: '日', m: '날', s: '일', col: '#FF9F1C' },
  { c: '月', m: '달', s: '월', col: '#C7CEDB' },
  { c: '火', m: '불', s: '화', col: '#F0553A' },
  { c: '水', m: '물', s: '수', col: '#3B9EDB' },
  { c: '木', m: '나무', s: '목', col: '#46B36B' },
  { c: '金', m: '쇠', s: '금', col: '#E0B341' },
  { c: '土', m: '흙', s: '토', col: '#B5793A' },
  { c: '山', m: '메', s: '산', col: '#6BA368' },
  { c: '川', m: '내', s: '천', col: '#4FA8D8' },
  { c: '天', m: '하늘', s: '천', col: '#5BB4E0' },
  { c: '地', m: '땅', s: '지', col: '#A9763B' },
  { c: '人', m: '사람', s: '인', col: '#E08A5B' },
  { c: '大', m: '큰', s: '대', col: '#9B59B6' },
  { c: '小', m: '작을', s: '소', col: '#7FC8A9' },
  { c: '中', m: '가운데', s: '중', col: '#E06C9F' },
  { c: '上', m: '윗', s: '상', col: '#79C0E8' },
  { c: '下', m: '아래', s: '하', col: '#A0A0C0' },
  { c: '東', m: '동녘', s: '동', col: '#6FCF97' },
  { c: '西', m: '서녘', s: '서', col: '#F2C14E' },
  { c: '南', m: '남녘', s: '남', col: '#F08A5D' },
  { c: '北', m: '북녘', s: '북', col: '#7FB3D5' },
  { c: '父', m: '아비', s: '부', col: '#E8896C' },
  { c: '母', m: '어미', s: '모', col: '#EC9BB0' },
  { c: '兄', m: '형', s: '형', col: '#D98880' },
  { c: '弟', m: '아우', s: '제', col: '#E6B0AA' },
  { c: '王', m: '임금', s: '왕', col: '#E0B341' },
  { c: '學', m: '배울', s: '학', col: '#5DADE2' },
  { c: '門', m: '문', s: '문', col: '#9A7B5F' },
  { c: '先', m: '먼저', s: '선', col: '#76D7C4' },
  { c: '生', m: '날', s: '생', col: '#82C785' },
  { c: '白', m: '흰', s: '백', col: '#E5E8E8' },
  { c: '靑', m: '푸를', s: '청', col: '#5499C7' },
  { c: '力', m: '힘', s: '력', col: '#EC7063' },
  { c: '心', m: '마음', s: '심', col: '#F1948A' },
]

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function makeQuestion() {
  const data = HANJA[Math.floor(Math.random() * HANJA.length)]
  const mode = Math.floor(Math.random() * 3) // 0 뜻, 1 음, 2 한자
  let promptText, sub, correct, key, big
  if (mode === 0) { promptText = data.c; sub = '이 한자의 뜻은?'; correct = data.m; key = 'm'; big = true }
  else if (mode === 1) { promptText = data.c; sub = '이 한자의 음(소리)은?'; correct = data.s; key = 's'; big = true }
  else { promptText = `${data.m} ${data.s}`; sub = '알맞은 한자는?'; correct = data.c; key = 'c'; big = false }

  const set = new Set([correct])
  const opts = [correct]
  let guard = 0
  while (opts.length < 4 && guard++ < 200) {
    const v = HANJA[Math.floor(Math.random() * HANJA.length)][key]
    if (!set.has(v)) { set.add(v); opts.push(v) }
  }
  shuffle(opts)
  return {
    char: data.c, color: data.col, mode,
    promptText, promptBig: big, sub,
    options: opts, correctIdx: opts.indexOf(correct), optBig: mode === 2,
    answered: false, pickedIdx: -1,
  }
}

function makeEnemy(stage) {
  const maxHp = Math.min(7, 2 + Math.floor(stage / 2))
  return { type: (stage - 1) % 3, hp: maxHp, maxHp, x: 278, y: 122, dying: false, dieAt: 0, shakeUntil: 0, attackUntil: 0 }
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
  over: (ac) => [440, 330, 247, 165].forEach((f, i) => beep(ac, { freq: f, dur: 0.3, type: 'sawtooth', vol: 0.2, delay: i * 0.16 })),
}

function MagicHanja() {
  const scale = useGameScale(GAME_W, STAGE_H, { reservedH: 16, maxScale: 1.3 })
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  useTouchLock(containerRef)

  const [phase, setPhase] = useState('menu') // menu | play | over
  const [hud, setHud] = useState({ lives: START_LIVES, score: 0, combo: 0, stage: 1, learned: 0 })
  const [q, setQ] = useState(null)
  const [best, setBest] = useState(() => {
    try { return Number(localStorage.getItem('magic-hanja-best')) || 0 } catch { return 0 }
  })
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem('mh-muted') === '1' } catch { return false }
  })

  const G = useRef(null)
  if (G.current === null) G.current = fresh()
  const audioRef = useRef(null)
  const mutedRef = useRef(muted)

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
      try { localStorage.setItem('mh-muted', next ? '1' : '0') } catch { /* ignore */ }
      return next
    })
  }, [])

  const syncHud = useCallback(() => {
    const g = G.current
    setHud({ lives: g.lives, score: g.score, combo: g.combo, stage: g.stage, learned: g.learned.size })
  }, [])

  // ── 게임 루프 (캔버스 연출만, 입력은 DOM 버튼) ──
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
      // 주인공 마법 투사체 → 적
      if (g.proj) {
        g.proj.t += dt * 2.6
        if (g.proj.t >= 1) {
          const e = g.enemy
          burst(e.x, e.y, g.proj.color, 16, { spread: 130, life: 0.55, size: 4 })
          play('hit')
          e.hp -= 1
          e.shakeUntil = now + 280
          if (e.hp <= 0 && !e.dying) {
            e.dying = true; e.dieAt = now
            burst(e.x, e.y, '#FFE08A', 22, { spread: 150, life: 0.7, size: 5 })
            play('defeat')
          }
          g.proj = null
        }
      }
      // 적 반격 투사체 → 주인공
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

    const drawBg = () => {
      ctx.fillStyle = '#2a2350'
      ctx.fillRect(0, 0, GAME_W, CANVAS_H)
      // 은은한 동양풍 동심원
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'
      ctx.lineWidth = 1
      for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.arc(GAME_W / 2, CANVAS_H + 30, i * 50, 0, Math.PI * 2); ctx.stroke() }
      ctx.fillStyle = 'rgba(0,0,0,0.18)'
      ctx.fillRect(0, CANVAS_H - 34, GAME_W, 34)
    }

    const draw = (now) => {
      const g = G.current
      drawBg()
      if (g.phase === 'play' || g.phase === 'over') {
        drawEnemy(ctx, g.enemy, now)
        const hb = g.heroHurtUntil > now ? Math.sin(now / 28) * 3 : 0
        drawHero(ctx, g.hero.x + hb, g.hero.y, now, g.castUntil > now, g.castChar, g.castColor)
        // 투사체
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
      // 피격 화면 플래시
      const fl = (g.flashUntil - now) / 300
      if (fl > 0) { ctx.fillStyle = 'rgba(231,76,60,' + (fl * 0.4) + ')'; ctx.fillRect(0, 0, GAME_W, CANVAS_H) }
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

  const nextQuestion = useCallback(() => { setQ(makeQuestion()) }, [])

  const nextStage = useCallback(() => {
    const g = G.current
    g.stage += 1
    g.enemy = makeEnemy(g.stage)
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
      g.learned.add(q.char)
      g.castUntil = now + 440
      g.castChar = q.char
      g.castColor = q.color
      g.proj = { t: 0, color: q.color }
      play('correct'); play('cast')
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
      g.flashUntil = now + 300
      play('wrong')
      syncHud()
      setTimeout(() => {
        if (G.current.phase !== 'play') return
        if (G.current.lives <= 0) {
          G.current.phase = 'over'
          setPhase('over')
          play('over')
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
    setPhase('play')
    syncHud()
    setQ(makeQuestion())
  }, [syncHud])

  return (
    <div className="mh-container" ref={containerRef}>
      <Link to="/" className="mh-back">← 홈으로</Link>
      <div className="mh-wrapper" style={{ width: GAME_W * scale, height: STAGE_H * scale }}>
        <div className="mh-stage" style={{ width: GAME_W, height: STAGE_H, transform: `scale(${scale})` }}>
          {/* HUD */}
          <div className="mh-top" style={{ height: HUD_H }}>
            <div className="mh-hearts">{'❤️'.repeat(Math.max(0, hud.lives))}{'🖤'.repeat(Math.max(0, START_LIVES - hud.lives))}</div>
            <div className="mh-stat">⭐{hud.score}</div>
            <div className="mh-stat">📚{hud.learned}</div>
            {hud.combo > 1 && <div className="mh-combo">🔥{hud.combo}</div>}
            <button className="mh-mute" onClick={toggleMute}>{muted ? '🔇' : '🔊'}</button>
          </div>

          {/* 배틀 캔버스 */}
          <div className="mh-field" style={{ height: CANVAS_H }}>
            <canvas ref={canvasRef} style={{ width: GAME_W, height: CANVAS_H }} />
            {phase === 'play' && (
              <div className="mh-stagetag">제 {hud.stage} 관문</div>
            )}
          </div>

          {/* 문제 */}
          <div className="mh-q" style={{ height: Q_H }}>
            {q && (
              <>
                <div className="mh-q-sub">{q.sub}</div>
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
              return (
                <button key={i} className={cls} disabled={q.answered} onClick={() => answer(i)}>{opt}</button>
              )
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
                    <p className="mh-tip">불 火 · 물 水 · 나무 木 … 한자마다 다른 마법!</p>
                  </>
                ) : (
                  <>
                    <div className="mh-logo">💫 도전 끝!</div>
                    <p>제 {hud.stage}관문 · 점수 {hud.score}</p>
                    <p className="mh-tip">배운 한자 {hud.learned}자 📚</p>
                  </>
                )}
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
  return {
    phase: 'menu', lives: START_LIVES, score: 0, combo: 0, stage: 1, learned: new Set(),
    hero: { x: 78, y: 150 }, enemy: makeEnemy(1), parts: [],
    proj: null, proj2: null, castUntil: 0, castChar: '', castColor: '#fff',
    heroHurtUntil: 0, flashUntil: 0,
  }
}

// ── 캔버스 드로잉 ───────────────────────────────────
function fillc(ctx, x, y, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill() }
function tri(ctx, x1, y1, x2, y2, x3, y3, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath(); ctx.fill() }

// 한자 마법사 소년 (오리지널)
function drawHero(ctx, x, y, now, casting, char, color) {
  const bob = Math.sin(now / 360) * 3
  const cy = y + bob
  // 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(x, y + 40, 26, 7, 0, 0, Math.PI * 2); ctx.fill()
  // 도복(몸)
  ctx.fillStyle = '#2E6DB4'
  ctx.beginPath()
  ctx.moveTo(x - 20, cy + 38); ctx.lineTo(x - 14, cy + 4); ctx.lineTo(x + 14, cy + 4); ctx.lineTo(x + 20, cy + 38)
  ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#21528C'; ctx.fillRect(x - 4, cy + 6, 8, 32) // 옷깃
  ctx.fillStyle = '#E8C341'; ctx.fillRect(x - 16, cy + 22, 32, 6) // 허리띠
  // 팔 (cast 시 들어올림)
  ctx.strokeStyle = '#2E6DB4'; ctx.lineWidth = 7; ctx.lineCap = 'round'
  ctx.beginPath()
  if (casting) { ctx.moveTo(x + 12, cy + 12); ctx.lineTo(x + 30, cy - 14) }
  else { ctx.moveTo(x + 12, cy + 12); ctx.lineTo(x + 24, cy + 24) }
  ctx.moveTo(x - 12, cy + 12); ctx.lineTo(x - 22, cy + 26)
  ctx.stroke()
  // 머리
  fillc(ctx, x, cy - 14, 15, '#FFD9B3')
  // 머리카락
  ctx.fillStyle = '#2B2B2B'
  ctx.beginPath(); ctx.arc(x, cy - 18, 15, Math.PI, 0); ctx.fill()
  ctx.fillRect(x - 15, cy - 20, 30, 5)
  // 머리띠
  ctx.fillStyle = '#D6453B'; ctx.fillRect(x - 16, cy - 14, 32, 5)
  tri(ctx, x - 16, cy - 12, x - 28, cy - 8, x - 16, cy - 6, '#D6453B') // 띠 자락
  // 눈
  fillc(ctx, x - 6, cy - 12, 2.4, '#222'); fillc(ctx, x + 6, cy - 12, 2.4, '#222')
  // 입
  ctx.strokeStyle = '#9C5A3C'; ctx.lineWidth = 1.6
  ctx.beginPath(); ctx.arc(x, cy - 6, 3.5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke()
  // 붓 (왼손)
  ctx.strokeStyle = '#8B5A2B'; ctx.lineWidth = 3
  ctx.beginPath(); ctx.moveTo(x - 22, cy + 26); ctx.lineTo(x - 30, cy + 38); ctx.stroke()
  fillc(ctx, x - 31, cy + 40, 3, '#1A1A1A')
  ctx.lineCap = 'butt'
  // 마법진 (cast 중)
  if (casting) {
    const mx = x + 40, my = cy - 22
    ctx.save()
    ctx.translate(mx, my)
    ctx.rotate(now / 240)
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.stroke()
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.stroke()
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      fillc(ctx, Math.cos(a) * 18, Math.sin(a) * 18, 2, color)
    }
    ctx.restore()
    ctx.fillStyle = color
    ctx.font = 'bold 20px serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(char, mx, my)
  }
}

function drawEnemy(ctx, e, now) {
  const dead = e.dying
  let scale = 1, alpha = 1
  if (dead) {
    const k = Math.min(1, (now - e.dieAt) / 450)
    scale = 1 - k; alpha = 1 - k
  }
  if (alpha <= 0) return
  const shake = e.shakeUntil > now ? Math.sin(now / 24) * 4 : 0
  const x = e.x + shake, y = e.y
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  if (e.type === 0) drawGoblin(ctx, now)
  else if (e.type === 1) drawShadow(ctx, now)
  else drawFox(ctx, now)
  ctx.restore()
  // HP 바
  if (!dead) {
    const w = 56, ratio = Math.max(0, e.hp / e.maxHp)
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x - w / 2, y - 44, w, 6)
    ctx.fillStyle = ratio > 0.5 ? '#2ECC71' : ratio > 0.25 ? '#F1C40F' : '#E74C3C'
    ctx.fillRect(x - w / 2, y - 44, w * ratio, 6)
  }
}

// 도깨비 (빨강, 뿔, 엄니)
function drawGoblin(ctx, now) {
  const b = Math.sin(now / 300) * 2
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(0, 40, 26, 7, 0, 0, Math.PI * 2); ctx.fill()
  tri(ctx, -16, -22, -26, -46, -4, -26, '#7A1B1B')
  tri(ctx, 16, -22, 26, -46, 4, -26, '#7A1B1B')
  fillc(ctx, 0, b, 28, '#D6453B')
  ctx.fillStyle = '#A8352C'; ctx.beginPath(); ctx.arc(0, b + 8, 22, 0, Math.PI); ctx.fill()
  // 눈썹+눈
  ctx.strokeStyle = '#3A0E0E'; ctx.lineWidth = 3; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(-18, b - 8); ctx.lineTo(-4, b - 2); ctx.moveTo(18, b - 8); ctx.lineTo(4, b - 2); ctx.stroke()
  ctx.lineCap = 'butt'
  fillc(ctx, -10, b + 2, 6, '#FFE08A'); fillc(ctx, 10, b + 2, 6, '#FFE08A')
  fillc(ctx, -10, b + 2, 2.6, '#000'); fillc(ctx, 10, b + 2, 2.6, '#000')
  // 입 + 엄니
  ctx.fillStyle = '#3A0808'; ctx.beginPath(); ctx.ellipse(0, b + 16, 12, 6, 0, 0, Math.PI * 2); ctx.fill()
  tri(ctx, -8, b + 12, -5, b + 22, -2, b + 12, '#fff')
  tri(ctx, 8, b + 12, 5, b + 22, 2, b + 12, '#fff')
}

// 그림자 요괴 (검정 유령)
function drawShadow(ctx, now) {
  const b = Math.sin(now / 260) * 3
  const wob = Math.sin(now / 180) * 4
  ctx.fillStyle = '#241B3A'
  ctx.beginPath()
  ctx.arc(0, b - 4, 26, Math.PI, 0)
  ctx.lineTo(26, b + 22)
  for (let i = 2; i >= -2; i--) { ctx.lineTo(i * 13, b + 22 + (i % 2 === 0 ? 0 : 8) + wob * 0.3) }
  ctx.lineTo(-26, b + 22)
  ctx.closePath(); ctx.fill()
  // 보라 오라
  ctx.globalAlpha = 0.4; fillc(ctx, 0, b - 2, 30, '#5B3A8A'); ctx.globalAlpha = 1
  ctx.beginPath(); ctx.arc(0, b - 4, 26, Math.PI, 0); ctx.fillStyle = '#241B3A'; ctx.fill()
  fillc(ctx, -10, b - 4, 6, '#B388E0'); fillc(ctx, 10, b - 4, 6, '#B388E0')
  fillc(ctx, -10, b - 4, 2.6, '#1A0A2A'); fillc(ctx, 10, b - 4, 2.6, '#1A0A2A')
  ctx.strokeStyle = '#B388E0'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.arc(0, b + 6, 6, 1.1 * Math.PI, 1.9 * Math.PI); ctx.stroke()
}

// 불여우 (주황 여우)
function drawFox(ctx, now) {
  const b = Math.sin(now / 320) * 2
  const tw = Math.sin(now / 200) * 0.2
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(0, 40, 26, 7, 0, 0, Math.PI * 2); ctx.fill()
  // 꼬리
  ctx.save(); ctx.translate(-22, b + 20); ctx.rotate(tw)
  tri(ctx, 0, -8, -28, 6, 0, 14, '#E8743B')
  tri(ctx, -20, 2, -28, 6, -20, 12, '#FFF1E0')
  ctx.restore()
  fillc(ctx, 0, b, 26, '#F08A3C')
  // 귀
  tri(ctx, -20, b - 14, -26, b - 40, -6, b - 22, '#E8743B')
  tri(ctx, 20, b - 14, 26, b - 40, 6, b - 22, '#E8743B')
  tri(ctx, -18, b - 18, -21, b - 32, -10, b - 22, '#FFF1E0')
  tri(ctx, 18, b - 18, 21, b - 32, 10, b - 22, '#FFF1E0')
  // 주둥이
  ctx.fillStyle = '#FFF1E0'; ctx.beginPath(); ctx.ellipse(0, b + 12, 13, 9, 0, 0, Math.PI * 2); ctx.fill()
  fillc(ctx, 0, b + 10, 3, '#3A1500')
  // 눈
  ctx.strokeStyle = '#3A1500'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(-14, b - 4); ctx.lineTo(-4, b); ctx.moveTo(14, b - 4); ctx.lineTo(4, b); ctx.stroke()
  ctx.lineCap = 'butt'
  fillc(ctx, -9, b - 1, 2.4, '#222'); fillc(ctx, 9, b - 1, 2.4, '#222')
}

export default MagicHanja
