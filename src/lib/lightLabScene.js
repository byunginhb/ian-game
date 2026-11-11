/** 빛 꺾기 실험실 3D 장면: 어두운 책상 위 나무 실험판. 규칙은 lightLab.js가 맡고 여기서는 그리기만 한다. */
import {
  NeutralToneMapping, AdditiveBlending, BoxGeometry, CanvasTexture, Color, CylinderGeometry, Group, HalfFloatType, HemisphereLight,
  InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, OctahedronGeometry, PCFSoftShadowMap, PerspectiveCamera,
  Plane, PlaneGeometry, PMREMGenerator, Raycaster, RepeatWrapping, Scene, SphereGeometry, SpotLight, SRGBColorSpace, TorusGeometry,
  Vector2, Vector3, WebGLRenderer, WebGLRenderTarget,
} from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { COLOR_HEX, SLASH } from './lightLab.js'

const MAX_HOPS = 260
const BEAM_Y = 0.5
const BEAM_SPEED = 26 // 칸/초: 빛이 판 위를 달려 나가는 속도
const ANGLE = { [SLASH]: Math.PI / 4, 2: -Math.PI / 4 }
const HOP_LENGTH = { '': 1, exit: 0.86, block: 0.6 }
const BEAM_COLOR = Object.fromEntries(Object.entries(COLOR_HEX).map(([code, hex]) => [code, new Color(hex)]))
const HOP_ANGLE = [Math.PI / 2, 0, -Math.PI / 2, Math.PI]
const BEAM_LAYERS = [[0.045, 2.3], [0.13, 0.14]] // [두께, 밝기]: 밝은 심지와 옅은 번짐
const ease = (current, target, dt, rate) => current + (target - current) * Math.min(1, dt * rate)

function woodTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 256, 256)
  // 결을 따라 흐르는 가는 줄무늬: 같은 텍스처에 판·칸 색을 곱해 쓴다.
  for (let i = 0; i < 150; i++) {
    const y = Math.random() * 256, wave = 2 + Math.random() * 5
    ctx.strokeStyle = `rgba(70, 40, 15, ${0.04 + Math.random() * 0.13})`
    ctx.lineWidth = 0.6 + Math.random() * 1.8
    ctx.beginPath()
    for (let x = -8; x <= 264; x += 8) ctx.lineTo(x, y + Math.sin(x / 38 + i) * wave)
    ctx.stroke()
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = texture.wrapT = RepeatWrapping
  return texture
}

