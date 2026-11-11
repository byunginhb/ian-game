/** 숫자 특공대의 로우폴리 모델·텍스처 팩토리. 모델 하나는 정점 색을 가진 단일 지오메트리(드로우콜 1회)다. */
import {
  BoxGeometry, SphereGeometry, CylinderGeometry, ConeGeometry, IcosahedronGeometry, OctahedronGeometry,
  BufferAttribute, Color, Matrix4, Vector3, Quaternion, Euler, CanvasTexture, SRGBColorSpace, RepeatWrapping,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const matrix = new Matrix4(), position = new Vector3(), quaternion = new Quaternion(), euler = new Euler(), scale = new Vector3(), tint = new Color()

const box = (w, h, d) => new BoxGeometry(w, h, d)
const sph = (r, w = 10, h = 8) => new SphereGeometry(r, w, h)
const cyl = (top, bottom, h, seg = 10) => new CylinderGeometry(top, bottom, h, seg)
const cone = (r, h, seg = 7) => new ConeGeometry(r, h, seg)
const ico = (r) => new IcosahedronGeometry(r, 0)
const octa = (r) => new OctahedronGeometry(r, 0)

/** 지오메트리를 제자리에 놓고 단색 정점 색을 입힌다. [x,y,z], [rx,ry,rz], [sx,sy,sz] */
function part(source, color, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
  const geometry = source.index ? source.toNonIndexed() : source
  if (geometry !== source) source.dispose()
  matrix.compose(position.set(...p), quaternion.setFromEuler(euler.set(...r)), scale.set(...s))
  geometry.applyMatrix4(matrix)
  const count = geometry.attributes.position.count, colors = new Float32Array(count * 3)
  tint.set(color)
  for (let i = 0; i < count; i++) tint.toArray(colors, i * 3)
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  geometry.deleteAttribute('uv')
  return geometry
}

function merge(parts) {
  const merged = mergeGeometries(parts)
  parts.forEach((item) => item.dispose())
  return merged
}

export function leaderParts(skin) {
  const dark = '#22304f'
  const body = merge([
    part(cyl(0.32, 0.38, 0.72), skin.suit, [0, 0.98, 0]),
    part(cyl(0.4, 0.4, 0.1), dark, [0, 0.64, 0]),
    part(box(0.22, 0.22, 0.04), '#ffe066', [0, 1.05, -0.36], [0, 0, Math.PI / 4]),
    part(sph(0.36), '#ffd9b3', [0, 1.62, 0]),
    part(sph(0.385), '#3b2a20', [0, 1.72, 0.05], [0, 0, 0], [1, 0.72, 1]),
    part(sph(0.05, 6, 5), '#1b1b1b', [-0.13, 1.6, -0.33]),
    part(sph(0.05, 6, 5), '#1b1b1b', [0.13, 1.6, -0.33]),
    part(box(0.2, 0.04, 0.04), '#c0504d', [0, 1.48, -0.34]),
    part(box(0.66, 0.8, 0.05), skin.cape, [0, 0.98, 0.34], [-0.28, 0, 0]),
  ])
  const arm = () => merge([part(box(0.14, 0.46, 0.14), skin.suit, [0, -0.23, 0]), part(sph(0.1, 6, 5), '#ffd9b3', [0, -0.5, 0])])
  const leg = () => merge([part(box(0.18, 0.5, 0.18), dark, [0, -0.25, 0]), part(box(0.2, 0.12, 0.32), '#ffffff', [0, -0.54, -0.06])])
  return { body, arms: [arm(), arm()], legs: [leg(), leg()] }
}

export function robotGeometry(skin) {
  return merge([
    part(box(0.46, 0.4, 0.4), skin.robot, [0, 0.36, 0]),
    part(box(0.4, 0.3, 0.36), '#f4f7fb', [0, 0.73, 0]),
    part(box(0.3, 0.12, 0.05), '#1d2b4a', [0, 0.74, -0.19]),
    part(box(0.3, 0.12, 0.05), '#1d2b4a', [0, 0.74, 0.19]),
    part(cyl(0.02, 0.02, 0.16, 5), '#8a94a8', [0, 0.96, 0]),
    part(sph(0.07, 6, 5), '#ff4d5e', [0, 1.07, 0]),
    part(box(0.14, 0.12, 0.22), '#3a4662', [-0.12, 0.06, 0]),
    part(box(0.14, 0.12, 0.22), '#3a4662', [0.12, 0.06, 0]),
    part(box(0.1, 0.26, 0.12), '#f4f7fb', [-0.29, 0.38, 0]),
    part(box(0.1, 0.26, 0.12), '#f4f7fb', [0.29, 0.38, 0]),
  ])
}

export function enemyGeometry() {
  return merge([
    part(sph(0.5, 8, 6), '#3a2352', [0, 0.48, 0], [0, 0, 0], [1, 0.92, 1]),
    part(cone(0.14, 0.4, 5), '#6b46a3', [-0.24, 0.98, 0], [0, 0, 0.35]),
    part(cone(0.14, 0.4, 5), '#6b46a3', [0.24, 0.98, 0], [0, 0, -0.35]),
    part(sph(0.1, 6, 5), '#ff5a4d', [-0.17, 0.6, 0.42]),
    part(sph(0.1, 6, 5), '#ff5a4d', [0.17, 0.6, 0.42]),
    part(box(0.3, 0.06, 0.05), '#ffffff', [0, 0.36, 0.46]),
  ])
}

export function hazardGeometry(width) {
  const parts = [part(cyl(0.5, 0.5, width, 12), '#5a6072', [0, 0, 0], [0, 0, Math.PI / 2])]
  for (const x of [-width * 0.33, 0, width * 0.33]) {
    parts.push(part(cyl(0.54, 0.54, 0.3, 12), '#ffcf33', [x, 0, 0], [0, 0, Math.PI / 2]))
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      parts.push(part(cone(0.15, 0.42, 5), '#eef1f8', [x + width * 0.16, Math.cos(a) * 0.68, Math.sin(a) * 0.68], [a, 0, 0]))
    }
  }
  return merge(parts)
}

