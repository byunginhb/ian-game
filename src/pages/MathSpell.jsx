import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGameScale } from '../hooks/useGameScale'
import { useTouchLock } from '../hooks/useTouchLock'
import './MathSpell.css'

const GAME_W = 400
const GAME_H = 680
const TICK = 16
const BUBBLE_R = 44
const QUESTIONS_PER_LEVEL = 5

const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five',
  'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
  'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
]

const BUBBLE_COLORS = [
  '#ef4444', '#f59e0b', '#22c55e', '#3b82f6',
  '#a855f7', '#ec4899', '#14b8a6', '#f97316',
]

const TIER_NAMES = ['덧셈 기초', '뺄셈 기초', '큰 수 덧셈', '곱셈', '혼합 연산', '도전!']

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randFloat(min, max) {
  return Math.random() * (max - min) + min
}

function randomMultiplicationPair() {
  const pairs = []
  for (let x = 2; x <= 10; x++) {
    for (let y = 2; y <= 10; y++) {
      if (x * y <= 20) pairs.push([x, y])
    }
  }
  return pairs[randInt(0, pairs.length - 1)]
}

function generateAddition(minAns, maxAns) {
  const answer = randInt(minAns, maxAns)
  const a = randInt(Math.max(0, answer - 20), answer)
  return { a, b: answer - a, op: '+', answer }
}

function generateSubtraction(minA, maxA) {
  const a = randInt(minA, maxA)
  const answer = randInt(0, Math.min(a, 20))
  return { a, b: a - answer, op: '−', answer }
}

function generateMultiplication() {
  const [a, b] = randomMultiplicationPair()
  return { a, b, op: '×', answer: a * b }
}

function generateMixed(minRange, maxRange) {
  const opChoice = randInt(0, 2)
  if (opChoice === 0) return generateAddition(minRange, maxRange)
  if (opChoice === 1) return generateSubtraction(minRange, maxRange)
  return generateMultiplication()
}

function generateProblem(levelIdx) {
  const tier = Math.floor(levelIdx / 5)
  switch (tier) {
    case 0: return generateAddition(1, 10)
    case 1: return generateSubtraction(2, 10)
    case 2: return generateAddition(11, 20)
    case 3: return generateMultiplication()
    case 4: return generateMixed(5, 20)
    default: return generateMixed(10, 20)
  }
}

function generateChoices(answer) {
  const choices = new Set([answer])
  let attempts = 0
  while (choices.size < 4 && attempts < 50) {
    const offset = randInt(1, 5) * (Math.random() < 0.5 ? -1 : 1)
    const wrong = answer + offset
    if (wrong >= 0 && wrong <= 20 && !choices.has(wrong)) {
      choices.add(wrong)
    }
    attempts++
  }
  let fill = 0
  while (choices.size < 4) {
    if (!choices.has(fill) && fill !== answer) choices.add(fill)
    fill++
  }
  return [...choices]
}

function getBubbleSpeed(levelIdx) {
  const tier = Math.floor(levelIdx / 5)
  return [0.4, 0.5, 0.6, 0.7, 0.85, 1.0][tier] || 1.0
}

function getTimerSeconds(levelIdx) {
  const tier = Math.floor(levelIdx / 5)
  return [15, 13, 12, 10, 9, 8][tier] || 8
}

function calculateStars(correctCount) {
  if (correctCount === QUESTIONS_PER_LEVEL) return 3
  if (correctCount >= 4) return 2
  if (correctCount >= 3) return 1
  return 0
}

// Create 4 bubbles with random positions & velocities
function createBubbles(choices, speed) {
  const pad = BUBBLE_R + 8
  const positions = [
    { x: GAME_W * 0.25, y: GAME_H * 0.42 },
    { x: GAME_W * 0.75, y: GAME_H * 0.42 },
    { x: GAME_W * 0.25, y: GAME_H * 0.62 },
    { x: GAME_W * 0.75, y: GAME_H * 0.62 },
  ]
  // shuffle positions
  for (let i = positions.length - 1; i > 0; i--) {
    const j = randInt(0, i)
    ;[positions[i], positions[j]] = [positions[j], positions[i]]
  }

  return choices.map((value, i) => ({
    value,
    x: positions[i].x + randFloat(-20, 20),
    y: positions[i].y + randFloat(-15, 15),
    vx: randFloat(-speed, speed) * (Math.random() < 0.5 ? 1 : -1),
    vy: randFloat(-speed, speed) * (Math.random() < 0.5 ? 1 : -1),
    color: BUBBLE_COLORS[randInt(0, BUBBLE_COLORS.length - 1)],
    scale: 1,
    popped: false,
    popType: null, // 'correct' | 'wrong'
  }))
}

