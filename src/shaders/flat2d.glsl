// Vertex shader that removes perspective from an object, so 3D shapes read as flat
// 2D drawings: parallel edges stay parallel and nothing shrinks with distance.
// Every point is projected as if it sat at the depth of the object's parent (uAnchor).
uniform vec3 uAnchor;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec3 vLocalPosition;
varying vec3 vLocalNormal;
varying vec3 vAxisFacing; // per local axis: > 0 when the +axis side faces the viewer

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vLocalPosition = position;
  vLocalNormal = normal;
  vAxisFacing = vec3(normalMatrix[0].z, normalMatrix[1].z, normalMatrix[2].z);

  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPosition = world.xyz;
  vec4 view = viewMatrix * world;
  float anchorDepth = (viewMatrix * vec4(uAnchor, 1.0)).z;

  vec4 flat2d = projectionMatrix * vec4(view.xy, anchorDepth, 1.0);
  // Keep the true depth so the object still sits correctly in front of / behind the scene.
  vec4 real = projectionMatrix * view;
  flat2d.z = real.z / real.w * flat2d.w;
  gl_Position = flat2d;
}
