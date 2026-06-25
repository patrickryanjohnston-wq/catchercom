import { useEffect, useState } from 'react'
import { getPickableVoices, speak, callPhrase } from '../audio/speech.js'

// Settings menu: choose which pitches show on the main page, add custom pitches, and pick
// the spoken voice + speed. Changes are pushed up via onChange (App persists them).
export default function Settings({ config, onChange, onClose }) {
  const [voices, setVoices] = useState(getPickableVoices)
  const [custom, setCustom] = useState('')

  // Voices can load asynchronously; refresh the list when they arrive.
  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const update = () => setVoices(getPickableVoices())
    window.speechSynthesis.addEventListener?.('voiceschanged', update)
    update()
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', update)
  }, [])

  const enabledCount = config.pitchTypes.filter((p) => p.enabled).length

  function togglePitch(id) {
    const p = config.pitchTypes.find((x) => x.id === id)
    // Don't let them turn off the last pitch — the main page needs at least one.
    if (p.enabled && enabledCount <= 1) return
    onChange({
      ...config,
      pitchTypes: config.pitchTypes.map((x) => (x.id === id ? { ...x, enabled: !x.enabled } : x)),
    })
  }

  function addCustom() {
    const label = custom.trim()
    if (!label) return
    const id = 'c' + Math.random().toString(36).slice(2, 8)
    onChange({
      ...config,
      pitchTypes: [...config.pitchTypes, { id, label, enabled: true, custom: true }],
    })
    setCustom('')
  }

  function removePitch(id) {
    onChange({ ...config, pitchTypes: config.pitchTypes.filter((x) => x.id !== id) })
  }

  function setLocationMode(mode) {
    onChange({ ...config, locationMode: mode })
  }

  function setVoiceName(name) {
    onChange({ ...config, voice: { ...config.voice, name } })
  }

  function setRate(rate) {
    onChange({ ...config, voice: { ...config.voice, rate } })
  }

  return (
    <div className="settings">
      <header className="settings-bar">
        <h1>Settings</h1>
        <button className="done-btn" onClick={onClose}>
          Done
        </button>
      </header>

      <section className="settings-section">
        <h2>Pitches on main page</h2>
        <p className="settings-hint">{enabledCount} shown — tap to toggle.</p>
        <div className="pitch-rows">
          {config.pitchTypes.map((p) => (
            <div className="pitch-row" key={p.id}>
              <button
                className={`pitch-toggle ${p.enabled ? 'on' : ''}`}
                onClick={() => togglePitch(p.id)}
              >
                <span className="check">{p.enabled ? '✓' : ''}</span>
                {p.label}
              </button>
              {p.custom && (
                <button className="del-btn" onClick={() => removePitch(p.id)} aria-label="Delete">
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="add-custom">
          <input
            type="text"
            placeholder="Add a custom pitch…"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustom()}
            maxLength={16}
          />
          <button className="add-btn" onClick={addCustom} disabled={!custom.trim()}>
            Add
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h2>Location display</h2>
        <p className="settings-hint">How the location buttons appear on the main page.</p>
        <div className="seg">
          <button
            className={config.locationMode !== 'grid' ? 'active' : ''}
            onClick={() => setLocationMode('simple')}
          >
            In / Out / Up / Down
          </button>
          <button
            className={config.locationMode === 'grid' ? 'active' : ''}
            onClick={() => setLocationMode('grid')}
          >
            9-box zone grid
          </button>
        </div>
        {config.locationMode === 'grid' && (
          <p className="settings-hint" style={{ marginTop: '10px', marginBottom: 0 }}>
            A Righty/Lefty toggle appears on the main screen and flips inside/outside.
          </p>
        )}
      </section>

      <section className="settings-section">
        <h2>Voice</h2>
        <select
          className="voice-select"
          value={config.voice.name}
          onChange={(e) => setVoiceName(e.target.value)}
        >
          <option value="">Auto (recommended)</option>
          {voices.map((v) => (
            <option key={v.name} value={v.name}>
              {v.name} ({v.lang})
            </option>
          ))}
        </select>

        <div className="rate-row">
          <span>Speed</span>
          <input
            type="range"
            min="0.6"
            max="2"
            step="0.1"
            value={config.voice.rate}
            onChange={(e) => setRate(Number(e.target.value))}
          />
          <span className="rate-val">{config.voice.rate.toFixed(1)}×</span>
        </div>

        <button
          className="test-btn"
          onClick={() => speak(callPhrase('Fastball', 'inside'))}
        >
          🔊 Test voice
        </button>
      </section>
    </div>
  )
}
