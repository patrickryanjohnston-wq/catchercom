// Local data model (ARCHITECTURE.md §9). No DB — this is the default config a coach can
// edit in-app (Settings menu). `pitchTypes` is the full CATALOG; `enabled` controls whether
// a pitch shows on the main page, so the coach picks exactly which/how many appear.

export const defaultConfig = {
  pitchTypes: [
    { id: 'fb', label: 'Fastball', enabled: true },
    { id: 'cb', label: 'Curveball', enabled: true },
    { id: 'ch', label: 'Changeup', enabled: true },
    { id: 'sl', label: 'Slider', enabled: true },
    { id: 'sp', label: 'Splitter', enabled: false },
    { id: 'ct', label: 'Cutter', enabled: false },
    { id: 'kn', label: 'Knuckleball', enabled: false },
  ],
  locations: [
    { id: 'in', label: 'Inside' },
    { id: 'out', label: 'Outside' },
    { id: 'up', label: 'Up' },
    { id: 'down', label: 'Down' },
  ],
  // "simple" = the In/Out/Up/Down list above; "grid" = the 3x3 strike-zone grid.
  locationMode: 'simple',
  // "tts" | "compose" | "prerendered" — prototype ships on "tts".
  playbackMode: 'tts',
  // Web Speech voice settings. name "" = auto-pick a natural male voice. rate = talking speed.
  voice: { name: '', rate: 1.35 },
}
