// Thin persistence layer. The web prototype uses localStorage; at the Capacitor wrap
// (Phase 5) swap these for @capacitor/preferences. Everything else calls loadConfig/
// saveConfig and is unaware of the backing store.

import { defaultConfig } from './defaultConfig.js'

const KEY = 'pitchcall.config.v1'

// Merge the saved pitch catalog with the defaults: keep the user's enabled/order/custom
// pitches, but make sure newly-added default pitches (e.g. presets) also appear.
function mergePitchCatalog(saved) {
  if (!Array.isArray(saved) || saved.length === 0) return defaultConfig.pitchTypes
  const normalized = saved.map((p) => ({ ...p, enabled: p.enabled !== false }))
  const have = new Set(normalized.map((p) => p.id))
  for (const def of defaultConfig.pitchTypes) {
    if (!have.has(def.id)) normalized.push(def)
  }
  return normalized
}

export function loadConfig() {
  let parsed = null
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) parsed = JSON.parse(raw)
  } catch {
    parsed = null
  }
  const cfg = { ...defaultConfig, ...(parsed || {}) }
  cfg.pitchTypes = mergePitchCatalog(parsed?.pitchTypes)
  cfg.locations = Array.isArray(cfg.locations) && cfg.locations.length ? cfg.locations : defaultConfig.locations
  cfg.voice = { ...defaultConfig.voice, ...(cfg.voice || {}) }
  return cfg
}

export function saveConfig(config) {
  try {
    localStorage.setItem(KEY, JSON.stringify(config))
  } catch {
    // Storage unavailable (private mode / embedded context) — run in-memory.
  }
}
