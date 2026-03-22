import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGameScale } from '../hooks/useGameScale'
import { useTouchLock } from '../hooks/useTouchLock'
import './MonsterDefense.css'

const GAME_W = 800
const GAME_H = 450
const MONSTER_SPAWN_X = 102
const BASE_LINE_X = 13
const MAX_HP = 20
const LS_HIGH_WAVE = 'monsterDefenseH_highWave'

// Wall grid: 2 columns × 9 rows = 18 slots
const WALL_SLOTS = []
for (let row = 0; row < 9; row++) {
  for (let col = 0; col < 2; col++) {
    WALL_SLOTS.push({
      x: 3.2 + col * 5.6,
      y: 7 + row * 10.5,
    })
  }
}

const MONSTER_TYPES = {
  slime: { emoji: '👺', speed: 4.0, hp: 5, gold: 5, minWave: 1 },
  bat: { emoji: '🦹', speed: 7.0, hp: 3, gold: 8, minWave: 6 },
  golem: { emoji: '👹', speed: 2.0, hp: 20, gold: 20, minWave: 11 },
  ghost: { emoji: '☠️', speed: 5.0, hp: 8, gold: 12, minWave: 16 },
  dragon: { emoji: '🐲', speed: 3.0, hp: 80, gold: 100, isBoss: true },
}

const WEAPON_TYPES = {
  arrow: { emoji: '🏹', damage: 2, fireRate: 1.5, range: 70, special: 'single', cost: 50, sell: 25, label: '화살탑' },
  cannon: { emoji: '💣', damage: 6, fireRate: 1.2, range: 60, special: 'splash', cost: 200, sell: 100, label: '대포탑' },
  magic: { emoji: '⚡', damage: 3, fireRate: 1.0, range: 80, special: 'pierce', cost: 500, sell: 250, label: '마법탑' },
  ice: { emoji: '❄️', damage: 1, fireRate: 1.2, range: 65, special: 'slow', cost: 350, sell: 175, label: '얼음탑' },
}

const PROJECTILE_SPEED = 30
const SPLASH_RADIUS = 5

let nextId = 1
function genId() { return nextId++ }

function getAvailableMonsterTypes(wave) {
  return Object.entries(MONSTER_TYPES)
    .filter(([, cfg]) => !cfg.isBoss && cfg.minWave <= wave)
    .map(([type]) => type)
}

function getWaveMonsterCount(wave) {
  if (wave <= 5) return (4 + wave * 2) * 3
  if (wave <= 10) return (14 + (wave - 5) * 3) * 3
  if (wave <= 15) return (29 + (wave - 10) * 4) * 3
  return (49 + (wave - 15) * 5) * 3
}

function createMonster(wave, forceType) {
  const isBossWave = wave % 5 === 0
  let type = forceType
  if (!type) {
    const available = getAvailableMonsterTypes(wave)
    type = available[Math.floor(Math.random() * available.length)]
  }
  const cfg = MONSTER_TYPES[type]
  const sc = 1 + (wave - 1) * 0.05
  const hp = type === 'dragon' ? cfg.hp + wave * 15 : Math.ceil(cfg.hp * (wave > 5 ? sc : 1))
  return {
    id: genId(), type, x: MONSTER_SPAWN_X, y: 10 + Math.random() * 80,
    hp, maxHp: hp, speed: cfg.speed, gold: cfg.gold, emoji: cfg.emoji,
    slowed: false, slowTimer: 0, isBoss: cfg.isBoss || false,
    wobbleOffset: Math.random() * Math.PI * 2, wobbleTime: 0,
  }
}

function createProjectile(weapon, slotPos, targetId, targetY, weaponType) {
  return {
    id: genId(), x: slotPos.x, y: slotPos.y,
    targetId, targetY,
    type: weaponType, damage: weapon.damage, range: weapon.range,
    startX: slotPos.x, pierceCount: weaponType === 'magic' ? 3 : 1,
    piercedIds: new Set(),
  }
}