function MathSpell() {
  const scale = useGameScale(GAME_W, GAME_H)
  const containerRef = useRef(null)
  useTouchLock(containerRef)

  const [gameState, setGameState] = useState('menu')
  const [renderTick, setRenderTick] = useState(0)

  const levelIdxRef = useRef(0)
  const questionIdxRef = useRef(0)
  const problemRef = useRef(null)
  const bubblesRef = useRef([])
  const heartsRef = useRef(3)
  const correctCountRef = useRef(0)
  const streakRef = useRef(0)
  const scoreRef = useRef(0)
  const timeLeftRef = useRef(0)
  const feedbackRef = useRef(null) // null | 'correct' | 'wrong'
  const showResultRef = useRef(null)
  const gameStateRef = useRef('menu')
  const particlesRef = useRef([])
  const comboTextRef = useRef(null)
  const feedbackTimerRef = useRef(null)

  const [clearedLevels, setClearedLevels] = useState(() => {
    try {
      const saved = localStorage.getItem('ms2-cleared')
      if (!saved) return new Set()
      const parsed = JSON.parse(saved)
      if (!Array.isArray(parsed)) return new Set()
      return new Set(parsed.filter((v) => Number.isInteger(v) && v >= 0 && v < 30))
    } catch { return new Set() }
  })
  const [levelStars, setLevelStars] = useState(() => {
    try {
      const saved = localStorage.getItem('ms2-stars')
      if (!saved) return {}
      const parsed = JSON.parse(saved)
      if (typeof parsed !== 'object' || parsed === null) return {}
      return parsed
    } catch { return {} }
  })

  const saveClearedLevels = useCallback((cleared, stars) => {
    try {
      localStorage.setItem('ms2-cleared', JSON.stringify([...cleared]))
      localStorage.setItem('ms2-stars', JSON.stringify(stars))
    } catch { /* noop */ }
  }, [])

  const spawnParticles = useCallback((x, y, color, count) => {
    const ps = []
    for (let i = 0; i < count; i++) {
      ps.push({
        id: Date.now() + i,
        x, y,
        vx: randFloat(-3, 3),
        vy: randFloat(-4, -1),
        size: randFloat(4, 10),
        color,
        life: 1,
      })
    }
    particlesRef.current = [...particlesRef.current, ...ps]
  }, [])

  const spawnQuestion = useCallback((lvIdx, qIdx) => {
    const prob = generateProblem(lvIdx)
    const choices = generateChoices(prob.answer)
    const speed = getBubbleSpeed(lvIdx)
    problemRef.current = prob
    bubblesRef.current = createBubbles(choices, speed)
    feedbackRef.current = null
    showResultRef.current = null
    timeLeftRef.current = getTimerSeconds(lvIdx) * 60 // frames
    questionIdxRef.current = qIdx
  }, [])

  const startFromLevel = useCallback((idx) => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current)
      feedbackTimerRef.current = null
    }
    levelIdxRef.current = idx
    heartsRef.current = 3
    correctCountRef.current = 0
    streakRef.current = 0
    scoreRef.current = 0
    showResultRef.current = null
    particlesRef.current = []
    comboTextRef.current = null
    gameStateRef.current = 'playing'
    setGameState('playing')
    spawnQuestion(idx, 0)
    setRenderTick((t) => t + 1)
  }, [spawnQuestion])

  const finishLevel = useCallback((correct, lvIdx) => {
    const stars = calculateStars(correct)
    if (stars > 0) {
      setClearedLevels((prev) => {
        const newCleared = new Set([...prev, lvIdx])
        setLevelStars((prevStars) => {
          const newStars = { ...prevStars, [lvIdx]: Math.max(stars, prevStars[lvIdx] || 0) }
          saveClearedLevels(newCleared, newStars)
          return newStars
        })
        return newCleared
      })
      showResultRef.current = 'success'
    } else {
      showResultRef.current = 'fail'
    }
  }, [saveClearedLevels])

  const advanceOrFinish = useCallback((newCorrect, newHearts, qIdx, lvIdx) => {
    if (newHearts <= 0) {
      showResultRef.current = 'fail'
      return
    }
    if (qIdx + 1 >= QUESTIONS_PER_LEVEL) {
      finishLevel(newCorrect, lvIdx)
      return
    }
    feedbackTimerRef.current = setTimeout(() => {
      spawnQuestion(lvIdx, qIdx + 1)
      setRenderTick((t) => t + 1)
    }, 900)
  }, [finishLevel, spawnQuestion])

  const handleBubbleTap = useCallback((bubbleIdx) => {
    if (feedbackRef.current !== null || showResultRef.current !== null) return
    const bubble = bubblesRef.current[bubbleIdx]
    if (!bubble || bubble.popped) return

    const prob = problemRef.current
    const lvIdx = levelIdxRef.current
    const qIdx = questionIdxRef.current

    if (bubble.value === prob.answer) {
      // Correct!
      bubble.popped = true
      bubble.popType = 'correct'
      feedbackRef.current = 'correct'
      spawnParticles(bubble.x, bubble.y, bubble.color, 12)
      const newCorrect = correctCountRef.current + 1
      correctCountRef.current = newCorrect
      streakRef.current++
      const combo = streakRef.current
      scoreRef.current += 100 * combo
      if (combo >= 2) {
        comboTextRef.current = { text: `${combo}x COMBO!`, born: Date.now() }
      }
      advanceOrFinish(newCorrect, heartsRef.current, qIdx, lvIdx)
    } else {
      // Wrong
      bubble.popped = true
      bubble.popType = 'wrong'
      feedbackRef.current = 'wrong'
      spawnParticles(bubble.x, bubble.y, '#ef4444', 6)
      heartsRef.current--
      streakRef.current = 0
      comboTextRef.current = null
      advanceOrFinish(correctCountRef.current, heartsRef.current, qIdx, lvIdx)
    }
    setRenderTick((t) => t + 1)
  }, [advanceOrFinish, spawnParticles])

  const goToMenu = useCallback(() => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current)
      feedbackTimerRef.current = null
    }
    gameStateRef.current = 'menu'
    setGameState('menu')
  }, [])

  // Game loop: animate bubbles & particles
  useEffect(() => {
    if (gameState !== 'playing') return

    const loop = setInterval(() => {
      if (gameStateRef.current !== 'playing') return

      const bubbles = bubblesRef.current
      const speed = getBubbleSpeed(levelIdxRef.current)
      const pad = BUBBLE_R + 4

      // Move bubbles
      for (const b of bubbles) {
        if (b.popped) continue
        b.x += b.vx
        b.y += b.vy

        // Bounce off walls
        if (b.x < pad) { b.x = pad; b.vx = Math.abs(b.vx) + randFloat(0, 0.2) }
        if (b.x > GAME_W - pad) { b.x = GAME_W - pad; b.vx = -Math.abs(b.vx) - randFloat(0, 0.2) }
        if (b.y < GAME_H * 0.3) { b.y = GAME_H * 0.3; b.vy = Math.abs(b.vy) + randFloat(0, 0.2) }
        if (b.y > GAME_H - pad - 20) { b.y = GAME_H - pad - 20; b.vy = -Math.abs(b.vy) - randFloat(0, 0.2) }

        // Slight random drift
        b.vx += randFloat(-0.03, 0.03) * speed
        b.vy += randFloat(-0.03, 0.03) * speed

        // Clamp speed
        const maxV = speed * 2.5
        b.vx = Math.max(-maxV, Math.min(maxV, b.vx))
        b.vy = Math.max(-maxV, Math.min(maxV, b.vy))
      }

      // Bubble-to-bubble collision (push apart)
      for (let i = 0; i < bubbles.length; i++) {
        for (let j = i + 1; j < bubbles.length; j++) {
          const a = bubbles[i], bub = bubbles[j]
          if (a.popped || bub.popped) continue
          const dx = bub.x - a.x
          const dy = bub.y - a.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const minDist = BUBBLE_R * 2 + 8
          if (dist < minDist && dist > 0) {
            const push = (minDist - dist) / 2
            const nx = dx / dist
            const ny = dy / dist
            a.x -= nx * push
            a.y -= ny * push
            bub.x += nx * push
            bub.y += ny * push
            a.vx -= nx * 0.3
            a.vy -= ny * 0.3
            bub.vx += nx * 0.3
            bub.vy += ny * 0.3
          }
        }
      }

      // Update particles
      particlesRef.current = particlesRef.current
        .map((p) => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + 0.15,
          life: p.life - 0.025,
        }))
        .filter((p) => p.life > 0)

      // Timer countdown
      if (feedbackRef.current === null && showResultRef.current === null) {
        timeLeftRef.current--
        if (timeLeftRef.current <= 0) {
          feedbackRef.current = 'wrong'
          heartsRef.current--
          streakRef.current = 0
          comboTextRef.current = null
          advanceOrFinish(correctCountRef.current, heartsRef.current, questionIdxRef.current, levelIdxRef.current)
        }
      }

      // Expire combo text
      if (comboTextRef.current && Date.now() - comboTextRef.current.born > 1200) {
        comboTextRef.current = null
      }

      setRenderTick((t) => t + 1)
    }, TICK)

    return () => clearInterval(loop)
  }, [gameState, advanceOrFinish])

  // Cleanup
  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    }
  }, [])

  // Render data
  const lvIdx = levelIdxRef.current
  const prob = problemRef.current
  const bubbles = bubblesRef.current
  const hearts = heartsRef.current
  const correctCount = correctCountRef.current
  const score = scoreRef.current
  const streak = streakRef.current
  const fb = feedbackRef.current
  const showResult = showResultRef.current
  const timeLeft = timeLeftRef.current
  const timerMax = getTimerSeconds(lvIdx) * 60
  const timerPercent = (timeLeft / timerMax) * 100
  const tier = Math.floor(lvIdx / 5)
  const particles = particlesRef.current
  const combo = comboTextRef.current
  const qIdx = questionIdxRef.current
  const earnedStars = showResult === 'success' ? calculateStars(correctCount) : 0
  const totalStars = Object.values(levelStars).reduce((sum, s) => sum + s, 0)

  return (
    <div ref={containerRef} className="ms2-container">
      <Link to="/" className="ms2-back-button">← 홈으로</Link>

      <div className="ms2-wrapper" style={{ width: GAME_W * scale, height: GAME_H * scale }}>
        <div
          className="ms2-area"
          style={{ width: GAME_W, height: GAME_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
          {/* Menu */}
          {gameState === 'menu' && (
            <div className="ms2-menu">
              <div className="ms2-menu-emoji">🧮</div>
              <h2 className="ms2-menu-title">Math Spell</h2>
              <p className="ms2-menu-desc">
                수학 문제를 풀고<br />정답 버블을 터뜨리세요!
              </p>
              <button className="ms2-menu-start" onClick={() => startFromLevel(0)}>
                게임 시작
              </button>

              <div className="ms2-level-select">
                <div className="ms2-level-select-title">
                  ⭐ {totalStars} / {30 * 3} — 레벨 선택
                </div>
                <div className="ms2-level-btns">
                  {Array.from({ length: 30 }, (_, i) => (
                    <button
                      key={i}
                      className={`ms2-level-btn${clearedLevels.has(i) ? ' ms2-level-cleared' : ''}`}
                      onClick={() => startFromLevel(i)}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Playing */}
          {gameState === 'playing' && prob && (
            <>
              {/* HUD */}
              <div className="ms2-hud">
                <div className="ms2-level-label">Lv.{lvIdx + 1}</div>
                <div className="ms2-progress">
                  {TIER_NAMES[tier]} ({qIdx + 1}/{QUESTIONS_PER_LEVEL})
                </div>
                <div className="ms2-score-badge">{score}</div>
                <button className="ms2-menu-btn" onClick={goToMenu}>☰</button>
              </div>

              {/* Hearts row */}
              <div className="ms2-hearts-row">
                {Array.from({ length: 3 }, (_, i) => (
                  <span key={i} className={`ms2-heart ${i >= hearts ? 'ms2-heart-lost' : ''}`}>❤️</span>
                ))}
                <div className="ms2-timer-bar">
                  <div
                    className="ms2-timer-fill"
                    style={{
                      width: `${timerPercent}%`,
                      backgroundColor: timerPercent > 50 ? '#22c55e' : timerPercent > 25 ? '#fbbf24' : '#ef4444',
                    }}
                  />
                </div>
              </div>

              {/* Problem */}
              <div className="ms2-problem-area">
                <div className="ms2-problem">
                  {prob.a} {prob.op} {prob.b} = ?
                </div>
              </div>

              {/* Bubbles */}
              {bubbles.map((b, i) => {
                if (b.popped && b.popType === 'correct') return null
                let cls = 'ms2-bubble'
                if (b.popped && b.popType === 'wrong') cls += ' ms2-bubble-wrong'
                if (fb === 'correct' && !b.popped && b.value === prob.answer) cls += ' ms2-bubble-reveal'
                return (
                  <div
                    key={`${qIdx}-${i}`}
                    className={cls}
                    style={{
                      left: b.x - BUBBLE_R,
                      top: b.y - BUBBLE_R,
                      width: BUBBLE_R * 2,
                      height: BUBBLE_R * 2,
                      background: `radial-gradient(circle at 35% 35%, ${b.color}dd, ${b.color}88)`,
                      borderColor: b.color,
                    }}
                    onClick={() => handleBubbleTap(i)}
                  >
                    <span className="ms2-bubble-text">{NUMBER_WORDS[b.value]}</span>
                    <div className="ms2-bubble-shine" />
                  </div>
                )
              })}

              {/* Pop effect for correct */}
              {bubbles.map((b, i) => (
                b.popped && b.popType === 'correct' ? (
                  <div
                    key={`pop-${qIdx}-${i}`}
                    className="ms2-pop-ring"
                    style={{ left: b.x - 50, top: b.y - 50 }}
                  />
                ) : null
              ))}

              {/* Particles */}
              {particles.map((p) => (
                <div
                  key={p.id}
                  className="ms2-particle"
                  style={{
                    left: p.x,
                    top: p.y,
                    width: p.size,
                    height: p.size,
                    background: p.color,
                    opacity: p.life,
                  }}
                />
              ))}

              {/* Combo text */}
              {combo && (
                <div className="ms2-combo" key={combo.born}>
                  {combo.text}
                </div>
              )}

              {/* Feedback text */}
              {fb === 'correct' && (
                <div className="ms2-fb ms2-fb-correct" key={`fb-${qIdx}`}>CORRECT!</div>
              )}
              {fb === 'wrong' && (
                <div className="ms2-fb ms2-fb-wrong" key={`fb-${qIdx}`}>
                  {NUMBER_WORDS[prob.answer].toUpperCase()}
                </div>
              )}

              {/* Streak indicator */}
              {streak >= 2 && fb === null && (
                <div className="ms2-streak-badge">🔥 {streak}</div>
              )}

              {/* Success overlay */}
              {showResult === 'success' && (
                <div className="ms2-overlay ms2-overlay-success">
                  <div className="ms2-overlay-content">
                    <span className="ms2-overlay-emoji">🎉</span>
                    <h2>레벨 클리어!</h2>
                    <div className="ms2-score-display">
                      <div className="ms2-score-item">
                        <div className="ms2-score-item-label">정답</div>
                        <div className="ms2-score-item-value">{correctCount}/{QUESTIONS_PER_LEVEL}</div>
                      </div>
                      <div className="ms2-score-item">
                        <div className="ms2-score-item-label">점수</div>
                        <div className="ms2-score-item-value">{score}</div>
                      </div>
                    </div>
                    <div className="ms2-stars-display">
                      {[1, 2, 3].map((s) => (
                        <span
                          key={s}
                          className={`ms2-star-icon${s <= earnedStars ? ' ms2-star-earned' : ''}`}
                          style={{ animationDelay: `${s * 0.15}s` }}
                        >⭐</span>
                      ))}
                    </div>
                    <button className="ms2-overlay-btn" onClick={() => {
                      if (lvIdx + 1 >= 30) { gameStateRef.current = 'complete'; setGameState('complete') }
                      else startFromLevel(lvIdx + 1)
                    }}>
                      {lvIdx + 1 >= 30 ? '완료!' : '다음 레벨 →'}
                    </button>
                  </div>
                </div>
              )}

              {/* Fail overlay */}
              {showResult === 'fail' && (
                <div className="ms2-overlay ms2-overlay-fail">
                  <div className="ms2-overlay-content">
                    <span className="ms2-overlay-emoji">😢</span>
                    <h2>아쉬워요!</h2>
                    <p>정답: {correctCount}/{QUESTIONS_PER_LEVEL} · 점수: {score}</p>
                    <div>
                      <button className="ms2-overlay-btn ms2-overlay-btn-retry" onClick={() => startFromLevel(lvIdx)}>
                        다시 도전
                      </button>
                      <button className="ms2-overlay-btn ms2-overlay-btn-menu" onClick={goToMenu}>
                        메뉴로
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Complete */}
          {gameState === 'complete' && (
            <div className="ms2-menu ms2-complete">
              <div className="ms2-menu-emoji">🏆</div>
              <h2 className="ms2-menu-title">축하합니다!</h2>
              <p className="ms2-menu-desc">모든 레벨을 클리어했어요!</p>
              <div className="ms2-total-stars">⭐ {totalStars} / {30 * 3}</div>
              <button className="ms2-menu-start" onClick={goToMenu}>
                메뉴로 돌아가기
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="ms2-instructions">떠다니는 버블 중 정답을 터치하세요!</div>
    </div>
  )
}

export default MathSpell
