// Native push-to-talk bridge (ARCHITECTURE.md §5/§6). On iOS the mic is captured natively
// (AudioSessionPlugin) so the Bluetooth link stays output-only A2DP and capture comes from
// the phone's built-in mic — the web view's getUserMedia never touches the mic. On the web
// prototype these are no-ops and the engine falls back to the Web Audio path.

import { Capacitor, registerPlugin } from '@capacitor/core'

const AudioSession = registerPlugin('AudioSession')

export function isNativeAudio() {
  return Capacitor.isNativePlatform()
}

/** Start native mic passthrough at the given boost. Resolves to {input, output} route. */
export function startNativeMic(boost) {
  return AudioSession.startMic({ boost })
}

export function stopNativeMic() {
  return AudioSession.stopMic()
}

export function setNativeBoost(boost) {
  return AudioSession.setBoost({ boost })
}
