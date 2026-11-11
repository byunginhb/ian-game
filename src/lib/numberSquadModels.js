/** 숫자 특공대의 모델·텍스처 팩토리. 둥근 장난감 느낌을 위해 구·캡슐·둥근 상자만 쓰고, 모델 하나는 정점 색을 가진 단일 지오메트리(드로우콜 1회)다. */
import {
  SphereGeometry, CylinderGeometry, CapsuleGeometry, TorusGeometry, BufferAttribute, Color, Matrix4, Vector3, Quaternion, Euler,
  CanvasTexture, SRGBColorSpace, RepeatWrapping,
} from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'

const matrix = new Matrix4(), position = new Vector3(), quaternion = new Quaternion(), euler = new Euler(), scale = new Vector3(), tint = new Color()

// 정밀도: 수백 개씩 찍어 내는 모델(로봇·적·코인·소품)은 낮게, 하나뿐인 대장·보스는 높게 만든다.
let lod = 1
const steps = (count, min) => Math.max(min, Math.round(count * lod))
const ball = (r, w = 14, h = 10) => new SphereGeometry(r, steps(w, 6), steps(h, 4))
const pill = (r, length, radial = 12) => new CapsuleGeometry(r, length, steps(4, 2), steps(radial, 6))
const block = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, lod < 0.7 ? 1 : 2, r)
const tube = (top, bottom, h, seg = 14) => new CylinderGeometry(top, bottom, h, steps(seg, 6))
const hoop = (r, thickness, seg = 20) => new TorusGeometry(r, thickness, steps(7, 4), steps(seg, 8))
const withDetail = (value, build) => { lod = value; try { return build() } finally { lod = 1 } }

/** 지오메트리를 제자리에 놓고 단색 정점 색을 입힌다. 매끈한 법선은 그대로 둔다. [x,y,z], [rx,ry,rz], [sx,sy,sz] */
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
  const loose = mergeGeometries(parts)
  parts.forEach((item) => item.dispose())
  // 같은 자리·법선·색의 정점을 다시 합쳐 정점 처리량을 줄인다.
  const merged = mergeVertices(loose)
  loose.dispose()
  return merged
}

const SKIN = '#ffd2a8', HAIR = '#4a3020', INK = '#2a2f45'

/** 머리가 큰 3등신 대장. 얼굴은 -z(달리는 방향)를 본다. */
export const leaderParts = (skin) => withDetail(0.85, () => buildLeader(skin))

function buildLeader(skin) {
  const body = merge([
    part(pill(0.3, 0.26), skin.suit, [0, 0.8, 0]),
    part(hoop(0.26, 0.085), skin.cape, [0, 1.13, 0], [Math.PI / 2, 0, 0]),
    part(block(0.62, 0.66, 0.1, 0.05), skin.cape, [0, 0.78, 0.33], [-0.3, 0, 0]),
    part(ball(0.47, 22, 16), SKIN, [0, 1.55, 0]),
    part(ball(0.5, 22, 16), HAIR, [0, 1.66, 0.07], [0, 0, 0], [1, 0.82, 1]),
    part(ball(0.2), HAIR, [0.1, 1.98, -0.2]), part(ball(0.17), HAIR, [-0.16, 1.95, -0.26]),
    part(ball(0.09), SKIN, [-0.46, 1.5, 0]), part(ball(0.09), SKIN, [0.46, 1.5, 0]),
    part(ball(0.075), '#1c1c24', [-0.17, 1.52, -0.42], [0, 0, 0], [1, 1.25, 0.6]), part(ball(0.075), '#1c1c24', [0.17, 1.52, -0.42], [0, 0, 0], [1, 1.25, 0.6]),
    part(ball(0.026, 8, 6), '#ffffff', [-0.15, 1.56, -0.465]), part(ball(0.026, 8, 6), '#ffffff', [0.19, 1.56, -0.465]),
    part(ball(0.08), '#ff9d9d', [-0.29, 1.4, -0.35], [0, 0, 0], [1, 0.6, 0.4]), part(ball(0.08), '#ff9d9d', [0.29, 1.4, -0.35], [0, 0, 0], [1, 0.6, 0.4]),
    part(hoop(0.07, 0.022, 12), '#b5524a', [0, 1.38, -0.44], [0.25, 0, 0], [1, 0.55, 1]),
    part(ball(0.1), '#ffe066', [0, 0.84, -0.29], [0, 0, 0], [1, 1, 0.5]),
  ])
  const arm = () => merge([part(pill(0.09, 0.2, 10), skin.suit, [0, -0.17, 0]), part(ball(0.11), SKIN, [0, -0.4, 0])])
  const leg = () => merge([part(pill(0.115, 0.16, 10), INK, [0, -0.17, 0]), part(ball(0.15), '#ffffff', [0, -0.42, -0.06], [0, 0, 0], [1, 0.7, 1.45]), part(ball(0.1), skin.cape, [0, -0.4, -0.2], [0, 0, 0], [1.1, 0.6, 0.8])])
  return { body, arms: [arm(), arm()], legs: [leg(), leg()] }
}