export function createLabScene(canvas) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  // 품질 단계: 2 = 번짐+그림자, 1 = 그림자만, 0 = 둘 다 끄고 초당 30장. GPU 없이 CPU로 그리는 환경은 0에서 시작한다.
  const debug = renderer.getContext().getExtension('WEBGL_debug_renderer_info')
  const software = /swiftshader|llvmpipe|software/i.test(debug ? renderer.getContext().getParameter(debug.UNMASKED_RENDERER_WEBGL) : '')
  let quality = software ? 0 : 2, restUntil = 0, slowStreak = 0
  let pixelRatio = software ? 0.6 : Math.min(window.devicePixelRatio || 1, 2)
  renderer.setPixelRatio(pixelRatio)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFSoftShadowMap
  renderer.toneMapping = NeutralToneMapping
  renderer.toneMappingExposure = 1.05

  const scene = new Scene()
  scene.background = new Color('#090b10')
  // 놋쇠와 거울에 비칠 실내 환경. CPU 렌더링에서는 준비 비용이 커서 건너뛴다.
  const disposables = []
  if (!software) {
    const pmrem = new PMREMGenerator(renderer), room = new RoomEnvironment()
    scene.environment = pmrem.fromScene(room, 0.04).texture
    scene.environmentIntensity = 0.1
    pmrem.dispose()
    disposables.push(scene.environment, room)
  }

  const camera = new PerspectiveCamera(30, 1, 0.5, 120)
  const lamp = new SpotLight('#ffe3bd', 92, 40, 0.62, 0.95, 1.6)
  lamp.castShadow = quality > 0
  lamp.shadow.mapSize.set(1024, 1024)
  lamp.shadow.bias = -0.0005
  lamp.shadow.radius = 5
  lamp.position.set(-3.2, 10.5, 4.2)
  scene.add(lamp, lamp.target, new HemisphereLight('#93a6cc', '#1b140e', software ? 0.9 : 0.12))

  // 후처리: 빛줄기와 켜진 수정만 번지도록 밝기 문턱을 높게 둔다.
  const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 })
  const composer = new EffectComposer(renderer, target)
  const bloom = new UnrealBloomPass(new Vector2(1, 1), 0.55, 0.5, 1)
  composer.addPass(new RenderPass(scene, camera))
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  const wood = woodTexture()
  const geometry = {
    tile: new RoundedBoxGeometry(0.94, 0.1, 0.94, 3, 0.035),
    socket: new CylinderGeometry(0.07, 0.07, 0.02, 16),
    block: new RoundedBoxGeometry(0.76, 0.6, 0.76, 4, 0.1),
    plate: new RoundedBoxGeometry(1.14, 0.54, 0.05, 3, 0.022),
    rail: new RoundedBoxGeometry(1.2, 0.07, 0.11, 2, 0.03),
    peg: new CylinderGeometry(0.16, 0.2, 0.1, 28),
    foot: new RoundedBoxGeometry(0.42, 0.12, 0.42, 3, 0.04),
    crystal: new OctahedronGeometry(0.28, 0),
    ring: new TorusGeometry(0.27, 0.035, 10, 36),
    sphere: new SphereGeometry(0.25, 32, 20),
    prism: new CylinderGeometry(0.34, 0.34, 0.56, 3),
    barrel: new CylinderGeometry(0.15, 0.18, 0.6, 28),
    lens: new CylinderGeometry(0.125, 0.125, 0.04, 24),
    cradle: new RoundedBoxGeometry(0.3, 0.2, 0.34, 3, 0.05),
    marble: new SphereGeometry(0.12, 24, 16),
    frame: new TorusGeometry(0.63, 0.022, 6, 4),
    beam: new BoxGeometry(1, 1, 1).translate(0.5, 0, 0),
    desk: new PlaneGeometry(80, 80),
  }
  const standard = (color, roughness, metalness = 0, extra) => new MeshStandardMaterial({ color, roughness, metalness, ...extra })
  const material = {
    tile: standard('#ffffff', 0.62, 0, { map: wood }),
    tray: standard('#7b4f2c', 0.7, 0, { map: wood }),
    socket: standard('#3b2a1c', 0.9),
    desk: standard('#14171d', 0.96),
    block: standard('#23272e', 0.82),
    brass: standard('#c8a05a', 0.3, 1, { envMapIntensity: 4 }),
    iron: standard('#343941', 0.5, 0.85, { envMapIntensity: 4 }),
    mirror: standard('#f3f7fb', 0.12, 1, { envMapIntensity: 9 }),
    ghost: standard('#ffd48a', 0.4, 0, { transparent: true, opacity: 0.4, emissive: '#ffb347', emissiveIntensity: 0.5, depthWrite: false }),
    prism: standard('#eef6ff', 0.04, 0, { transparent: true, opacity: 0.5, emissive: '#cfe3ff', emissiveIntensity: 0.12 }),
    cursor: new MeshBasicMaterial({ color: '#ffd48a', transparent: true, opacity: 0.9, depthTest: false }),
    beam: new MeshBasicMaterial({ transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
  }
  const desk = new Mesh(geometry.desk, material.desk)
  desk.rotation.x = -Math.PI / 2; desk.position.y = -0.36; desk.receiveShadow = true
  scene.add(desk)

  const beams = new InstancedMesh(geometry.beam, material.beam, MAX_HOPS * 2)
  beams.frustumCulled = false; beams.count = 0; beams.renderOrder = 4
  const cursor = new Mesh(geometry.frame, material.cursor)
  cursor.rotation.set(-Math.PI / 2, 0, Math.PI / 4); cursor.renderOrder = 5; cursor.visible = false
  const ghost = new Group()
  const ghostPlate = new Mesh(geometry.plate, material.ghost)
  ghostPlate.position.y = 0.42
  ghost.add(ghostPlate); ghost.visible = false
  scene.add(beams, cursor, ghost)

  const dummy = new Object3D(), tint = new Color(), raycaster = new Raycaster(), pointer = new Vector2(), hit = new Vector3()
  const ground = new Plane(new Vector3(0, 1, 0), -0.05), corner = new Vector3()
  let view = null, insets = { top: 0, bottom: 0 }, frameAverage = 1 / 60, frames = 0, clock = 0

  const cellX = (index) => (index % view.level.w) - (view.level.w - 1) / 2
  const cellZ = (index) => Math.floor(index / view.level.w) - (view.level.h - 1) / 2
  const shadowed = (mesh) => { mesh.castShadow = true; mesh.receiveShadow = true; return mesh }

  function mirrorGroup(fixed) {
    const group = new Group()
    const plate = shadowed(new Mesh(geometry.plate, material.mirror))
    plate.position.y = 0.42
    const frame = fixed ? material.iron : material.brass
    const top = shadowed(new Mesh(geometry.rail, frame)), bottom = shadowed(new Mesh(geometry.rail, frame))
    top.position.y = 0.71; bottom.position.y = 0.13
    const base = shadowed(new Mesh(fixed ? geometry.foot : geometry.peg, frame))
    base.position.y = fixed ? 0.06 : 0.05
    group.add(plate, top, bottom, base)
    return group
  }

  function fit() {
    if (!view) return
    const { w, h } = view.level
    const width = canvas.clientWidth || 1, height = canvas.clientHeight || 1
    camera.aspect = width / height
    // 위쪽 안내와 아래쪽 버튼을 뺀 영역 한가운데에 실험판이 꽉 차도록 거리를 맞춘다.
    const free = Math.max(0.3, (height - insets.top - insets.bottom) / height)
    camera.clearViewOffset()
    camera.updateProjectionMatrix()
    let distance = 14
    for (let pass = 0; pass < 4; pass++) {
      camera.position.set(0, distance * 0.83, distance * 0.56)
      camera.lookAt(0, 0.1, 0)
      camera.updateMatrixWorld()
      let extentX = 0, extentY = 0
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [-0.3, 0.9]) {
        corner.set(sx * (w / 2 + 0.5), y, sz * (h / 2 + 0.5)).project(camera)
        extentX = Math.max(extentX, Math.abs(corner.x)); extentY = Math.max(extentY, Math.abs(corner.y))
      }
      distance *= Math.max(extentX / 0.94, extentY / (free * 0.94))
    }
    camera.position.set(0, distance * 0.83, distance * 0.56)
    camera.lookAt(0, 0.1, 0)
    camera.setViewOffset(width, height, 0, (insets.bottom - insets.top) / 2, width, height)
  }

  function resize(nextInsets = insets) {
    insets = nextInsets
    const width = canvas.clientWidth || 1, height = canvas.clientHeight || 1
    renderer.setSize(width, height, false)
    composer.setPixelRatio(pixelRatio)
    composer.setSize(width, height)
    fit()
  }

  function unload() {
    if (!view) return
    scene.remove(view.group)
    view.group.traverse((object) => { if (object.isInstancedMesh) object.dispose() })
    view.owned.forEach((item) => item.dispose())
    view = null
    beams.count = 0; cursor.visible = false; ghost.visible = false
  }

  function load(level) {
    unload()
    const group = new Group(), owned = [], { w, h, cells } = level
    view = { level, group, owned, targets: [], mirrors: new Map(), crystals: [], marble: null, hops: [], born: new Map(), solved: false, glow: 0 }
    const tray = shadowed(new Mesh(new RoundedBoxGeometry(w + 0.8, 0.34, h + 0.8, 4, 0.14), material.tray))
    owned.push(tray.geometry)
    tray.position.y = -0.19
    const tiles = new InstancedMesh(geometry.tile, material.tile, w * h), sockets = new InstancedMesh(geometry.socket, material.socket, w * h)
    tiles.receiveShadow = true
    cells.forEach((cell, index) => {
      const x = cellX(index), z = cellZ(index)
      dummy.position.set(x, -0.02, z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); dummy.updateMatrix()
      tiles.setMatrixAt(index, dummy.matrix)
      tiles.setColorAt(index, tint.set(((index % w) + Math.floor(index / w)) % 2 ? '#c99c66' : '#e6cba0'))
      dummy.position.y = cell.type === 'empty' ? 0.03 : -1; dummy.updateMatrix()
      sockets.setMatrixAt(index, dummy.matrix)
      const at = (object, y = 0) => { object.position.set(x, y, z); object.userData.cell = index; view.targets.push(object); group.add(object); return object }
      if (cell.type === 'rock') at(shadowed(new Mesh(geometry.block, material.block)), 0.33)
      else if (cell.type === 'fixed') at(mirrorGroup(true)).rotation.y = ANGLE[cell.mirror]
      else if (cell.type === 'source') {
        const lamp = new Group(), lens = new MeshBasicMaterial({ color: tint.set(COLOR_HEX[cell.color]).multiplyScalar(2.4), toneMapped: false })
        owned.push(lens)
        const barrel = shadowed(new Mesh(geometry.barrel, material.brass)), glass = new Mesh(geometry.lens, lens), cradle = shadowed(new Mesh(geometry.cradle, material.iron))
        barrel.rotation.z = -Math.PI / 2; barrel.position.y = BEAM_Y
        glass.rotation.z = -Math.PI / 2; glass.position.set(0.31, BEAM_Y, 0)
        cradle.position.y = 0.2
        lamp.add(barrel, glass, cradle)
        // 통은 +x를 향해 만들었으므로 방향(북·동·남·서)에 맞춰 돌린다.
        at(lamp).rotation.y = [Math.PI / 2, 0, -Math.PI / 2, Math.PI][cell.dir]
      } else if (cell.type === 'crystal') {
        const glass = standard(tint.set(COLOR_HEX[cell.need]).multiplyScalar(0.55).getHex(), 0.08, 0, { emissive: COLOR_HEX[cell.need], emissiveIntensity: 0.05, transparent: true, opacity: 0.9 })
        const band = standard(COLOR_HEX[cell.need], 0.4, 0, { emissive: COLOR_HEX[cell.need], emissiveIntensity: 0.55 })
        owned.push(glass, band)
        const gem = shadowed(new Mesh(geometry.crystal, glass)), ring = new Mesh(geometry.ring, band), foot = shadowed(new Mesh(geometry.peg, material.brass))
        gem.scale.y = 1.5
        ring.rotation.x = Math.PI / 2; ring.position.set(x, 0.11, z); foot.position.set(x, 0.05, z)
        group.add(ring, foot)
        view.crystals.push({ index, need: cell.need, gem: at(gem, BEAM_Y), glass, level: 0, got: 0 })
      } else if (cell.type === 'filter') {
        const glass = standard(COLOR_HEX[cell.color], 0.05, 0, { transparent: true, opacity: 0.62, emissive: COLOR_HEX[cell.color], emissiveIntensity: 0.18 })
        owned.push(glass)
        at(shadowed(new Mesh(geometry.sphere, glass)), BEAM_Y)
        at(shadowed(new Mesh(geometry.peg, material.brass)), 0.05)
        const stem = at(shadowed(new Mesh(geometry.socket, material.brass)), 0.17)
        stem.scale.set(0.6, 8, 0.6)
      } else if (cell.type === 'prism') {
        at(shadowed(new Mesh(geometry.prism, material.prism)), 0.42).rotation.y = Math.PI / 6
        at(shadowed(new Mesh(geometry.foot, material.brass)), 0.06)
      }
    })
    if (level.marble >= 0) {
      const glass = standard('#dfe8f5', 0.05, 0, { emissive: '#fff2c4', emissiveIntensity: 0, transparent: true, opacity: 0.85 })
      owned.push(glass)
      const ball = shadowed(new Mesh(geometry.marble, glass))
      ball.position.set(cellX(level.marble), 0.15, cellZ(level.marble))
      group.add(ball)
      view.marble = { ball, glass, level: 0, lit: false }
    }
    tiles.instanceColor.needsUpdate = true
    group.add(tray, tiles, sockets)
    scene.add(group)
    lamp.target.position.set(0, 0, 0)
    frames = 0; frameAverage = 1 / 60 // 새 판의 준비 시간은 성능 판정에서 뺀다
    resize()
  }

  /** 규칙 쪽 상태를 장면에 반영한다. 달라진 거울과 새로 생긴 빛줄기만 움직인다. */
  function sync({ placed, traced, evaluation, cursorIndex, hint }) {
    if (!view) return
    for (let index = 0; index < placed.length; index++) {
      const want = placed[index]
      let item = view.mirrors.get(index)
      if (want && !item) {
        item = { group: mirrorGroup(false), angle: ANGLE[want], scale: 0, drop: 0.5 }
        item.group.position.set(cellX(index), 0.5, cellZ(index))
        item.group.userData.cell = index
        view.targets.push(item.group)
        view.group.add(item.group)
        view.mirrors.set(index, item)
      }
      if (item) { item.want = want; if (want) item.target = ANGLE[want] }
    }
    // 이미 켜져 있던 빛줄기는 그대로 두고, 새 구간만 가장 가까운 지점부터 달려 나간다.
    const born = new Map()
    let first = Infinity
    for (const hop of traced.hops) { hop.key = ((hop.y * view.level.w + hop.x) * 4 + hop.dir) * 8 + hop.color; if (!view.born.has(hop.key)) first = Math.min(first, hop.dist) }
    for (const hop of traced.hops) born.set(hop.key, view.born.has(hop.key) ? view.born.get(hop.key) : clock + (hop.dist - first) / BEAM_SPEED)
    view.born = born
    view.hops = traced.hops.slice(0, MAX_HOPS)
    for (const crystal of view.crystals) crystal.got = traced.received[crystal.index]
    if (view.marble) view.marble.lit = evaluation.marble
    view.solved = evaluation.solved
    cursor.visible = cursorIndex >= 0
    if (cursor.visible) cursor.position.set(cellX(cursorIndex), 0.06, cellZ(cursorIndex))
    ghost.visible = Boolean(hint)
    if (hint) {
      ghost.position.set(cellX(hint.index), 0, cellZ(hint.index))
      ghost.rotation.y = ANGLE[hint.mirror] ?? 0
      ghostPlate.visible = hint.mirror > 0
      material.cursor.color.set('#ffd48a')
      cursor.visible = true
      cursor.position.set(ghost.position.x, 0.06, ghost.position.z)
    }
  }

  function pick(clientX, clientY) {
    if (!view) return -1
    const rect = canvas.getBoundingClientRect()
    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    // 비스듬히 내려다보므로 키 큰 장치의 윗부분은 뒤 칸 바닥과 겹쳐 보인다. 장치를 먼저 맞혀 본다.
    for (let object = raycaster.intersectObjects(view.targets, true)[0]?.object; object; object = object.parent) if (object.userData.cell !== undefined) return object.userData.cell
    if (!raycaster.ray.intersectPlane(ground, hit)) return -1
    const x = Math.round(hit.x + (view.level.w - 1) / 2), y = Math.round(hit.z + (view.level.h - 1) / 2)
    return x < 0 || y < 0 || x >= view.level.w || y >= view.level.h ? -1 : y * view.level.w + x
  }

  function update(dt) {
    if (!view) return
    clock += dt
    for (const [index, item] of view.mirrors) {
      item.scale = ease(item.scale, item.want ? 1 : 0, dt, 14)
      item.drop = ease(item.drop, 0, dt, 12)
      item.angle = ease(item.angle, item.target, dt, 16)
      item.group.position.y = item.drop
      item.group.rotation.y = item.angle
      item.group.scale.setScalar(Math.max(0.001, item.scale))
      if (!item.want && item.scale < 0.03) { view.group.remove(item.group); view.targets.splice(view.targets.indexOf(item.group), 1); view.mirrors.delete(index) }
    }
    for (const crystal of view.crystals) {
      const right = crystal.got === crystal.need
      crystal.level = ease(crystal.level, right ? 1 : 0, dt, 7)
      // 다른 색이 닿으면 그 색으로 흐리게 빛나 무엇이 모자란지 보여 준다.
      crystal.glass.emissive.copy(BEAM_COLOR[right || !crystal.got ? crystal.need : crystal.got])
      crystal.glass.emissiveIntensity = 0.05 + crystal.level * 1.25 + (!right && crystal.got ? 0.4 : 0)
      crystal.gem.rotation.y += dt * (0.25 + crystal.level * 1.6)
      crystal.gem.position.y = BEAM_Y + Math.sin(clock * 2 + crystal.index) * 0.03 * crystal.level
    }
    if (view.marble) {
      const marble = view.marble
      marble.level = ease(marble.level, marble.lit ? 1 : 0, dt, 6)
      marble.glass.emissiveIntensity = marble.level * 2.2
      marble.ball.position.y = 0.15 + marble.level * (0.22 + Math.sin(clock * 3) * 0.05)
    }
    view.glow = ease(view.glow, view.solved ? 1 : 0, dt, 2.5)
    lamp.intensity = 92 * (1 + view.glow * 0.3)
    if (ghost.visible) { material.ghost.opacity = 0.3 + Math.sin(clock * 5) * 0.15; cursor.scale.setScalar(1 + Math.sin(clock * 5) * 0.05) } else cursor.scale.setScalar(1)

    // 빛줄기: 구간마다 밝은 심지 하나와 넓고 옅은 번짐 하나.
    let count = 0
    for (const hop of view.hops) {
      const reveal = Math.max(0, Math.min(1, (clock - view.born.get(hop.key)) * BEAM_SPEED))
      if (reveal <= 0) continue
      const pulse = 1 + Math.sin(clock * 5 - hop.dist * 0.9) * 0.07
      dummy.position.set(hop.x - (view.level.w - 1) / 2, BEAM_Y, hop.y - (view.level.h - 1) / 2)
      dummy.rotation.set(0, HOP_ANGLE[hop.dir], 0)
      for (const [thickness, power] of BEAM_LAYERS) {
        dummy.scale.set(HOP_LENGTH[hop.end] * reveal, thickness * pulse, thickness * pulse)
        dummy.updateMatrix()
        beams.setMatrixAt(count, dummy.matrix)
        beams.setColorAt(count++, tint.copy(BEAM_COLOR[hop.color]).multiplyScalar(power))
      }
    }
    beams.count = count
    beams.instanceMatrix.needsUpdate = true
    if (beams.instanceColor) beams.instanceColor.needsUpdate = true

    // 가장 낮은 단계에서는 그리는 데 쓴 시간의 두 배만큼 쉬어, 아무리 느린 기기에서도 입력이 밀리지 않게 한다.
    const started = performance.now()
    if (quality === 0 && started < restUntil) return
    if (quality === 2) composer.render(dt)
    else renderer.render(scene, camera)
    const cost = performance.now() - started
    if (quality === 0) restUntil = started + Math.max(33, cost * 3)

    // 느린 기기에서는 번짐 → 그림자·해상도 순으로 내려 프레임을 지킨다. 다시 올리지는 않아 깜빡임이 없다.
    if (dt > 0 && quality > 0) {
      frameAverage = frameAverage * 0.95 + dt * 0.05
      frames += 1
      // 절전 모드처럼 초당 30장으로 고정된 기기는 느린 것이 아니므로 그보다 느릴 때만 내린다.
      // 실험판을 새로 깔면 셰이더 준비로 한두 장이 튀므로, 0.1초 넘는 장이 연달아 세 번 나올 때만 바로 내린다.
      slowStreak = cost > 100 ? slowStreak + 1 : 0
      if (slowStreak >= 3 || (frames > (frameAverage > 0.045 ? 14 : 90) && frameAverage > 1 / 27)) {
        frames = 0; slowStreak = 0; frameAverage = 1 / 60
        quality -= 1
        if (quality === 1) composer.dispose() // 후처리용 렌더 타깃 메모리를 돌려준다
        if (quality === 0) { lamp.castShadow = false; pixelRatio = Math.min(pixelRatio, 1); renderer.setPixelRatio(pixelRatio); resize() }
      }
    }
  }

  return {
    load, sync, pick, update, resize, unload,
    dispose() {
      unload()
      Object.values(geometry).forEach((item) => item.dispose())
      Object.values(material).forEach((item) => item.dispose())
      beams.dispose(); wood.dispose(); disposables.forEach((item) => item.dispose?.()); target.dispose(); composer.dispose()
      renderer.dispose(); renderer.forceContextLoss()
    },
  }
}
