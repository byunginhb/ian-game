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
const MAX_MONSTERS = 48
const MAX_PROJECTILES = 64
const MAX_IMPACTS = 18
const MAX_FLOATING_TEXTS = 12
const PAINT_INTERVAL = 1000 / 30

const MONSTER_TYPE_CACHE = new Map()

let nextId = 1
function genId() { return nextId++ }

function getAvailableMonsterTypes(wave) {
  if (MONSTER_TYPE_CACHE.has(wave)) return MONSTER_TYPE_CACHE.get(wave)
  const types = Object.entries(MONSTER_TYPES)
    .filter(([, cfg]) => !cfg.isBoss && cfg.minWave <= wave)
    .map(([type]) => type)
  MONSTER_TYPE_CACHE.set(wave, types)
  return types
}

function getWaveMonsterCount(wave) {
  if (wave <= 5) return (4 + wave * 2) * 3
  if (wave <= 10) return (14 + (wave - 5) * 3) * 3
  if (wave <= 15) return (29 + (wave - 10) * 4) * 3
  return (49 + (wave - 15) * 5) * 3
}

function createMonster(wave, forceType) {
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
    angle: 0,
  }
}

function RotateNotice() {
  return (
    <div className="md-rotate-notice" role="status">
      <div className="md-phone-icon" aria-hidden="true"><span /></div>
      <strong>가로로 돌려주세요</strong>
      <span>넓은 전장에서 더 재미있게 플레이할 수 있어요</span>
    </div>
  )
}

