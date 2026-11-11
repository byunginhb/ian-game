/** 숫자 특공대 이펙트: 고정 크기 풀을 재사용하는 파티클과 미사일 (프레임 중 메모리 할당 없음). */
import { BufferGeometry, BufferAttribute, Points, ShaderMaterial, Color, InstancedMesh, SphereGeometry, MeshBasicMaterial, Object3D, DynamicDrawUsage } from 'three'

const PARTICLES = 480
const MISSILES = 40
const palette = new Map()
// CSS 색 문자열 파싱은 색마다 한 번만 한다.
const colorOf = (hex) => { let color = palette.get(hex); if (!color) { color = new Color(hex); palette.set(hex, color) } return color }

export function createParticles() {
  const position = new Float32Array(PARTICLES * 3), color = new Float32Array(PARTICLES * 3)
  const size = new Float32Array(PARTICLES), alpha = new Float32Array(PARTICLES)
  const velocity = new Float32Array(PARTICLES * 3), life = new Float32Array(PARTICLES), span = new Float32Array(PARTICLES)
  const gravity = new Float32Array(PARTICLES), base = new Float32Array(PARTICLES)
  const geometry = new BufferGeometry()
  const attributes = { position: [position, 3], aColor: [color, 3], aSize: [size, 1], aAlpha: [alpha, 1] }
  for (const [name, [array, items]] of Object.entries(attributes)) {
    const attribute = new BufferAttribute(array, items)
    attribute.setUsage(DynamicDrawUsage)
    geometry.setAttribute(name, attribute)
  }
  const material = new ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uScale: { value: 600 } },
    vertexShader: 'attribute float aSize; attribute float aAlpha; attribute vec3 aColor; varying vec3 vColor; varying float vAlpha; uniform float uScale; void main(){ vColor=aColor; vAlpha=aAlpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=aSize*uScale/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'varying vec3 vColor; varying float vAlpha; void main(){ vec2 c=gl_PointCoord-0.5; float d=dot(c,c); if(d>0.25||vAlpha<=0.0) discard; gl_FragColor=vec4(vColor,vAlpha*(1.0-d*2.6)); \n#include <colorspace_fragment>\n }',
  })
  const points = new Points(geometry, material)
  points.frustumCulled = false
  let cursor = 0

  function emit(x, y, z, vx, vy, vz, hex, pointSize, seconds, pull = 0) {
    const i = cursor
    cursor = (cursor + 1) % PARTICLES
    position[i * 3] = x; position[i * 3 + 1] = y; position[i * 3 + 2] = z
    velocity[i * 3] = vx; velocity[i * 3 + 1] = vy; velocity[i * 3 + 2] = vz
    colorOf(hex).toArray(color, i * 3)
    base[i] = pointSize; life[i] = seconds; span[i] = seconds; gravity[i] = pull
  }

  return {
    points,
    emit,
    burst(x, y, z, colors, count, speed, pointSize = 0.5, seconds = 0.7, pull = 9) {
      for (let n = 0; n < count; n++) {
        const a = Math.random() * 6.283, up = Math.random() * 1.2 - 0.2, s = speed * (0.4 + Math.random() * 0.6)
        emit(x, y, z, Math.cos(a) * s, up * s, Math.sin(a) * s, colors[n % colors.length], pointSize * (0.6 + Math.random() * 0.7), seconds * (0.6 + Math.random() * 0.6), pull)
      }
    },
    update(dt) {
      for (let i = 0; i < PARTICLES; i++) {
        if (life[i] <= 0) continue
        life[i] -= dt
        if (life[i] <= 0) { alpha[i] = 0; size[i] = 0; continue }
        velocity[i * 3 + 1] -= gravity[i] * dt
        position[i * 3] += velocity[i * 3] * dt
        position[i * 3 + 1] += velocity[i * 3 + 1] * dt
        position[i * 3 + 2] += velocity[i * 3 + 2] * dt
        const k = life[i] / span[i]
        alpha[i] = Math.min(1, k * 2.2)
        size[i] = base[i] * (0.5 + k * 0.5)
      }
      for (const name of Object.keys(attributes)) geometry.attributes[name].needsUpdate = true
    },
    setScale(value) { material.uniforms.uScale.value = value },
    dispose() { geometry.dispose(); material.dispose() },
  }
}

export function createMissiles(color) {
  const geometry = new SphereGeometry(0.2, 8, 6)
  const material = new MeshBasicMaterial({ color })
  const mesh = new InstancedMesh(geometry, material, MISSILES)
  mesh.frustumCulled = false
  mesh.instanceMatrix.setUsage(DynamicDrawUsage)
  const dummy = new Object3D()
  const from = new Float32Array(MISSILES * 3), to = new Float32Array(MISSILES * 3), time = new Float32Array(MISSILES).fill(-1)
  const hide = (i) => { dummy.position.set(0, -99, 0); dummy.scale.setScalar(0); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix) }
  for (let i = 0; i < MISSILES; i++) hide(i)

  return {
    mesh,
    /** 빈 슬롯이 없으면 조용히 건너뛴다: 화면에 보이는 미사일 수의 상한이 된다. */
    fire(fx, fy, fz, tx, ty, tz) {
      const i = time.findIndex((value) => value < 0)
      if (i < 0) return
      from[i * 3] = fx; from[i * 3 + 1] = fy; from[i * 3 + 2] = fz
      to[i * 3] = tx; to[i * 3 + 1] = ty; to[i * 3 + 2] = tz
      time[i] = 0
    },
    update(dt, onHit) {
      for (let i = 0; i < MISSILES; i++) {
        if (time[i] < 0) continue
        time[i] += dt / 0.42
        const t = time[i]
        if (t >= 1) { time[i] = -1; hide(i); onHit(to[i * 3], to[i * 3 + 1], to[i * 3 + 2]); continue }
        dummy.position.set(
          from[i * 3] + (to[i * 3] - from[i * 3]) * t,
          from[i * 3 + 1] + (to[i * 3 + 1] - from[i * 3 + 1]) * t + Math.sin(t * Math.PI) * 3.2,
          from[i * 3 + 2] + (to[i * 3 + 2] - from[i * 3 + 2]) * t,
        )
        dummy.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.6)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    },
    dispose() { geometry.dispose(); material.dispose() },
  }
}
