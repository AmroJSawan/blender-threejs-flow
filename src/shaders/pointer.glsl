// Where a point on screen is relative to the pointer (or the finger, in the card view).
// The result is measured in picture heights: length() < 0.3 means "within 30% of the picture's height".
uniform vec2 uPointer;    // -1…1 across the picture; far outside when there is no pointer
uniform vec2 uResolution; // picture size in CSS pixels
vec2 fromPointer(vec4 clip) {
  return (clip.xy / clip.w - uPointer) * vec2(uResolution.x / uResolution.y, 1.0) * 0.5;
}
