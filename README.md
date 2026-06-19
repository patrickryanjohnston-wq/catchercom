# PitchCall

Dugout pitch-calling app. A coach taps a pitch type + location on a phone; a catcher
wearing a single Bluetooth earpiece hears it spoken (e.g. "fastball, inside"). The coach
can also hold a push-to-talk button to speak live through the same earpiece. The earpiece
is receive-only.

See **[ARCHITECTURE.md](ARCHITECTURE.md)** for the full v1 build brief and
**[CLAUDE.md](CLAUDE.md)** for the working summary.

## Run the web prototype

```bash
npm install
npm run dev
```

`vite.config.js` sets `host: true`, so the dev server also prints a Network URL you can
open from a phone on the same Wi-Fi to test real Bluetooth audio routing.

## How to use it

1. Pair a Bluetooth earbud/speaker to the device in the OS (the app does **not** manage
   Bluetooth — the OS routes audio).
2. Tap **Calling ON** — unlocks audio and starts the near-silent keep-alive tone that
   holds the Bluetooth link open so the first word of a call isn't clipped.
3. Tap a **pitch**, then a **location** — the call is spoken immediately.
4. **Repeat last** replays the previous call.
5. **Hold to talk** opens the phone mic live to the earpiece; release to stop.

## Status

Phases 1–3 of the build plan are implemented in this web prototype (soundboard,
keep-alive tone + calling mode, push-to-talk). Pre-recorded clips (Phase 4) and the
Capacitor iOS wrap (Phase 5) are not done yet. See ARCHITECTURE.md §10.