/** 콩알 로봇: 둥근 몸통, 큰 머리, 방울 안테나. */
export const robotGeometry = (skin) => withDetail(0.5, () => merge([
    part(pill(0.22, 0.12), skin.robot, [0, 0.36, 0]),
    part(block(0.24, 0.22, 0.12, 0.05), '#e8edf5', [0, 0.38, 0.2]),
    part(ball(0.28, 18, 12), '#f7f9fc', [0, 0.78, 0], [0, 0, 0], [1, 0.9, 1]),
    part(ball(0.21), INK, [0, 0.78, -0.13], [0, 0, 0], [1.05, 0.55, 0.7]),
    part(ball(0.25, 14, 10), skin.robot, [0, 0.9, 0.02], [0, 0, 0], [1.02, 0.64, 1.02]),
    part(ball(0.045, 8, 6), '#7df9ff', [-0.09, 0.79, -0.27]), part(ball(0.045, 8, 6), '#7df9ff', [0.09, 0.79, -0.27]),
    part(tube(0.018, 0.018, 0.14, 6), '#9aa3b8', [0, 1.08, 0]),
    part(ball(0.07, 10, 8), '#ff5d6c', [0, 1.18, 0]),
    part(ball(0.1, 10, 8), INK, [-0.12, 0.07, 0], [0, 0, 0], [1, 0.7, 1.3]), part(ball(0.1, 10, 8), INK, [0.12, 0.07, 0], [0, 0, 0], [1, 0.7, 1.3]),
    part(ball(0.085, 10, 8), skin.robot, [-0.29, 0.4, 0]), part(ball(0.085, 10, 8), skin.robot, [0.29, 0.4, 0]),
  ]))

/** 그림자 몬스터: 찡그린 눈의 둥근 덩어리. 얼굴은 +z(특공대 쪽)를 본다. */
export const enemyGeometry = () => withDetail(0.55, () => merge([
    part(ball(0.5, 18, 14), '#4a2f73', [0, 0.47, 0], [0, 0, 0], [1, 0.92, 1]),
    part(ball(0.34), '#5d3c8f', [0, 0.36, 0.22], [0, 0, 0], [1, 0.8, 0.7]),
    part(pill(0.07, 0.14, 8), '#8f6bd1', [-0.25, 0.95, 0], [0, 0, 0.4]), part(pill(0.07, 0.14, 8), '#8f6bd1', [0.25, 0.95, 0], [0, 0, -0.4]),
    part(ball(0.13), '#ffffff', [-0.18, 0.6, 0.4]), part(ball(0.13), '#ffffff', [0.18, 0.6, 0.4]),
    part(ball(0.065, 8, 6), '#ff4d5e', [-0.17, 0.59, 0.51]), part(ball(0.065, 8, 6), '#ff4d5e', [0.17, 0.59, 0.51]),
    part(block(0.24, 0.07, 0.08, 0.03), '#2a1a45', [-0.2, 0.75, 0.43], [0, 0, -0.45]), part(block(0.24, 0.07, 0.08, 0.03), '#2a1a45', [0.2, 0.75, 0.43], [0, 0, 0.45]),
    part(hoop(0.09, 0.025, 12), '#2a1a45', [0, 0.33, 0.47], [0, 0, 0], [1, 0.6, 1]),
  ]))

/** 굴러가는 뿅망치 롤러: 줄무늬 띠와 말랑한 혹. */
export const hazardGeometry = (width) => withDetail(0.7, () => buildHazard(width))

