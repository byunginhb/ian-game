import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGameScale } from '../hooks/useGameScale'
import { useTouchLock } from '../hooks/useTouchLock'
import './MathSpell.css'

const GAME_W = 400
const GAME_H = 680

const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five',
  'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
  'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
]

const QUESTIONS_PER_LEVEL = 5
const TIER_NAMES = ['덧셈 기초', '뺄셈 기초', '큰 수 덧셈', '곱셈', '혼합 연산', '도전!']
const TIER_EMOJIS = ['🐣', '🐥', '🐔', '🦅', '🦉', '🏆']

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
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
  return shuffle([...choices])
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
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

function MathSpell() {
  const scale = useGameScale(GAME_W, GAME_H)
  const containerRef = useRef(null)
  useTouchLock(containerRef)

  const [gameState, setGameState] = useState('menu')
  const [levelIdx, setLevelIdx] = useState(0)
  const [questionIdx, setQuestionIdx] = useState(0)
  const [problem, setProblem] = useState(null)
  const [choices, setChoices] = useState([])
  const [hearts, setHearts] = useState(3)
  const [correctCount, setCorrectCount] = useState(0)
  const [streak, setStreak] = useState(0)
  const [feedback, setFeedback] = useState(null)
  const [selectedChoice, setSelectedChoice] = useState(null)
  const [showResult, setShowResult] = useState(null)
  const [timeLeft, setTimeLeft] = useState(0)

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

  const feedbackTimerRef = useRef(null)

  const saveClearedLevels = useCallback((cleared, stars) => {
    try {
      localStorage.setItem('ms2-cleared', JSON.stringify([...cleared]))
      localStorage.setItem('ms2-stars', JSON.stringify(stars))
    } catch { /* noop */ }
  }, [])

  const spawnQuestion = useCallback((lvIdx, qIdx) => {
    const prob = generateProblem(lvIdx)
    setProblem(prob)
    setChoices(generateChoices(prob.answer))
    setFeedback(null)
    setSelectedChoice(null)
    setTimeLeft(getTimerSeconds(lvIdx))
    setQuestionIdx(qIdx)
  }, [])

  const goToMenu = useCallback(() => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current)
      feedbackTimerRef.current = null
    }
    setGameState('menu')
  }, [])

  const startFromLevel = useCallback((idx) => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current)
      feedbackTimerRef.current = null
    }
    setLevelIdx(idx)
    setHearts(3)
    setCorrectCount(0)
    setStreak(0)
    setShowResult(null)
    setGameState('playing')
    spawnQuestion(idx, 0)
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
      setShowResult('success')
    } else {
      setShowResult('fail')
    }
  }, [saveClearedLevels])

  const advanceOrFinish = useCallback((newCorrect, newHearts, qIdx, lvIdx) => {
    if (newHearts <= 0) {
      setShowResult('fail')
      return
    }
    if (qIdx + 1 >= QUESTIONS_PER_LEVEL) {
      finishLevel(newCorrect, lvIdx)
      return
    }
    feedbackTimerRef.current = setTimeout(() => {
      spawnQuestion(lvIdx, qIdx + 1)
    }, 800)
  }, [finishLevel, spawnQuestion])

  const handleChoice = useCallback((value) => {
    if (feedback !== null || showResult !== null || !problem) return

    setSelectedChoice(value)
    if (value === problem.answer) {
      setFeedback('correct')
      const newCorrect = correctCount + 1
      setCorrectCount(newCorrect)
      setStreak((s) => s + 1)
      advanceOrFinish(newCorrect, hearts, questionIdx, levelIdx)
    } else {
      setFeedback('wrong')
      const newHearts = hearts - 1
      setHearts(newHearts)
      setStreak(0)
      advanceOrFinish(correctCount, newHearts, questionIdx, levelIdx)
    }
  }, [feedback, showResult, problem, correctCount, hearts, questionIdx, levelIdx, advanceOrFinish])

  // Timer countdown only
  useEffect(() => {
    if (gameState !== 'playing' || feedback !== null || showResult !== null) return

    const id = setInterval(() => {
      setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)

    return () => clearInterval(id)
  }, [gameState, feedback, showResult])

  // Time-up handler (separate from timer)
  useEffect(() => {
    if (timeLeft === 0 && gameState === 'playing' && feedback === null && showResult === null && problem) {
      setFeedback('wrong')
      setSelectedChoice(-1)
      const newHearts = hearts - 1
      setHearts(newHearts)
      setStreak(0)
      advanceOrFinish(correctCount, newHearts, questionIdx, levelIdx)
    }
  }, [timeLeft, gameState, feedback, showResult, problem, hearts, correctCount, questionIdx, levelIdx, advanceOrFinish])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    }
  }, [])

  // Keyboard shortcuts (1-4)
  useEffect(() => {
    if (gameState !== 'playing') return

    const onKey = (e) => {
      if (feedback !== null || showResult !== null) return
      const num = parseInt(e.key)
      if (num >= 1 && num <= 4 && choices[num - 1] !== undefined) {
        e.preventDefault()
        handleChoice(choices[num - 1])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [gameState, feedback, showResult, choices, handleChoice])

  const totalStars = Object.values(levelStars).reduce((sum, s) => sum + s, 0)
  const timerMax = problem ? getTimerSeconds(levelIdx) : 1
  const timerPercent = (timeLeft / timerMax) * 100
  const tier = Math.floor(levelIdx / 5)
  const earnedStars = showResult === 'success' ? calculateStars(correctCount) : 0

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
                수학 문제를 풀고<br />답을 영어로 맞춰보세요!
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
          {gameState === 'playing' && problem && (
            <>
              <div className="ms2-hud">
                <div className="ms2-level-label">Lv.{levelIdx + 1}</div>
                <div className="ms2-progress">
                  {TIER_EMOJIS[tier]} {TIER_NAMES[tier]} ({questionIdx + 1}/{QUESTIONS_PER_LEVEL})
                </div>
                <div className="ms2-hearts">
                  {Array.from({ length: 3 }, (_, i) => (
                    <span key={i} className={i >= hearts ? 'ms2-heart-lost' : ''}>❤️</span>
                  ))}
                </div>
                <button className="ms2-menu-btn" onClick={goToMenu}>☰</button>
              </div>

              <div className="ms2-timer-wrap">
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

              <div className="ms2-problem-area">
                <div className="ms2-problem-label">이 문제의 답은 영어로?</div>
                <div className="ms2-problem">
                  {problem.a} {problem.op} {problem.b} = ?
                </div>
              </div>

              {streak >= 2 && feedback === null && (
                <div className="ms2-streak" key={streak}>🔥 {streak}연속 정답!</div>
              )}

              <div className="ms2-feedback">
                {feedback === 'correct' && (
                  <span className="ms2-feedback-correct">
                    ✅ 정답! {NUMBER_WORDS[problem.answer].toUpperCase()}
                  </span>
                )}
                {feedback === 'wrong' && (
                  <span className="ms2-feedback-wrong">
                    ❌ 정답: {NUMBER_WORDS[problem.answer].toUpperCase()}
                  </span>
                )}
              </div>

              <div className="ms2-choices">
                {choices.map((value, i) => {
                  let cls = 'ms2-choice'
                  if (feedback !== null) {
                    if (value === problem.answer) cls += ' ms2-choice-correct'
                    else if (value === selectedChoice) cls += ' ms2-choice-wrong'
                  }
                  return (
                    <button
                      key={`${questionIdx}-${i}`}
                      className={cls}
                      disabled={feedback !== null}
                      onClick={() => handleChoice(value)}
                    >
                      {NUMBER_WORDS[value]}
                    </button>
                  )
                })}
              </div>

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
                      if (levelIdx + 1 >= 30) setGameState('complete')
                      else startFromLevel(levelIdx + 1)
                    }}>
                      {levelIdx + 1 >= 30 ? '완료!' : '다음 레벨 →'}
                    </button>
                  </div>
                </div>
              )}

              {showResult === 'fail' && (
                <div className="ms2-overlay ms2-overlay-fail">
                  <div className="ms2-overlay-content">
                    <span className="ms2-overlay-emoji">😢</span>
                    <h2>아쉬워요!</h2>
                    <p>정답: {correctCount}/{QUESTIONS_PER_LEVEL}</p>
                    <div>
                      <button className="ms2-overlay-btn ms2-overlay-btn-retry" onClick={() => startFromLevel(levelIdx)}>
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

      <div className="ms2-instructions">보기에서 정답을 골라 터치하세요 (키보드: 1~4)</div>
    </div>
  )
}

export default MathSpell
