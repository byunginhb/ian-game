/** 숫자 특공대 3D 렌더러. 게임 규칙(run)은 numberSquad.js가 소유하고 여기서는 그리기만 한다. */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Fog, Color, HemisphereLight, DirectionalLight, Group, Mesh, InstancedMesh,
  MeshLambertMaterial, MeshStandardMaterial, MeshBasicMaterial, PlaneGeometry, BoxGeometry, SphereGeometry, CylinderGeometry, TorusGeometry, BufferAttribute,
  BufferGeometry, Points, PointsMaterial, Sprite, SpriteMaterial, Object3D, Vector3, BackSide, DoubleSide, DynamicDrawUsage, PCFSoftShadowMap,
  NeutralToneMapping, PMREMGenerator,
} from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { hazardX, mulberry32, opIsGain, opLabel, TRACK_HALF } from './numberSquad.js'
import {
  WORLD_LOOKS, bossGeometry, checkerTexture, coinGeometry, createBadge, enemyGeometry, glowTexture, hazardGeometry,
  labelTexture, leaderParts, postGeometry, propGeometry, robotGeometry, trackTexture,
} from './numberSquadModels.js'
import { createMissiles, createParticles } from './numberSquadFx.js'

const SQUAD_CAP = 120
const GOLDEN = 2.39996
const GOOD = ['#5ef2ff', '#ffffff', '#ffe066'], BAD = ['#ff5a4d', '#ffb3ad'], GOLD = ['#ffd447', '#fff3b0'], CONFETTI = ['#ff4d5e', '#ffd447', '#5ef2ff', '#8cf26b', '#b28dff']
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export function createSquadScene(canvas) {
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const deviceRatio = window.devicePixelRatio || 1
  // 고해상도 화면은 픽셀 밀도가 계단 현상을 가려 주므로 MSAA 비용을 아낀다.
  const renderer = new WebGLRenderer({ canvas, antialias: deviceRatio < 2, powerPreference: 'high-performance' })
  // GPU 없이 CPU로 그리는 환경은 반사 재질과 그림자를 빼고 가볍게 시작한다.
  const debug = renderer.getContext().getExtension('WEBGL_debug_renderer_info')
  const software = /swiftshader|llvmpipe|software/i.test(debug ? renderer.getContext().getParameter(debug.UNMASKED_RENDERER_WEBGL) : '')
  let pixelRatio = software ? 0.6 : Math.min(deviceRatio, coarse ? 1.75 : 2), restUntil = 0
  renderer.setPixelRatio(pixelRatio)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFSoftShadowMap
  renderer.toneMapping = NeutralToneMapping
  renderer.toneMappingExposure = 0.96

  const scene = new Scene()
  const camera = new PerspectiveCamera(58, 1, 0.5, 800)
  // 장난감 같은 부드러운 조명: 하늘빛 확산광 + 따뜻한 주광 + 윤곽을 살리는 림 라이트 + 실내 반사
  const hemi = new HemisphereLight('#ffffff', '#888888', software ? 1.5 : 0.45)
  const sun = new DirectionalLight('#fff4e0', software ? 2 : 1.75)
  const rim = new DirectionalLight('#ffffff', software ? 0 : 0.9)
  if (!software) {
    const pmrem = new PMREMGenerator(renderer), room = new RoomEnvironment()
    scene.environment = pmrem.fromScene(room, 0.04).texture
    scene.environmentIntensity = 0.32
    pmrem.dispose(); room.dispose?.()
  }
  sun.castShadow = !coarse && !software
  sun.shadow.mapSize.set(1024, 1024)
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 60 })
  sun.shadow.bias = -0.0006
  scene.add(hemi, sun, sun.target, rim, rim.target)
  // 살짝 윤이 나는 플라스틱. 정점 색을 쓰므로 모델마다 재질을 새로 만들지 않는다.
  const toy = (options) => (software ? new MeshLambertMaterial(options) : new MeshStandardMaterial({ roughness: 0.48, metalness: 0, ...options }))
  const material = toy({ vertexColors: true })
  const particles = createParticles()
  scene.add(particles.points)
  const dummy = new Object3D(), camPos = new Vector3(), camLook = new Vector3(), goal = new Vector3(), look = new Vector3(), white = new Color('#ffffff')
  let view = null, disposables = [], frameAverage = 1 / 60, framesSinceChange = 0

  function resize() {
    const width = canvas.clientWidth || 1, height = canvas.clientHeight || 1
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    // 세로 화면에서도 트랙 전체 폭이 보이도록 수직 시야각을 넓힌다.
    camera.fov = clamp((2 * Math.atan(Math.tan(0.63) / camera.aspect) * 180) / Math.PI, 50, 82)
    camera.updateProjectionMatrix()
    particles.setScale((height * pixelRatio * 0.5) / Math.tan((camera.fov * Math.PI) / 360))
  }

  function unload() {
    if (!view) return
    scene.remove(view.group)
    // instanceMatrix GPU 버퍼는 메시의 dispose 이벤트에서만 해제된다.
    view.group.traverse((object) => { if (object.isInstancedMesh) object.dispose() })
    disposables.forEach((item) => item.dispose())
    disposables = []
    view = null
  }

  function load(stage, skin) {
    unload()
    const own = (item) => { disposables.push(item); return item }
    const lookConfig = WORLD_LOOKS[stage.cfg.world]
    const length = stage.length, group = new Group(), rng = mulberry32(stage.seed + 77)
    const lambert = (color, extra) => own(toy({ color, ...extra }))
    const instanced = (geometry, count, dynamic) => {
      const mesh = new InstancedMesh(own(geometry), material, Math.max(1, count))
      mesh.count = count // 0개일 때 원점에 기본 인스턴스가 그려지지 않게 한다.
      mesh.frustumCulled = false
      if (dynamic) mesh.instanceMatrix.setUsage(DynamicDrawUsage)
      group.add(mesh)
      return mesh
    }
    const place = (mesh, index, x, y, z, s = 1, ry = 0) => {
      dummy.position.set(x, y, z); dummy.rotation.set(0, ry, 0); dummy.scale.setScalar(s); dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
    }
    scene.fog = new Fog(lookConfig.fog, 55, 215)
    scene.background = new Color(lookConfig.fog)
    hemi.color.set(lookConfig.skyTop).lerp(white, 0.65)
    hemi.groundColor.set(lookConfig.hemiGround)

    // 하늘: 카메라를 따라다니는 그라데이션 돔 + 태양 글로우 (+ 우주의 별)
    const sky = new Group()
    const dome = own(new SphereGeometry(600, 20, 12))
    const top = new Color(lookConfig.skyTop), bottom = new Color(lookConfig.fog), mixed = new Color()
    const domeColors = new Float32Array(dome.attributes.position.count * 3)
    for (let i = 0; i < dome.attributes.position.count; i++) mixed.copy(bottom).lerp(top, clamp(dome.attributes.position.getY(i) / 330, 0, 1)).toArray(domeColors, i * 3)
    dome.setAttribute('color', new BufferAttribute(domeColors, 3))
    sky.add(new Mesh(dome, own(new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false, depthWrite: false, toneMapped: false }))))
    const glow = new Sprite(own(new SpriteMaterial({ map: own(glowTexture(stage.cfg.world === 3 ? '#b28dff' : '#ffe9a8')), fog: false, depthWrite: false })))
    glow.position.set(-170, 190, -470); glow.scale.setScalar(190)
    sky.add(glow)
    if (stage.cfg.world === 3) {
      const stars = new Float32Array(600 * 3)
      for (let i = 0; i < 600; i++) {
        const a = rng() * 6.283, h = rng() * 0.95 - 0.25, r = Math.sqrt(1 - h * h) * 560
        stars.set([Math.cos(a) * r, h * 560, Math.sin(a) * r], i * 3)
      }
      const starGeometry = own(new BufferGeometry())
      starGeometry.setAttribute('position', new BufferAttribute(stars, 3))
      sky.add(new Points(starGeometry, own(new PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, fog: false, depthWrite: false }))))
    }
    sky.renderOrder = -1
    group.add(sky)

    // 트랙·결승선·보스 무대·바닥
    const trackLength = length + 6, trackZ = -length / 2 + 3
    const map = own(trackTexture(lookConfig))
    map.repeat.set(1, trackLength / 10)
    map.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
    const road = new Mesh(own(new PlaneGeometry(TRACK_HALF * 2, trackLength)), lambert('#ffffff', { map }))
    road.rotation.x = -Math.PI / 2; road.position.z = trackZ; road.receiveShadow = true
    const slab = new Mesh(own(new BoxGeometry(TRACK_HALF * 2 + 0.7, 0.7, trackLength)), lambert(lookConfig.line))
    slab.position.set(0, -0.37, trackZ)
    // 트랙 가장자리는 각진 턱 대신 둥근 튜브 난간
    const railGeometry = own(new CylinderGeometry(0.3, 0.3, trackLength, 14))
    const railMaterial = lambert(lookConfig.edge, { emissive: lookConfig.edge, emissiveIntensity: lookConfig.glow ? 0.7 : 0.18 })
    const rails = [-1, 1].map((side) => { const rail = new Mesh(railGeometry, railMaterial); rail.rotation.x = Math.PI / 2; rail.position.set(side * (TRACK_HALF + 0.2), 0.08, trackZ); rail.receiveShadow = true; return rail })
    const finishLine = new Mesh(own(new PlaneGeometry(TRACK_HALF * 2, 1.8)), own(new MeshBasicMaterial({ map: own(checkerTexture()) })))
    finishLine.rotation.x = -Math.PI / 2; finishLine.position.set(0, 0.02, -length + 1.2)
    const bossZ = -(length + 15)
    const arena = new Mesh(own(new CylinderGeometry(14, 12.5, 0.9, 48)), lambert(lookConfig.track))
    arena.position.set(0, -0.47, bossZ + 2); arena.receiveShadow = true
    const ring = new Mesh(own(new TorusGeometry(14.05, 0.34, 10, 56)), railMaterial)
    ring.rotation.x = Math.PI / 2
    ring.position.set(0, -0.02, bossZ + 2)
    group.add(road, slab, ...rails, finishLine, arena, ring)
    if (lookConfig.ground) {
      const groundMaterial = lookConfig.glow ? own(new MeshBasicMaterial({ color: lookConfig.ground })) : lambert(lookConfig.ground)
      const ground = new Mesh(own(new PlaneGeometry(900, length + 700)), groundMaterial)
      ground.rotation.x = -Math.PI / 2; ground.position.set(0, lookConfig.groundY, -length / 2)
      const pillarCount = Math.ceil(length / 20)
      const pillars = new InstancedMesh(own(new CylinderGeometry(0.75, 0.95, -lookConfig.groundY, 14)), lambert(lookConfig.line), pillarCount * 2)
      for (let i = 0; i < pillarCount * 2; i++) place(pillars, i, (i % 2 ? 1 : -1) * 4, lookConfig.groundY / 2 - 0.4, -Math.floor(i / 2) * 20 - 6)
      pillars.frustumCulled = false
      group.add(ground, pillars)
    }

    // 배경 소품: 종류마다 인스턴싱 1회
    for (const spec of lookConfig.props) {
      const mesh = instanced(propGeometry(spec.kind), spec.count)
      for (let i = 0; i < spec.count; i++) {
        const s = spec.min + rng() * (spec.max - spec.min), z = 40 - rng() * (length + 150)
        const near = z < -(length - 6) ? 20 : 8.5
        const x = (rng() < 0.5 ? -1 : 1) * (spec.far ? 70 + rng() * 110 : near + s * 3 + rng() ** 1.6 * 60)
        place(mesh, i, x, spec.float ? -16 + rng() * 34 : lookConfig.groundY - 0.3, z, s, rng() * 6.283)
      }
    }

    // 숫자 문·퀴즈 문·적·장애물
    const textures = new Map()
    const label = (text, color) => {
      const key = `${text}|${color}`
      if (!textures.has(key)) textures.set(key, own(labelTexture(text, color)))
      return textures.get(key)
    }
    const panelGeometry = { 2: own(new PlaneGeometry(4.5, 3)), 3: own(new PlaneGeometry(2.95, 3)) }
    const gateRows = stage.rows.filter((row) => row.type === 'gate' || row.type === 'quiz')
    const posts = instanced(postGeometry(), gateRows.reduce((sum, row) => sum + (row.type === 'gate' ? 3 : 4), 0))
    const enemyRows = stage.rows.filter((row) => row.type === 'enemy')
    const enemies = instanced(enemyGeometry(), enemyRows.reduce((sum, row) => sum + Math.min(12, row.value), 0), true)
    enemies.castShadow = true
    const roller = own(hazardGeometry(3.4))
    let postIndex = 0, enemyIndex = 0
    const rowViews = stage.rows.map((row) => {
      if (row.type === 'gate' || row.type === 'quiz') {
        const items = row.type === 'gate'
          ? row.options.map((op) => [opLabel(op), opIsGain(op) ? '#1e88ff' : '#ff4757'])
          : row.quiz.choices.map((choice) => [String(choice), '#8e5cf6'])
        const width = (TRACK_HALF * 2) / items.length
        for (let j = 0; j <= items.length; j++) place(posts, postIndex++, -TRACK_HALF + width * j, 0, -row.z)
        const panels = items.map(([text, color], j) => {
          const panel = new Mesh(panelGeometry[items.length], own(new MeshBasicMaterial({ map: label(text, color), transparent: true, side: DoubleSide, depthWrite: false, toneMapped: false })))
          panel.position.set(-TRACK_HALF + width * (j + 0.5), 2.2, -row.z)
          group.add(panel)
          return panel
        })
        return { panels }
      }
      if (row.type === 'enemy') {
        const count = Math.min(12, row.value), start = enemyIndex
        const base = Array.from({ length: count }, (_, i) => [((i % 4) - 1.5) * 1.9 + (rng() - 0.5) * 0.6, -row.z - Math.floor(i / 4) * 1.5 + (rng() - 0.5) * 0.5])
        enemyIndex += count
        const sprite = new Sprite(own(new SpriteMaterial({ map: label(`−${row.value}`, '#d7263d'), depthWrite: false, toneMapped: false })))
        sprite.position.set(0, 3.5, -row.z); sprite.scale.set(3.4, 2.1, 1)
        group.add(sprite)
        return { start, base, sprite, done: false }
      }
      const mesh = new Mesh(roller, material)
      mesh.position.set(row.x, 0.78, -row.z); mesh.castShadow = true
      group.add(mesh)
      return { mesh }
    })

    const coins = instanced(coinGeometry(), stage.coins.length, true)

    // 대장 이안 + 꼬마 로봇 특공대
    const parts = leaderParts(skin)
    const leader = new Group()
    const body = new Mesh(own(parts.body), material)
    const arms = parts.arms.map((geometry, i) => { const arm = new Mesh(own(geometry), material); arm.position.set(i ? 0.45 : -0.45, 1.3, 0); return arm })
    const legs = parts.legs.map((geometry, i) => { const leg = new Mesh(own(geometry), material); leg.position.set(i ? 0.16 : -0.16, 0.6, 0); return leg })
    for (const mesh of [body, ...arms, ...legs]) { mesh.castShadow = true; leader.add(mesh) }
    leader.scale.setScalar(1.12)
    const badge = createBadge()
    own(badge.texture)
    const badgeSprite = new Sprite(own(new SpriteMaterial({ map: badge.texture, depthWrite: false, depthTest: false, toneMapped: false })))
    badgeSprite.position.set(0, 3.4, 0); badgeSprite.scale.set(2, 1, 1); badgeSprite.renderOrder = 5
    group.add(leader, badgeSprite)
    const squad = instanced(robotGeometry(skin), SQUAD_CAP, true)
    squad.castShadow = true; squad.count = 0

    const bossScale = 1.2
    const boss = new Mesh(own(bossGeometry(stage.cfg.world)), material)
    boss.position.set(0, 0, bossZ); boss.scale.setScalar(bossScale); boss.castShadow = true
    const missiles = createMissiles(skin.robot)
    own(missiles)
    group.add(boss, missiles.mesh)
    scene.add(group)

    view = {
      stage, skin, look: lookConfig, group, sky, leader, arms, legs, badge, badgeSprite, squad, coins, rowViews, enemies, boss, bossZ, bossScale, missiles,
      sx: new Float32Array(SQUAD_CAP), sz: new Float32Array(SQUAD_CAP), spawn: new Float32Array(SQUAD_CAP),
      shown: 0, radius: 0, stride: 0, lean: 0, dust: 0, lastX: 0, anims: [], shake: 0, punch: 0, bossState: 'idle', bossTime: 0, ambient: 0, turn: 0, snap: true,
    }
    frameAverage = 1 / 60; framesSinceChange = -60 // 새 코스의 셰이더 준비 시간은 성능 판정에서 뺀다
    resize()
  }

  function handle(event, run, lz) {
    const v = view
    if (event.type === 'gate' || event.type === 'quiz') {
      const row = v.stage.rows[event.row]
      v.rowViews[event.row].panels.forEach((panel, j) => {
        const answer = event.type === 'quiz' && row.quiz.choices[j] === row.quiz.answer
        if (event.type === 'quiz' && (answer || j === event.choice)) panel.material.color.set(answer ? '#7dffb0' : '#ff8d8d')
        v.anims.push({ panel, keep: j === event.choice || answer, time: 0 })
      })
      particles.burst(run.x, 1.6, lz, event.good ? GOOD : BAD, event.good ? 22 : 10, 7, 0.55)
      if (!event.good) v.shake = Math.max(v.shake, 0.25)
    } else if (event.type === 'enemy') {
      const rowView = v.rowViews[event.row]
      rowView.done = true; rowView.sprite.visible = false
      for (let i = 0; i < rowView.base.length; i++) { dummy.position.set(0, -99, 0); dummy.scale.setScalar(0); dummy.updateMatrix(); v.enemies.setMatrixAt(rowView.start + i, dummy.matrix) }
      particles.burst(run.x, 1, lz - 1, ['#6b46a3', '#ff5a4d', '#ffffff'], 28, 8, 0.6)
      v.shake = Math.max(v.shake, 0.45)
    } else if (event.type === 'hazard' && event.hit) {
      particles.burst(run.x, 1, lz, ['#ffffff', '#ffcf33', '#ff5a4d'], 22, 8, 0.55)
      v.shake = Math.max(v.shake, 0.6)
    } else if (event.type === 'coin') {
      const coin = v.stage.coins[event.index]
      particles.burst(coin.x, 1.1, -coin.z, GOLD, 5, 3.5, 0.4, 0.4)
    } else if (event.type === 'shot') {
      const i = v.shown ? Math.floor(Math.random() * v.shown) : -1
      v.missiles.fire(i < 0 ? run.x : v.sx[i], 1.2, i < 0 ? lz : v.sz[i], (Math.random() - 0.5) * 2.4, 3 + Math.random() * 2.4, v.bossZ + 1.6)
    } else if (event.type === 'end') {
      v.bossState = event.win ? 'dying' : 'laugh'
      v.shake = 0.8
    }
  }

  const onMissileHit = (x, y, z) => { view.punch = 1; particles.burst(x, y, z, ['#ffffff', '#ffd447', '#ff7a1a'], 5, 5, 0.55, 0.4) }

  function update(run, dt) {
    if (!view) return
    const v = view, { stage } = run, time = run.time, lz = -run.z
    for (const event of run.events) handle(event, run, lz)
    const running = run.phase === 'run', won = run.phase === 'won'

    // 대장
    const vx = dt > 0 ? (run.x - v.lastX) / dt : 0
    v.lastX = run.x
    if (running) v.stride += dt * stage.cfg.speed * run.speedK * 0.85
    const swing = running ? Math.sin(v.stride) * 0.95 : 0
    v.legs[0].rotation.x = swing; v.legs[1].rotation.x = -swing
    v.arms[0].rotation.x = won ? Math.PI + Math.sin(time * 9) * 0.3 : -swing
    v.arms[1].rotation.x = won ? Math.PI - Math.sin(time * 9) * 0.3 : swing
    v.turn += ((won ? Math.PI : 0) - v.turn) * Math.min(1, dt * 6)
    // 통통 튀는 느낌: 공중에서는 길쭉해지고 발이 닿을 때 납작해진다 (스쿼시 & 스트레치)
    const bounce = running ? Math.abs(Math.sin(v.stride)) : won ? Math.abs(Math.sin(time * 6)) : 0.5
    const leaderY = running ? bounce * 0.2 : won ? bounce * 0.9 : 0
    const stretch = running || won ? (bounce - 0.5) * 0.2 : 0
    v.lean += ((running ? (run.braking ? 0.24 : -0.16) : 0) - v.lean) * Math.min(1, dt * 8)
    v.leader.position.set(run.x, leaderY, lz)
    v.leader.rotation.set(v.lean, v.turn, clamp(-vx * 0.035, -0.32, 0.32))
    v.leader.scale.set(1.12 * (1 - stretch * 0.5), 1.12 * (1 + stretch), 1.12 * (1 - stretch * 0.5))
    if (run.braking && running && (v.dust += dt) > 0.05) { v.dust = 0; particles.emit(run.x + (Math.random() - 0.5) * 0.8, 0.15, lz - 0.2, (Math.random() - 0.5) * 2, 1.2, -3, '#ffffff', 0.5, 0.45, 0) }

    // 특공대: 해바라기 나선 대형으로 대장을 따라온다
    const left = running ? run.count : Math.max(0, run.count - run.fired)
    const target = clamp(left - 1, 0, SQUAD_CAP)
    if (target > v.shown) for (let i = v.shown; i < target; i++) { v.sx[i] = run.x; v.sz[i] = lz + 0.6; v.spawn[i] = time }
    else for (let i = target; i < Math.min(v.shown, target + 8); i++) particles.burst(v.sx[i], 0.5, v.sz[i], [v.skin.robot, '#ffffff'], 4, 3, 0.4, 0.45)
    v.shown = target
    const radius = 0.44 * Math.sqrt(target)
    v.radius += (radius - v.radius) * Math.min(1, dt * 5)
    const hopHeight = running ? 0.26 : won ? 0.7 : 0.04, hopSpeed = won ? 7 : running && run.braking ? 7 : 10
    for (let i = 0; i < target; i++) {
      const r = 0.44 * Math.sqrt(i + 0.6), a = i * GOLDEN
      const k = Math.min(1, dt * (11 - Math.min(6, r)))
      v.sx[i] += (clamp(run.x + Math.cos(a) * r * 0.92, -4.55, 4.55) - v.sx[i]) * k
      v.sz[i] += (lz + 1 + radius * 1.05 + Math.sin(a) * r * 1.05 - v.sz[i]) * k
      const pop = Math.min(1, (time - v.spawn[i]) * 5)
      const hop = Math.abs(Math.sin(time * hopSpeed + i * 1.3)), size = 0.3 + 0.7 * pop + Math.sin(pop * Math.PI) * 0.3, squash = (hop - 0.5) * 0.26
      dummy.position.set(v.sx[i], hop * hopHeight, v.sz[i])
      dummy.rotation.set(running ? v.lean * 0.7 : 0, v.turn, Math.sin(time * hopSpeed * 0.5 + i) * 0.08)
      dummy.scale.set(size * (1 - squash * 0.5), size * (1 + squash), size * (1 - squash * 0.5))
      dummy.updateMatrix()
      v.squad.setMatrixAt(i, dummy.matrix)
    }
    v.squad.count = target
    v.squad.instanceMatrix.needsUpdate = true
    v.badge.set(String(running ? run.count : left), run.fever ? '#ff9f1a' : '#1e88ff')
    v.badgeSprite.position.set(run.x, 3.4 + leaderY, lz)
    v.badgeSprite.visible = !run.result

    // 코인·적·장애물
    for (let i = 0; i < stage.coins.length; i++) {
      const coin = stage.coins[i], hidden = run.taken[i] || coin.z < run.z - 8
      dummy.position.set(coin.x, hidden ? -99 : 1.05 + Math.sin(time * 3 + i) * 0.12, -coin.z)
      dummy.rotation.set(0, time * 3 + i * 0.6, 0)
      dummy.scale.setScalar(hidden ? 0 : 1)
      dummy.updateMatrix()
      v.coins.setMatrixAt(i, dummy.matrix)
    }
    v.coins.instanceMatrix.needsUpdate = true
    for (let i = 0; i < stage.rows.length; i++) {
      const row = stage.rows[i], rowView = v.rowViews[i]
      if (row.type === 'hazard') { rowView.mesh.position.x = hazardX(row, time); rowView.mesh.rotation.x = time * 5 } else if (row.type === 'enemy' && !rowView.done) {
        for (let j = 0; j < rowView.base.length; j++) {
          const hop = Math.abs(Math.sin(time * 6 + j)), squash = (hop - 0.5) * 0.3
          dummy.position.set(rowView.base[j][0], hop * 0.35, rowView.base[j][1])
          dummy.rotation.set(0, Math.sin(time * 2 + j) * 0.25, 0); dummy.scale.set(1.15 * (1 - squash * 0.5), 1.15 * (1 + squash), 1.15 * (1 - squash * 0.5)); dummy.updateMatrix()
          v.enemies.setMatrixAt(rowView.start + j, dummy.matrix)
        }
      }
    }
    v.enemies.instanceMatrix.needsUpdate = true
    for (let i = v.anims.length - 1; i >= 0; i--) {
      const anim = v.anims[i]
      anim.time += dt * (anim.keep ? 1.8 : 4)
      anim.panel.material.opacity = Math.max(0, 1 - anim.time)
      if (anim.keep) anim.panel.scale.setScalar(1 + anim.time * 0.5)
      if (anim.time >= 1) { anim.panel.visible = false; v.anims[i] = v.anims[v.anims.length - 1]; v.anims.pop() }
    }

    // 보스
    v.punch *= Math.exp(-dt * 10)
    const hover = stage.cfg.world === 3 ? 1.2 : 0
    if (v.bossState === 'dying') {
      v.bossTime += dt
      const s = Math.max(0, 1 - v.bossTime * 1.5)
      v.boss.scale.setScalar(v.bossScale * s)
      v.boss.rotation.y += dt * 14
      if (s > 0) particles.burst((Math.random() - 0.5) * 5, 2 + Math.random() * 4, v.bossZ, ['#ffffff', '#ffd447', '#ff7a1a', '#ff4d5e'], 7, 12, 0.9, 0.9)
      else {
        v.boss.visible = false
        particles.emit((Math.random() - 0.5) * 12, 10, lz - Math.random() * 12, (Math.random() - 0.5) * 2, -2, 0, CONFETTI[Math.floor(Math.random() * 5)], 0.55, 2.4, 2)
      }
    } else {
      const laugh = v.bossState === 'laugh'
      if (laugh) v.boss.position.z += (lz - 7 - v.boss.position.z) * Math.min(1, dt * 2)
      v.boss.position.x = Math.sin(time * 70) * v.punch * 0.18
      v.boss.position.y = hover + Math.sin(time * 2) * 0.18 + (laugh ? Math.abs(Math.sin(time * 9)) * 0.5 : 0)
      v.boss.rotation.y = Math.sin(time * 1.2) * 0.12
      v.boss.scale.setScalar(v.bossScale * (1 + v.punch * 0.07))
    }
    v.missiles.update(dt, onMissileHit)

    // 분위기 입자와 피버 꼬리
    v.ambient += dt
    while (v.ambient > 0.07) {
      v.ambient -= 0.07
      const drift = v.look.drift
      particles.emit((Math.random() - 0.5) * 34, drift < 0 ? 11 : Math.random() * 9 - 1, lz - 6 - Math.random() * 55, (Math.random() - 0.5) * 0.8, drift, 0, v.look.ambient[Math.floor(Math.random() * 3)], 0.32, 3.2, 0)
    }
    if (run.fever && running) for (let i = 0; i < 2; i++) particles.emit(run.x + (Math.random() - 0.5) * 0.8, 0.2, lz + 0.5, 0, 2.5, 3, GOLD[i], 0.5, 0.5, 0)
    particles.update(dt)

    // 카메라
    const tall = camera.aspect < 1
    const back = (12.5 + v.radius * 2) * (tall ? 0.9 : 1), height = 8.5 + v.radius * 0.9
    if (running) { goal.set(run.x * 0.5, height, lz + back); look.set(run.x * 0.6, 1.2, lz - (tall ? 13 : 6)) }
    // 승리하면 결과 카드 옆(세로 화면은 위)에서 환호하는 특공대를 가까이 비춘다.
    else if (won) { goal.set(tall ? 0 : -1.5, tall ? 7 : 4.4, lz + (tall ? 13 : 10) + v.radius); look.set(tall ? 0 : 3, tall ? -3 : 1.2, lz + 1) }
    else { goal.set(tall ? 0 : 4.5, height + 1.5, lz + back + 2); look.set(0, 3, lz - 9) }
    const ease = v.snap ? 1 : Math.min(1, dt * (running ? 7 : 2.2))
    v.snap = false
    camPos.lerp(goal, ease); camLook.lerp(look, ease)
    if (running) { camPos.z = goal.z; camLook.z = look.z }
    v.shake *= Math.exp(-dt * 6)
    camera.position.set(camPos.x + (Math.random() - 0.5) * v.shake, camPos.y + (Math.random() - 0.5) * v.shake, camPos.z)
    camera.lookAt(camLook)
    v.sky.position.copy(camera.position)
    sun.position.set(run.x + 7, 16, lz + 13)
    sun.target.position.set(run.x, 0, lz - 5)
    rim.position.set(run.x - 6, 9, lz - 16)
    rim.target.position.set(run.x, 1, lz)

    // CPU 렌더링에서는 그리는 데 쓴 시간의 세 배만큼 쉬어, 게임 진행과 입력이 그리기에 밀리지 않게 한다.
    const started = performance.now()
    if (!software || started >= restUntil) {
      renderer.render(scene, camera)
      if (software) restUntil = started + Math.max(33, (performance.now() - started) * 3)
    }

    // 느린 기기에서는 그림자 → 해상도 순으로 품질을 내려 프레임을 지킨다. 다시 올리지는 않아 깜빡임이 없다.
    if (dt > 0) {
      frameAverage = frameAverage * 0.95 + dt * 0.05
      // 아주 느린 기기(25fps 미만)는 0.2초 만에, 그 외에는 1.5초 관찰 후 한 단계씩 내린다.
      if (++framesSinceChange > (frameAverage > 0.045 ? 6 : 90) && frameAverage > 1 / 40) {
        framesSinceChange = 0
        if (sun.castShadow) sun.castShadow = false
        // 30fps로 고정된 절전 모드 기기는 해상도를 낮춰도 빨라지지 않으므로 1.0 아래로는 정말 느릴 때만 내린다.
        else if (pixelRatio > (frameAverage > 0.04 ? 0.5 : 1)) { pixelRatio = Math.max(0.5, pixelRatio - 0.25); renderer.setPixelRatio(pixelRatio); resize() }
      }
    }
  }

  return {
    load, update, resize, unload,
    dispose() {
      unload()
      particles.dispose(); material.dispose(); scene.environment?.dispose()
      renderer.dispose(); renderer.forceContextLoss()
    },
  }
}
