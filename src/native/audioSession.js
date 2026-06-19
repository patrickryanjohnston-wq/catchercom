// Native iOS audio-session control (ARCHITECTURE.md §5). This is the seam the Swift
// plugin plugs into; on the web prototype every call is a no-op.
//
// The hard requirement (§5): keep high-quality A2DP *output* to the Bluetooth earpiece
// while recording from the *phone* mic for push-to-talk — without iOS falling back to
// the low-quality HFP headset profile (which would also capture the earpiece's mic).
//
//   - 'playback'     → category .playback + .allowBluetoothA2DP (soundboard only)
//   - 'playAndRecord'→ .playAndRecord + [.allowBluetoothA2DP, .defaultToSpeaker],
//                      NO .allowBluetooth, then setPreferredInput(built-in mic)
//
// The Swift implementation lives in native-ios/AudioSessionPlugin.swift and is wired up
// after `npx cap add ios`. See native-ios/README.md.

import { Capacitor, registerPlugin } from '@capacitor/core'

const AudioSession = registerPlugin('AudioSession')

/** mode: 'playback' | 'playAndRecord' */
export async function setAudioSessionMode(mode) {
  if (!Capacitor.isNativePlatform()) return // browser: OS handles routing
  try {
    await AudioSession.setMode({ mode })
  } catch {
    // plugin not present yet (pre-wrap) — non-fatal
  }
}
