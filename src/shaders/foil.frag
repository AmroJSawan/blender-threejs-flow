// Iridescent foil / liquid chrome. In Blender: custom property  shader = "foil".
// A mirror-like metal whose colour runs through the rainbow as the surface turns away from the eye,
// like oil on water. It reflects a small studio of strip lights drawn below; the pointer moves them.
precision highp float;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
uniform float uTime;
uniform float uHover;
uniform vec2 uMouse;
uniform vec3 uColor; // Blender base colour: the metal under the rainbow

const float BANDS = 1.3;   // how many times the rainbow repeats across the surface
const float RAINBOW = 0.8; // 0 = plain chrome, 1 = pure rainbow

// Brightness of the studio in a given direction: dim sky, three tall strip lights, one lamp overhead.
float studio(vec3 dir) {
  float around = atan(dir.z, dir.x) + uMouse.x * 0.8;
  float strips = smoothstep(0.5, 0.95, sin(around * 3.0)) * smoothstep(-0.25, 0.2, dir.y + uMouse.y * 0.3) * smoothstep(0.95, 0.55, dir.y);
  return 0.45 * smoothstep(-0.5, 1.0, dir.y) + 1.25 * strips + 1.5 * smoothstep(0.86, 0.99, dir.y);
}

void main() {
  vec3 normal = normalize(vWorldNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 view = normalize(cameraPosition - vWorldPosition);
  float facing = max(dot(normal, view), 0.0);
  float light = studio(reflect(-view, normal));

  float film = (1.0 - facing) * 1.4 + dot(normal, vec3(0.37, 0.55, 0.21)) * 0.5 + uTime * 0.04 + uHover * 0.25;
  vec3 rainbow = 0.5 + 0.5 * cos(6.2831 * (film * BANDS + vec3(0.0, 0.33, 0.67)));
  vec3 color = mix(uColor, rainbow, RAINBOW) * (0.32 + light);
  color += smoothstep(1.0, 1.9, light) * 0.6; // the hottest reflections burn to white
  gl_FragColor = vec4(color, 1.0);
}
