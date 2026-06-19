// Local data model (ARCHITECTURE.md §9). No DB — this is the default config a coach
// can edit in-app. `clip` ids are reserved for Phase 4 (pre-recorded clips); the
// prototype speaks `label` via Web Speech, so clips are unused for now.

export const defaultConfig = {
  pitchTypes: [
    { id: 'fb', label: 'Fastball', clip: 'type_fb' },
    { id: 'cb', label: 'Curveball', clip: 'type_cb' },
    { id: 'ch', label: 'Changeup', clip: 'type_ch' },
    { id: 'sl', label: 'Slider', clip: 'type_sl' },
  ],
  locations: [
    { id: 'in', label: 'Inside', clip: 'loc_in' },
    { id: 'out', label: 'Outside', clip: 'loc_out' },
    { id: 'up', label: 'Up', clip: 'loc_up' },
    { id: 'down', label: 'Down', clip: 'loc_down' },
  ],
  // "tts" | "compose" | "prerendered" — prototype ships on "tts".
  playbackMode: 'tts',
}
