// Dots. In Blender: custom property  shader = "particles"  on any mesh; its vertices become dots.
// The Blender base colour is the colour of the first shape; ARRIVED is the colour of the second.
#pragma points
precision highp float;
varying float vJourney;
varying float vShade;
uniform vec3 uColor;

const vec3 ARRIVED = vec3(1.0, 0.42, 0.72);

void main() {
  vec2 fromCentre = gl_PointCoord - 0.5;
  if (dot(fromCentre, fromCentre) > 0.25) discard; // round dot
  gl_FragColor = vec4(mix(uColor, ARRIVED, vJourney) * vShade, 1.0);
}
