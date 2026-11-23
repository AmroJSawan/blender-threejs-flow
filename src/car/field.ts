import * as THREE from 'three'

/**
 * The band along the bottom of the car screen: one continuous dark surface with no panels on it. Each setting shows as the
 * thing it does, reduced to light, and they run into one another with no edges between zones:
 * - temperature is a column of light that stands higher and turns from cool to warm;
 * - the fan is air: thin streams crossing the zone, more of them and faster with every notch;
 * - volume is sound: rings spreading up from the bottom edge, reaching further the louder it is;
 * - the track is a row of points, the one playing in the middle;
 * - seat heat is the element in the seat: waved lines that glow one by one.
 * What stands up is worked up and down; what runs across is worked sideways.
 *
 * `kinds` are the names the page's settings use for these.
 */
export const kinds = { column: 0, rings: 1, air: 0, points: 1, element: 2 } as const
export type Rising = 'column' | 'rings'
export type Crossing = 'air' | 'points' | 'element'

export const field = new THREE.ShaderMaterial({
  transparent: true,
  depthTest: false,
  uniforms: {
    uSize: { value: new THREE.Vector2() },
    uRatio: { value: 1 },
    uTime: { value: 0 },
    uBand: { value: new THREE.Vector2() }, // the band's top and bottom, px from the top of the screen
    uZone: { value: [0, 1, 2].map(() => new THREE.Vector4()) }, // each zone: left, right (px), how much it is switched on, how lit it is
    uUp: { value: [0, 1, 2].map(() => new THREE.Vector4()) }, // its rising setting: how full (0–1), which kind, how much it is the one being changed
    uOver: { value: [0, 1, 2].map(() => new THREE.Vector4()) }, // its crossing setting: its place, which kind, how much it is being changed, how far its air has flowed
    uFinger: { value: [0, 1].map(() => new THREE.Vector4()) }, // where a finger is (x, y), how far pressed in
    uCool: { value: new THREE.Color('#4aa8ff') },
    uMild: { value: new THREE.Color('#ffd08a') },
    uHot: { value: new THREE.Color('#ff6a45') },
    uTone: { value: new THREE.Color('#9fe8cb') },
    uAir: { value: new THREE.Color('#cfe6f5') },
  },
  vertexShader: /* glsl */ `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform vec2 uSize, uBand;
    uniform float uRatio, uTime;
    uniform vec4 uZone[3], uUp[3], uOver[3], uFinger[2];
    uniform vec3 uCool, uMild, uHot, uTone, uAir;

    float soft(float away, float wide) { return exp(-away * away / (wide * wide)); }
    vec3 warmth(float part) { return mix(mix(uCool, uMild, min(part * 2.0, 1.0)), uHot, max(part * 2.0 - 1.0, 0.0)); }

    void main() {
      vec2 p = vec2(gl_FragCoord.x, uSize.y * uRatio - gl_FragCoord.y) / uRatio;
      float tall = uBand.y - uBand.x;
      float up = (uBand.y - p.y) / tall;                     // 0 at the bottom edge … 1 at the top of the band
      vec3 light = vec3(0.0);
      for (int i = 0; i < 3; i++) {
        float wide = uZone[i].y - uZone[i].x;
        float across = (p.x - uZone[i].x) / wide;            // 0 at the zone's left … 1 at its right
        float on = uZone[i].z;
        vec3 made = vec3(0.0);

        // ---- What stands up, a third of the way across ----
        float fromUp = (across - 0.3) * wide;                // px from its middle
        float full = uUp[i].x;
        float busyUp = uUp[i].z;
        if (uUp[i].y < 0.5) {
          // A column of light: its top is where the temperature is; a faint scale runs beside it.
          float level = 0.2 + 0.62 * full;
          float body = soft(fromUp, mix(22.0, 34.0, busyUp)) * smoothstep(level + 0.03, level - 0.03, up) * smoothstep(0.03, 0.14, up);
          float top = soft(fromUp, mix(36.0, 54.0, busyUp)) * soft((up - level) * tall, 8.0);
          float halo = soft(fromUp, 110.0) * soft((up - level * 0.6) * tall, tall * 0.5) * 0.16;
          float marks = soft(fromUp - mix(46.0, 62.0, busyUp), 6.0) * pow(0.5 + 0.5 * cos(up * 6.2831853 * 14.0), 24.0) * smoothstep(0.1, 0.16, up) * smoothstep(0.86, 0.8, up);
          vec3 colour = mix(vec3(0.42), warmth(full), on);
          made += colour * (body * 0.8 + top * 1.0 + halo) + vec3(0.6) * marks * 0.4;
        } else {
          // Rings of sound spreading up from the bottom edge: they reach further the louder it is.
          float reach = length(vec2(fromUp, up * tall));
          float far = (0.22 + 0.78 * full) * tall * 0.9;
          float rings = pow(0.5 + 0.5 * cos(6.2831853 * (reach / mix(19.0, 23.0, busyUp) - uTime * 0.55 * on)), 5.0);
          float within = smoothstep(far + 12.0, far - 30.0, reach) * smoothstep(8.0, 26.0, reach) * smoothstep(0.0, 0.1, up);
          made += mix(vec3(0.4), uTone, on) * rings * within * mix(0.7, 0.95, busyUp) * (0.5 + 0.5 * full);
        }

        // ---- What runs across, over the rest of the zone ----
        float place = uOver[i].x;
        float busyOver = uOver[i].z;
        float lane = smoothstep(0.42, 0.56, across) * smoothstep(1.02, 0.9, across);
        if (uOver[i].y < 0.5) {
          // Air: streams crossing the zone. Each notch adds a stream, and they all move faster.
          for (int j = 0; j < 7; j++) {
            float there = smoothstep(float(j) - 0.2, float(j) + 0.8, place) * on;
            float row = 0.26 + 0.085 * float(j) + 0.022 * sin(across * 7.0 + float(j) * 1.9 + uOver[i].w * 1.3);
            float gusts = 0.3 + 0.7 * pow(0.5 + 0.5 * cos(6.2831853 * (across * 1.6 - uOver[i].w + float(j) * 0.37)), 2.0);
            made += uAir * soft((up - row) * tall, mix(2.0, 3.0, busyOver)) * gusts * lane * there * 0.85;
          }
          made += uAir * soft((up - 0.52) * tall, 2.0) * lane * 0.1;   // still air: one faint line, so the place is never empty
        } else if (uOver[i].y < 1.5) {
          // A row of points, one per track; the one playing is in the middle and the largest.
          for (int k = 0; k < 5; k++) {
            float away = float(k) - place;
            vec2 from = vec2((across - 0.72) * wide - away * mix(34.0, 50.0, busyOver), (up - 0.5) * tall);
            float size = mix(3.5, mix(8.0, 12.0, busyOver), soft(away, 0.6));
            made += mix(vec3(0.5), uTone, on * soft(away, 0.6)) * smoothstep(size + 1.0, size - 1.0, length(from)) * soft(away, 2.2) * 0.85;
          }
        } else {
          // The element in the seat: waved lines that glow, one more with each level.
          for (int j = 0; j < 3; j++) {
            float glow = smoothstep(float(j) - 0.2, float(j) + 0.8, place) * on;
            float row = 0.3 + 0.15 * float(j) + 0.03 * sin(across * wide / 5.2);
            made += mix(vec3(0.3), uHot, glow) * soft((up - row) * tall, mix(2.2, 3.2, busyOver)) * lane * mix(0.22, 1.0, glow);
          }
        }
        light += made * uZone[i].w;
      }
      // A finger on the glass: a little light gathers under it.
      for (int f = 0; f < 2; f++) light += vec3(0.5, 0.56, 0.6) * uFinger[f].z * soft(length(p - uFinger[f].xy), 46.0) * 0.1;
      light *= smoothstep(-0.02, 0.06, up);
      gl_FragColor = vec4(light, clamp(max(light.r, max(light.g, light.b)), 0.0, 1.0));
    }`,
})