function MonsterDefense() {
  const containerRef = useRef(null)
  const scale = useGameScale(GAME_W, GAME_H, { reservedH: 60 })
  useTouchLock(containerRef)

  const [phase, setPhase] = useState('start')
  const [gameSpeed, setGameSpeed] = useState(1) // 1x, 2x, 3x
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [popupType, setPopupType] = useState(null) // 'buy' | 'upgrade' | null
  const [floatingTexts, setFloatingTexts] = useState([])
  const [screenShake, setScreenShake] = useState(false)
  const [bossWarning, setBossWarning] = useState(false)
  const [waveBanner, setWaveBanner] = useState(null)
  const [waveClear, setWaveClear] = useState(false)
  const [restCountdown, setRestCountdown] = useState(5)
  const [highWave, setHighWave] = useState(() => {
    const s = localStorage.getItem(LS_HIGH_WAVE)
    return s ? Number(s) : 0
  })

  const monstersRef = useRef([])
  const projectilesRef = useRef([])
  const weaponsRef = useRef([])
  const goldRef = useRef(0)
  const hpRef = useRef(MAX_HP)
  const waveRef = useRef(1)
  const frameCountRef = useRef(0)
  const spawnCountRef = useRef(0)
  const spawnTotalRef = useRef(0)
  const spawnTimerRef = useRef(0)
  const phaseRef = useRef('start')
  const rafRef = useRef(null)
  const lastTimeRef = useRef(null)
  const statsRef = useRef({ monstersKilled: 0, goldEarned: 0 })
  const gameSpeedRef = useRef(1)

  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { gameSpeedRef.current = gameSpeed }, [gameSpeed])

  const [, forceRender] = useState(0)
  const flush = useCallback(() => forceRender(t => t + 1), [])

  const addFloatingText = useCallback((text, x, y, color) => {
    const id = genId()
    setFloatingTexts(prev => [...prev, { id, text, x, y, color }])
    setTimeout(() => setFloatingTexts(prev => prev.filter(f => f.id !== id)), 1200)
  }, [])

  const triggerShake = useCallback(() => {
    setScreenShake(true)
    setTimeout(() => setScreenShake(false), 400)
  }, [])

  const initGame = useCallback(() => {
    nextId = 1
    monstersRef.current = []
    projectilesRef.current = []
    goldRef.current = 150
    hpRef.current = MAX_HP
    waveRef.current = 1
    frameCountRef.current = 0
    spawnCountRef.current = 0
    spawnTotalRef.current = getWaveMonsterCount(1)
    spawnTimerRef.current = 0
    statsRef.current = { monstersKilled: 0, goldEarned: 0 }
    weaponsRef.current = []
    setSelectedSlot(null)
    setPopupType(null)
    setFloatingTexts([])
    setScreenShake(false)
    setBossWarning(false)
    setWaveBanner(null)
    setWaveClear(false)
  }, [])

  const startWave = useCallback((wave) => {
    spawnCountRef.current = 0
    spawnTotalRef.current = getWaveMonsterCount(wave)
    spawnTimerRef.current = wave === 1 ? -5 : 0
    setWaveBanner(`웨이브 ${wave}!`)
    setTimeout(() => setWaveBanner(null), 2500)
    if (wave % 5 === 0) {
      setBossWarning(true)
      setTimeout(() => setBossWarning(false), 3000)
      for (let b = 0; b < 3; b++) {
        setTimeout(() => {
          monstersRef.current = [...monstersRef.current, createMonster(wave, 'dragon')]
        }, 2000 + b * 1500)
      }
    }
  }, [])

  // Game loop
  useEffect(() => {
    if (phase !== 'playing') {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return
    }
    lastTimeRef.current = null

    function loop(timestamp) {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp
      const rawDt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05)
      const dt = rawDt * gameSpeedRef.current
      lastTimeRef.current = timestamp
      if (phaseRef.current !== 'playing') return

      frameCountRef.current++
      const wave = waveRef.current

      // Spawn
      spawnTimerRef.current += dt
      const dur = 15 + wave * 0.5
      const interval = dur / spawnTotalRef.current
      while (spawnTimerRef.current >= interval && spawnCountRef.current < spawnTotalRef.current && monstersRef.current.length < 60) {
        spawnTimerRef.current -= interval
        monstersRef.current.push(createMonster(wave))
        spawnCountRef.current++
      }

      // Move monsters
      const toRemove = []
      for (let i = 0; i < monstersRef.current.length; i++) {
        const m = monstersRef.current[i]
        if (m.slowed && m.slowTimer > 0) {
          m.slowTimer -= dt
          if (m.slowTimer <= 0) { m.slowed = false; m.slowTimer = 0 }
        }
        const spd = m.slowed ? m.speed * 0.5 : m.speed
        m.x -= spd * dt
        m.wobbleTime += dt
        m.y = Math.max(5, Math.min(95, m.y + Math.sin(m.wobbleTime * 1.2 + m.wobbleOffset) * 0.15))

        if (m.x <= BASE_LINE_X) {
          hpRef.current = Math.max(0, hpRef.current - (m.isBoss ? 5 : 1))
          toRemove.push(m.id)
          triggerShake()
          if (hpRef.current <= 0) {
            phaseRef.current = 'gameover'
            setPhase('gameover')
            const w = waveRef.current
            setHighWave(prev => {
              if (w > prev) { localStorage.setItem(LS_HIGH_WAVE, String(w)); return w }
              return prev
            })
          }
        }
      }
      if (toRemove.length > 0) {
        monstersRef.current = monstersRef.current.filter(m => !toRemove.includes(m.id))
      }

      // Weapons fire
      for (let i = 0; i < weaponsRef.current.length; i++) {
        const w = weaponsRef.current[i]
        w.fireTimer -= dt
        if (w.fireTimer > 0) continue
        const slotPos = WALL_SLOTS[w.slotIndex]
        if (!slotPos) continue
        let nearestId = null
        let nearestY = slotPos.y
        let nearestDist = Infinity
        for (const m of monstersRef.current) {
          const dx = m.x - slotPos.x
          if (dx > 0 && dx <= w.range) {
            const d = Math.abs(m.y - slotPos.y) + dx * 0.3
            if (d < nearestDist) { nearestDist = d; nearestY = m.y; nearestId = m.id }
          }
        }
        w.fireTimer = 1 / w.fireRate
        projectilesRef.current.push(createProjectile(w, slotPos, nearestId, nearestY, w.type))
      }

      // Move projectiles & collisions
      const pRemove = []
      for (let i = 0; i < projectilesRef.current.length; i++) {
        const b = projectilesRef.current[i]
        if (pRemove.includes(b.id)) continue
        const traveled = b.x - b.startX
        if (traveled >= b.range || b.x > 101) { pRemove.push(b.id); continue }

        // Homing: track target monster position
        const target = b.targetId ? monstersRef.current.find(m => m.id === b.targetId) : null
        const tgtX = target ? target.x : b.x + 20
        const tgtY = target ? target.y : b.targetY
        const dx = tgtX - b.x
        const dy = tgtY - b.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        b.x += (dx / dist) * PROJECTILE_SPEED * dt
        b.y += (dy / dist) * PROJECTILE_SPEED * dt

        if (b.type === 'cannon') {
          let hit = false
          for (const m of monstersRef.current) {
            if (Math.abs(b.x - m.x) < 3 && Math.abs(b.y - m.y) < 5) { hit = true; break }
          }
          if (hit) {
            for (const m of monstersRef.current) {
              const dist = Math.sqrt(Math.pow((b.x - m.x) * 8, 2) + Math.pow((b.y - m.y) * 4.5, 2)) / 8
              if (dist <= SPLASH_RADIUS) m.hp -= b.damage
            }
            const killed = monstersRef.current.filter(m => m.hp <= 0)
            killed.forEach(m => {
              goldRef.current += m.gold
              statsRef.current.monstersKilled++
              statsRef.current.goldEarned += m.gold
              addFloatingText(`+${m.gold}G`, m.x, m.y, '#ffd700')
            })
            monstersRef.current = monstersRef.current.filter(m => m.hp > 0)
            pRemove.push(b.id)
          }
        } else {
          for (const m of monstersRef.current) {
            if (b.piercedIds.has(m.id)) continue
            if (Math.abs(b.x - m.x) < 2 && Math.abs(b.y - m.y) < 3) {
              b.piercedIds.add(m.id)
              m.hp -= b.damage
              if (b.type === 'ice') { m.slowed = true; m.slowTimer = 3 }
              addFloatingText(`-${b.damage}`, m.x, m.y - 3, '#ff6666')
              if (m.hp <= 0) {
                goldRef.current += m.gold
                statsRef.current.monstersKilled++
                statsRef.current.goldEarned += m.gold
                addFloatingText(`+${m.gold}G`, m.x, m.y, '#ffd700')
              }
              b.pierceCount--
              if (b.pierceCount <= 0) { pRemove.push(b.id); break }
            }
          }
          monstersRef.current = monstersRef.current.filter(m => m.hp > 0)
        }
      }
      projectilesRef.current = projectilesRef.current.filter(b => !pRemove.includes(b.id))
      if (projectilesRef.current.length > 50) projectilesRef.current = projectilesRef.current.slice(-50)

      // Wave clear
      if (spawnCountRef.current >= spawnTotalRef.current && monstersRef.current.length === 0 && phaseRef.current === 'playing') {
        phaseRef.current = 'rest'
        setPhase('rest')
        setWaveClear(true)
        setTimeout(() => setWaveClear(false), 2000)
      }

      if (frameCountRef.current % 2 === 0) flush()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [phase, flush, addFloatingText, triggerShake])

  // Rest countdown
  useEffect(() => {
    if (phase !== 'rest') return
    setRestCountdown(3)
    let count = 3
    const iv = setInterval(() => {
      count--
      setRestCountdown(count)
      if (count <= 0) {
        clearInterval(iv)
        waveRef.current++
        startWave(waveRef.current)
        phaseRef.current = 'playing'
        setPhase('playing')
      }
    }, 1000)
    return () => clearInterval(iv)
  }, [phase, startWave])

  const handleStart = useCallback(() => {
    initGame()
    startWave(1)
    phaseRef.current = 'playing'
    setPhase('playing')
  }, [initGame, startWave])

  // Slot click → open popup
  const handleSlotClick = useCallback((slotIdx) => {
    if (selectedSlot === slotIdx && popupType) {
      setSelectedSlot(null)
      setPopupType(null)
      return
    }
    setSelectedSlot(slotIdx)
    const hasWeapon = weaponsRef.current.some(w => w.slotIndex === slotIdx)
    setPopupType(hasWeapon ? 'upgrade' : 'buy')
  }, [selectedSlot, popupType])

  // Close popup when clicking field
  const handleFieldClick = useCallback(() => {
    setSelectedSlot(null)
    setPopupType(null)
  }, [])

  const handleBuyWeapon = useCallback((weaponType) => {
    if (selectedSlot === null) return
    const cfg = WEAPON_TYPES[weaponType]
    if (goldRef.current < cfg.cost) return
    if (weaponsRef.current.some(w => w.slotIndex === selectedSlot)) return

    goldRef.current -= cfg.cost
    weaponsRef.current.push({
      id: genId(), type: weaponType, slotIndex: selectedSlot,
      damage: cfg.damage, fireRate: cfg.fireRate, range: cfg.range,
      fireTimer: 0, emoji: cfg.emoji, upgrades: { speed: 0, power: 0 },
    })
    setPopupType('upgrade')
    flush()
  }, [selectedSlot, flush])

  const handleUpgrade = useCallback((upgradeType) => {
    const weapon = weaponsRef.current.find(w => w.slotIndex === selectedSlot)
    if (!weapon) return
    const level = weapon.upgrades[upgradeType]
    const cost = 50 * Math.pow(2, level)
    if (goldRef.current < cost) return

    goldRef.current -= cost
    weapon.upgrades[upgradeType]++
    if (upgradeType === 'speed') weapon.fireRate *= 1.25
    if (upgradeType === 'power') weapon.damage = Math.ceil(weapon.damage * 1.5)
    flush()
  }, [selectedSlot, flush])

  const handleSell = useCallback(() => {
    const weapon = weaponsRef.current.find(w => w.slotIndex === selectedSlot)
    if (!weapon) return
    const cfg = WEAPON_TYPES[weapon.type]
    goldRef.current += cfg.sell
    weaponsRef.current = weaponsRef.current.filter(w => w.slotIndex !== selectedSlot)
    setPopupType(null)
    flush()
  }, [selectedSlot, flush])

  const getUpCost = (weapon, type) => {
    if (!weapon) return 50
    return 50 * Math.pow(2, weapon.upgrades[type])
  }

  // Render values
  const monsters = monstersRef.current
  const projectiles = projectilesRef.current
  const weapons = weaponsRef.current
  const gold = goldRef.current
  const hp = hpRef.current
  const wave = waveRef.current
  const hpPct = Math.max(0, (hp / MAX_HP) * 100)
  const hpColor = hpPct > 50 ? '#44cc44' : hpPct > 25 ? '#ffcc00' : '#ff4444'

  // Popup position (relative to wrapper, scaled)
  const popupSlot = selectedSlot !== null ? WALL_SLOTS[selectedSlot] : null
  const popupX = popupSlot ? Math.round(popupSlot.x * scale * GAME_W / 100 + 30 * scale) : 0
  const popupY = popupSlot ? Math.round(popupSlot.y * scale * GAME_H / 100 - 20 * scale) : 0
  const selectedWeapon = selectedSlot !== null ? weapons.find(w => w.slotIndex === selectedSlot) : null

  if (phase === 'start') {
    return (
      <div ref={containerRef} className="md-container">
        <Link to="/" className="md-back-button">← 홈으로</Link>
        <div className="md-overlay">
          <div className="md-start-box">
            <span className="md-start-emoji">🏰</span>
            <h1 className="md-start-title">몬스터 디펜스</h1>
            <div className="md-howto">
              <div className="md-howto-rule">👆 왼쪽 벽의 빈칸을 터치해서 무기를 설치!</div>
              <div className="md-howto-rule">🏹 무기가 자동으로 미사일을 발사해요</div>
              <div className="md-howto-rule">👾 몬스터가 오른쪽에서 천천히 다가와요</div>
              <div className="md-howto-rule">💰 시작 골드 150G! 화살탑은 50G</div>
              <div className="md-howto-rule">⬆️ 설치된 무기를 터치하면 업그레이드/판매</div>
              <div className="md-howto-rule">❤️ 몬스터가 벽에 닿으면 HP가 줄어요</div>
            </div>
            <button className="md-btn" onClick={handleStart}>시작하기</button>
            {highWave > 0 && <div style={{ color: '#ffd700', fontSize: 13, marginTop: 10 }}>최고 기록: 웨이브 {highWave}</div>}
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'gameover') {
    return (
      <div ref={containerRef} className="md-container">
        <Link to="/" className="md-back-button">← 홈으로</Link>
        <div className="md-overlay">
          <div className="md-gameover-box">
            <div style={{ color: 'white', fontSize: 28, fontWeight: 900, marginBottom: 14 }}>게임 오버 🏰</div>
            <div className="md-gameover-stats">
              <div>도달 웨이브: {wave}</div>
              <div>처치: {statsRef.current.monstersKilled}마리</div>
              <div>골드: {statsRef.current.goldEarned.toLocaleString()}G</div>
            </div>
            {wave > highWave && <div className="md-new-record">🎉 새로운 최고 기록!</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="md-btn" onClick={handleStart}>다시 시작</button>
              <Link to="/" className="md-btn">홈으로</Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="md-container">
      <Link to="/" className="md-back-button">← 홈으로</Link>

      <div className={`md-wrapper${screenShake ? ' md-screen-shake' : ''}`} style={{ width: GAME_W * scale, height: GAME_H * scale, position: 'relative' }}>
        <div className="md-game-area" style={{ width: GAME_W, height: GAME_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <div className="md-field" onClick={handleFieldClick} />
          <div className="md-wall" />

          {/* HUD */}
          <div className="md-hud">
            <div className="md-hp-container">
              <span style={{ fontSize: 12 }}>❤️</span>
              <div className="md-hp-bar">
                <div className="md-hp-bar-fill" style={{ width: `${hpPct}%`, background: hpColor }} />
              </div>
              <span className="md-hp-text">{hp}/{MAX_HP}</span>
            </div>
            <span className="md-wave-label">🌊 {wave}웨이브</span>
            <span className="md-gold-display">💰 {gold}G</span>
            <button
              className="md-speed-btn"
              onClick={() => setGameSpeed(s => s >= 3 ? 1 : s + 1)}
            >
              ⏩ {gameSpeed}x
            </button>
          </div>

          {/* Wall grid slots */}
          {WALL_SLOTS.map((pos, i) => {
            const weapon = weapons.find(w => w.slotIndex === i)
            const isSel = selectedSlot === i
            return (
              <div
                key={i}
                className={`md-slot${weapon ? ' md-slot-filled' : ' md-slot-empty'}${isSel ? ' md-slot-selected' : ''}`}
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                onClick={(e) => { e.stopPropagation(); handleSlotClick(i) }}
              >
                {weapon ? (
                  <span className="md-slot-emoji">{weapon.emoji}</span>
                ) : (
                  <span className="md-slot-plus">+</span>
                )}
              </div>
            )
          })}

          {/* Range indicator for selected weapon */}
          {selectedSlot !== null && selectedWeapon && (() => {
            const pos = WALL_SLOTS[selectedSlot]
            if (!pos) return null
            const rangeW = selectedWeapon.range
            return (
              <div
                className="md-range-indicator"
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  width: `${rangeW}%`,
                  height: '16%',
                }}
              />
            )
          })()}

          {/* Monsters */}
          {monsters.map(m => (
            <div key={m.id} className={`md-monster${m.slowed ? ' md-monster-slowed' : ''}${m.isBoss ? ' md-monster-boss' : ''}`} style={{ left: `${m.x}%`, top: `${m.y}%` }}>
              <div className="md-monster-hp"><div className="md-monster-hp-fill" style={{ width: `${Math.max(0, (m.hp / m.maxHp) * 100)}%` }} /></div>
              <span className="md-monster-emoji">{m.emoji}</span>
            </div>
          ))}

          {/* Projectiles */}
          {projectiles.map(b => (
            <div key={b.id} className={`md-projectile md-proj-${b.type}`} style={{ left: `${b.x}%`, top: `${b.y}%` }} />
          ))}

          {/* Floating texts */}
          {floatingTexts.map(f => (
            <div key={f.id} className="md-float-text" style={{ left: `${f.x}%`, top: `${f.y}%`, color: f.color }}>{f.text}</div>
          ))}

          {waveBanner && <div className="md-wave-banner">{waveBanner}</div>}
          {bossWarning && <div className="md-boss-warning">⚠️ BOSS!</div>}
          {waveClear && <div className="md-wave-clear">웨이브 클리어!</div>}
          {phase === 'rest' && <div className="md-rest-timer">다음 웨이브 {restCountdown}초</div>}
          {phase === 'playing' && spawnCountRef.current === 0 && monstersRef.current.length === 0 && (
            <div className="md-rest-timer">👆 벽의 빈칸을 터치해서 무기 설치!</div>
          )}
        </div>

        {/* Inline popup — OUTSIDE game-area, inside wrapper */}
        {popupType && popupSlot && (
          <div
            className="md-popup"
            style={{ left: popupX, top: Math.max(0, Math.min(popupY, GAME_H * scale - 160)) }}
            onClick={(e) => e.stopPropagation()}
          >
            {popupType === 'buy' && (
              <div className="md-popup-inner">
                <div className="md-popup-title">무기 구매</div>
                {Object.entries(WEAPON_TYPES).map(([type, cfg]) => (
                  <button key={type} className="md-popup-btn" onClick={() => handleBuyWeapon(type)} disabled={gold < cfg.cost}>
                    <span>{cfg.emoji} {cfg.label}</span>
                    <span className={gold >= cfg.cost ? 'md-affordable' : ''}>{cfg.cost}G</span>
                  </button>
                ))}
                <button className="md-popup-close" onClick={() => { setSelectedSlot(null); setPopupType(null) }}>✕</button>
              </div>
            )}
            {popupType === 'upgrade' && selectedWeapon && (
              <div className="md-popup-inner">
                <div className="md-popup-title">{selectedWeapon.emoji} {WEAPON_TYPES[selectedWeapon.type].label}</div>
                <button className="md-popup-btn" onClick={() => handleUpgrade('speed')} disabled={gold < getUpCost(selectedWeapon, 'speed')}>
                  <span>⚡ 속도 Lv.{selectedWeapon.upgrades.speed + 1}</span>
                  <span className={gold >= getUpCost(selectedWeapon, 'speed') ? 'md-affordable' : ''}>{getUpCost(selectedWeapon, 'speed')}G</span>
                </button>
                <button className="md-popup-btn" onClick={() => handleUpgrade('power')} disabled={gold < getUpCost(selectedWeapon, 'power')}>
                  <span>💥 파워 Lv.{selectedWeapon.upgrades.power + 1}</span>
                  <span className={gold >= getUpCost(selectedWeapon, 'power') ? 'md-affordable' : ''}>{getUpCost(selectedWeapon, 'power')}G</span>
                </button>
                <button className="md-popup-btn md-popup-sell" onClick={handleSell}>
                  <span>🗑️ 판매</span>
                  <span className="md-affordable">+{WEAPON_TYPES[selectedWeapon.type].sell}G</span>
                </button>
                <button className="md-popup-close" onClick={() => { setSelectedSlot(null); setPopupType(null) }}>✕</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default MonsterDefense
