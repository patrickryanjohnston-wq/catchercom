// Audio engine for PitchCall (ARCHITECTURE.md §4, §6).
//
// Responsibilities:
//   - Own a single AudioContext (created lazily on a user gesture — browsers require it).
//   - Keep-alive tone: a near-silent oscillator that holds the Bluetooth A2DP link open
//     so the first word of a call isn't clipped (§4).
//   - Push-to-talk: route the phone mic through Web Audio to the same output (§6).
//
// Spoken calls use the Web Speech API (see speech.js). That audio doesn't pass through
// this AudioContext, but it shares the OS output (the paired Bluetooth earpiece); the
// keep-alive tone is what keeps that shared link awake between calls.
//
// This module is transport-agnostic (§12): it only ever targets the OS default output.

import { setAudioSessionMode } from '../native/audioSession.js'

const KEEPALIVE_FREQ_HZ = 19000 // ~inaudible to players, keeps the codec streaming
const KEEPALIVE_GAIN = 0.0008 // ~ -62 dB: non-zero so hardware doesn't drop the link

// Live push-to-talk is quieter than the TTS calls: iOS's .playAndRecord session outputs
// lower than .playback, and raw mic level is modest. Boost the mic path to match. Bump
// this up if live voice is still too quiet; back off toward 1.0 if it distorts/clips.
const MIC_BOOST = 3.0

class AudioEngine {
  constructor() {
    this.ctx = null
    this.keepAlive = null // { osc, gain }
    this.mic = null // { stream, source }
    this.callingMode = false
    this.talking = false
  }

  /** Create/resume the AudioContext. Must be called from a user gesture. */
  async ensureContext() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext
      this.ctx = new Ctx()
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume()
    }
    return this.ctx
  }

  // ---- Keep-alive tone / calling mode (§4) -------------------------------------

  async setCallingMode(on) {
    this.callingMode = on
    if (on) {
      await this.startKeepAlive()
    } else {
      this.stopKeepAlive()
    }
    return this.callingMode
  }

  async startKeepAlive() {
    await this.ensureContext()
    if (this.keepAlive) return // already running
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = KEEPALIVE_FREQ_HZ
    gain.gain.value = KEEPALIVE_GAIN
    osc.connect(gain).connect(this.ctx.destination)
    osc.start()
    this.keepAlive = { osc, gain }
  }

  stopKeepAlive() {
    if (!this.keepAlive) return
    try {
      this.keepAlive.osc.stop()
      this.keepAlive.osc.disconnect()
      this.keepAlive.gain.disconnect()
    } catch {
      // already stopped
    }
    this.keepAlive = null
  }

  // ---- Push-to-talk mic passthrough (§6) ---------------------------------------

  async startTalking() {
    if (this.talking) return
    // getUserMedia only exists in a secure context. localhost is secure, but a phone
    // hitting the dev server over plain http://192.168.x.x is NOT — the mic is blocked
    // there. It works in the native iOS app (Phase 5) and on localhost.
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const err = new Error('insecure-context')
      err.name = 'InsecureContextError'
      throw err
    }
    // On iOS, switch to a record-capable session that KEEPS A2DP output (§5).
    await setAudioSessionMode('playAndRecord')
    await this.ensureContext()
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        noiseSuppression: true, // cut crowd/dugout noise
        autoGainControl: true,
        echoCancellation: false, // no loopback to cancel; avoids latency/artifacts
      },
      video: false,
    })
    const source = this.ctx.createMediaStreamSource(stream)

    // Boost the live voice so it's as loud as the TTS calls (see MIC_BOOST).
    const gain = this.ctx.createGain()
    gain.gain.value = MIC_BOOST
    source.connect(gain)
    gain.connect(this.ctx.destination)

    // Analyser tap (does not affect output) so the UI can show a live input level —
    // a quick way to confirm the mic is actually capturing.
    const analyser = this.ctx.createAnalyser()
    analyser.fftSize = 512
    source.connect(analyser)

    // Workaround for a long-standing Chrome/Safari bug: a getUserMedia stream routed
    // ONLY through Web Audio outputs silence. Attaching the same stream to a muted
    // <audio> element "kickstarts" the pipeline so the WebAudio path actually plays.
    const sink = new Audio()
    sink.srcObject = stream
    sink.muted = true // muted so this element itself adds no second output path
    sink.play().catch(() => {})

    this.mic = { stream, source, gain, sink, analyser, buf: new Uint8Array(analyser.fftSize) }
    this.talking = true
  }

  /** Current mic input level, 0..1 (RMS). 0 when not talking. */
  getMicLevel() {
    if (!this.mic?.analyser) return 0
    const { analyser, buf } = this.mic
    analyser.getByteTimeDomainData(buf)
    let sum = 0
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128
      sum += v * v
    }
    return Math.min(1, Math.sqrt(sum / buf.length) * 3) // scaled for visibility
  }

  stopTalking() {
    if (!this.mic) {
      this.talking = false
      return
    }
    try {
      this.mic.source.disconnect()
      if (this.mic.gain) this.mic.gain.disconnect()
      if (this.mic.sink) {
        this.mic.sink.pause()
        this.mic.sink.srcObject = null
      }
      this.mic.stream.getTracks().forEach((t) => t.stop())
    } catch {
      // already stopped
    }
    this.mic = null
    this.talking = false
    // Back to output-only A2DP now that the mic is closed (§5).
    setAudioSessionMode('playback')
  }

  /** Full teardown (e.g. on unmount). */
  dispose() {
    this.stopTalking()
    this.stopKeepAlive()
    if (this.ctx) {
      this.ctx.close().catch(() => {})
      this.ctx = null
    }
  }
}

// Single shared engine for the app.
export const audioEngine = new AudioEngine()