export const coinGeometry = () => merge([
  part(cyl(0.45, 0.45, 0.08, 14), '#f5a700', [0, 0, 0], [Math.PI / 2, 0, 0]),
  part(cyl(0.32, 0.32, 0.13, 14), '#ffe066', [0, 0, 0], [Math.PI / 2, 0, 0]),
])

export const postGeometry = () => merge([part(cyl(0.16, 0.2, 4.2, 8), '#ffffff', [0, 2.1, 0]), part(sph(0.28, 8, 6), '#ffd447', [0, 4.3, 0])])

const BOSSES = [
  () => [
    part(box(1, 2, 1.2), '#2c7a3f', [-0.9, 1, 0]), part(box(1, 2, 1.2), '#2c7a3f', [0.9, 1, 0]),
    part(box(2.6, 2.6, 3.4), '#3fae5a', [0, 3.2, -0.3], [0.25, 0, 0]),
    part(box(1.8, 1.6, 0.2), '#d8f2a0', [0, 3.1, 1.3], [0.25, 0, 0]),
    part(box(1.8, 1.5, 2.4), '#3fae5a', [0, 5.3, 1.6]), part(box(1.6, 0.4, 2), '#2c7a3f', [0, 4.25, 1.7]),
    ...[[-0.5, 2.5], [0.5, 2.5], [-0.5, 1.9], [0.5, 1.9]].map(([x, z]) => part(cone(0.14, 0.4, 4), '#ffffff', [x, 4.62, z])),
    part(sph(0.26, 8, 6), '#ffe94a', [-0.78, 5.65, 2.5]), part(sph(0.26, 8, 6), '#ffe94a', [0.78, 5.65, 2.5]),
    part(sph(0.12, 6, 5), '#1b1b1b', [-0.8, 5.65, 2.72]), part(sph(0.12, 6, 5), '#1b1b1b', [0.8, 5.65, 2.72]),
    part(box(0.3, 0.9, 0.3), '#2c7a3f', [-1.45, 3.2, 1.2], [-0.6, 0, 0]), part(box(0.3, 0.9, 0.3), '#2c7a3f', [1.45, 3.2, 1.2], [-0.6, 0, 0]),
    part(cone(0.9, 3.4, 6), '#3fae5a', [0, 2.6, -3.3], [-Math.PI / 2, 0, 0]),
    ...[0.9, 0, -0.9, -1.8].map((z, i) => part(cone(0.35, 0.9, 4), '#ff8a3d', [0, 4.9 - i * 0.35, z - 0.4])),
    part(cyl(0.12, 0.12, 0.7, 6), '#8a94a8', [0, 6.4, 1.4]), part(sph(0.18, 6, 5), '#ff4d5e', [0, 6.8, 1.4]),
  ],
  () => [
    part(sph(2.2, 12, 10), '#8b5cf6', [0, 4, 0], [0, 0, 0], [1, 1.15, 1]),
    ...[[-1.2, 5.6, 0.9], [1.3, 5.2, 0.7], [0.2, 6.2, 0.5], [-0.6, 4.9, 1.7]].map((p) => part(sph(0.34, 6, 5), '#c4b5fd', p)),
    part(sph(0.55, 8, 6), '#ffffff', [-0.85, 3.9, 1.85]), part(sph(0.55, 8, 6), '#ffffff', [0.85, 3.9, 1.85]),
    part(sph(0.26, 6, 5), '#1b1b1b', [-0.85, 3.85, 2.3]), part(sph(0.26, 6, 5), '#1b1b1b', [0.85, 3.85, 2.3]),
    part(box(1.3, 0.14, 0.1), '#2e1065', [0, 4.75, 2.05], [0, 0, 0.12]),
    ...Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2 + 0.39
      return [
        part(cyl(0.5, 0.28, 3.2, 6), '#7c3aed', [Math.cos(a) * 2.2, 1.4, Math.sin(a) * 2.2], [Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55]),
        part(sph(0.34, 6, 5), '#f9a8d4', [Math.cos(a) * 3.05, 0.25, Math.sin(a) * 3.05]),
      ]
    }).flat(),
  ],
  () => [
    part(box(1.3, 1.8, 1.3), '#3b2f36', [-1, 0.9, 0]), part(box(1.3, 1.8, 1.3), '#3b2f36', [1, 0.9, 0]),
    part(box(3.4, 2.8, 2.2), '#4a3b46', [0, 3.2, 0]),
    ...[[-0.9, 3.6, 0.5], [0.8, 2.7, -0.4], [0.2, 3.9, 0.3]].map(([x, y, rz]) => part(box(0.22, 1.5, 0.1), '#ff7a1a', [x, y, 1.12], [0, 0, rz])),
    part(sph(0.62, 8, 6), '#ffb000', [0, 3.2, 0.95]),
    part(ico(1.15), '#3b2f36', [-2.3, 4.5, 0]), part(ico(1.15), '#3b2f36', [2.3, 4.5, 0]),
    part(box(1, 2.6, 1), '#4a3b46', [-2.5, 2.7, 0.2]), part(box(1, 2.6, 1), '#4a3b46', [2.5, 2.7, 0.2]),
    part(ico(0.85), '#ff7a1a', [-2.5, 1.1, 0.3]), part(ico(0.85), '#ff7a1a', [2.5, 1.1, 0.3]),
    part(box(1.5, 1.3, 1.4), '#3b2f36', [0, 5.3, 0]),
    part(box(0.38, 0.2, 0.1), '#ffd000', [-0.38, 5.42, 0.72], [0, 0, -0.25]), part(box(0.38, 0.2, 0.1), '#ffd000', [0.38, 5.42, 0.72], [0, 0, 0.25]),
    part(box(0.7, 0.12, 0.1), '#ff7a1a', [0, 4.95, 0.72]),
    part(cone(0.28, 0.9, 5), '#ff7a1a', [-0.6, 6.3, 0], [0, 0, 0.3]), part(cone(0.28, 0.9, 5), '#ff7a1a', [0.6, 6.3, 0], [0, 0, -0.3]),
  ],
  () => [
    part(cyl(1.6, 3.6, 0.9, 16), '#9aa7c7', [0, 3.4, 0]), part(cyl(3.6, 2, 0.7, 16), '#6c7a9c', [0, 2.6, 0]),
    part(sph(1.5, 12, 8), '#7df9ff', [0, 4, 0]),
    part(sph(0.6, 8, 6), '#8cf26b', [0, 4.2, 1.15]),
    part(sph(0.16, 6, 5), '#1b1b1b', [-0.22, 4.3, 1.68]), part(sph(0.16, 6, 5), '#1b1b1b', [0.22, 4.3, 1.68]),
    ...Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2
      return part(sph(0.24, 6, 5), i % 2 ? '#ffe94a' : '#ff7ad9', [Math.cos(a) * 3.3, 3.05, Math.sin(a) * 3.3])
    }),
    part(cyl(0.3, 0.38, 1.8, 8), '#3a4662', [0, 2.5, 2.9], [Math.PI / 2, 0, 0]),
    part(cyl(0.06, 0.06, 1.2, 5), '#c9d2e8', [0, 5.9, 0]), part(sph(0.2, 6, 5), '#ff4d5e', [0, 6.6, 0]),
    ...[-1.4, 0, 1.4].map((x) => part(cone(0.5, 1.3, 6), '#ff7ad9', [x, 1.6, 0], [Math.PI, 0, 0])),
  ],
]

