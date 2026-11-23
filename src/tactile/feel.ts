/**
 * What a finger gets back from the glass, shared by the Groove pages: sound (made on the spot, no files), vibration, and a voice.
 */
export const feedback = {
  /**
   * Vibration lengths in ms: about 10 reads as a click, 30 or more as a buzz, so a notch is short and an end stop long.
   * A phone's motor is slow to start, though, and many do not move at all for less than about 15 ms, so these are longer than the ideal.
   * Ticks closer together than `apart` ms are dropped (touch cannot tell them apart, and it turns to noise).
   */
  pulse: { land: 14, notch: 20, heavy: 30, stop: 60, turn: [22, 70, 30] },
  apart: 32,
  loud: 0.5,
}
/** Whether values are spoken. */
export const voice = { on: true }

let audio: AudioContext | undefined
let out: GainNode
let hiss: AudioBuffer
export function wake() {
  if (!audio) {
    audio = new AudioContext({ latencyHint: 'interactive' })
    out = audio.createGain()
    out.gain.value = feedback.loud
    out.connect(audio.destination)
    hiss = audio.createBuffer(1, audio.sampleRate * 0.05, audio.sampleRate)
    const samples = hiss.getChannelData(0)
    for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1
  }
  if (audio.state !== 'running') void audio.resume()
}
/** One short tone that dies away: `pitch` Hz (sliding to `to`), `lasts` seconds, `level` 0–1, starting `after` seconds from now. */
function tone(pitch: number, lasts: number, level: number, shape: OscillatorType = 'sine', to = pitch, after = 0) {
  if (!audio) return
  const start = audio.currentTime + after
  const voice = audio.createOscillator()
  const loudness = audio.createGain()
  voice.type = shape
  voice.frequency.setValueAtTime(pitch, start)
  voice.frequency.exponentialRampToValueAtTime(to, start + lasts)
  loudness.gain.setValueAtTime(level, start)
  loudness.gain.exponentialRampToValueAtTime(0.0008, start + lasts)
  voice.connect(loudness).connect(out)
  voice.start(start)
  voice.stop(start + lasts + 0.01)
}
/** The sharp front of a click: a few milliseconds of hiss, kept to the band given. */
function snap(band: number, lasts: number, level: number, kind: BiquadFilterType = 'bandpass') {
  if (!audio) return
  const source = audio.createBufferSource()
  const filter = audio.createBiquadFilter()
  const loudness = audio.createGain()
  source.buffer = hiss
  filter.type = kind
  filter.frequency.value = band
  filter.Q.value = 1.2
  loudness.gain.setValueAtTime(level, audio.currentTime)
  loudness.gain.exponentialRampToValueAtTime(0.0008, audio.currentTime + lasts)
  source.connect(filter).connect(loudness).connect(out)
  source.start()
  source.stop(audio.currentTime + lasts + 0.01)
}
/** Phones that offer no vibration to web pages but do tick when a switch is flipped: flip a hidden one. */
const flipper = document.createElement('label')
flipper.className = 'quiet'
flipper.innerHTML = '<input type="checkbox" switch />'
document.body.append(flipper)
/**
 * What the finger just met, handed to whatever can make it felt. Inside the iPhone app (ios/Groove) that is the app, which plays
 * a shaped click on the Taptic Engine; `part` is how high the value is in its range. In a browser it is a vibration of the given length.
 */
type Met = 'land' | 'notch' | 'heavy' | 'stop' | 'on' | 'off'
const app = (window as unknown as { webkit?: { messageHandlers?: { groove?: { postMessage(said: object): void } } } }).webkit?.messageHandlers?.groove
const vibrates = 'vibrate' in navigator
function buzz(kind: Met, part = 0.5) {
  if (app) return app.postMessage({ kind, part })
  const pattern = kind === 'on' || kind === 'off' ? feedback.pulse.turn : feedback.pulse[kind]
  if (vibrates) navigator.vibrate(pattern)
  else flipper.click()
}
let lastTick = 0
export const feel = {
  land() {
    tone(190, 0.04, 0.16, 'sine', 140)
    buzz('land')
  },
  /** One notch: where in the range it is (0–1) sets the pitch, so the height of the value can be heard. */
  notch(lowest: number, highest: number, part: number, heavy: boolean) {
    const now = performance.now()
    if (now - lastTick < feedback.apart) return
    lastTick = now
    snap(3200, 0.006, heavy ? 0.5 : 0.34)
    tone(lowest * (highest / lowest) ** part, heavy ? 0.05 : 0.028, heavy ? 0.3 : 0.22, heavy ? 'triangle' : 'sine')
    if (heavy) tone(150, 0.05, 0.3)
    buzz(heavy ? 'heavy' : 'notch', part)
  },
  stop() {
    snap(420, 0.03, 0.5, 'lowpass')
    tone(170, 0.06, 0.5, 'sine', 110)
    buzz('stop')
  },
  turn(on: boolean) {
    tone(on ? 520 : 780, 0.05, 0.26, 'triangle')
    tone(on ? 780 : 520, 0.07, 0.26, 'triangle', undefined, 0.075)
    buzz(on ? 'on' : 'off')
  },
}
export function say(words: string) {
  const spoken = document.querySelector('#spoken')
  if (spoken) spoken.textContent = words
  if (!voice.on || !('speechSynthesis' in window)) return
  speechSynthesis.cancel()
  const line = new SpeechSynthesisUtterance(words)
  line.rate = 1.2
  speechSynthesis.speak(line)
}
/** Whether anything here can make itself felt: the iPhone app, or a browser that vibrates. */
export const felt = Boolean(app) || vibrates
