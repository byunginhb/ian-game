import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGameScale } from '../hooks/useGameScale'
import { useTouchLock } from '../hooks/useTouchLock'
import './WordPuzzle.css'

const GAME_W = 400
const GAME_H = 680

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
]

const LEVELS = [
  // Tier 1: 3글자 쉬운 단어 (하트 5)
  { word: 'cat', emoji: '🐱', hint: '야옹하고 울어요', maxHearts: 5 },
  { word: 'dog', emoji: '🐶', hint: '멍멍 짖어요', maxHearts: 5 },
  { word: 'sun', emoji: '☀️', hint: '하늘에서 빛나요', maxHearts: 5 },
  { word: 'cup', emoji: '🥤', hint: '물을 마셔요', maxHearts: 5 },
  { word: 'hat', emoji: '🎩', hint: '머리에 써요', maxHearts: 5 },
  // Tier 2: 3~4글자 (하트 5)
  { word: 'fish', emoji: '🐟', hint: '물속에 살아요', maxHearts: 5 },
  { word: 'bird', emoji: '🐦', hint: '하늘을 날아요', maxHearts: 5 },
  { word: 'cake', emoji: '🎂', hint: '생일에 먹어요', maxHearts: 5 },
  { word: 'frog', emoji: '🐸', hint: '개굴개굴 울어요', maxHearts: 5 },
  { word: 'moon', emoji: '🌙', hint: '밤에 빛나요', maxHearts: 5 },
  // Tier 3: 5글자 (하트 4)
  { word: 'apple', emoji: '🍎', hint: '빨간 과일이에요', maxHearts: 4 },
  { word: 'happy', emoji: '😊', hint: '기분이 좋아요', maxHearts: 4 },
  { word: 'mouse', emoji: '🐭', hint: '찍찍 울어요', maxHearts: 4 },
  { word: 'lemon', emoji: '🍋', hint: '노란 과일, 시어요', maxHearts: 4 },
  { word: 'tiger', emoji: '🐯', hint: '줄무늬 동물이에요', maxHearts: 4 },
  // Tier 4: 6글자 (하트 4)
  { word: 'banana', emoji: '🍌', hint: '노란 과일, 길어요', maxHearts: 4 },
  { word: 'rabbit', emoji: '🐰', hint: '깡충깡충 뛰어요', maxHearts: 4 },
  { word: 'orange', emoji: '🍊', hint: '주황색 과일이에요', maxHearts: 4 },
  { word: 'flower', emoji: '🌸', hint: '봄에 피어요', maxHearts: 4 },
  { word: 'turtle', emoji: '🐢', hint: '느리지만 열심히 가요', maxHearts: 4 },
  // Tier 5: 복합 (하트 3)
  { word: 'pencil', emoji: '✏️', hint: '글씨를 써요', maxHearts: 3 },
  { word: 'school', emoji: '🏫', hint: '공부하는 곳이에요', maxHearts: 3 },
  { word: 'rocket', emoji: '🚀', hint: '우주로 날아가요', maxHearts: 3 },
  { word: 'dragon', emoji: '🐉', hint: '불을 뿜어요', maxHearts: 3 },
  { word: 'window', emoji: '🪟', hint: '밖을 볼 수 있어요', maxHearts: 3 },
  // Tier 6: 고난도 (하트 3)
  { word: 'rainbow', emoji: '🌈', hint: '비 온 뒤 나타나요', maxHearts: 3 },
  { word: 'dolphin', emoji: '🐬', hint: '바다에서 뛰어올라요', maxHearts: 3 },
  { word: 'popcorn', emoji: '🍿', hint: '영화관에서 먹어요', maxHearts: 3 },
  { word: 'penguin', emoji: '🐧', hint: '얼음 위에 살아요', maxHearts: 3 },
  { word: 'diamond', emoji: '💎', hint: '반짝이는 보석이에요', maxHearts: 3 },
]

function calculateStars(remainingHearts, maxHearts) {
  if (remainingHearts === maxHearts) return 3
  if (remainingHearts >= Math.ceil(maxHearts / 2)) return 2
  return 1
}

