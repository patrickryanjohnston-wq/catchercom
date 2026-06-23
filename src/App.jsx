import { useEffect, useRef, useState } from 'react'
import { loadConfig, saveConfig } from './config/storage.js'
import { audioEngine } from './audio/audioEngine.js'
import { speak, callPhrase } from './audio/speech.js'
import { setVoicePrefs } from './audio/speech.js'
import { setKeepAwake } from './native/keepAwake.js'
import PushToTalkButton from './components/PushToTalkButton.jsx'
import Settings from './components/Settings.jsx'

// Light haptic on supported devices (no-op on desktop).
function buzz(ms = 30) {
  if (navigator.vibrate) navigator.vibrate(ms)
}

export default function App() {
  const [config, setConfig] = useState(loadConfig)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [callingMode, setCallingMode] = useState(false)
  const [pendingType, setPendingType] = useState(null) // selected pitch type, awaiting location
  const [lastCall, setLastCall] = useState(null) // { type, location, phrase }
  const [flash, setFlash] = useState(false) // brief visual confirm a call fired
  const [micBoost, setMicBoostState] = useState(() => {
    const saved = Number(localStorage.getItem('pitchcall.micBoost'))
    return saved >= 1 && saved <= 8 ? saved : 3
  })
  const flashTimer = useRef(null)

  useEffect(() => {
    audioEngine.setMicBoost(micBoost) // apply saved talk volume on load
    setVoicePrefs(config.voice) // apply saved voice + speed
    return () => {
      audioEngine.dispose()
      if (flashTimer.current) clearTimeout(flashTimer.current)
    }
  }, [])

  // Update + persist config, and keep the speech engine in sync with the chosen voice/speed.
  function updateConfig(next) {
    setConfig(next)
    saveConfig(next)
    setVoicePrefs(next.voice)
  }

  const visiblePitches = config.pitchTypes.filter((p) => p.enabled)

  function changeMicBoost(value) {
    setMicBoostState(value)
    audioEngine.setMicBoost(value) // live, even mid-talk
    try {
      localStorage.setItem('pitchcall.micBoost', String(value))
    } catch {
      // storage unavailable — keep in memory
    }
  }

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

  if (settingsOpen) {
    return (
      <Settings
        config={config}
        onChange={updateConfig}
        onClose={() => {
          setPendingType(null) // a just-disabled pitch shouldn't stay armed
          setSettingsOpen(false)
        }}
      />
    )
  }

  return (
    <div className={`app ${flash ? 'flash' : ''}`}>
      <header className="topbar">
        <button className="menu-btn" onClick={() => setSettingsOpen(true)} aria-label="Menu">
          ⚙
        </button>
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
          {visiblePitches.map((t) => (
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

      <div className="talk-section">
        <div className="talk-volume">
          <span className="talk-volume-label">Talk volume</span>
          <button
            className="vol-btn"
            onClick={() => changeMicBoost(Math.max(1, micBoost - 0.5))}
            disabled={micBoost <= 1}
          >
            −
          </button>
          <span className="talk-volume-val">{micBoost}×</span>
          <button
            className="vol-btn"
            onClick={() => changeMicBoost(Math.min(8, micBoost + 0.5))}
            disabled={micBoost >= 8}
          >
            +
          </button>
        </div>
        <PushToTalkButton onBuzz={buzz} />
      </div>
    </div>
  )
}