function buildHazard(width) {
  const parts = [part(pill(0.5, width - 1, 16), '#ff6b6b', [0, 0, 0], [0, 0, Math.PI / 2])]
  for (const x of [-width * 0.3, 0, width * 0.3]) {
    parts.push(part(hoop(0.5, 0.07, 22), '#ffffff', [x, 0, 0], [0, Math.PI / 2, 0]))
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + x
      parts.push(part(ball(0.17, 10, 8), '#ffd447', [x + width * 0.15, Math.cos(a) * 0.5, Math.sin(a) * 0.5]))
    }
  }
  return merge(parts)
}

export const coinGeometry = () => withDetail(0.6, () => merge([
  part(hoop(0.38, 0.09, 22), '#f5a700'),
  part(tube(0.36, 0.36, 0.1, 22), '#ffd447', [0, 0, 0], [Math.PI / 2, 0, 0]),
  part(ball(0.16, 10, 8), '#fff3b0', [0, 0, 0], [0, 0, 0], [1, 1, 0.5]),
]))

export const postGeometry = () => withDetail(0.6, () => merge([
  part(pill(0.15, 3.7, 12), '#ffffff', [0, 2, 0]),
  part(hoop(0.16, 0.05, 14), '#ffd447', [0, 1.2, 0], [Math.PI / 2, 0, 0]), part(hoop(0.16, 0.05, 14), '#ffd447', [0, 2.8, 0], [Math.PI / 2, 0, 0]),
  part(ball(0.3, 14, 10), '#ffd447', [0, 4.25, 0]),
]))

const ring = (count, radius, make) => Array.from({ length: count }, (_, i) => make(Math.cos((i / count) * Math.PI * 2) * radius, Math.sin((i / count) * Math.PI * 2) * radius, i)).flat()

