import * as THREE from 'three'

/**
 * Dual-quaternion skinning.
 *
 * three.js blends bone *matrices* (linear blend skinning). When a joint turns
 * a long way (arms overhead, deep hip flexion) blended matrices shrink the
 * skin toward the joint, the familiar "pinch" or "candy wrapper". Blending
 * rigid transforms as dual quaternions keeps the skin's volume instead.
 *
 * `useDQS(material)` patches a built-in material's vertex shader; `dqsVertex`
 * is the same maths on the CPU, used for grounding and floor contacts so the
 * physics match what is drawn.
 */

const GLSL_FN = /* glsl */ `
vec4 dqsQuat( mat4 bm ) {
  // bone matrices carry a uniform scale (vertex dequantisation baked into the
  // inverse bind matrices); strip it to get the pure rotation
  mat3 m = mat3( bm ) / length( bm[0].xyz );
  float r00 = m[0][0], r11 = m[1][1], r22 = m[2][2];
  float tr = r00 + r11 + r22;
  vec4 q;
  if ( tr > 0.0 ) {
    float s = sqrt( tr + 1.0 ) * 2.0;
    q = vec4( ( m[1][2] - m[2][1] ) / s, ( m[2][0] - m[0][2] ) / s, ( m[0][1] - m[1][0] ) / s, 0.25 * s );
  } else if ( r00 > r11 && r00 > r22 ) {
    float s = sqrt( 1.0 + r00 - r11 - r22 ) * 2.0;
    q = vec4( 0.25 * s, ( m[1][0] + m[0][1] ) / s, ( m[2][0] + m[0][2] ) / s, ( m[1][2] - m[2][1] ) / s );
  } else if ( r11 > r22 ) {
    float s = sqrt( 1.0 + r11 - r00 - r22 ) * 2.0;
    q = vec4( ( m[1][0] + m[0][1] ) / s, 0.25 * s, ( m[2][1] + m[1][2] ) / s, ( m[2][0] - m[0][2] ) / s );
  } else {
    float s = sqrt( 1.0 + r22 - r00 - r11 ) * 2.0;
    q = vec4( ( m[2][0] + m[0][2] ) / s, ( m[2][1] + m[1][2] ) / s, 0.25 * s, ( m[0][1] - m[1][0] ) / s );
  }
  return normalize( q );
}
vec4 dqsMul( vec4 a, vec4 b ) {
  return vec4( a.w * b.xyz + b.w * a.xyz + cross( a.xyz, b.xyz ), a.w * b.w - dot( a.xyz, b.xyz ) );
}
// Dual part for rotation q followed by translation t.
vec4 dqsDual( vec4 q, vec3 t ) { return 0.5 * dqsMul( vec4( t, 0.0 ), q ); }
vec3 dqsRotate( vec4 q, vec3 v ) { return v + 2.0 * cross( q.xyz, cross( q.xyz, v ) + q.w * v ); }
`

const SKINBASE = /* glsl */ `
#ifdef USE_SKINNING
  mat4 boneMatX = getBoneMatrix( skinIndex.x );
  mat4 boneMatY = getBoneMatrix( skinIndex.y );
  mat4 boneMatZ = getBoneMatrix( skinIndex.z );
  mat4 boneMatW = getBoneMatrix( skinIndex.w );
  vec4 dqR0 = dqsQuat( boneMatX );
  vec4 dqR1 = dqsQuat( boneMatY );
  vec4 dqR2 = dqsQuat( boneMatZ );
  vec4 dqR3 = dqsQuat( boneMatW );
  // keep every quaternion in the same hemisphere as the first
  if ( dot( dqR0, dqR1 ) < 0.0 ) dqR1 = -dqR1;
  if ( dot( dqR0, dqR2 ) < 0.0 ) dqR2 = -dqR2;
  if ( dot( dqR0, dqR3 ) < 0.0 ) dqR3 = -dqR3;
  vec4 dqReal = dqR0 * skinWeight.x + dqR1 * skinWeight.y + dqR2 * skinWeight.z + dqR3 * skinWeight.w;
  vec4 dqDual = dqsDual( dqR0, boneMatX[3].xyz ) * skinWeight.x + dqsDual( dqR1, boneMatY[3].xyz ) * skinWeight.y
    + dqsDual( dqR2, boneMatZ[3].xyz ) * skinWeight.z + dqsDual( dqR3, boneMatW[3].xyz ) * skinWeight.w;
  float dqLen = length( dqReal );
  dqReal /= dqLen;
  dqDual /= dqLen;
  // translation = 2 * dual * conj(real)
  vec3 dqT = 2.0 * dqsMul( dqDual, vec4( -dqReal.xyz, dqReal.w ) ).xyz;
#endif
`

const SKINNORMAL = /* glsl */ `
#ifdef USE_SKINNING
  objectNormal = ( bindMatrixInverse * vec4( dqsRotate( dqReal, ( bindMatrix * vec4( objectNormal, 0.0 ) ).xyz ), 0.0 ) ).xyz;
  #ifdef USE_TANGENT
    objectTangent = ( bindMatrixInverse * vec4( dqsRotate( dqReal, ( bindMatrix * vec4( objectTangent, 0.0 ) ).xyz ), 0.0 ) ).xyz;
  #endif
#endif
`

