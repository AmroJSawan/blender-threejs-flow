import * as THREE from 'three'
import type { Expression } from '../kit'

const RADIUS = 1.9 // of the ring
const TUBE = 0.78  // its thickness
const halo: Expression = {
  title: 'Halo',
  note: 'A ring of blue light with pale edges and a dark heart. A brighter patch travels slowly round it.',
  order: 4,
  stage: 'light',
  build() {
    const uTime = { value: 0 }
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(RADIUS, TUBE, 48, 160),
      new THREE.ShaderMaterial({
        uniforms: { uTime },
        vertexShader: /* glsl */ `
          varying vec3 vNormal;
          varying vec3 vToEye;
          varying vec2 vAt;
          void main() {
            vAt = position.xy;
            vec4 seen = modelViewMatrix * vec4(position, 1.0);
            vNormal = normalMatrix * normal;
            vToEye = -seen.xyz;
            gl_Position = projectionMatrix * seen;
          }`,
        fragmentShader: /* glsl */ `
          varying vec3 vNormal;
          varying vec3 vToEye;
          varying vec2 vAt;
          uniform float uTime;
          void main() {
            float facing = clamp(dot(normalize(vNormal), normalize(vToEye)), 0.0, 1.0);
            float edge = pow(1.0 - facing, 3.2);                                      // the ring's inner and outer outlines
            float patch_ = pow(0.5 + 0.5 * cos(atan(vAt.y, vAt.x) - uTime * 0.7), 3.0); // the travelling brighter patch
            vec3 colour = vec3(0.01, 0.1, 0.85) * (0.42 + 0.4 * patch_) + vec3(0.45, 0.76, 1.0) * (edge * 0.95 + 0.22 * patch_ * facing);
            gl_FragColor = vec4(colour, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    )
    // The light the ring throws into the dark round it.
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12),
      new THREE.ShaderMaterial({
        uniforms: {},
        vertexShader: /* glsl */ `varying vec2 vAt; void main() { vAt = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          varying vec2 vAt;
          void main() {
            float away = abs(length(vAt) - ${RADIUS.toFixed(2)}) - ${TUBE.toFixed(2)};
            gl_FragColor = vec4(vec3(0.03, 0.2, 1.0) * 0.45 * exp(-max(away, 0.0) / 0.55), 1.0);
            #include <colorspace_fragment>
          }`,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    )
    glow.position.z = -0.9
    const object = new THREE.Group().add(glow, ring)
    return {
      object,
      update(time) {
        uTime.value = time
        ring.rotation.set(0.14 * Math.sin(time * 0.5), 0.14 * Math.cos(time * 0.4), 0) // it wobbles gently, like a coin settling
      },
    }
  },
}
export default halo