const BOSSES = [
  // 티라노 로봇: 통통한 몸통과 큰 머리, 짧은 팔
  () => [
    part(pill(0.6, 0.9), '#2f9a52', [-1, 1, 0]), part(pill(0.6, 0.9), '#2f9a52', [1, 1, 0]),
    part(ball(0.7), '#ffffff', [-1, 0.3, 0.35], [0, 0, 0], [1, 0.5, 1.3]), part(ball(0.7), '#ffffff', [1, 0.3, 0.35], [0, 0, 0], [1, 0.5, 1.3]),
    part(ball(1.9, 24, 18), '#45c46a', [0, 3.1, -0.2], [0.2, 0, 0], [1, 1.05, 1.15]),
    part(ball(1.35, 20, 14), '#e2f7b5', [0, 2.9, 0.95], [0, 0, 0], [0.95, 1, 0.75]),
    part(block(2.4, 1.7, 2.6, 0.75), '#45c46a', [0, 5.3, 1.5]),
    part(block(2.1, 0.6, 2.3, 0.28), '#2f9a52', [0, 4.35, 1.65]),
    ...[-0.75, -0.25, 0.25, 0.75].map((x) => part(ball(0.17), '#ffffff', [x, 4.72, 2.72], [0, 0, 0], [1, 1.3, 1])),
    part(ball(0.4), '#ffffff', [-0.72, 5.75, 2.5]), part(ball(0.4), '#ffffff', [0.72, 5.75, 2.5]),
    part(ball(0.2), '#1c1c24', [-0.7, 5.72, 2.84]), part(ball(0.2), '#1c1c24', [0.7, 5.72, 2.84]),
    part(block(0.75, 0.2, 0.2, 0.09), '#1f7a3d', [-0.74, 6.18, 2.55], [0, 0, -0.35]), part(block(0.75, 0.2, 0.2, 0.09), '#1f7a3d', [0.74, 6.18, 2.55], [0, 0, 0.35]),
    part(pill(0.22, 0.5, 10), '#2f9a52', [-1.75, 3.3, 1.3], [-0.9, 0, 0.3]), part(pill(0.22, 0.5, 10), '#2f9a52', [1.75, 3.3, 1.3], [-0.9, 0, -0.3]),
    ...[[1.3, 2.7, -1.9], [0.95, 2.4, -3], [0.6, 2.2, -3.9], [0.32, 2.1, -4.5]].map(([r, y, z]) => part(ball(r), '#45c46a', [0, y, z])),
    ...[[0.5, 5.1, -0.9], [0.55, 4.6, -1.8], [0.45, 3.7, -2.7], [0.35, 3, -3.5]].map(([r, y, z]) => part(ball(r), '#ff9a4d', [0, y, z], [0, 0, 0], [0.5, 1.2, 1])),
    part(tube(0.07, 0.07, 0.6, 8), '#9aa3b8', [0, 6.4, 1.2]), part(ball(0.22), '#ff5d6c', [0, 6.8, 1.2]),
  ],
  // 대왕 문어: 말랑한 머리와 구슬을 꿰어 만든 다리
  () => [
    part(ball(2.3, 26, 20), '#9a6bff', [0, 4.1, 0], [0, 0, 0], [1, 1.15, 1]),
    ...[[-1.3, 5.7, 1], [1.4, 5.3, 0.8], [0.2, 6.4, 0.6], [-0.5, 5.2, 1.9], [1, 6.2, -0.4]].map((p) => part(ball(0.36), '#c9b2ff', p, [0, 0, 0], [1, 1, 0.6])),
    part(ball(0.62), '#ffffff', [-0.85, 4, 1.95]), part(ball(0.62), '#ffffff', [0.85, 4, 1.95]),
    part(ball(0.32), '#1c1c24', [-0.82, 3.95, 2.45]), part(ball(0.32), '#1c1c24', [0.82, 3.95, 2.45]),
    part(ball(0.1, 8, 6), '#ffffff', [-0.72, 4.1, 2.72]), part(ball(0.1, 8, 6), '#ffffff', [0.92, 4.1, 2.72]),
    part(block(1, 0.22, 0.22, 0.1), '#5a2fc2', [-0.9, 4.85, 2.05], [0, 0, -0.3]), part(block(1, 0.22, 0.22, 0.1), '#5a2fc2', [0.9, 4.85, 2.05], [0, 0, 0.3]),
    part(hoop(0.3, 0.08, 14), '#5a2fc2', [0, 3.1, 2.15], [0.2, 0, 0], [1, 0.6, 1]),
    ...ring(8, 1, (x, z, i) => [[0.62, 1.9, 1.9], [0.52, 2.55, 1.15], [0.42, 3.05, 0.6], [0.32, 3.45, 0.3]].map(([r, reach, y], n) => part(ball(r), n === 3 ? '#ffb3e0' : i % 2 ? '#8a57f5' : '#9a6bff', [x * reach, y, z * reach]))),
  ],
  // 용암 골렘: 둥근 바윗돌을 쌓은 몸에 달아오른 속불
  () => [
    part(block(1.5, 1.9, 1.5, 0.55), '#4a3b46', [-1.05, 0.95, 0]), part(block(1.5, 1.9, 1.5, 0.55), '#4a3b46', [1.05, 0.95, 0]),
    part(block(3.8, 3, 2.6, 1.1), '#5a4954', [0, 3.3, 0]),
    part(ball(0.75), '#ffb000', [0, 3.3, 1.05], [0, 0, 0], [1, 1, 0.6]), part(hoop(0.8, 0.14, 18), '#ff7a1a', [0, 3.3, 1.2]),
    ...[[-1.1, 4, 1.22], [1, 2.6, 1.22], [-0.9, 2.5, 1.2], [1.2, 4.1, 1.15]].map((p) => part(ball(0.2), '#ff7a1a', p, [0, 0, 0], [1, 1.6, 0.5])),
    part(ball(1.3), '#4a3b46', [-2.5, 4.5, 0]), part(ball(1.3), '#4a3b46', [2.5, 4.5, 0]),
    part(pill(0.6, 1.3), '#5a4954', [-2.8, 2.8, 0.2]), part(pill(0.6, 1.3), '#5a4954', [2.8, 2.8, 0.2]),
    part(ball(0.95), '#ff7a1a', [-2.8, 1.2, 0.3]), part(ball(0.95), '#ff7a1a', [2.8, 1.2, 0.3]),
    part(block(1.9, 1.5, 1.7, 0.6), '#4a3b46', [0, 5.5, 0.1]),
    part(ball(0.28), '#ffd000', [-0.42, 5.6, 0.9], [0, 0, 0], [1.2, 0.8, 0.6]), part(ball(0.28), '#ffd000', [0.42, 5.6, 0.9], [0, 0, 0], [1.2, 0.8, 0.6]),
    part(block(0.8, 0.2, 0.2, 0.09), '#2e2630', [-0.45, 5.98, 0.9], [0, 0, -0.35]), part(block(0.8, 0.2, 0.2, 0.09), '#2e2630', [0.45, 5.98, 0.9], [0, 0, 0.35]),
    part(block(0.8, 0.16, 0.14, 0.07), '#ff7a1a', [0, 5.08, 0.93]),
    part(pill(0.22, 0.5, 10), '#ff7a1a', [-0.75, 6.5, 0], [0, 0, 0.35]), part(pill(0.22, 0.5, 10), '#ff7a1a', [0.75, 6.5, 0], [0, 0, -0.35]),
  ],
  // 우주 해적선: 둥근 접시에 유리 돔, 돔 안의 꼬마 외계인
  () => [
    part(ball(3.7, 28, 16), '#a9b6d6', [0, 3, 0], [0, 0, 0], [1, 0.3, 1]),
    part(ball(2.6, 24, 14), '#7887ad', [0, 2.5, 0], [0, 0, 0], [1, 0.32, 1]),
    part(hoop(3.55, 0.2, 32), '#ffd447', [0, 3, 0], [Math.PI / 2, 0, 0]),
    part(ball(1.7, 22, 16), '#8cecff', [0, 3.9, 0]),
    part(ball(0.72), '#8cf26b', [0, 4.25, 1.2]),
    part(ball(0.2), '#1c1c24', [-0.25, 4.38, 1.82], [0, 0, 0], [1, 1.3, 0.6]), part(ball(0.2), '#1c1c24', [0.25, 4.38, 1.82], [0, 0, 0], [1, 1.3, 0.6]),
    part(pill(0.05, 0.3, 6), '#8cf26b', [-0.3, 5, 1.2], [0, 0, 0.3]), part(pill(0.05, 0.3, 6), '#8cf26b', [0.3, 5, 1.2], [0, 0, -0.3]),
    part(ball(0.1, 8, 6), '#ffe94a', [-0.38, 5.25, 1.2]), part(ball(0.1, 8, 6), '#ffe94a', [0.38, 5.25, 1.2]),
    ...ring(10, 3.3, (x, z, i) => [part(ball(0.26), i % 2 ? '#ffe94a' : '#ff7ad9', [x, 3.25, z])]),
    part(pill(0.34, 1.2, 12), '#3a4662', [0, 2.6, 3.1], [Math.PI / 2, 0, 0]), part(hoop(0.36, 0.09, 14), '#ffd447', [0, 2.6, 3.9]),
    ...[-1.5, 0, 1.5].map((x) => part(ball(0.5), '#ff7ad9', [x, 1.7, 0], [0, 0, 0], [1, 1.4, 1])),
  ],
]

