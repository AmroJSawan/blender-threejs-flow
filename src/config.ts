import type { Object3D } from 'three'

/**
 * THE CONTROL PANEL.
 * Everything you normally want to tweak lives in this file.
 * Per-object behaviour is set in Blender (custom properties), see README.
 */
export const config = {
  /** File exported from Blender, relative to public/. */
  model: '/scene.glb',

  look: {
    background: '#0d0f14',
    /** Name of a file in src/shaders (without .frag) drawn full-screen behind the scene, or null. */
    backgroundShader: 'backdrop' as string | null,
    /** Soft studio lighting on top of the lights exported from Blender. */
    environment: true,
    environmentIntensity: 0.35,
    exposure: 1,
    shadows: false,
    /** Cap for high-density screens. 2 is a good quality / speed balance. */
    maxPixelRatio: 2,
  },

  scroll: {
    /** Page length in screen heights. Longer = slower camera move. */
    pages: 4,
    /** Seconds the animation takes to catch up with the scrollbar. true = no lag. */
    scrub: 1 as number | boolean,
    /** Smooth wheel scrolling (Lenis). Auto-disabled for reduced-motion users. */
    smooth: true,
    /** Blender actions whose name starts with this play in a loop instead of following scroll. */
    loopPrefix: 'Loop',
  },

  mouse: {
    /** How far the camera drifts with the pointer, in scene units. 0 = off. */
    parallax: 0.15,
    /** How much the camera turns toward the pointer, in radians. 0 = off. */
    tilt: 0.02,
    /** 0–1, lower = lazier follow. */
    ease: 0.08,
  },

  hover: {
    /** Extra hoverable objects by name ("Door_*" wildcards allowed). Objects tagged in Blender need no entry. */
    names: [] as string[],
    scale: 1.08,
    glow: '#ffffff',
    glowStrength: 0.35,
    duration: 0.3,
  },
}

/**
 * YOUR HOOKS. Called by the engine; write any custom behaviour here.
 * `object.userData` holds the custom properties you set in Blender.
 */
export const events = {
  onEnter(_object: Object3D) {},
  onLeave(_object: Object3D) {},
  onClick(object: Object3D) {
    const link = object.userData.link
    if (typeof link === 'string' && link) window.open(link, '_blank', 'noopener')
  },
  /** progress goes 0 → 1 from top to bottom of the page. */
  onScroll(_progress: number) {},
}
