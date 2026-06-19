import { useEffect, useRef, useState } from 'react'
import { loadConfig } from './config/storage.js'
import { audioEngine } from './audio/audioEngine.js'
import { speak, callPhrase } from './audio/speech.js'
import { setKeepAwake } from './native/keepAwake.js'
import PushToTalkButton from './components/PushToTalkButton.jsx'

// Light haptic on supported devices (no-op on desktop).
function buzz(ms = 30) {
  if (navigator.vibrate) navigator.vibrate(ms)
}

export default function App() {
  const [config] = useState(loadConfig)
  const [callingMode, setCallingMode] = useState(false)
  const [pendingType, setPendingType] = useState(null) // selected pitch type, awaiting location
  const [lastCall, setLastCall] = useState(null) // { type, location, phrase }
  const [flash, setFlash] = useState(false) // brief visual confirm a call fired
  const flashTimer = useRef(null)

  useEffect(() => {
    return () => {
      audioEngine.dispose()
      if (flashTimer.current) clearTimeout(flashTimer.current)
    }
  }, [])

  async function toggleCallingMode() {
    const next = !callingMode
    setCallingMode(next)
    // ensureContext runs inside a user gesture here, so audio is unlocked.
    await audioEngine.setCallingMode(next)
    setKeepAwake(next) // hold the screen on while calling (native only)
    buzz(20)
  }

  function confirmFlash() {
    setFlash(true)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(false), 250)
  }

  function fireCall(type, location) {
    const phrase = callPhrase(type.label, location?.label)
    speak(phrase)
    setLastCall({ type, location, phrase })
    setPendingType(null)
    confirmFlash()
    buzz(40)
  }

  function onPickType(type) {
    // Re-tapping the armed type cancels it.
    setPendingType((cur) => (cur?.id === type.id ? null : type))
    buzz(15)
  }

  function onPickLocation(location) {
    if (!pendingType) return
    fireCall(pendingType, location)
  }

  function repeatLast() {
    if (!lastCall) return
    speak(lastCall.phrase)
    confirmFlash()
    buzz(40)
  }

  return (
    <div className={`app ${flash ? 'flash' : ''}`}>
      <header className="topbar">
        <div className="brand">PitchCall</div>
        <button
          className={`calling-toggle ${callingMode ? 'on' : 'off'}`}
          onClick={toggleCallingMode}
        >
          <span className="dot" />
          {callingMode ? 'Calling ON' : 'Calling OFF'}
        </button>
      </header>

      {!callingMode && (
        <p className="hint">
          Turn <strong>Calling ON</strong> to hold the Bluetooth link open and unlock audio.
        </p>
      )}

      <section className="panel">
        <h2 className="panel-title">
          1 · Pitch {pendingType && <span className="armed">→ {pendingType.label}</span>}
        </h2>
        <div className="grid types">
          {config.pitchTypes.map((t) => (
            <button
              key={t.id}
              className={`cell type ${pendingType?.id === t.id ? 'armed' : ''}`}
              onClick={() => onPickType(t)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">2 · Location</h2>
        <div className="grid locations">
          {config.locations.map((l) => (
            <button
              key={l.id}
              className="cell location"
              disabled={!pendingType}
              onClick={() => onPickLocation(l)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </section>

      <section className="panel last-call">
        <button className="repeat" onClick={repeatLast} disabled={!lastCall}>
          🔁 Repeat last
        </button>
        <div className="last-call-text">
          {lastCall ? `“${lastCall.phrase}”` : 'No call yet'}
        </div>
      </section>

      <PushToTalkButton onBuzz={buzz} />
    </div>
  )
}
