import * as THREE from 'three'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { config, events } from './config'
import type { Stage } from './stage'

gsap.registerPlugin(ScrollTrigger)

/**
 * Blender animations → scroll.
 * Every exported action follows the scrollbar, except actions whose name starts
 * with config.scroll.loopPrefix, which simply play in a loop.
 * With follow = false (card view) the page scrolls normally: loops run as usual, and the scroll
 * animations of objects (not the camera) play back and forth by themselves.
 */
export function createScroll(stage: Stage, follow = true) {
  const { pages, scrub, smooth, loopPrefix } = config.scroll
  const track = document.querySelector<HTMLElement>('#scroll')!
  if (follow) track.style.minHeight = `${pages * 100}vh`

  const scrubMixer = new THREE.AnimationMixer(stage.root)
  const loopMixer = new THREE.AnimationMixer(stage.root)
  const scrubbed: THREE.AnimationAction[] = []
  /** Card view: scroll animations with the stretch of time in which something actually moves. */
  const replayed: { action: THREE.AnimationAction; start: number; end: number }[] = []
  let length = 0

  for (const clip of stage.clips) {
    if (clip.name.startsWith(loopPrefix)) {
      loopMixer.clipAction(clip).play()
    } else if (follow) {
      scrubbed.push(scrubMixer.clipAction(clip).play())
      length = Math.max(length, clip.duration)
    } else {
      const range = movingRange(clip, stage.root)
      if (range) replayed.push({ action: scrubMixer.clipAction(clip).play(), ...range })
    }
  }

  const state = { progress: 0 }
  if (follow) {
    gsap.to(state, {
      progress: 1,
      ease: 'none',
      scrollTrigger: { trigger: track, start: 'top top', end: 'bottom bottom', scrub },
    })
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (follow && smooth && !reduced) {
    const lenis = new Lenis()
    lenis.on('scroll', ScrollTrigger.update)
    gsap.ticker.add((time) => lenis.raf(time * 1000))
    gsap.ticker.lagSmoothing(0)
  }

  const bar = document.querySelector<HTMLElement>('#progress span')
  let last = -1

  return {
    get progress() {
      return state.progress
    },
    /** `replay` (0–1): card view only, how far through their own motion the scroll animations are. */
    update(delta: number, replay = 0) {
      loopMixer.update(delta)
      if (!follow) {
        for (const { action, start, end } of replayed) action.time = start + (end - start) * replay
        scrubMixer.update(0)
        return
      }
      if (state.progress === last) return
      last = state.progress
      const time = state.progress * length
      for (const action of scrubbed) action.time = Math.min(time, action.getClip().duration)
      scrubMixer.update(0)
      if (bar) bar.style.transform = `scaleX(${state.progress})`
      events.onScroll(state.progress)
    },
  }
}

/** The stretch of a clip in which its values change, or null for a camera move or a clip that never moves. */
function movingRange(clip: THREE.AnimationClip, root: THREE.Object3D): { start: number; end: number } | null {
  let start = Infinity
  let end = -Infinity
  for (const track of clip.tracks) {
    const node = root.getObjectByName(THREE.PropertyBinding.parseTrackName(track.name).nodeName)
    let isCamera = false
    node?.traverse((o) => (isCamera ||= o instanceof THREE.Camera))
    if (isCamera) return null
    const { times, values } = track
    const size = track.getValueSize()
    const differs = (a: number, b: number) => {
      for (let i = 0; i < size; i++) if (Math.abs(values[a * size + i] - values[b * size + i]) > 1e-5) return true
      return false
    }
    const lastKey = times.length - 1
    let first = 0
    while (first < lastKey && !differs(first + 1, 0)) first++
    let final = lastKey
    while (final > 0 && !differs(final - 1, lastKey)) final--
    if (first >= final) continue // this track never changes
    start = Math.min(start, times[first])
    end = Math.max(end, times[final])
  }
  return end > start ? { start, end } : null
}
