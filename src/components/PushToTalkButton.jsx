import { useCallback, useEffect, useRef, useState } from 'react'
import { audioEngine } from '../audio/audioEngine.js'

// Hold-to-talk (ARCHITECTURE.md §6). Mic is open only while the button is physically
// held — pointerup, pointercancel, and pointerleave all stop it, so it can never be
// left open by accident.
export default function PushToTalkButton({ disabled, onBuzz }) {
  const [status, setStatus] = useState('idle') // idle | requesting | live | error
  const [error, setError] = useState(null)
  const [level, setLevel] = useState(0)
  const [diag, setDiag] = useState(null) // persistent readout of the last hold
  const heldRef = useRef(false)
  const rafRef = useRef(null)
  const peakRef = useRef(0)

  const pollLevel = useCallback(() => {
    const lvl = audioEngine.getMicLevel()
    if (lvl > peakRef.current) peakRef.current = lvl
    setLevel(lvl)
    rafRef.current = requestAnimationFrame(pollLevel)
  }, [])

  const start = useCallback(
    async (e) => {
      e.preventDefault()
      if (disabled || heldRef.current) return
      heldRef.current = true
      setError(null)
      setStatus('requesting')
      setDiag('requesting mic permission…')
      peakRef.current = 0
      try {
        await audioEngine.startTalking()
        // If the user already released during the async permission/setup, bail out.
        if (!heldRef.current) {
          audioEngine.stopTalking()
          setStatus('idle')
          return
        }
        setStatus('live')
        setDiag('mic granted — capturing (speak now)')
        rafRef.current = requestAnimationFrame(pollLevel)
        if (onBuzz) onBuzz(60)
      } catch (err) {
        heldRef.current = false
        setStatus('error')
        setDiag(`failed: ${err?.name || 'unknown error'}`)
        if (err?.name === 'NotAllowedError') {
          setError('Mic permission denied — click the mic icon in the address bar and Allow')
        } else if (err?.name === 'InsecureContextError') {
          setError('Mic needs HTTPS — works on localhost & the iOS app, not the phone http:// URL')
        } else {
          setError(`Mic error: ${err?.name || 'unknown'}`)
        }
      }
    },
    [disabled, onBuzz, pollLevel],
  )

  const stop = useCallback(() => {
    if (!heldRef.current) return
    heldRef.current = false
    audioEngine.stopTalking()
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setLevel(0)
    setStatus('idle')
    const peakPct = Math.round(peakRef.current * 100)
    setDiag(
      peakPct > 0
        ? `last hold: mic captured ✓  (peak ${peakPct}%)`
        : 'last hold: went live but peak level was 0% — mic captured no sound',
    )
  }, [])

  // Safety net: stop on unmount or if the tab is hidden mid-transmit.
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) stop()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      audioEngine.stopTalking()
    }
  }, [stop])

  const live = status === 'live'

  return (
    <div className="ptt-wrap">
      <button
        className={`ptt ${live ? 'live' : ''}`}
        disabled={disabled}
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onContextMenu={(e) => e.preventDefault()}
      >
        {status === 'requesting'
          ? '… requesting mic'
          : live
            ? '● LIVE — talking'
            : '🎙 Hold to talk'}
      </button>

      {/* Live input meter: if this bar moves when you talk, the mic IS capturing. */}
      {live && (
        <div className="ptt-meter" aria-label="mic level">
          <div className="ptt-meter-fill" style={{ width: `${Math.round(level * 100)}%` }} />
        </div>
      )}

      {error && <div className="ptt-error">{error}</div>}
      {status === 'idle' && !error && (
        <div className="ptt-hint">Hold to speak live (on a laptop you'll hear feedback)</div>
      )}
      {diag && <div className="ptt-diag">{diag}</div>}
    </div>
  )
}
