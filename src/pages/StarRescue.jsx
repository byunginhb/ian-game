import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGameScale } from '../hooks/useGameScale'
import { useTouchLock } from '../hooks/useTouchLock'
import { StarBackdrop, StarEntities, StarHud, StarOverlay, TouchControls } from './StarRescueParts'
import './StarRescue.css'

const GAME_W = 420
const GAME_H = 620
const PLAYER_SIZE = 42
const PLAYER_SPEED = 4.7
const DASH_SPEED = 11
const BULLET_SPEED = 8.4
const FIRE_GAP = 150
const DASH_COST = 34
const PARTICLE_LIFE = 520

const ENEMY_TYPES = [
  { key: 'imp', emoji: '👾', hp: 1, size: 34, score: 70, color: '#a78bfa' },
  { key: 'bat', emoji: '🦇', hp: 2, size: 38, score: 105, color: '#f472b6' },
  { key: 'rock', emoji: '☄️', hp: 3, size: 42, score: 140, color: '#fb923c' },
]

const STAR_COLORS = ['#fff176', '#7dd3fc', '#f0abfc', '#86efac']
const LANES = [58, 122, 186, 250, 314, 378]

function rand(min, max) {
  return min + Math.random() * (max - min)
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function distance(a, b, c, d) {
  return Math.hypot(a - c, b - d)
}

function getWaveConfig(wave) {
  return {
    target: Math.min(30, 6 + wave * 3),
    maxEnemies: Math.min(12, 4 + Math.floor(wave * 0.95)),
    spawnGap: Math.max(390, 1120 - wave * 82),
    speed: Math.min(2.8, 0.85 + wave * 0.13),
    boss: wave % 3 === 0,
    bossHp: 18 + wave * 5,
  }
}

function makeParticle(id, x, y, color) {
  const angle = rand(0, Math.PI * 2)
  const spread = rand(18, 62)

  return {
    id: `spark-${id}`,
    x,
    y,
    dx: Math.cos(angle) * spread,
    dy: Math.sin(angle) * spread,
    size: rand(4, 11),
    color,
    born: performance.now(),
  }
}

function isInteractiveTarget(target) {
  return target instanceof HTMLElement && Boolean(target.closest('button, a, input, textarea, select'))
}

function StarRescue() {
  const scale = useGameScale(GAME_W, GAME_H, { reservedH: 74 })
  const containerRef = useRef(null)
  const areaRef = useRef(null)
  useTouchLock(containerRef)

  const [phase, setPhase] = useState('menu')
  const [wave, setWave] = useState(1)
  const [rescued, setRescued] = useState(0)
  const [hp, setHp] = useState(3)
  const [energy, setEnergy] = useState(100)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [best, setBest] = useState(0)
  const [view, setView] = useState({
    player: { x: 210, y: 520, safeUntil: 0, dashUntil: 0 },
    enemies: [],
    bullets: [],
    enemyShots: [],
    pickups: [],
    particles: [],
    boss: null,
    now: 0,
  })

  const waveConfig = useMemo(() => getWaveConfig(wave), [wave])

  const phaseRef = useRef(phase)
  const waveRef = useRef(wave)
  const playerRef = useRef({
    x: 210,
    y: 520,
    targetX: 210,
    targetY: 520,
    pointerUntil: 0,
    safeUntil: 0,
    dashUntil: 0,
    dashX: 0,
    dashY: -1,
  })
  const enemiesRef = useRef([])
  const bulletsRef = useRef([])
  const enemyShotsRef = useRef([])
  const pickupsRef = useRef([])
  const particlesRef = useRef([])
  const bossRef = useRef(null)
  const keysRef = useRef(new Set())
  const fireHeldRef = useRef(false)
  const rescuedRef = useRef(0)
  const hpRef = useRef(3)
  const energyRef = useRef(100)
  const scoreRef = useRef(0)
  const comboRef = useRef(0)
  const bestRef = useRef(0)
  const spawnAtRef = useRef(0)
  const shotAtRef = useRef(0)
  const bossShotAtRef = useRef(0)
  const idsRef = useRef({ enemy: 0, bullet: 0, shot: 0, pickup: 0, particle: 0 })

  useEffect(() => {
    try {
      bestRef.current = Number(localStorage.getItem('star-rescue-best')) || 0
      setBest(bestRef.current)
    } catch {
      // Storage can be blocked; the game still works for the current session.
    }
  }, [])

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    waveRef.current = wave
  }, [wave])

  const syncScore = useCallback(() => {
    setScore(scoreRef.current)
    setCombo(comboRef.current)
  }, [])

  const updateBest = useCallback(() => {
    if (scoreRef.current <= bestRef.current) return
    bestRef.current = scoreRef.current
    setBest(bestRef.current)
    try {
      localStorage.setItem('star-rescue-best', String(bestRef.current))
    } catch {
      // Ignore storage failures.
    }
  }, [])

  const addParticles = useCallback((x, y, color, amount = 12) => {
    const nextParticles = Array.from({ length: amount }, () => {
      idsRef.current.particle += 1
      return makeParticle(idsRef.current.particle, x, y, color)
    })
    particlesRef.current = [...particlesRef.current, ...nextParticles]
  }, [])

  const createEnemy = useCallback((nextWave) => {
    const config = getWaveConfig(nextWave)
    const type = ENEMY_TYPES[Math.min(ENEMY_TYPES.length - 1, Math.floor(rand(0, 1 + nextWave * 0.52)))]
    idsRef.current.enemy += 1

    const fromSide = Math.random() < 0.28
    const x = fromSide ? (Math.random() < 0.5 ? -24 : GAME_W + 24) : LANES[Math.floor(rand(0, LANES.length))]
    const y = fromSide ? rand(96, 276) : -28
    const sideDir = x < 0 ? 1 : -1

    return {
      id: `enemy-${idsRef.current.enemy}`,
      x,
      y,
      vx: fromSide ? sideDir * config.speed * rand(0.5, 0.9) : rand(-0.45, 0.45),
      vy: config.speed * rand(0.78, 1.18),
      hp: type.hp + Math.floor(nextWave / 5),
      maxHp: type.hp + Math.floor(nextWave / 5),
      size: type.size,
      score: type.score,
      type: type.key,
      emoji: type.emoji,
      color: type.color,
      wobble: rand(1.6, 3.4),
      drift: rand(0, Math.PI * 2),
    }
  }, [])

  const createBoss = useCallback((nextWave) => {
    const config = getWaveConfig(nextWave)
    return {
      id: `boss-${nextWave}`,
      x: 210,
      y: 100,
      vx: 1.15 + nextWave * 0.08,
      hp: config.bossHp,
      maxHp: config.bossHp,
      size: 82,
    }
  }, [])

  const spawnPickup = useCallback((x, y, amount = 1) => {
    const nextPickups = Array.from({ length: amount }, (_, index) => {
      idsRef.current.pickup += 1
      return {
        id: `star-${idsRef.current.pickup}`,
        x: x + rand(-16, 16) + index * 4,
        y: y + rand(-10, 12),
        vx: rand(-0.35, 0.35),
        vy: rand(0.75, 1.35),
        size: rand(23, 30),
        color: STAR_COLORS[idsRef.current.pickup % STAR_COLORS.length],
      }
    })
    pickupsRef.current = [...pickupsRef.current, ...nextPickups]
  }, [])

  const fire = useCallback((wide = false) => {
    const player = playerRef.current
    const offsets = wide ? [-13, 0, 13] : [-8, 8]
    const nextBullets = offsets.map((offset) => {
      idsRef.current.bullet += 1
      return {
        id: `bolt-${idsRef.current.bullet}`,
        x: player.x + offset,
        y: player.y - 22,
        vx: offset * 0.018,
        vy: -BULLET_SPEED,
        size: wide ? 9 : 8,
      }
    })
    bulletsRef.current = [...bulletsRef.current, ...nextBullets]
  }, [])

  const triggerDash = useCallback((now = performance.now()) => {
    if (phaseRef.current !== 'playing' || energyRef.current < DASH_COST) return

    const keys = keysRef.current
    const inputX = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0)
    const inputY = (keys.has('arrowdown') || keys.has('s') ? 1 : 0) - (keys.has('arrowup') || keys.has('w') ? 1 : 0)
    const length = Math.hypot(inputX, inputY) || 1
    const player = playerRef.current

    if (inputX || inputY) {
      player.dashX = inputX / length
      player.dashY = inputY / length
    } else {
      player.dashX = 0
      player.dashY = -1
    }
    player.dashUntil = now + 170
    player.safeUntil = now + 320
    energyRef.current = Math.max(0, energyRef.current - DASH_COST)
    setEnergy(Math.round(energyRef.current))
    addParticles(player.x, player.y, '#7dd3fc', 14)
  }, [addParticles])

  const endRound = useCallback((nextPhase) => {
    phaseRef.current = nextPhase
    setPhase(nextPhase)
    updateBest()
  }, [updateBest])

  const startWave = useCallback((nextWave, resetScore = false) => {
    const config = getWaveConfig(nextWave)
    const nextHp = resetScore ? 3 : Math.min(5, hpRef.current + 1)

    playerRef.current = {
      x: 210,
      y: 520,
      targetX: 210,
      targetY: 520,
      pointerUntil: 0,
      safeUntil: performance.now() + 700,
      dashUntil: 0,
      dashX: 0,
      dashY: -1,
    }
    enemiesRef.current = Array.from({ length: Math.min(3, config.maxEnemies) }, () => createEnemy(nextWave))
    bulletsRef.current = []
    enemyShotsRef.current = []
    pickupsRef.current = []
    particlesRef.current = []
    bossRef.current = config.boss ? createBoss(nextWave) : null
    rescuedRef.current = 0
    hpRef.current = nextHp
    energyRef.current = 100
    phaseRef.current = 'playing'
    waveRef.current = nextWave
    spawnAtRef.current = performance.now() + 650
    shotAtRef.current = 0
    bossShotAtRef.current = performance.now() + 900

    if (resetScore) {
      scoreRef.current = 0
      comboRef.current = 0
    }

    setWave(nextWave)
    setRescued(0)
    setHp(nextHp)
    setEnergy(100)
    setPhase('playing')
    syncScore()
    setView({
      player: { ...playerRef.current },
      enemies: enemiesRef.current,
      bullets: [],
      enemyShots: [],
      pickups: [],
      particles: [],
      boss: bossRef.current,
      now: performance.now(),
    })
  }, [createBoss, createEnemy, syncScore])

  const startGame = useCallback(() => {
    startWave(1, true)
  }, [startWave])

  const nextWave = useCallback(() => {
    startWave(waveRef.current + 1, false)
  }, [startWave])

  const getGamePoint = useCallback((event) => {
    const rect = areaRef.current?.getBoundingClientRect()
    if (!rect) return null
    return {
      x: clamp((event.clientX - rect.left) / scale, PLAYER_SIZE / 2, GAME_W - PLAYER_SIZE / 2),
      y: clamp((event.clientY - rect.top) / scale, 96, GAME_H - PLAYER_SIZE / 2),
    }
  }, [scale])

  const movePointerTarget = useCallback((event) => {
    if (phaseRef.current !== 'playing' || isInteractiveTarget(event.target)) return
    const point = getGamePoint(event)
    if (!point) return
    playerRef.current.targetX = point.x
    playerRef.current.targetY = point.y
    playerRef.current.pointerUntil = performance.now() + 1200
  }, [getGamePoint])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (isInteractiveTarget(event.target) || isInteractiveTarget(document.activeElement)) return

      const key = event.key.toLowerCase()
      const moveKeys = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd']

      if (moveKeys.includes(key) && phaseRef.current === 'playing') {
        event.preventDefault()
        keysRef.current.add(key)
      }

      if (key === ' ' && phaseRef.current === 'playing') {
        event.preventDefault()
        fireHeldRef.current = true
      }

      if (key === 'shift') {
        event.preventDefault()
        triggerDash()
      }

      if (key === 'enter') {
        if (phaseRef.current === 'menu' || phaseRef.current === 'lost') {
          event.preventDefault()
          startGame()
        } else if (phaseRef.current === 'clear') {
          event.preventDefault()
          nextWave()
        }
      }

      if (key === 'r') {
        event.preventDefault()
        startGame()
      }
    }

    const onKeyUp = (event) => {
      const key = event.key.toLowerCase()
      keysRef.current.delete(key)
      if (key === ' ') fireHeldRef.current = false
    }

    const onBlur = () => {
      keysRef.current.clear()
      fireHeldRef.current = false
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [nextWave, startGame, triggerDash])

  useEffect(() => {
    if (phase !== 'playing') return undefined

    let frameId = 0
    let last = performance.now()

    function damagePlayer(now, x, y) {
      const player = playerRef.current
      if (now < player.safeUntil) return false

      hpRef.current = Math.max(0, hpRef.current - 1)
      comboRef.current = 0
      player.safeUntil = now + 1050
      setHp(hpRef.current)
      syncScore()
      addParticles(x, y, '#fb7185', 18)

      if (hpRef.current <= 0) {
        endRound('lost')
        return true
      }

      return false
    }

    function tick(now) {
      if (phaseRef.current !== 'playing') return

      const deltaScale = Math.min(2.2, (now - last) / 16)
      last = now

      const config = getWaveConfig(waveRef.current)
      const player = playerRef.current
      const keys = keysRef.current
      const right = keys.has('arrowright') || keys.has('d') ? 1 : 0
      const left = keys.has('arrowleft') || keys.has('a') ? 1 : 0
      const down = keys.has('arrowdown') || keys.has('s') ? 1 : 0
      const up = keys.has('arrowup') || keys.has('w') ? 1 : 0
      const inputX = right - left
      const inputY = down - up

      if (now < player.dashUntil) {
        player.x += player.dashX * DASH_SPEED * deltaScale
        player.y += player.dashY * DASH_SPEED * deltaScale
      } else if (inputX || inputY) {
        const length = Math.hypot(inputX, inputY) || 1
        player.x += (inputX / length) * PLAYER_SPEED * deltaScale
        player.y += (inputY / length) * PLAYER_SPEED * deltaScale
        player.targetX = player.x
        player.targetY = player.y
      } else if (now < player.pointerUntil) {
        const dx = player.targetX - player.x
        const dy = player.targetY - player.y
        const gap = Math.hypot(dx, dy)
        const step = PLAYER_SPEED * 1.18 * deltaScale
        if (gap <= step) {
          player.x = player.targetX
          player.y = player.targetY
        } else if (gap > 0) {
          player.x += (dx / gap) * step
          player.y += (dy / gap) * step
        }
      }

      player.x = clamp(player.x, PLAYER_SIZE / 2, GAME_W - PLAYER_SIZE / 2)
      player.y = clamp(player.y, 96, GAME_H - PLAYER_SIZE / 2)

      energyRef.current = clamp(energyRef.current + 0.28 * deltaScale, 0, 100)
      setEnergy(Math.round(energyRef.current))

      if (fireHeldRef.current && now - shotAtRef.current > FIRE_GAP) {
        fire(comboRef.current >= 4)
        shotAtRef.current = now
      }

      let bullets = bulletsRef.current
        .map((bullet) => ({ ...bullet, x: bullet.x + bullet.vx * deltaScale, y: bullet.y + bullet.vy * deltaScale }))
        .filter((bullet) => bullet.y > -24 && bullet.x > -24 && bullet.x < GAME_W + 24)

      let enemyShots = enemyShotsRef.current
        .map((shot) => ({ ...shot, x: shot.x + shot.vx * deltaScale, y: shot.y + shot.vy * deltaScale }))
        .filter((shot) => shot.y < GAME_H + 28 && shot.x > -28 && shot.x < GAME_W + 28)

      let enemies = enemiesRef.current.map((enemy) => {
        const nextEnemy = { ...enemy }
        const seek = enemy.type !== 'rock'
        if (seek) {
          const dx = player.x - nextEnemy.x
          const dy = player.y - nextEnemy.y
          const gap = Math.hypot(dx, dy) || 1
          nextEnemy.vx += (dx / gap) * 0.025 * deltaScale
          nextEnemy.vy += (dy / gap) * 0.015 * deltaScale
          const speedLimit = config.speed * (enemy.type === 'bat' ? 1.35 : 1.05)
          const speed = Math.hypot(nextEnemy.vx, nextEnemy.vy) || 1
          if (speed > speedLimit) {
            nextEnemy.vx = (nextEnemy.vx / speed) * speedLimit
            nextEnemy.vy = (nextEnemy.vy / speed) * speedLimit
          }
        }
        nextEnemy.drift += 0.035 * deltaScale
        nextEnemy.x += (nextEnemy.vx + Math.sin(nextEnemy.drift) * 0.24) * deltaScale
        nextEnemy.y += nextEnemy.vy * deltaScale

        if (nextEnemy.x < 18) {
          nextEnemy.x = 18
          nextEnemy.vx = Math.abs(nextEnemy.vx)
        }
        if (nextEnemy.x > GAME_W - 18) {
          nextEnemy.x = GAME_W - 18
          nextEnemy.vx = -Math.abs(nextEnemy.vx)
        }
        if (nextEnemy.y > GAME_H + 36) {
          nextEnemy.y = -28
          nextEnemy.x = LANES[Math.floor(rand(0, LANES.length))]
        }

        return nextEnemy
      })

      let boss = bossRef.current ? { ...bossRef.current } : null
      if (boss) {
        boss.x += boss.vx * deltaScale
        if (boss.x < 62 || boss.x > GAME_W - 62) {
          boss.x = clamp(boss.x, 62, GAME_W - 62)
          boss.vx *= -1
        }
        if (now > bossShotAtRef.current) {
          idsRef.current.shot += 1
          enemyShots = [
            ...enemyShots,
            { id: `shadow-${idsRef.current.shot}`, x: boss.x - 24, y: boss.y + 34, vx: -0.65, vy: 3.6, size: 15 },
            { id: `shadow-${idsRef.current.shot}-b`, x: boss.x + 24, y: boss.y + 34, vx: 0.65, vy: 3.6, size: 15 },
          ]
          bossShotAtRef.current = now + Math.max(520, 1000 - waveRef.current * 38)
        }
      }

      if (now > spawnAtRef.current && enemies.length < config.maxEnemies) {
        enemies = [...enemies, createEnemy(waveRef.current)]
        spawnAtRef.current = now + config.spawnGap * rand(0.65, 1.15)
      }

      const damagedEnemyIds = new Set()
      const deadEnemyIds = new Set()
      const usedBulletIds = new Set()

      bullets.forEach((bullet) => {
        if (boss && distance(bullet.x, bullet.y, boss.x, boss.y) < boss.size * 0.48) {
          usedBulletIds.add(bullet.id)
          boss.hp -= 1
          addParticles(bullet.x, bullet.y, '#fde68a', 3)
          if (boss.hp <= 0) {
            scoreRef.current += 650
            comboRef.current += 2
            spawnPickup(boss.x, boss.y, 7)
            addParticles(boss.x, boss.y, '#facc15', 28)
            boss = null
            syncScore()
          }
          return
        }

        const enemy = enemies.find((nextEnemy) => distance(bullet.x, bullet.y, nextEnemy.x, nextEnemy.y) < (bullet.size + nextEnemy.size) * 0.48)
        if (!enemy) return
        usedBulletIds.add(bullet.id)
        enemy.hp -= 1
        damagedEnemyIds.add(enemy.id)
        addParticles(bullet.x, bullet.y, enemy.color, 5)
        if (enemy.hp <= 0) deadEnemyIds.add(enemy.id)
      })

      bullets = bullets.filter((bullet) => !usedBulletIds.has(bullet.id))

      if (damagedEnemyIds.size > 0) {
        enemies = enemies.map((enemy) => ({ ...enemy }))
      }

      enemies.forEach((enemy) => {
        if (!deadEnemyIds.has(enemy.id)) return
        scoreRef.current += enemy.score + comboRef.current * 8
        comboRef.current += 1
        spawnPickup(enemy.x, enemy.y, enemy.type === 'rock' ? 2 : 1)
        addParticles(enemy.x, enemy.y, enemy.color, 14)
      })
      enemies = enemies.filter((enemy) => !deadEnemyIds.has(enemy.id))

      let pickups = pickupsRef.current
        .map((pickup) => ({
          ...pickup,
          x: pickup.x + pickup.vx * deltaScale,
          y: pickup.y + pickup.vy * deltaScale,
          vy: Math.min(2.5, pickup.vy + 0.018 * deltaScale),
        }))
        .filter((pickup) => pickup.y < GAME_H + 26)

      const collectedPickupIds = new Set()
      pickups.forEach((pickup) => {
        if (distance(player.x, player.y, pickup.x, pickup.y) > (PLAYER_SIZE + pickup.size) * 0.46) return
        collectedPickupIds.add(pickup.id)
        rescuedRef.current += 1
        scoreRef.current += 115 + comboRef.current * 10
        addParticles(pickup.x, pickup.y, pickup.color, 12)
      })

      if (collectedPickupIds.size > 0) {
        pickups = pickups.filter((pickup) => !collectedPickupIds.has(pickup.id))
        setRescued(rescuedRef.current)
        syncScore()
      }

      const hitEnemy = enemies.find((enemy) => distance(player.x, player.y, enemy.x, enemy.y) < (PLAYER_SIZE + enemy.size) * 0.43)
      if (hitEnemy) {
        enemies = enemies.filter((enemy) => enemy.id !== hitEnemy.id)
        if (damagePlayer(now, hitEnemy.x, hitEnemy.y)) return
      }

      const hitShot = enemyShots.find((shot) => distance(player.x, player.y, shot.x, shot.y) < (PLAYER_SIZE + shot.size) * 0.46)
      if (hitShot) {
        enemyShots = enemyShots.filter((shot) => shot.id !== hitShot.id)
        if (damagePlayer(now, hitShot.x, hitShot.y)) return
      }

      particlesRef.current = particlesRef.current.filter((particle) => now - particle.born < PARTICLE_LIFE)

      if (rescuedRef.current >= config.target) {
        bulletsRef.current = bullets
        enemyShotsRef.current = enemyShots
        enemiesRef.current = enemies
        pickupsRef.current = pickups
        bossRef.current = boss
        setView({
          player: { ...player },
          enemies,
          bullets,
          enemyShots,
          pickups,
          particles: particlesRef.current,
          boss,
          now,
        })
        endRound('clear')
        return
      }

      bulletsRef.current = bullets
      enemyShotsRef.current = enemyShots
      enemiesRef.current = enemies
      pickupsRef.current = pickups
      bossRef.current = boss

      setView({
        player: { ...player },
        enemies,
        bullets,
        enemyShots,
        pickups,
        particles: particlesRef.current,
        boss,
        now,
      })

      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [addParticles, createEnemy, endRound, fire, phase, spawnPickup, syncScore])

  const progressRatio = clamp(rescued / waveConfig.target, 0, 1)
  const shielded = phase === 'playing' && view.now < view.player.safeUntil
  const dashing = phase === 'playing' && view.now < view.player.dashUntil
  const handleFireDown = useCallback((event) => {
    event.preventDefault()
    event.stopPropagation()
    fireHeldRef.current = true
  }, [])
  const handleFireUp = useCallback(() => {
    fireHeldRef.current = false
  }, [])
  const handleTouchDash = useCallback((event) => {
    event.preventDefault()
    event.stopPropagation()
    triggerDash()
  }, [triggerDash])

  return (
    <div className="sr-container" ref={containerRef}>
      <Link to="/" className="sr-back">← 홈으로</Link>

      <div className="sr-wrapper" style={{ width: GAME_W * scale, height: GAME_H * scale }}>
        <div
          ref={areaRef}
          className={`sr-area sr-${phase}`}
          style={{ width: GAME_W, height: GAME_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}
          onPointerDown={movePointerTarget}
          onPointerMove={movePointerTarget}
        >
          <StarBackdrop />
          <StarHud
            wave={wave}
            score={score}
            rescued={rescued}
            target={waveConfig.target}
            hp={hp}
            energy={energy}
            progressRatio={progressRatio}
            boss={view.boss}
          />
          <StarEntities
            view={view}
            combo={combo}
            phase={phase}
            shielded={shielded}
            dashing={dashing}
            playerSize={PLAYER_SIZE}
          />
          <TouchControls onFireDown={handleFireDown} onFireUp={handleFireUp} onDash={handleTouchDash} />

          {phase !== 'playing' && (
            <StarOverlay
              phase={phase}
              rescued={rescued}
              score={score}
              best={best}
              onPrimary={phase === 'clear' ? nextWave : startGame}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default StarRescue
