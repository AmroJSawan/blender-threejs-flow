// Tinted glass. In Blender: custom property  shader = "glass".
// See-through in the middle, bright and reflective toward the edges.
#pragma transparent
precision highp float;
#include "studio.glsl"
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
uniform float uTime;
uniform float uHover;
uniform vec2 uMouse;
uniform vec3 uColor; // Blender base colour: the glass tint

void main() {
  vec3 normal = normalize(vWorldNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 view = normalize(cameraPosition - vWorldPosition);
  float facing = max(dot(normal, view), 0.0);
  float fresnel = pow(1.0 - facing, 2.0);

  // The tint shifts toward violet around the curve, like thick coloured glass.
  vec3 tint = mix(uColor, vec3(0.45, 0.15, 1.0), 0.5 + 0.5 * sin(normal.y * 3.0 + normal.x * 2.0));
  vec3 color = tint * (0.85 + 1.3 * fresnel);
  color += studio(reflect(-view, normal), uTime, uMouse) * (0.25 + 0.7 * fresnel);
  color += tint * uHover * 0.5;

  float alpha = clamp(0.8 + 0.2 * fresnel + uHover * 0.2, 0.0, 1.0);
  gl_FragColor = vec4(color, alpha);
}
