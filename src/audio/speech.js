// Web Speech playback for the prototype (ARCHITECTURE.md §7, option A).
// Phase 4 swaps this for pre-recorded / composed clips behind the same speak() call.
//
// Voice + speaking rate are user-configurable (Settings menu) via setVoicePrefs(). When no
// voice is chosen, we auto-pick a natural male voice. A specific/branded voice can't come
// from the browser engine — that needs recorded/AI-cloned clips (Phase 4).

// Natural male voices to auto-pick from (best first), used when the user hasn't chosen one.
const PREFERRED_VOICE_HINTS = [
  'Reed (English (US))',
  'Rocko (English (US))',
  'Reed',
  'Rocko',
  'Aaron',
  'Tom',
  'Eddy (English (US))',
  'Daniel',
  'Microsoft David',
  'Google US English',
]

let prefs = { name: '', rate: 1.35 } // updated from config via setVoicePrefs
let warmedUp = false

/** All voices available on this device (for the Settings dropdown). */
export function getVoices() {
  if (!('speechSynthesis' in window)) return []
  return window.speechSynthesis.getVoices()
}

// iOS/macOS "novelty" voices (sound effects, not people) — hide these from the picker so
// only human-named voices remain.
const NON_PERSON_VOICES = new Set([
  'albert', 'bad news', 'good news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos',
  'jester', 'organ', 'pipe organ', 'superstar', 'trinoids', 'whisper', 'wobble', 'zarvox',
  'deranged', 'hysterical', 'pluto', 'junior', 'grandma', 'grandpa', 'princess',
])

function baseName(name) {
  return name.split('(')[0].trim().toLowerCase() // "Reed (English (US))" -> "reed"
}

/** Human-named voices only, English first, then the rest — friendlier for the picker. */
export function getPickableVoices() {
  const named = getVoices().filter((v) => !NON_PERSON_VOICES.has(baseName(v.name)))
  const en = named.filter((v) => /^en/i.test(v.lang))
  const rest = named.filter((v) => !/^en/i.test(v.lang))
  return [...en, ...rest]
}

export function setVoicePrefs(next) {
  prefs = { ...prefs, ...(next || {}) }
}

function resolveVoice() {
  const voices = getVoices()
  if (!voices.length) return null
  // 1) the user's explicit choice
  if (prefs.name) {
    const chosen = voices.find((v) => v.name === prefs.name)
    if (chosen) return chosen
  }
  // 2) auto-pick a preferred natural male voice
  for (const hint of PREFERRED_VOICE_HINTS) {
    const v = voices.find((vo) => vo.name.toLowerCase().includes(hint.toLowerCase()))
    if (v) return v
  }
  // 3) fall back to any English voice, then anything
  return voices.find((vo) => /^en/i.test(vo.lang)) || voices[0]
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
  const v = resolveVoice()
  if (v) u.voice = v
  u.rate = prefs.rate || 1
  u.pitch = 1.0
  u.volume = 1.0
  window.speechSynthesis.speak(u)
}

/** Build the spoken phrase from a pitch type + optional location label. */
export function callPhrase(typeLabel, locationLabel) {
  return locationLabel ? `${typeLabel}, ${locationLabel}` : typeLabel
}
