// Screen keep-awake wrapper (ARCHITECTURE.md §5): stop the phone from sleeping mid-inning
// and suspending the JS context / keep-alive tone. No-op on the web prototype.

import { Capacitor } from '@capacitor/core'
import { KeepAwake } from '@capacitor-community/keep-awake'

export async function setKeepAwake(on) {
  if (!Capacitor.isNativePlatform()) return // browser: nothing to do
  try {
    if (on) await KeepAwake.keepAwake()
    else await KeepAwake.allowSleep()
  } catch {
    // plugin unavailable — non-fatal
  }
}
