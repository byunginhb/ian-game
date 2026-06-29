import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useGameScale } from '../hooks/useGameScale'
import { useTouchLock } from '../hooks/useTouchLock'
import './MagicHanja.css'

const GAME_W = 360
const HUD_H = 46
const CANVAS_H = 226
const Q_H = 84
const OPT_H = 168
const STAGE_H = HUD_H + CANVAS_H + Q_H + OPT_H
const START_LIVES = 5
const PARTICLE_CAP = 90

// ── 급수별 한자 ([한자, 훈, 음]) ──────────────────────
const GRADE_8 = [
  ['敎', '가르칠', '교'], ['校', '학교', '교'], ['九', '아홉', '구'], ['國', '나라', '국'], ['軍', '군사', '군'],
  ['金', '쇠', '금'], ['南', '남녘', '남'], ['女', '여자', '녀'], ['年', '해', '년'], ['大', '큰', '대'],
  ['東', '동녘', '동'], ['六', '여섯', '륙'], ['萬', '일만', '만'], ['母', '어미', '모'], ['木', '나무', '목'],
  ['門', '문', '문'], ['民', '백성', '민'], ['白', '흰', '백'], ['父', '아비', '부'], ['北', '북녘', '북'],
  ['四', '넉', '사'], ['山', '메', '산'], ['三', '석', '삼'], ['生', '날', '생'], ['西', '서녘', '서'],
  ['先', '먼저', '선'], ['小', '작을', '소'], ['水', '물', '수'], ['室', '집', '실'], ['十', '열', '십'],
  ['五', '다섯', '오'], ['王', '임금', '왕'], ['外', '바깥', '외'], ['月', '달', '월'], ['二', '두', '이'],
  ['人', '사람', '인'], ['一', '한', '일'], ['日', '날', '일'], ['長', '긴', '장'], ['弟', '아우', '제'],
  ['中', '가운데', '중'], ['靑', '푸를', '청'], ['寸', '마디', '촌'], ['七', '일곱', '칠'], ['土', '흙', '토'],
  ['八', '여덟', '팔'], ['學', '배울', '학'], ['韓', '한국', '한'], ['兄', '형', '형'], ['火', '불', '화'],
]
const GRADE_7 = [
  ['家', '집', '가'], ['歌', '노래', '가'], ['間', '사이', '간'], ['江', '강', '강'], ['車', '수레', '거'],
  ['空', '빌', '공'], ['工', '장인', '공'], ['口', '입', '구'], ['記', '기록할', '기'], ['氣', '기운', '기'],
  ['男', '사내', '남'], ['內', '안', '내'], ['農', '농사', '농'], ['答', '대답', '답'], ['道', '길', '도'],
  ['冬', '겨울', '동'], ['同', '한가지', '동'], ['動', '움직일', '동'], ['登', '오를', '등'], ['來', '올', '래'],
  ['力', '힘', '력'], ['老', '늙을', '로'], ['里', '마을', '리'], ['林', '수풀', '림'], ['立', '설', '립'],
  ['每', '매양', '매'], ['面', '낯', '면'], ['名', '이름', '명'], ['命', '목숨', '명'], ['文', '글월', '문'],
  ['問', '물을', '문'], ['物', '물건', '물'], ['方', '모', '방'], ['百', '일백', '백'], ['不', '아닐', '불'],
  ['事', '일', '사'], ['算', '셈', '산'], ['上', '윗', '상'], ['色', '빛', '색'], ['夕', '저녁', '석'],
  ['世', '인간', '세'], ['少', '적을', '소'], ['所', '바', '소'], ['手', '손', '수'], ['數', '셈', '수'],
  ['市', '저자', '시'], ['時', '때', '시'], ['食', '밥', '식'], ['植', '심을', '식'], ['心', '마음', '심'],
  ['安', '편안', '안'], ['語', '말씀', '어'], ['午', '낮', '오'], ['右', '오른', '우'], ['有', '있을', '유'],
  ['育', '기를', '육'], ['邑', '고을', '읍'], ['入', '들', '입'], ['自', '스스로', '자'], ['字', '글자', '자'],
  ['場', '마당', '장'], ['全', '온전', '전'], ['前', '앞', '전'], ['電', '번개', '전'], ['正', '바를', '정'],
  ['祖', '할아비', '조'], ['足', '발', '족'], ['左', '왼', '좌'], ['主', '주인', '주'], ['住', '살', '주'],
  ['重', '무거울', '중'], ['地', '땅', '지'], ['紙', '종이', '지'], ['直', '곧을', '직'], ['千', '일천', '천'],
  ['天', '하늘', '천'], ['川', '내', '천'], ['草', '풀', '초'], ['村', '마을', '촌'], ['秋', '가을', '추'],
  ['春', '봄', '춘'], ['出', '날', '출'], ['便', '편할', '편'], ['平', '평평할', '평'], ['下', '아래', '하'],
  ['夏', '여름', '하'], ['漢', '한수', '한'], ['海', '바다', '해'], ['花', '꽃', '화'], ['話', '말씀', '화'],
  ['活', '살', '활'], ['孝', '효도', '효'], ['後', '뒤', '후'], ['休', '쉴', '휴'], ['然', '그럴', '연'],
]

