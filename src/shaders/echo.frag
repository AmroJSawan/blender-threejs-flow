// Light tail for echo.vert. In Blender: custom property  shader = "echo"  plus the number
// property  copies = 140. The Blender base colour is the colour of the light.
// Every copy adds a little light; where the ring moves slowly the copies pile up and glow.
#pragma additive
precision highp float;
varying float vEcho;
varying float vAcross;
uniform vec3 uColor;

const float TRAIL = 0.32;  // brightness of the newest echo; overlapping echoes add up to white
const float FALLOFF = 1.6; // higher = the tail fades out sooner

void main() {
  float edge = smoothstep(1.0, 0.35, abs(vAcross)); // soft line edges
  float light = vEcho == 0.0 ? 1.0 : TRAIL * pow(1.0 - vEcho, FALLOFF);
  gl_FragColor = vec4(uColor * light * edge, 1.0);
}
