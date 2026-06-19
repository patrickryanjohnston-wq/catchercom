# Pitch Caller (PitchCall) — Project Context for Claude Code

## What this app is
A dugout pitch-calling app. A coach taps a pitch type + location on a phone; a catcher
wearing a single Bluetooth earpiece hears it spoken (e.g. "fastball, inside"). The coach
can also hold a push-to-talk button to speak live through the same earpiece. The earpiece
is receive-only — the catcher never talks back.

**The full v1 build brief lives in [ARCHITECTURE.md](ARCHITECTURE.md). Read it before
working on this project.** The points below are a summary, not a replacement.

## Stack
- React + Vite (web prototype first).
- Capacitor for the iOS wrapper (Greenlearner LLC Apple Developer account).
- Web Audio API for playback + the Bluetooth keep-alive tone; `getUserMedia` → Web Audio
  for live push-to-talk mic passthrough.
- No backend, no network, no DB. v1 is 100% local/offline. Config is local JSON,
  persisted with Capacitor Preferences.

## Core architectural rule (do not break)
The app does NOT manage Bluetooth. Standard A2DP audio is paired and routed by the OS;
the app only plays the right audio at the right moment. **No `navigator.bluetooth`, no
BLE/GATT, no in-app pairing UI, no backend.** If you reach for any of those, re-read
ARCHITECTURE.md §2.

## Build phases (do in order — see ARCHITECTURE.md §10)
1. Browser soundboard (React grid → Web Speech TTS).
2. Bluetooth keep-alive tone + calling-mode toggle.
3. Push-to-talk mic passthrough.
4. Pre-recorded clips + repeat-last-call.
5. Capacitor iOS wrap (audio-session config, mic permission, background audio, field test).

## Directories
- `src/config/` — `defaultConfig.js` (the §9 data model) + `storage.js` (localStorage now;
  swap for Capacitor Preferences at Phase 5).
- `src/audio/` — `audioEngine.js` (AudioContext, keep-alive tone, push-to-talk) and
  `speech.js` (Web Speech TTS; Phase 4 swaps in clips behind the same `speak()`).
- `src/components/` — UI pieces (e.g. `PushToTalkButton.jsx`).
- `src/App.jsx` — the soundboard screen; `src/styles.css` — dugout-friendly styling.

## Status
Web prototype covers Phases 1–3 (soundboard + keep-alive/calling-mode + push-to-talk) and
repeat-last-call. Run with `npm run dev` (`host:true`, reachable from a phone on same Wi-Fi).

**Phase 5 (Capacitor iOS wrap) — iOS project builds:**
- Toolchain: **Xcode 16.4** in /Applications (macOS Sequoia 15.6). System Ruby 2.6 lacks
  dev headers so `gem install cocoapods` is a dead end; **CocoaPods 1.16.2 installed via
  Homebrew** (self-contained Ruby). Homebrew at /opt/homebrew (in `~/.zprofile`).
- Capacitor 8 uses **Swift Package Manager**, not CocoaPods. `ios/` project created via
  `npx cap add ios`. Build the web app (`npm run build`) then `npx cap sync ios`.
- Native wiring DONE and **compiles clean** (`xcodebuild ... -sdk iphonesimulator` →
  BUILD SUCCEEDED):
  - `ios/App/App/AudioSessionPlugin.swift` — §5 A2DP-output + phone-mic session switching
    (exposed to JS as `AudioSession`, called from `src/native/audioSession.js`).
  - `ios/App/App/AppDelegate.swift` — base `.playback`/`.allowBluetoothA2DP` session at
    launch (plays over silent switch).
  - `ios/App/App/Info.plist` — `NSMicrophoneUsageDescription` + `UIBackgroundModes: audio`.
- Build/run helper: `eval "$(/opt/homebrew/bin/brew shellenv)"` to get `pod` on PATH.

**Next (needs the user + GUI Xcode):** in Xcode, App target → Signing & Capabilities →
select the Greenlearner LLC **Team** (fix bundle id if it collides); plug in the iPhone,
trust it + enable Developer Mode; pick the device and Run. Then verify on device:
first-call latency (keep-alive on/off), and that PTT keeps A2DP (not muffled HFP).
TODO to confirm on device: that the app-target `AudioSession` plugin is discovered by
Capacitor at runtime (JS wrapper is guarded, so a miss fails soft).

Not yet done: pre-recorded clips (Phase 4).

## Notes for Claude
- Brand new project, separate from PeerScout. Treat PeerScout-specific instructions as
  out of scope here.
- Before any real game use, league electronic-communication rules must be confirmed
  (ARCHITECTURE.md §13).
