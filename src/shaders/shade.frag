// Soft dark ball: a pool of darkness behind glowing things, so light reads well on any background.
// In Blender: put a sphere around the object and give it  shader = "shade".
// Optional number property  shade = 0.9  (how dark the middle is).
#pragma underlay
precision highp float;
varying vec3 vNormal;
uniform float uShade;

void main() {
  float facing = abs(normalize(vNormal).z);
  gl_FragColor = vec4(vec3(0.0), (uShade > 0.0 ? uShade : 0.9) * pow(smoothstep(0.0, 1.0, facing), 1.5));
}
