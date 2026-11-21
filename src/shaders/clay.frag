// Matte clay: soft wrapped light, a waxy glow where light turns to shadow, and a fine grain.
// In Blender: custom property  shader = "clay"; the base colour is the clay colour.
// Optional number property  contact = 1  darkens the object near the ground it stands on
// (the height of its parent), as a soft contact shadow.
precision highp float;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
uniform vec3 uColor;
uniform vec3 uAnchor;
uniform float uContact;
uniform float uHover;
uniform vec2 uMouse;

const float GRAIN = 0.035;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec3 normal = normalize(vWorldNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 view = normalize(cameraPosition - vWorldPosition);
  vec3 key = normalize(vec3(-0.45 + uMouse.x * 0.5, 0.8, 0.55 + uMouse.y * 0.3));
  float light = 0.5 + 0.5 * dot(normal, key); // wraps all the way round: no hard shadow line

  vec3 color = mix(uColor * vec3(0.5, 0.46, 0.6), uColor * 1.04 + 0.04, smoothstep(0.1, 0.95, light));
  color += uColor * vec3(1.0, 0.45, 0.35) * smoothstep(0.25, 0.5, light) * smoothstep(0.75, 0.5, light) * 0.16;
  color += vec3(0.9, 0.95, 1.0) * 0.1 * max(normal.y, 0.0);  // cool light from the sky
  color += vec3(1.0, 0.9, 0.8) * 0.07 * max(-normal.y, 0.0); // warm light bounced off the ground
  color += pow(1.0 - max(dot(normal, view), 0.0), 3.0) * 0.14;

  color *= mix(1.0, mix(0.6, 1.0, smoothstep(0.0, 0.3, vWorldPosition.y - uAnchor.y)), uContact);
  color += (hash(gl_FragCoord.xy) - 0.5) * GRAIN + uHover * 0.05;
  gl_FragColor = vec4(color, 1.0);
}
