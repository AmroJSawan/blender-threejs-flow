import './icons.css'
import listed from './icons.json'

/**
 * The Icons set. Every picture is rendered in Blender (blender/make_icons.py): six icons, each in every palette, all built by
 * the same few rules. This page only shows them: one large, the set under it, and a choice of palette. What the icons and
 * palettes are comes from icons.json, which the Blender script writes.
 */
const settings = {
  folder: 'icons/',
  /** Which icon and palette the page opens on (the address can say otherwise: ?icon=wallet&palette=coral). */
  icon: 'folder',
  palette: 'cobalt',
  /** How long the large picture takes to change (ms); the same as its fade in the stylesheet. */
  change: 250,
}

type Palette = (typeof listed.palettes)[number]
const asked = new URLSearchParams(location.search)
const base = import.meta.env.BASE_URL + settings.folder
const state = {
  icon: listed.icons.find((icon) => icon.name === asked.get('icon')) ?? listed.icons.find((icon) => icon.name === settings.icon)!,
  palette: listed.palettes.find((palette) => palette.name === asked.get('palette')) ?? listed.palettes.find((palette) => palette.name === settings.palette)!,
}
const picture = (icon: string, palette: string) => `${base}${palette}/${icon}.webp`

const big = document.querySelector<HTMLImageElement>('#big')!
const set = document.querySelector('#set')!
const palettes = document.querySelector('#palettes')!
const chips = document.querySelector('#chips')!

/** Whether a colour is dark enough that the words on it should be light. */
function dark(colour: string) {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(colour.slice(at, at + 2), 16))
  return r * 0.299 + g * 0.587 + b * 0.114 < 110
}

const thumbs = listed.icons.map((icon) => {
  const button = document.createElement('button')
  button.type = 'button'
  button.setAttribute('role', 'option')
  button.setAttribute('aria-label', icon.title)
  button.innerHTML = '<img alt="" loading="lazy" />'
  button.addEventListener('click', () => {
    state.icon = icon
    show()
  })
  set.append(button)
  return button
})
const choices = listed.palettes.map((palette) => {
  const button = document.createElement('button')
  button.type = 'button'
  button.setAttribute('role', 'radio')
  button.innerHTML = `<i style="--from: ${palette.a}; --to: ${palette.b}"></i>${palette.title}`
  button.addEventListener('click', () => {
    state.palette = palette
    show()
  })
  palettes.append(button)
  return button
})

let waiting = 0
function show() {
  const { icon, palette } = state
  const page = document.body
  for (const key of ['a', 'b', 'accent'] as const) page.style.setProperty(`--${key}`, palette[key])
  page.style.setProperty('--back', palette.page) // the backdrop as rendered, so the pictures' edges fade into the page
  page.classList.toggle('dark', dark(palette.page))
  thumbs.forEach((button, index) => {
    button.querySelector('img')!.src = picture(listed.icons[index].name, palette.name)
    button.setAttribute('aria-selected', String(listed.icons[index] === icon))
  })
  choices.forEach((button, index) => button.setAttribute('aria-checked', String(listed.palettes[index] === palette)))
  chips.innerHTML = swatches(palette)
  document.querySelector('#title')!.textContent = icon.title
  document.querySelector('#about')!.textContent = icon.about
  history.replaceState(null, '', `?icon=${icon.name}&palette=${palette.name}`)
  // The large picture fades out, changes once the new one has arrived, and fades back in.
  const wanted = picture(icon.name, palette.name)
  if (!big.src) {
    big.src = wanted
    return
  }
  const turn = ++waiting
  big.classList.add('changing')
  const next = new Image()
  next.src = wanted
  Promise.all([next.decode().catch(() => {}), new Promise((done) => setTimeout(done, settings.change))]).then(() => {
    if (turn !== waiting) return
    big.src = wanted
    big.classList.remove('changing')
  })
}
function swatches(palette: Palette) {
  const made = [
    ['Gloss', `linear-gradient(135deg, ${palette.a}, ${palette.b})`],
    ['Second gloss', `linear-gradient(135deg, ${palette.c}, ${palette.d})`],
    ['Leather', `linear-gradient(135deg, ${palette.a}, ${palette.b})`],
    ['Frosted glass', palette.glass],
    ['Crystal', `linear-gradient(135deg, ${palette.b}, #ffffff)`],
    ['Foil', `linear-gradient(135deg, ${palette.d}, ${palette.accent}, ${palette.a}, ${palette.b})`],
    ['Brushed metal', 'linear-gradient(135deg, #f4f5f7, #9aa0aa)'],
    ['Chrome', 'linear-gradient(135deg, #ffffff, #8a909a, #f0f1f3)'],
    ['Gold', 'linear-gradient(135deg, #ffe08a, #e09a1a)'],
    ['Stone', '#d9dbe2'],
    ['Lit layer', `linear-gradient(135deg, ${palette.c}, ${palette.d})`],
    ['Accent', palette.accent],
    ['Backdrop', palette.page],
  ]
  return made.map(([name, fill]) => `<span><i style="--chip: ${fill}"></i>${name}</span>`).join('')
}
show()