export const bossGeometry = (world) => merge(BOSSES[world]())

const PROPS = {
  tree: () => [
    part(cyl(0.5, 0.75, 5, 6), '#7a5230', [0, 2.5, 0]),
    part(cone(3, 4.2, 7), '#2f9e4f', [0, 6.6, 0]), part(cone(2.3, 3.6, 7), '#44b862', [0, 8.7, 0]), part(cone(1.5, 2.9, 7), '#62cf74', [0, 10.5, 0]),
  ],
  bush: () => [part(ico(2), '#8a9aa0', [0, 0.9, 0], [0.3, 0.5, 0], [1.2, 0.7, 1]), part(ico(1.3), '#3c9d4d', [1.4, 1.1, 0.6]), part(ico(1), '#57b85f', [-1.3, 0.8, -0.5])],
  coral: () => [
    part(cyl(0.35, 0.5, 4.5, 6), '#ff7eb6', [0, 2.2, 0]),
    part(cyl(0.25, 0.32, 3, 6), '#ff9a5c', [1, 4.2, 0], [0, 0, -0.7]), part(cyl(0.25, 0.32, 2.6, 6), '#ff7eb6', [-0.9, 3.6, 0.3], [0.2, 0, 0.8]),
    part(sph(0.5, 6, 5), '#ffd1e6', [0, 4.6, 0]), part(sph(0.42, 6, 5), '#ffd1a8', [2, 5.1, 0]), part(sph(0.42, 6, 5), '#ffd1e6', [-1.8, 4.4, 0.5]),
  ],
  reef: () => [
    part(ico(2.2), '#4a6fa5', [0, 0.8, 0], [0.2, 0.4, 0], [1.3, 0.7, 1]),
    part(cone(0.3, 4, 5), '#2fbf9f', [0.6, 3, 0.2], [0, 0, 0.12]), part(cone(0.3, 3.2, 5), '#56d6b8', [-0.5, 2.6, -0.3], [0, 0, -0.15]), part(cone(0.26, 2.6, 5), '#2fbf9f', [0, 2.2, 0.8]),
  ],
  spire: () => [part(cone(2, 11, 5), '#2e2630', [0, 5.5, 0]), part(cone(1.2, 6.5, 5), '#40343f', [1.6, 3.2, 0.6], [0, 0, -0.18]), part(ico(0.7), '#ff7a1a', [-1.1, 0.6, 0.8])],
  volcano: () => [part(cyl(2.6, 8, 9, 8), '#3a2c33', [0, 4.5, 0]), part(cyl(2.4, 2.4, 0.5, 8), '#ff6a1a', [0, 9, 0]), part(cyl(1.5, 1.5, 0.6, 8), '#ffc04a', [0, 9.1, 0])],
  asteroid: () => [part(ico(2.2), '#6b5ca5', [0, 0, 0], [0.4, 0.2, 0], [1, 0.8, 1.1]), part(ico(1.2), '#8474c4', [1.6, 0.9, 0.5]), part(ico(0.6), '#a99be0', [-1.5, -0.8, 0.9])],
  crystal: () => [part(octa(1.6), '#5ef2ff', [0, 0, 0], [0, 0.4, 0], [1, 2.3, 1]), part(octa(0.9), '#b28dff', [1.4, -1, 0.3], [0.3, 0, 0.3], [1, 2, 1])],
}

