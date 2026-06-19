// Web Speech playback for the prototype (ARCHITECTURE.md §7, option A).
// Phase 4 swaps this for pre-recorded / composed clips behind the same speak() call.
//
// We pick a natural male voice and speak quickly. A specific/branded voice (e.g. a
// celebrity style) can't come from the browser engine — that needs recorded or
// AI-cloned clips (Phase 4).

// Normal male voice, spoken quickly so calls land fast in the dugout.
const VOICE_SETTINGS = {
  rate: 1.35, // fast (range is 0.1–10, default 1)
  pitch: 1.0, // natural (range is 0–2, default 1)
  volume: 1.0,
}

// Natural male voices, best first. We match loosely by name across platforms.
const PREFERRED_VOICE_HINTS = [
  'Reed (English (US))', // modern, natural US male (macOS)
  'Rocko (English (US))',
  'Reed',
  'Rocko',
  'Aaron', // macOS enhanced US male (if downloaded)
  'Tom',
  'Eddy (English (US))',
  'Daniel', // British male fallback
  'Microsoft David',
  'Google US English',
]

let chosenVoice = null
let warmedUp = false

function pickVoice() {
  if (!('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null // not loaded yet

  // 1) Try our preferred deep-male names in order.
  for (const hint of PREFERRED_VOICE_HINTS) {
    const v = voices.find((vo) => vo.name.toLowerCase().includes(hint.toLowerCase()))
    if (v) return v
  }
  // 2) Otherwise any voice whose name hints "male".
  const male = voices.find((vo) => /male/i.test(vo.name))
  if (male) return male
  // 3) Fall back to the first English voice, then the first of anything.
  return voices.find((vo) => /^en/i.test(vo.lang)) || voices[0]
}

function ensureVoice() {
  if (chosenVoice) return chosenVoice
  chosenVoice = pickVoice()
  return chosenVoice
}

// Voices load asynchronously in most browsers; refresh our pick when they arrive.
if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    chosenVoice = pickVoice()
  }
}

/** Some engines clip the very first utterance of a session; speak an empty primer once. */
function warmUp() {
  if (warmedUp || !('speechSynthesis' in window)) return
  warmedUp = true
  try {
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    window.speechSynthesis.speak(u)
  } catch {
    // ignore
  }
}

/**
 * Speak a pitch call, e.g. "Fastball, inside".
 * Cancels any in-progress utterance so rapid calls don't queue up.
 */
export function speak(text) {
  if (!('speechSynthesis' in window)) {
    console.warn('speechSynthesis not supported in this browser')
    return
  }
  warmUp()
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  const v = ensureVoice()
  if (v) u.voice = v
  u.rate = VOICE_SETTINGS.rate
  u.pitch = VOICE_SETTINGS.pitch
  u.volume = VOICE_SETTINGS.volume
  window.speechSynthesis.speak(u)
}

/** Build the spoken phrase from a pitch type + optional location label. */
export function callPhrase(typeLabel, locationLabel) {
  return locationLabel ? `${typeLabel}, ${locationLabel}` : typeLabel
}
