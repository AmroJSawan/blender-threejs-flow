/**
 * The lab index's viewer: pointing at a study (or tabbing to it) loads that study, live, in the
 * window on the right. The page works without this script: every study is an ordinary link.
 */
const settings = {
  /** Milliseconds the pointer must rest on a study before it loads, so sweeping across the list loads nothing. */
  rest: 180,
  /** The size a study is laid out at inside the window, before being scaled to fit (matches lab.css). */
  page: [1280, 800] as [number, number],
}

const frame = document.querySelector<HTMLElement>('#window')!
const number = document.querySelector<HTMLElement>('#viewer-no')!
const title = document.querySelector<HTMLElement>('#viewer-name')!
const openLink = document.querySelector<HTMLAnchorElement>('#viewer-open')!
const studies = [...document.querySelectorAll<HTMLAnchorElement>('[data-study]')]
const roomForViewer = matchMedia('(min-width: 1000px) and (hover: hover)')

let showing: HTMLAnchorElement | undefined
let waiting = 0
function show(study: HTMLAnchorElement) {
  if (study === showing || !roomForViewer.matches) return
  showing = study
  for (const other of studies) other.classList.toggle('shown', other === study)
  number.textContent = study.querySelector('.no')!.textContent
  title.textContent = study.querySelector('.name')!.textContent
  openLink.href = study.href
  // One study runs at a time: the last one is removed, so its drawing stops.
  frame.querySelector('iframe')?.remove()
  const page = document.createElement('iframe')
  page.title = `${title.textContent}, live preview`
  page.tabIndex = -1
  page.setAttribute('aria-hidden', 'true')
  page.addEventListener('load', () => page.classList.add('ready'))
  page.src = study.href
  frame.append(page)
  fit()
}

/** Scales the study's page to the window's width. */
function fit() {
  const page = frame.querySelector<HTMLElement>('iframe')
  if (page) page.style.transform = `scale(${frame.clientWidth / settings.page[0]})`
}
new ResizeObserver(fit).observe(frame)

for (const study of studies) {
  study.addEventListener('pointerenter', () => {
    clearTimeout(waiting)
    waiting = window.setTimeout(() => show(study), settings.rest)
  })
  study.addEventListener('pointerleave', () => clearTimeout(waiting))
  study.addEventListener('focus', () => show(study))
}
const first = studies.find((study) => study.hasAttribute('data-first')) ?? studies[0]
if (roomForViewer.matches) show(first)
roomForViewer.addEventListener('change', () => roomForViewer.matches && show(showing ?? first))
export {}