export const propGeometry = (kind) => merge(PROPS[kind]())

/** 월드별 분위기. props의 float는 우주처럼 땅 없이 떠 있는 소품이다. */
export const WORLD_LOOKS = [
  { skyTop: '#2f9bff', skyBottom: '#e6f9cf', fog: '#cdeec8', track: '#f8e9bd', line: '#e6cc86', edge: '#ff9f43', ground: '#4caf58', groundY: -5, glow: false, hemiGround: '#6dbb63', ambient: ['#7ad36b', '#ffe066', '#ffffff'], drift: -0.7, props: [{ kind: 'tree', count: 150, min: 0.7, max: 1.6 }, { kind: 'bush', count: 90, min: 0.6, max: 1.5 }] },
  { skyTop: '#1565d8', skyBottom: '#9fecff', fog: '#8fdcf2', track: '#fff4dc', line: '#f1d9a6', edge: '#18c5c9', ground: '#1596d1', groundY: -3.5, glow: false, hemiGround: '#1aa6d9', ambient: ['#ffffff', '#c9f6ff', '#8fe9ff'], drift: 1.4, props: [{ kind: 'coral', count: 130, min: 0.8, max: 2 }, { kind: 'reef', count: 100, min: 0.8, max: 1.8 }] },
  { skyTop: '#2a0f1e', skyBottom: '#ff8a4a', fog: '#b9482b', track: '#5a4954', line: '#77606c', edge: '#ffb347', ground: '#ff5a1f', groundY: -4.5, glow: true, hemiGround: '#ff6a2a', ambient: ['#ffb347', '#ff6a1a', '#ffe066'], drift: 2.2, props: [{ kind: 'spire', count: 140, min: 0.7, max: 1.8 }, { kind: 'volcano', count: 26, min: 1.6, max: 3.4, far: true }] },
  { skyTop: '#04041a', skyBottom: '#3a1f78', fog: '#1c1548', track: '#2f2b78', line: '#4a45a8', edge: '#5ef2ff', ground: null, groundY: -6, glow: true, hemiGround: '#5b3fc4', ambient: ['#ffffff', '#5ef2ff', '#ff7ad9'], drift: 0.15, props: [{ kind: 'asteroid', count: 120, min: 0.5, max: 2, float: true }, { kind: 'crystal', count: 90, min: 0.6, max: 1.6, float: true }] },
]