function WordPuzzle() {
  const scale = useGameScale(GAME_W, GAME_H)
  const containerRef = useRef(null)
  useTouchLock(containerRef)

  const [gameState, setGameState] = useState('menu') // menu | playing | complete
  const [levelIdx, setLevelIdx] = useState(0)
  const [guessed, setGuessed] = useState(new Set())
  const [wrong, setWrong] = useState(new Set())
  const [hearts, setHearts] = useState(5)
  const [showResult, setShowResult] = useState(null) // null | 'success' | 'fail'
  const [clearedLevels, setClearedLevels] = useState(() => {
    try {
      const saved = localStorage.getItem('wp-cleared')
      if (!saved) return new Set()
      const parsed = JSON.parse(saved)
      if (!Array.isArray(parsed)) return new Set()
      return new Set(parsed.filter((v) => Number.isInteger(v) && v >= 0 && v < LEVELS.length))
    } catch { return new Set() }
  })
  const [levelStars, setLevelStars] = useState(() => {
    try {
      const saved = localStorage.getItem('wp-stars')
      if (!saved) return {}
      const parsed = JSON.parse(saved)
      if (typeof parsed !== 'object' || parsed === null) return {}
      return parsed
    } catch { return {} }
  })

  const level = LEVELS[levelIdx]

  const saveClearedLevels = useCallback((cleared, stars) => {
    try {
      localStorage.setItem('wp-cleared', JSON.stringify([...cleared]))
      localStorage.setItem('wp-stars', JSON.stringify(stars))
    } catch { /* noop */ }
  }, [])

  const resetLevel = useCallback((idx) => {
    const lv = LEVELS[idx]
    setGuessed(new Set())
    setWrong(new Set())
    setHearts(lv.maxHearts)
    setShowResult(null)
  }, [])

  const startFromLevel = useCallback((idx) => {
    setLevelIdx(idx)
    resetLevel(idx)
    setGameState('playing')
  }, [resetLevel])

  const handleLetterSelect = useCallback((letter) => {
    if (showResult) return
    const lower = letter.toLowerCase()
    if (guessed.has(lower) || wrong.has(lower)) return

    if (level.word.includes(lower)) {
      const newGuessed = new Set([...guessed, lower])
      setGuessed(newGuessed)

      // check win
      const allRevealed = [...level.word].every((ch) => newGuessed.has(ch))
      if (allRevealed) {
        const stars = calculateStars(hearts, level.maxHearts)
        const newCleared = new Set([...clearedLevels, levelIdx])
        const newStars = { ...levelStars, [levelIdx]: Math.max(stars, levelStars[levelIdx] || 0) }
        setClearedLevels(newCleared)
        setLevelStars(newStars)
        saveClearedLevels(newCleared, newStars)
        setShowResult('success')
      }
    } else {
      const newWrong = new Set([...wrong, lower])
      setWrong(newWrong)
      const newHearts = hearts - 1
      setHearts(newHearts)

      if (newHearts <= 0) {
        setShowResult('fail')
      }
    }
  }, [showResult, guessed, wrong, level, hearts, clearedLevels, levelIdx, levelStars, saveClearedLevels])

  const handleNextLevel = useCallback(() => {
    if (levelIdx + 1 >= LEVELS.length) {
      setGameState('complete')
    } else {
      startFromLevel(levelIdx + 1)
    }
  }, [levelIdx, startFromLevel])

  const handleRetry = useCallback(() => {
    resetLevel(levelIdx)
  }, [levelIdx, resetLevel])

  // keyboard input
  useEffect(() => {
    if (gameState !== 'playing') return

    const onKey = (e) => {
      const key = e.key.toUpperCase()
      if (key.length === 1 && key >= 'A' && key <= 'Z') {
        e.preventDefault()
        handleLetterSelect(key)
      }
      if (e.key === 'Enter' && showResult === 'success') {
        handleNextLevel()
      }
      if (e.key === 'Enter' && showResult === 'fail') {
        handleRetry()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [gameState, handleLetterSelect, showResult, handleNextLevel, handleRetry])

  const totalStars = Object.values(levelStars).reduce((sum, s) => sum + s, 0)
  const earnedStars = showResult === 'success' ? calculateStars(hearts, level.maxHearts) : 0

  return (
    <div ref={containerRef} className="wp-container">
      <Link to="/" className="wp-back-button">← 홈으로</Link>

      <div className="wp-wrapper" style={{ width: GAME_W * scale, height: GAME_H * scale }}>
        <div
          className="wp-area"
          style={{ width: GAME_W, height: GAME_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
          {/* ===== Menu ===== */}
          {gameState === 'menu' && (
            <div className="wp-menu">
              <div className="wp-menu-emoji">🔤</div>
              <h2 className="wp-menu-title">Word Puzzle</h2>
              <p className="wp-menu-desc">
                이모지 힌트를 보고<br />영어 단어를 맞춰보세요!
              </p>
              <button className="wp-menu-start" onClick={() => startFromLevel(0)}>
                게임 시작
              </button>

              <div className="wp-level-select">
                <div className="wp-level-select-title">
                  ⭐ {totalStars} / {LEVELS.length * 3} — 레벨 선택
                </div>
                <div className="wp-level-btns">
                  {LEVELS.map((_, i) => (
                    <button
                      key={i}
                      className={`wp-level-btn${clearedLevels.has(i) ? ' wp-level-cleared' : ''}`}
                      onClick={() => startFromLevel(i)}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===== Playing ===== */}
          {gameState === 'playing' && (
            <>
              {/* HUD */}
              <div className="wp-hud">
                <div className="wp-level-label">Lv.{levelIdx + 1}</div>
                <div className="wp-hearts">
                  {Array.from({ length: level.maxHearts }, (_, i) => (
                    <span key={i} className={i >= hearts ? 'wp-heart-lost' : ''}>
                      ❤️
                    </span>
                  ))}
                </div>
                <button className="wp-menu-btn" onClick={() => setGameState('menu')}>☰</button>
              </div>

              {/* Hint */}
              <div className="wp-hint-area">
                <span className="wp-hint-emoji">{level.emoji}</span>
                <div className="wp-hint-text">{level.hint}</div>
              </div>

              {/* Word slots */}
              <div className="wp-word-area">
                {[...level.word].map((ch, i) => {
                  const revealed = guessed.has(ch)
                  return (
                    <div
                      key={i}
                      className={`wp-letter-slot${revealed ? ' wp-letter-revealed' : ''}`}
                    >
                      {revealed ? ch.toUpperCase() : ''}
                    </div>
                  )
                })}
              </div>

              {/* Keyboard */}
              <div className="wp-keyboard">
                {KEYBOARD_ROWS.map((row, ri) => (
                  <div key={ri} className="wp-kb-row">
                    {row.map((letter) => {
                      const lower = letter.toLowerCase()
                      const isCorrect = guessed.has(lower)
                      const isWrong = wrong.has(lower)
                      let cls = 'wp-kb-key'
                      if (isCorrect) cls += ' wp-kb-correct'
                      if (isWrong) cls += ' wp-kb-wrong'
                      return (
                        <button
                          key={letter}
                          className={cls}
                          disabled={isCorrect || isWrong || showResult !== null}
                          onClick={() => handleLetterSelect(letter)}
                        >
                          {letter}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>

              {/* Success overlay */}
              {showResult === 'success' && (
                <div className="wp-overlay wp-overlay-success">
                  <div className="wp-overlay-content">
                    <span className="wp-overlay-emoji">🎉</span>
                    <h2>정답!</h2>
                    <div className="wp-overlay-word">{level.word}</div>
                    <div className="wp-stars-display">
                      {[1, 2, 3].map((s) => (
                        <span
                          key={s}
                          className={`wp-star-icon${s <= earnedStars ? ' wp-star-earned' : ''}`}
                          style={{ animationDelay: `${s * 0.15}s` }}
                        >
                          ⭐
                        </span>
                      ))}
                    </div>
                    <button className="wp-overlay-btn" onClick={handleNextLevel}>
                      {levelIdx + 1 >= LEVELS.length ? '완료!' : '다음 레벨 →'}
                    </button>
                  </div>
                </div>
              )}

              {/* Fail overlay */}
              {showResult === 'fail' && (
                <div className="wp-overlay wp-overlay-fail">
                  <div className="wp-overlay-content">
                    <span className="wp-overlay-emoji">😢</span>
                    <h2>아쉬워요!</h2>
                    <p>정답은...</p>
                    <div className="wp-overlay-word">{level.word}</div>
                    <div>
                      <button className="wp-overlay-btn wp-overlay-btn-retry" onClick={handleRetry}>
                        다시 도전
                      </button>
                      <button className="wp-overlay-btn wp-overlay-btn-menu" onClick={() => setGameState('menu')}>
                        메뉴로
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ===== Complete ===== */}
          {gameState === 'complete' && (
            <div className="wp-menu wp-complete">
              <div className="wp-menu-emoji">🏆</div>
              <h2 className="wp-menu-title">축하합니다!</h2>
              <p className="wp-menu-desc">모든 레벨을 클리어했어요!</p>
              <div className="wp-total-stars">⭐ {totalStars} / {LEVELS.length * 3}</div>
              <button className="wp-menu-start" onClick={() => setGameState('menu')}>
                메뉴로 돌아가기
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="wp-instructions">알파벳을 눌러 단어를 완성하세요</div>
    </div>
  )
}

export default WordPuzzle
