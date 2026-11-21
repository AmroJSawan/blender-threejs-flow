// Mirror. In Blender: custom property  shader = "mirror".
// Reflects the procedural studio in studio.glsl.
precision highp float;
#include "studio.glsl"
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
uniform float uTime;
uniform float uHover;
uniform vec2 uMouse;
uniform vec3 uColor; // Blender base colour: tints the reflection

void main() {
  vec3 normal = normalize(vWorldNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 view = normalize(cameraPosition - vWorldPosition);
  vec3 reflected = reflect(-view, normal);

  vec3 color = studio(reflected, uTime, uMouse);
  color *= mix(vec3(1.0), uColor * 2.0, 0.25);

  // Coloured edge where the mirror turns away from the eye.
  float fresnel = pow(1.0 - max(dot(normal, view), 0.0), 3.0);
  color += vec3(0.9, 0.1, 0.8) * fresnel * 0.8;
  color *= 1.0 + uHover * 0.35;
  gl_FragColor = vec4(color, 1.0);
}