const ELEMENT_COLORS = {
  火: '#F0553A', 水: '#3B9EDB', 木: '#46B36B', 金: '#E0B341', 土: '#B5793A',
  日: '#FF9F1C', 月: '#C7CEDB', 山: '#6BA368', 川: '#4FA8D8', 天: '#5BB4E0',
  心: '#F1948A', 江: '#3B9EDB', 海: '#2E86C1', 花: '#EC7FB0', 草: '#52BE80',
  電: '#F4D03F', 林: '#46B36B', 靑: '#5499C7', 白: '#E5E8E8', 力: '#EC7063',
}
const PALETTE = ['#8B5CF6', '#E06C9F', '#5DADE2', '#48C9B0', '#F5B041', '#EC7063', '#52BE80', '#AF7AC5', '#5499C7', '#F39C12']
function hanjaColor(c) { return ELEMENT_COLORS[c] || PALETTE[c.charCodeAt(0) % PALETTE.length] }
function toObj([c, m, s]) { return { c, m, s, col: hanjaColor(c) } }

const GRADES = [
  { name: '8급', list: GRADE_8.map(toObj) },
  { name: '7급', list: GRADE_7.map(toObj) },
]
const ALL = GRADES.flatMap((g) => g.list)

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function makeQuestion(grade, learnedSet) {
  const unlearned = grade.list.filter((h) => !learnedSet.has(h.c))
  const pool = unlearned.length ? unlearned : grade.list
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
    char: data.c, color: data.col, promptText, promptBig: big, sub,
    options: opts, correctIdx: opts.indexOf(correct), optBig: mode === 2,
    answered: false, pickedIdx: -1,
  }
}