const SKINNING = /* glsl */ `
#ifdef USE_SKINNING
  vec3 dqP = ( bindMatrix * vec4( transformed, 1.0 ) ).xyz * length( boneMatX[0].xyz );
  transformed = ( bindMatrixInverse * vec4( dqsRotate( dqReal, dqP ) + dqT, 1.0 ) ).xyz;
#endif
`

export function useDQS<M extends THREE.Material>(material: M): M {
  const prev = material.onBeforeCompile
  material.onBeforeCompile = (shader, r) => {
    prev?.call(material, shader, r)
    shader.vertexShader = shader.vertexShader
      .replace('#include <skinning_pars_vertex>', '#include <skinning_pars_vertex>\n' + GLSL_FN)
      .replace('#include <skinbase_vertex>', SKINBASE)
      .replace('#include <skinnormal_vertex>', SKINNORMAL)
      .replace('#include <skinning_vertex>', SKINNING)
  }
  const key = material.customProgramCacheKey.bind(material)
  material.customProgramCacheKey = () => key() + '|dqs'
  return material
}

// ---------------------------------------------------------------- CPU side

/** Per-bone rotation + translation for the current frame. */
export interface BoneDQ {
  q: THREE.Quaternion[]
  t: THREE.Vector3[]
  /** Uniform scale per bone (identical across bones in practice). */
  s: number[]
}

const _m = new THREE.Matrix4()
const _s = new THREE.Vector3()

export function boneDQs(mesh: THREE.SkinnedMesh, out?: BoneDQ): BoneDQ {
  const { bones, boneInverses } = mesh.skeleton
  const o = out ?? { q: bones.map(() => new THREE.Quaternion()), t: bones.map(() => new THREE.Vector3()), s: bones.map(() => 1) }
  for (let i = 0; i < bones.length; i++) {
    _m.multiplyMatrices(bones[i].matrixWorld, boneInverses[i])
    _m.decompose(o.t[i], o.q[i], _s)
    o.s[i] = _s.x
  }
  return o
}

const _p = new THREE.Vector3()
const _r = new THREE.Quaternion()
const _q = new THREE.Quaternion()
const _d = new THREE.Vector4()
const _tmp = new THREE.Vector3()

/** World-space position of a vertex under dual-quaternion skinning. */
export function dqsVertex(mesh: THREE.SkinnedMesh, dq: BoneDQ, i: number, target: THREE.Vector3) {
  const g = mesh.geometry
  const si = g.attributes.skinIndex
  const sw = g.attributes.skinWeight
  _p.fromBufferAttribute(g.attributes.position, i).applyMatrix4(mesh.bindMatrix)
  _r.set(0, 0, 0, 0)
  _d.set(0, 0, 0, 0)
  let first: THREE.Quaternion | null = null
  _p.multiplyScalar(dq.s[si.getComponent(i, 0)])
  for (let k = 0; k < 4; k++) {
    const w = sw.getComponent(i, k)
    if (w === 0) continue
    const b = si.getComponent(i, k)
    _q.copy(dq.q[b])
    if (!first) first = dq.q[b]
    else if (_q.dot(first) < 0) _q.set(-_q.x, -_q.y, -_q.z, -_q.w)
    const t = dq.t[b]
    // dual = 0.5 * (t,0) * q
    const dx = 0.5 * (t.x * _q.w + t.y * _q.z - t.z * _q.y)
    const dy = 0.5 * (-t.x * _q.z + t.y * _q.w + t.z * _q.x)
    const dz = 0.5 * (t.x * _q.y - t.y * _q.x + t.z * _q.w)
    const dw = 0.5 * (-t.x * _q.x - t.y * _q.y - t.z * _q.z)
    _r.x += _q.x * w; _r.y += _q.y * w; _r.z += _q.z * w; _r.w += _q.w * w
    _d.x += dx * w; _d.y += dy * w; _d.z += dz * w; _d.w += dw * w
  }
  const len = Math.hypot(_r.x, _r.y, _r.z, _r.w) || 1
  _r.set(_r.x / len, _r.y / len, _r.z / len, _r.w / len)
  _d.multiplyScalar(1 / len)
  // translation = 2 * dual * conj(real)
  const cx = -_r.x, cy = -_r.y, cz = -_r.z, cw = _r.w
  const tx = 2 * (_d.w * cx + _d.x * cw + _d.y * cz - _d.z * cy)
  const ty = 2 * (_d.w * cy - _d.x * cz + _d.y * cw + _d.z * cx)
  const tz = 2 * (_d.w * cz + _d.x * cy - _d.y * cx + _d.z * cw)
  target.copy(_p).applyQuaternion(_r).add(_tmp.set(tx, ty, tz))
  return target.applyMatrix4(_m.copy(mesh.bindMatrixInverse).premultiply(mesh.matrixWorld))
}