function canvasOf(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  return [canvas, canvas.getContext('2d')]
}

const FONT = "'Avenir Next', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif"

function drawLabel(ctx, text, color, width, height) {
  ctx.clearRect(0, 0, width, height)
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, `${color}f2`); gradient.addColorStop(1, `${color}b8`)
  ctx.fillStyle = gradient
  ctx.beginPath(); ctx.roundRect(6, 6, width - 12, height - 12, 26); ctx.fill()
  ctx.lineWidth = 8; ctx.strokeStyle = '#ffffffee'; ctx.stroke()
  let size = height * 0.68
  ctx.font = `900 ${size}px ${FONT}`
  while (ctx.measureText(text).width > width - 44 && size > 20) { size -= 6; ctx.font = `900 ${size}px ${FONT}` }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.lineWidth = Math.max(6, size * 0.12); ctx.strokeStyle = '#0b1b3a99'; ctx.lineJoin = 'round'
  ctx.strokeText(text, width / 2, height / 2 + size * 0.04)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(text, width / 2, height / 2 + size * 0.04)
}

export function labelTexture(text, color) {
  const [canvas, ctx] = canvasOf(256, 160)
  drawLabel(ctx, text, color, 256, 160)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/** 대장 머리 위 인원 배지. 숫자가 바뀔 때만 다시 그린다. */
export function createBadge() {
  const [canvas, ctx] = canvasOf(256, 128)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  let shown = null
  return {
    texture,
    set(text, color) {
      if (shown === text + color) return
      shown = text + color
      drawLabel(ctx, text, color, 256, 128)
      texture.needsUpdate = true
    },
  }
}

export function trackTexture(look) {
  const [canvas, ctx] = canvasOf(256, 256)
  ctx.fillStyle = look.track; ctx.fillRect(0, 0, 256, 256)
  ctx.fillStyle = look.line
  ctx.fillRect(0, 0, 256, 6)
  ctx.beginPath(); ctx.moveTo(128, 70); ctx.lineTo(168, 130); ctx.lineTo(148, 130); ctx.lineTo(128, 100); ctx.lineTo(108, 130); ctx.lineTo(88, 130); ctx.closePath(); ctx.fill()
  ctx.fillStyle = look.edge
  ctx.fillRect(0, 0, 14, 256); ctx.fillRect(242, 0, 14, 256)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(14, 0, 4, 256); ctx.fillRect(238, 0, 4, 256)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = texture.wrapT = RepeatWrapping
  return texture
}

export function checkerTexture() {
  const [canvas, ctx] = canvasOf(160, 32)
  for (let x = 0; x < 10; x++) for (let y = 0; y < 2; y++) { ctx.fillStyle = (x + y) % 2 ? '#1b1b1b' : '#ffffff'; ctx.fillRect(x * 16, y * 16, 16, 16) }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

export function glowTexture(color) {
  const [canvas, ctx] = canvasOf(128, 128)
  const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 64)
  gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(0.25, color); gradient.addColorStop(1, `${color}00`)
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}
