// Living orb, colour side. In Blender: add custom property  shader = "pulse"  to a mesh.
// pulse.vert (same name) moves the surface; this paints it: deep colour in the body,
// pale light on top of the ridges, a pink tint in the grooves and a soft glowing edge.
#pragma transparent // soft, see-through edge
precision highp float;
varying vec3 vNormal;
varying float vWave;   // -1…1: grooves to ridges
varying float vActive; // 0 = calm, 1 = rippling
uniform float uHover;
uniform vec3 uColor;   // the object's Blender base colour

const vec3 GLOW = vec3(0.72, 0.84, 1.0);   // pale light on ridges and around the edge
const vec3 GROOVE = vec3(0.86, 0.36, 0.92); // tint inside the grooves
const float SOFT_EDGE = 0.4;                // how far the edge fades out (0 = hard edge)

void main() {
  vec3 normal = normalize(vNormal);
  float facing = abs(normal.z);

  // Soft light from above, wrapped around so nothing goes black.
  float light = 0.5 + 0.5 * dot(normal, normalize(vec3(-0.25, 0.85, 0.45)));
  vec3 deep = uColor * vec3(0.2, 0.3, 0.85);
  vec3 color = mix(deep, uColor, smoothstep(0.1, 0.75, light));
  color = mix(color, GLOW, smoothstep(0.66, 1.0, light) * 0.6);

  // Ripples: grooves pick up the tint, ridges get a little extra light.
  float groove = smoothstep(0.1, -0.9, vWave) * vActive;
  color = mix(color, GROOVE, groove * 0.45 * smoothstep(0.25, 0.8, light));
  color += GLOW * smoothstep(0.5, 1.0, vWave) * vActive * 0.12;

  // Glowing, slightly see-through edge, like a blurred outline.
  float rim = pow(1.0 - facing, 2.2);
  color = mix(color, GLOW, rim * 0.6);
  color += uHover * 0.06;
  float alpha = smoothstep(0.0, SOFT_EDGE, facing);

  gl_FragColor = vec4(color, alpha);
}
