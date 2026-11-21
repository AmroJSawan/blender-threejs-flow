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
 * With follow = false (card view) only the loops run; the page scrolls normally.
 */
export function createScroll(stage: Stage, follow = true) {
  const { pages, scrub, smooth, loopPrefix } = config.scroll
  const track = document.querySelector<HTMLElement>('#scroll')!
  if (follow) track.style.minHeight = `${pages * 100}vh`

  const scrubMixer = new THREE.AnimationMixer(stage.root)
  const loopMixer = new THREE.AnimationMixer(stage.root)
  const scrubbed: THREE.AnimationAction[] = []
  let length = 0

  for (const clip of stage.clips) {
    if (clip.name.startsWith(loopPrefix)) {
      loopMixer.clipAction(clip).play()
    } else {
      scrubbed.push(scrubMixer.clipAction(clip).play())
      length = Math.max(length, clip.duration)
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
    update(delta: number) {
      loopMixer.update(delta)
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
