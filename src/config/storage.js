// Thin persistence layer. The web prototype uses localStorage; at the Capacitor wrap
// (Phase 5) swap these two functions for @capacitor/preferences so config survives in
// the embedded WebView. Everything else in the app calls loadConfig/saveConfig and is
// unaware of the backing store.

import { defaultConfig } from './defaultConfig.js'

const KEY = 'pitchcall.config.v1'

export function loadConfig() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultConfig
    const parsed = JSON.parse(raw)
    // Shallow-merge so new default fields appear for users with older saved config.
    return { ...defaultConfig, ...parsed }
  } catch {
    return defaultConfig
  }
}

export function saveConfig(config) {
  try {
    localStorage.setItem(KEY, JSON.stringify(config))
  } catch {
    // Storage unavailable (private mode / embedded context) — run in-memory.
  }
}
