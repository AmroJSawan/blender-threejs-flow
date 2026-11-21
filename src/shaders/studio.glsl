// A small procedural "studio" that the mirror and glass shaders reflect.
// There is no real environment map: everything you see reflected is drawn here.
vec3 studio(vec3 dir, float time, vec2 mouse) {
  // Deep blue room, brighter toward the ceiling.
  vec3 color = mix(vec3(0.0, 0.01, 0.08), vec3(0.0, 0.30, 0.95), smoothstep(-0.6, 0.9, dir.y));

  // Thin cyan light streaks that drift slowly.
  float streaks = sin(dir.y * 16.0 + sin(dir.x * 3.0 + time * 0.4) * 1.6);
  color += vec3(0.15, 0.65, 1.0) * pow(max(streaks, 0.0), 14.0) * 0.55;

  // One big soft-box light; it follows the pointer a little.
  vec3 key = normalize(vec3(0.55 + mouse.x * 0.5, 0.45 + mouse.y * 0.4, 0.75));
  float amount = max(dot(dir, key), 0.0);
  color += vec3(0.25, 0.85, 1.0) * pow(amount, 5.0) * 0.6;
  color += vec3(1.0) * smoothstep(0.80, 0.97, amount) * 1.5;
  return color;
}