export const bossGeometry = (world) => withDetail(0.8, () => merge(BOSSES[world]()))

const PROPS = {
  tree: () => [
    part(pill(0.55, 3.6, 10), '#8a5a35', [0, 2.3, 0]),
    part(ball(2.7, 14, 10), '#35a85a', [0, 6.4, 0]), part(ball(2, 14, 10), '#4cc06c', [1.5, 7.9, 0.6]), part(ball(1.8, 14, 10), '#4cc06c', [-1.4, 7.6, -0.5]), part(ball(1.7, 14, 10), '#6fd884', [0.2, 9.1, 0.2]),
  ],
  bush: () => [part(ball(2, 14, 10), '#9aa7ad', [0, 0.8, 0], [0, 0, 0], [1.2, 0.7, 1]), part(ball(1.3, 12, 8), '#4cc06c', [1.5, 1, 0.6]), part(ball(1, 12, 8), '#6fd884', [-1.4, 0.7, -0.5]), part(ball(0.3, 8, 6), '#ff8fb8', [1.6, 2.2, 0.8]), part(ball(0.25, 8, 6), '#ffe066', [-1.2, 1.6, -0.2])],
  coral: () => [
    part(pill(0.42, 3.6, 10), '#ff86bd', [0, 2.2, 0]),
    part(pill(0.3, 2.2, 10), '#ffa869', [1.1, 4.2, 0], [0, 0, -0.75]), part(pill(0.3, 1.9, 10), '#ff86bd', [-1, 3.6, 0.3], [0.2, 0, 0.85]),
    part(ball(0.6, 12, 8), '#ffd6ea', [0, 4.6, 0]), part(ball(0.5, 12, 8), '#ffdcb8', [2.1, 5.1, 0]), part(ball(0.5, 12, 8), '#ffd6ea', [-1.9, 4.5, 0.5]),
  ],
  reef: () => [
    part(ball(2.3, 14, 10), '#5a84c2', [0, 0.6, 0], [0, 0, 0], [1.3, 0.65, 1]),
    part(pill(0.26, 3, 8), '#3ad1ae', [0.6, 2.6, 0.2], [0, 0, 0.14]), part(pill(0.24, 2.3, 8), '#6ee6c8', [-0.5, 2.2, -0.3], [0, 0, -0.18]), part(pill(0.2, 1.7, 8), '#3ad1ae', [0, 1.9, 0.8]),
    part(ball(0.45, 10, 8), '#ffd447', [-1.5, 1.3, 0.6]),
  ],
  spire: () => [part(ball(2.2, 14, 10), '#3d323d', [0, 1.6, 0], [0, 0, 0], [1, 1.1, 1]), part(ball(1.7, 14, 10), '#4a3d49', [0.2, 4.2, 0.1]), part(ball(1.2, 12, 8), '#3d323d', [-0.1, 6.3, 0]), part(ball(0.8, 12, 8), '#4a3d49', [0.1, 7.8, 0]), part(ball(0.55, 10, 8), '#ff7a1a', [-1.6, 0.5, 1])],
  volcano: () => [part(tube(2.8, 8, 8.5, 20), '#45353d', [0, 4.25, 0]), part(hoop(2.6, 0.5, 20), '#5a4650', [0, 8.5, 0], [Math.PI / 2, 0, 0]), part(ball(2.4, 16, 10), '#ff6a1a', [0, 8.3, 0], [0, 0, 0], [1, 0.35, 1])],
  asteroid: () => [part(ball(2.2, 14, 10), '#7a6ab8', [0, 0, 0], [0.4, 0.2, 0], [1, 0.85, 1.1]), part(ball(0.7, 10, 8), '#5f5099', [1, 1.3, 0.9], [0, 0, 0], [1, 0.5, 1]), part(ball(0.5, 10, 8), '#5f5099', [-1.2, 0.3, 1.5], [0, 0, 0], [1, 1, 0.5]), part(ball(1.1, 12, 8), '#9485d6', [1.9, -0.9, 0.3])],
  crystal: () => [part(ball(1.1, 12, 10), '#6ef4ff', [0, 0, 0], [0, 0, 0], [1, 2.2, 1]), part(ball(0.7, 10, 8), '#c0a0ff', [1.3, -0.9, 0.3], [0, 0, 0.3], [1, 1.9, 1]), part(hoop(1.6, 0.1, 22), '#ffffff', [0, 0, 0], [1.2, 0, 0.3])],
}

export const propGeometry = (kind) => withDetail(0.55, () => merge(PROPS[kind]()))

/** 월드별 분위기. props의 float는 우주처럼 땅 없이 떠 있는 소품이다. */
export const WORLD_LOOKS = [
  { skyTop: '#2f9bff', skyBottom: '#e6f9cf', fog: '#cdeec8', track: '#f8e9bd', line: '#e6cc86', edge: '#ff9f43', ground: '#3f9d52', groundY: -5, glow: false, hemiGround: '#6dbb63', ambient: ['#7ad36b', '#ffe066', '#ffffff'], drift: -0.7, props: [{ kind: 'tree', count: 150, min: 0.7, max: 1.6 }, { kind: 'bush', count: 90, min: 0.6, max: 1.5 }] },
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
  // 딱딱한 선 대신 둥근 발판 무늬와 부드러운 화살표
  ctx.fillStyle = look.line
  for (const [x, y] of [[52, 40], [204, 40], [52, 168], [204, 168]]) { ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill() }
  ctx.lineWidth = 15; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = look.line
  ctx.beginPath(); ctx.moveTo(98, 126); ctx.lineTo(128, 88); ctx.lineTo(158, 126); ctx.stroke()
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