function makeEnemy(stage) {
  const maxHp = Math.min(7, 2 + Math.floor(stage / 2))
  return { type: (stage - 1) % 3, hp: maxHp, maxHp, x: 278, y: 120, dying: false, dieAt: 0, shakeUntil: 0, attackUntil: 0 }
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
  const [hud, setHud] = useState({ lives: START_LIVES, score: 0, combo: 0, stage: 1, gradeName: '8급', gLearned: 0, gTotal: 50, caster: '손오공' })
  const [q, setQ] = useState(null)
  const [best, setBest] = useState(() => {
    try { return Number(localStorage.getItem('magic-hanja-best')) || 0 } catch { return 0 }
  })
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem('mh-muted') === '1' } catch { return false }
  })
  const [menuProgress, setMenuProgress] = useState(() => {
    const l = loadLearned(); const gi = deriveGradeIdx(l)
    return { gradeName: GRADES[gi].name, learned: l[GRADES[gi].name].size, total: GRADES[gi].list.length }
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
    const grade = GRADES[g.gradeIdx]
    setHud({
      lives: g.lives, score: g.score, combo: g.combo, stage: g.stage,
      gradeName: grade.name, gLearned: g.learnedByGrade[grade.name].size, gTotal: grade.list.length,
      caster: HERO_NAMES[(g.stage - 1) % HERO_NAMES.length],
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

    const drawBg = () => {
      ctx.fillStyle = '#2a2350'
      ctx.fillRect(0, 0, GAME_W, CANVAS_H)
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'
      ctx.lineWidth = 1
      for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.arc(GAME_W / 2, CANVAS_H + 30, i * 50, 0, Math.PI * 2); ctx.stroke() }
      ctx.fillStyle = 'rgba(0,0,0,0.18)'
      ctx.fillRect(0, CANVAS_H - 30, GAME_W, 30)
    }

    const draw = (now) => {
      const g = G.current
      drawBg()
      if (g.phase === 'play' || g.phase === 'over') {
        drawEnemy(ctx, g.enemy, now)
        const hb = g.heroHurtUntil > now ? Math.sin(now / 28) * 3 : 0
        const heroDraw = HERO_DRAW[(g.stage - 1) % HERO_DRAW.length]
        heroDraw(ctx, g.hero.x + hb, g.hero.y, now, g.castUntil > now, g.castChar, g.castColor)
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
    setQ(makeQuestion(grade, g.learnedByGrade[grade.name]))
  }, [])

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
      const grade = GRADES[g.gradeIdx]
      const set = g.learnedByGrade[grade.name]
      if (!set.has(q.char)) { set.add(q.char); saveLearned(grade.name, set) }
      g.castUntil = now + 440
      g.castChar = q.char
      g.castColor = q.color
      g.proj = { t: 0, color: q.color }
      play('correct'); play('cast')
      // 급수 완성 체크
      if (set.size >= grade.list.length && g.gradeIdx < GRADES.length - 1) {
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
      g.flashUntil = now + 300
      play('wrong')
      syncHud()
      setTimeout(() => {
        if (G.current.phase !== 'play') return
        if (G.current.lives <= 0) {
          G.current.phase = 'over'
          setPhase('over')
          play('over')
          const l = loadLearned(); const gi = deriveGradeIdx(l)
          setMenuProgress({ gradeName: GRADES[gi].name, learned: l[GRADES[gi].name].size, total: GRADES[gi].list.length })
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
            {phase === 'play' && <div className="mh-stagetag">제 {hud.stage}관문 · {hud.caster}</div>}
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
                    <p className="mh-tip">손오공·삼장·옥동자·샤오공주와 함께!<br />8급을 모두 익히면 7급에 도전!</p>
                  </>
                ) : (
                  <>
                    <div className="mh-logo">💫 도전 끝!</div>
                    <p>제 {hud.stage}관문 · 점수 {hud.score}</p>
                  </>
                )}
                <p className="mh-prog">📚 {menuProgress.gradeName} {menuProgress.learned}/{menuProgress.total} 학습</p>
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
  return {
    phase: 'menu', lives: START_LIVES, score: 0, combo: 0, stage: 1,
    learnedByGrade, gradeIdx: deriveGradeIdx(learnedByGrade),
    hero: { x: 78, y: 150 }, enemy: makeEnemy(1), parts: [],
    proj: null, proj2: null, castUntil: 0, castChar: '', castColor: '#fff',
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

// 삼장 (여주인공, 대지여신의 후예 - 긴 머리 미소녀 마법사)
function drawSamjang(ctx, x, y, now, casting, char, color) {
  const cy = y + Math.sin(now / 380) * 3
  heroBase(ctx, x, y)
  // 긴 머리 (뒤로 늘어뜨림)
  ctx.fillStyle = '#2E2620'
  ctx.beginPath(); ctx.moveTo(x - 16, cy - 12); ctx.quadraticCurveTo(x - 24, cy + 22, x - 14, cy + 36); ctx.lineTo(x + 14, cy + 36); ctx.quadraticCurveTo(x + 24, cy + 22, x + 16, cy - 12); ctx.closePath(); ctx.fill()
  // 몸 (붉은 치마저고리 + 초록 띠)
  ctx.fillStyle = '#E0566E'
  ctx.beginPath(); ctx.moveTo(x - 21, cy + 38); ctx.lineTo(x - 12, cy + 4); ctx.lineTo(x + 12, cy + 4); ctx.lineTo(x + 21, cy + 38); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#F4D7DE'; ctx.fillRect(x - 12, cy + 4, 24, 9) // 저고리
  ctx.fillStyle = '#3FA86B'; ctx.fillRect(x - 13, cy + 13, 26, 5) // 초록 띠(대지)
  heroArms(ctx, x, cy, casting, '#E0566E')
  // 부적/주선 (왼손)
  ctx.fillStyle = '#F5EBC8'; ctx.fillRect(x - 36, cy + 12, 8, 16)
  ctx.fillStyle = '#C0392B'; ctx.fillRect(x - 34, cy + 15, 4, 10)
  // 얼굴
  fillc(ctx, x, cy - 13, 14, '#FFE0C2')
  // 앞머리 + 옆머리
  ctx.fillStyle = '#2E2620'
  ctx.beginPath(); ctx.arc(x, cy - 15, 14, Math.PI * 1.0, Math.PI * 2.0); ctx.fill()
  ctx.beginPath(); ctx.moveTo(x - 14, cy - 14); ctx.lineTo(x - 16, cy - 2); ctx.lineTo(x - 9, cy - 6); ctx.closePath(); ctx.fill()
  ctx.beginPath(); ctx.moveTo(x + 14, cy - 14); ctx.lineTo(x + 16, cy - 2); ctx.lineTo(x + 9, cy - 6); ctx.closePath(); ctx.fill()
  // 꽃 비녀
  fillc(ctx, x + 11, cy - 18, 3.2, '#FF7AA8'); fillc(ctx, x + 11, cy - 18, 1.3, '#FFE08A')
  // 큰 눈 + 속눈썹
  fillc(ctx, x - 5, cy - 12, 3, '#3A2A40'); fillc(ctx, x + 5, cy - 12, 3, '#3A2A40')
  fillc(ctx, x - 4, cy - 13, 1, '#fff'); fillc(ctx, x + 6, cy - 13, 1, '#fff')
  ctx.strokeStyle = '#C8607E'; ctx.lineWidth = 1.4
  ctx.beginPath(); ctx.arc(x, cy - 5, 2.4, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke()
  fillc(ctx, x - 8, cy - 6, 1.8, 'rgba(255,150,170,0.5)'); fillc(ctx, x + 8, cy - 6, 1.8, 'rgba(255,150,170,0.5)')
  if (casting) drawMagicCircle(ctx, x + 40, cy - 22, now, color, char)
}

// 옥동자 (보리도사 제자, 시간 마법 - 상투 소년)
function drawOkdongja(ctx, x, y, now, casting, char, color) {
  const cy = y + Math.sin(now / 400) * 3
  heroBase(ctx, x, y)
  // 몸 (옥빛 도복)
  ctx.fillStyle = '#3FB89A'
  ctx.beginPath(); ctx.moveTo(x - 20, cy + 38); ctx.lineTo(x - 13, cy + 4); ctx.lineTo(x + 13, cy + 4); ctx.lineTo(x + 20, cy + 38); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#E8C341'; ctx.fillRect(x - 16, cy + 22, 32, 5)
  ctx.fillStyle = '#2E9079'; ctx.fillRect(x - 2, cy + 4, 4, 34)
  heroArms(ctx, x, cy, casting, '#3FB89A')
  // 모래시계 (시간 마법, 왼손)
  ctx.strokeStyle = '#C9A36A'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(x - 36, cy + 8); ctx.lineTo(x - 28, cy + 8); ctx.moveTo(x - 36, cy + 22); ctx.lineTo(x - 28, cy + 22); ctx.stroke()
  tri(ctx, x - 36, cy + 8, x - 28, cy + 8, x - 32, cy + 15, '#9AD8FF')
  tri(ctx, x - 36, cy + 22, x - 28, cy + 22, x - 32, cy + 15, '#9AD8FF')
  // 얼굴 (둥근 소년)
  fillc(ctx, x, cy - 13, 15, '#FFE0C2')
  // 머리 + 상투
  ctx.fillStyle = '#3A2E26'
  ctx.beginPath(); ctx.arc(x, cy - 15, 15, Math.PI * 1.05, Math.PI * 1.95); ctx.fill()
  fillc(ctx, x, cy - 30, 4, '#3A2E26') // 상투
  ctx.fillStyle = '#2E9079'; ctx.fillRect(x - 4, cy - 31, 8, 3) // 상투 띠
  // 눈 (동글, 허당 느낌) + 발그레
  fillc(ctx, x - 5, cy - 11, 2.8, '#222'); fillc(ctx, x + 5, cy - 11, 2.8, '#222')
  fillc(ctx, x - 4, cy - 12, 1, '#fff'); fillc(ctx, x + 6, cy - 12, 1, '#fff')
  fillc(ctx, x - 9, cy - 6, 2, 'rgba(255,150,120,0.5)'); fillc(ctx, x + 9, cy - 6, 2, 'rgba(255,150,120,0.5)')
  ctx.strokeStyle = '#9C5A3C'; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.arc(x, cy - 5, 2.6, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke()
  if (casting) drawMagicCircle(ctx, x + 40, cy - 22, now, color, char)
}

// 샤오공주 (하늘나라 공주 - 머리 장식 + 푸른 예복)
function drawXiao(ctx, x, y, now, casting, char, color) {
  const cy = y + Math.sin(now / 360) * 3
  heroBase(ctx, x, y)
  // 예복 치마 (넓게)
  ctx.fillStyle = '#7FB8E8'
  ctx.beginPath(); ctx.moveTo(x - 24, cy + 38); ctx.lineTo(x - 12, cy + 4); ctx.lineTo(x + 12, cy + 4); ctx.lineTo(x + 24, cy + 38); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#EAF4FF'; ctx.fillRect(x - 12, cy + 4, 24, 8) // 흰 상의
  ctx.fillStyle = '#E8C341'; ctx.fillRect(x - 13, cy + 12, 26, 5) // 금띠
  // 치마 무늬
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  for (let i = -1; i <= 1; i++) fillc(ctx, x + i * 12, cy + 30, 2.2, 'rgba(255,255,255,0.4)')
  heroArms(ctx, x, cy, casting, '#7FB8E8')
  // 부채 (왼손)
  ctx.fillStyle = '#E84F8A'
  ctx.beginPath(); ctx.moveTo(x - 30, cy + 20); ctx.lineTo(x - 42, cy + 8); ctx.lineTo(x - 40, cy + 22); ctx.closePath(); ctx.fill()
  // 얼굴
  fillc(ctx, x, cy - 13, 14, '#FFE3CC')
  // 올림머리 + 옆머리
  ctx.fillStyle = '#241C30'
  ctx.beginPath(); ctx.arc(x, cy - 15, 14, Math.PI * 1.0, Math.PI * 2.0); ctx.fill()
  fillc(ctx, x, cy - 30, 6, '#241C30') // 쪽
  // 작은 관/장식
  ctx.fillStyle = '#F2C200'
  tri(ctx, x - 7, cy - 24, x, cy - 34, x + 7, cy - 24, '#F2C200')
  fillc(ctx, x, cy - 33, 2, '#7DD4F8')
  fillc(ctx, x - 11, cy - 16, 2.2, '#FF7AA8'); fillc(ctx, x + 11, cy - 16, 2.2, '#FF7AA8') // 귀 장식
  // 눈 (우아)
  fillc(ctx, x - 5, cy - 12, 2.8, '#2A2238'); fillc(ctx, x + 5, cy - 12, 2.8, '#2A2238')
  fillc(ctx, x - 4, cy - 13, 1, '#fff'); fillc(ctx, x + 6, cy - 13, 1, '#fff')
  ctx.strokeStyle = '#C8607E'; ctx.lineWidth = 1.4
  ctx.beginPath(); ctx.arc(x, cy - 5, 2.2, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke()
  if (casting) drawMagicCircle(ctx, x + 40, cy - 22, now, color, char)
}

const HERO_DRAW = [drawSonOhgong, drawSamjang, drawOkdongja, drawXiao]
const HERO_NAMES = ['손오공', '삼장', '옥동자', '샤오공주']

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
  if (!dead) {
    const w = 56, ratio = Math.max(0, e.hp / e.maxHp)
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x - w / 2, y - 44, w, 6)
    ctx.fillStyle = ratio > 0.5 ? '#2ECC71' : ratio > 0.25 ? '#F1C40F' : '#E74C3C'
    ctx.fillRect(x - w / 2, y - 44, w * ratio, 6)
  }
}

function drawGoblin(ctx, now) {
  const b = Math.sin(now / 300) * 2
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(0, 40, 26, 7, 0, 0, Math.PI * 2); ctx.fill()
  tri(ctx, -16, -22, -26, -46, -4, -26, '#7A1B1B')
  tri(ctx, 16, -22, 26, -46, 4, -26, '#7A1B1B')
  fillc(ctx, 0, b, 28, '#D6453B')
  ctx.fillStyle = '#A8352C'; ctx.beginPath(); ctx.arc(0, b + 8, 22, 0, Math.PI); ctx.fill()
  ctx.strokeStyle = '#3A0E0E'; ctx.lineWidth = 3; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(-18, b - 8); ctx.lineTo(-4, b - 2); ctx.moveTo(18, b - 8); ctx.lineTo(4, b - 2); ctx.stroke()
  ctx.lineCap = 'butt'
  fillc(ctx, -10, b + 2, 6, '#FFE08A'); fillc(ctx, 10, b + 2, 6, '#FFE08A')
  fillc(ctx, -10, b + 2, 2.6, '#000'); fillc(ctx, 10, b + 2, 2.6, '#000')
  ctx.fillStyle = '#3A0808'; ctx.beginPath(); ctx.ellipse(0, b + 16, 12, 6, 0, 0, Math.PI * 2); ctx.fill()
  tri(ctx, -8, b + 12, -5, b + 22, -2, b + 12, '#fff')
  tri(ctx, 8, b + 12, 5, b + 22, 2, b + 12, '#fff')
}

function drawShadow(ctx, now) {
  const b = Math.sin(now / 260) * 3
  const wob = Math.sin(now / 180) * 4
  ctx.globalAlpha *= 1
  ctx.beginPath()
  ctx.arc(0, b - 4, 26, Math.PI, 0)
  ctx.lineTo(26, b + 22)
  for (let i = 2; i >= -2; i--) ctx.lineTo(i * 13, b + 22 + (i % 2 === 0 ? 0 : 8) + wob * 0.3)
  ctx.lineTo(-26, b + 22)
  ctx.closePath()
  ctx.fillStyle = '#241B3A'; ctx.fill()
  fillc(ctx, -10, b - 4, 6, '#B388E0'); fillc(ctx, 10, b - 4, 6, '#B388E0')
  fillc(ctx, -10, b - 4, 2.6, '#1A0A2A'); fillc(ctx, 10, b - 4, 2.6, '#1A0A2A')
  ctx.strokeStyle = '#B388E0'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.arc(0, b + 6, 6, 1.1 * Math.PI, 1.9 * Math.PI); ctx.stroke()
}

function drawFox(ctx, now) {
  const b = Math.sin(now / 320) * 2
  const tw = Math.sin(now / 200) * 0.2
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(0, 40, 26, 7, 0, 0, Math.PI * 2); ctx.fill()
  ctx.save(); ctx.translate(-22, b + 20); ctx.rotate(tw)
  tri(ctx, 0, -8, -28, 6, 0, 14, '#E8743B')
  tri(ctx, -20, 2, -28, 6, -20, 12, '#FFF1E0')
  ctx.restore()
  fillc(ctx, 0, b, 26, '#F08A3C')
  tri(ctx, -20, b - 14, -26, b - 40, -6, b - 22, '#E8743B')
  tri(ctx, 20, b - 14, 26, b - 40, 6, b - 22, '#E8743B')
  tri(ctx, -18, b - 18, -21, b - 32, -10, b - 22, '#FFF1E0')
  tri(ctx, 18, b - 18, 21, b - 32, 10, b - 22, '#FFF1E0')
  ctx.fillStyle = '#FFF1E0'; ctx.beginPath(); ctx.ellipse(0, b + 12, 13, 9, 0, 0, Math.PI * 2); ctx.fill()
  fillc(ctx, 0, b + 10, 3, '#3A1500')
  ctx.strokeStyle = '#3A1500'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(-14, b - 4); ctx.lineTo(-4, b); ctx.moveTo(14, b - 4); ctx.lineTo(4, b); ctx.stroke()
  ctx.lineCap = 'butt'
  fillc(ctx, -9, b - 1, 2.4, '#222'); fillc(ctx, 9, b - 1, 2.4, '#222')
}

export default MagicHanja