function MonsterDefense() {
  const containerRef = useRef(null)
  const scale = useGameScale(GAME_W, GAME_H, { reservedH: 8, padding: 12 })
  useTouchLock(containerRef)

  const [phase, setPhase] = useState('start')
  const [gameSpeed, setGameSpeed] = useState(1) // 1x, 2x, 3x
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [popupType, setPopupType] = useState(null) // 'buy' | 'upgrade' | null
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
  const impactsRef = useRef([])
  const floatingTextsRef = useRef([])
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
  const lastPaintRef = useRef(0)
  const shakeTimeoutRef = useRef(null)
  const statsRef = useRef({ monstersKilled: 0, goldEarned: 0 })
  const gameSpeedRef = useRef(1)

  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { gameSpeedRef.current = gameSpeed }, [gameSpeed])

  const [, forceRender] = useState(0)
  const flush = useCallback(() => forceRender(t => t + 1), [])

  const addFloatingText = useCallback((text, x, y, color) => {
    floatingTextsRef.current.push({ id: genId(), text, x, y, color, life: 0.9 })
    if (floatingTextsRef.current.length > MAX_FLOATING_TEXTS) {
      floatingTextsRef.current.splice(0, floatingTextsRef.current.length - MAX_FLOATING_TEXTS)
    }
  }, [])

  const addImpact = useCallback((type, x, y) => {
    impactsRef.current.push({ id: genId(), type, x, y, life: 0.38 })
    if (impactsRef.current.length > MAX_IMPACTS) {
      impactsRef.current.splice(0, impactsRef.current.length - MAX_IMPACTS)
    }
  }, [])

  const triggerShake = useCallback(() => {
    if (shakeTimeoutRef.current) return
    setScreenShake(true)
    shakeTimeoutRef.current = setTimeout(() => {
      shakeTimeoutRef.current = null
      setScreenShake(false)
    }, 260)
  }, [])

  useEffect(() => () => {
    if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current)
  }, [])

  const initGame = useCallback(() => {
    nextId = 1
    monstersRef.current = []
    projectilesRef.current = []
    impactsRef.current = []
    floatingTextsRef.current = []
    if (shakeTimeoutRef.current) {
      clearTimeout(shakeTimeoutRef.current)
      shakeTimeoutRef.current = null
    }
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
          if (phaseRef.current === 'playing' && monstersRef.current.length < MAX_MONSTERS) {
            monstersRef.current.push(createMonster(wave, 'dragon'))
          }
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
      while (spawnTimerRef.current >= interval && spawnCountRef.current < spawnTotalRef.current && monstersRef.current.length < MAX_MONSTERS) {
        spawnTimerRef.current -= interval
        monstersRef.current.push(createMonster(wave))
        spawnCountRef.current++
      }

      // Move monsters
      const toRemove = new Set()
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
          toRemove.add(m.id)
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
      if (toRemove.size > 0) {
        monstersRef.current = monstersRef.current.filter(m => !toRemove.has(m.id))
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
        if (nearestId !== null && projectilesRef.current.length < MAX_PROJECTILES) {
          w.fireTimer = 1 / w.fireRate
          projectilesRef.current.push(createProjectile(w, slotPos, nearestId, nearestY, w.type))
        } else {
          // No target or the visual pool is full: retry shortly without creating throwaway DOM nodes.
          w.fireTimer = 0.12
        }
      }

      // Move projectiles & collisions
      const pRemove = new Set()
      const monsterById = new Map(monstersRef.current.map(m => [m.id, m]))
      for (let i = 0; i < projectilesRef.current.length; i++) {
        const b = projectilesRef.current[i]
        if (pRemove.has(b.id)) continue
        const traveled = b.x - b.startX
        if (traveled >= b.range || b.x > 101) { pRemove.add(b.id); continue }

        // Homing: track target monster position
        const target = b.targetId ? monsterById.get(b.targetId) : null
        const liveTarget = target?.hp > 0 ? target : null
        const tgtX = liveTarget ? liveTarget.x : b.x + 20
        const tgtY = liveTarget ? liveTarget.y : b.targetY
        const dx = tgtX - b.x
        const dy = tgtY - b.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        b.angle = Math.atan2(dy, dx) * 180 / Math.PI
        b.x += (dx / dist) * PROJECTILE_SPEED * dt
        b.y += (dy / dist) * PROJECTILE_SPEED * dt

        if (b.type === 'cannon') {
          let hit = false
          for (const m of monstersRef.current) {
            if (m.hp > 0 && Math.abs(b.x - m.x) < 3 && Math.abs(b.y - m.y) < 5) { hit = true; break }
          }
          if (hit) {
            for (const m of monstersRef.current) {
              if (m.hp <= 0) continue
              const dist = Math.sqrt(Math.pow((b.x - m.x) * 8, 2) + Math.pow((b.y - m.y) * 4.5, 2)) / 8
              if (dist <= SPLASH_RADIUS) {
                m.hp -= b.damage
                if (m.hp <= 0) {
                  goldRef.current += m.gold
                  statsRef.current.monstersKilled++
                  statsRef.current.goldEarned += m.gold
                  addFloatingText(`+${m.gold}G`, m.x, m.y, '#ffe18a')
                }
              }
            }
            addImpact('cannon', b.x, b.y)
            pRemove.add(b.id)
          }
        } else {
          for (const m of monstersRef.current) {
            if (m.hp <= 0 || b.piercedIds.has(m.id)) continue
            if (Math.abs(b.x - m.x) < 2 && Math.abs(b.y - m.y) < 3) {
              b.piercedIds.add(m.id)
              m.hp -= b.damage
              if (b.type === 'ice') { m.slowed = true; m.slowTimer = 3 }
              addImpact(b.type, b.x, b.y)
              if (m.hp <= 0) {
                goldRef.current += m.gold
                statsRef.current.monstersKilled++
                statsRef.current.goldEarned += m.gold
                addFloatingText(`+${m.gold}G`, m.x, m.y, '#ffe18a')
              }
              b.pierceCount--
              if (b.pierceCount <= 0) { pRemove.add(b.id); break }
            }
          }
        }
      }
      monstersRef.current = monstersRef.current.filter(m => m.hp > 0)
      projectilesRef.current = projectilesRef.current.filter(b => !pRemove.has(b.id))

      // Short-lived feedback is maintained inside the game loop to avoid a timer/state update per hit.
      for (const impact of impactsRef.current) impact.life -= rawDt
      impactsRef.current = impactsRef.current.filter(impact => impact.life > 0)
      for (const floatingText of floatingTextsRef.current) floatingText.life -= rawDt
      floatingTextsRef.current = floatingTextsRef.current.filter(floatingText => floatingText.life > 0)

      // Wave clear
      if (spawnCountRef.current >= spawnTotalRef.current && monstersRef.current.length === 0 && phaseRef.current === 'playing') {
        phaseRef.current = 'rest'
        setPhase('rest')
        setWaveClear(true)
        setTimeout(() => setWaveClear(false), 2000)
      }

      const paintInterval = monstersRef.current.length > 36 ? 1000 / 24 : PAINT_INTERVAL
      if (timestamp - lastPaintRef.current >= paintInterval) {
        lastPaintRef.current = timestamp
        flush()
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [phase, flush, addFloatingText, addImpact, triggerShake])

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
  const impacts = impactsRef.current
  const floatingTexts = floatingTextsRef.current
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
        <RotateNotice />
        <Link to="/" className="md-back-button"><span aria-hidden="true">←</span> 게임 선택</Link>
        <div className="md-overlay">
          <div className="md-start-box">
            <div className="md-start-crest" aria-hidden="true">
              <span className="md-start-emoji">🏰</span>
              <span className="md-crest-ring" />
            </div>
            <div className="md-start-content">
              <div className="md-eyebrow">MOONKEEP · NIGHT WATCH</div>
              <h1 className="md-start-title">몬스터 디펜스</h1>
              <p className="md-start-subtitle">성벽에 무기를 설치하고, 달빛을 삼키러 온 몬스터를 막아내세요.</p>
              <div className="md-howto">
                <div className="md-howto-rule"><span>01</span><div><b>성벽 선택</b><small>빈 슬롯을 눌러 무기를 설치해요</small></div></div>
                <div className="md-howto-rule"><span>02</span><div><b>자동 요격</b><small>타워가 가까운 적을 추적해요</small></div></div>
                <div className="md-howto-rule"><span>03</span><div><b>전력 강화</b><small>처치 골드로 속도와 파워를 올려요</small></div></div>
              </div>
              <div className="md-start-actions">
                <button className="md-btn" onClick={handleStart}><span>수비 시작</span><span aria-hidden="true">›</span></button>
                <div className="md-start-gold"><span>시작 자금</span><strong>150 G</strong></div>
                {highWave > 0 && <div className="md-high-wave"><span>최고 기록</span><strong>WAVE {highWave}</strong></div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'gameover') {
    return (
      <div ref={containerRef} className="md-container">
        <RotateNotice />
        <Link to="/" className="md-back-button"><span aria-hidden="true">←</span> 게임 선택</Link>
        <div className="md-overlay">
          <div className="md-gameover-box">
            <div className="md-eyebrow">THE WALL HAS FALLEN</div>
            <h2 className="md-gameover-title">수비 종료</h2>
            <div className="md-gameover-stats">
              <div><span>도달 웨이브</span><strong>{wave}</strong></div>
              <div><span>몬스터 처치</span><strong>{statsRef.current.monstersKilled}</strong></div>
              <div><span>획득 골드</span><strong>{statsRef.current.goldEarned.toLocaleString()} G</strong></div>
            </div>
            {wave > highWave && <div className="md-new-record">✦ 새로운 최고 기록</div>}
            <div className="md-gameover-actions">
              <button className="md-btn" onClick={handleStart}>다시 수비</button>
              <Link to="/" className="md-btn md-btn-secondary">게임 선택</Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="md-container md-playing">
      <RotateNotice />
      <Link to="/" className="md-back-button md-back-ingame" aria-label="게임 선택으로 돌아가기">←</Link>

      <div className={`md-wrapper${screenShake ? ' md-screen-shake' : ''}`} style={{ width: GAME_W * scale, height: GAME_H * scale, position: 'relative' }}>
        <div className="md-game-area" style={{ width: GAME_W, height: GAME_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <div className="md-field" onClick={handleFieldClick} />
          <div className="md-field-mist" />
          <div className="md-wall"><span className="md-wall-sigil">M</span></div>
          <div className="md-gate-line" />

          {/* HUD */}
          <div className="md-hud">
            <div className="md-hp-container">
              <span className="md-hud-icon" aria-hidden="true">♥</span>
              <div className="md-hp-copy">
                <span>성벽 내구도</span>
                <div className="md-hp-bar">
                  <div className="md-hp-bar-fill" style={{ width: `${hpPct}%`, background: hpColor }} />
                </div>
              </div>
              <span className="md-hp-text">{hp}/{MAX_HP}</span>
            </div>
            <span className="md-wave-label"><small>WAVE</small>{String(wave).padStart(2, '0')}</span>
            <span className="md-gold-display"><small>보유 골드</small>{gold.toLocaleString()} <i>G</i></span>
            <button
              className="md-speed-btn"
              onClick={() => setGameSpeed(s => s >= 3 ? 1 : s + 1)}
              aria-label={`게임 속도 ${gameSpeed}배. 눌러서 변경`}
            >
              <span aria-hidden="true">▶▶</span> {gameSpeed}×
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
            <div key={m.id} className={`md-monster${m.slowed ? ' md-monster-slowed' : ''}${m.isBoss ? ' md-monster-boss' : ''}`} style={{ transform: `translate3d(${m.x * GAME_W / 100}px, ${m.y * GAME_H / 100}px, 0) translate(-50%, -50%)` }}>
              <div className="md-monster-hp"><div className="md-monster-hp-fill" style={{ width: `${Math.max(0, (m.hp / m.maxHp) * 100)}%` }} /></div>
              <div className="md-monster-body"><span className="md-monster-emoji">{m.emoji}</span><span className="md-monster-shadow" /></div>
            </div>
          ))}

          {/* Projectiles */}
          {projectiles.map(b => (
            <div
              key={b.id}
              className={`md-projectile md-proj-${b.type}`}
              style={{ transform: `translate3d(${b.x * GAME_W / 100}px, ${b.y * GAME_H / 100}px, 0) translate(-50%, -50%) rotate(${b.angle}deg)` }}
            />
          ))}

          {/* Capped, short-lived impact pool */}
          {impacts.map(impact => (
            <div key={impact.id} className={`md-impact md-impact-${impact.type}`} style={{ left: `${impact.x}%`, top: `${impact.y}%` }} />
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
