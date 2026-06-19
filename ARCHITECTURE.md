# PitchCall — v1 Architecture Spec (Direct Bluetooth, Local-Only)

> This is the authoritative v1 build brief. It is intentionally opinionated about what
> to build and, just as importantly, what NOT to build in v1.

## 1. Goal

One coach holds a phone in the dugout. The catcher wears a single Bluetooth earpiece
under the helmet. Coach taps a pitch type + location on the phone; the catcher hears
it spoken in the earpiece (e.g. "fastball, inside"). The coach can also hold a
push-to-talk button to speak to the catcher live through the same earpiece. The earpiece
is listen-only — the catcher never talks back. Little League, dugout is close to the
plate, so we are testing direct phone-to-earpiece Bluetooth range.

## 2. The one architectural insight that drives everything

**The app does not manage the Bluetooth connection.** Standard Bluetooth audio
(A2DP / HFP) is paired and routed by the operating system. The earpiece is paired once
in iOS Settings and becomes the system audio output. The app's only job is to *play the
correct audio at the correct moment*; the OS delivers it to the earpiece.

Consequences:
- No Web Bluetooth, no BLE/GATT code, no pairing UI inside the app.
- No backend, no Supabase, no network, no second phone. v1 is 100% local/offline —
  including live voice, which is just the phone mic routed locally to the Bluetooth output.
- The app is an audio soundboard plus a live mic-passthrough channel; both feed the same
  OS audio output.

If you start reaching for `navigator.bluetooth` or a backend, you have misunderstood the
spec. Stop and re-read this section.

## 3. Tech stack

- React + Vite (matches the existing PeerScout stack).
- Capacitor for the iOS wrapper (Greenlearner LLC Apple Developer account).
- Web Audio API for playback and for the keep-alive tone; `getUserMedia` (phone mic) →
  Web Audio for live push-to-talk passthrough.
- Audio source: see Section 7. Dev/prototype uses Web Speech (`speechSynthesis`);
  field version uses pre-recorded clips.
- No state backend. All config is a local JSON object / file in the app.

## 4. CRITICAL requirement — Bluetooth idle keep-alive

Bluetooth audio output sleeps after a second or two of silence to save power. The next
sound has to wake the link, which clips or delays the first ~1–2 seconds of audio. For
intermittent pitch calls this means the first word ("FAST-ball") routinely gets eaten.

**Fix:** while the app is in "calling mode," continuously play an inaudible keep-alive
tone through the same audio graph to hold the Bluetooth link open.

Implementation notes:
- Use Web Audio: an `OscillatorNode` (or a looping near-silent buffer) into a `GainNode`
  set to a very low but non-zero level (roughly 0.0005–0.001, i.e. about -60 dB), not
  pure digital silence. Some hardware drops the link on true silence; a near-silent
  tone is more reliable.
- A frequency around 1 Hz or ~19–20 kHz is effectively inaudible to players but keeps
  the codec streaming.
- Start the tone when the coach enters calling mode; stop it when leaving (battery).
- Pitch-call clips play into the same destination / over the same session so they ride
  the already-open link with no wake-up delay.

This must be built and verified early. Test first-call latency with the tone on vs off.

## 5. iOS audio session (Capacitor layer) — the trickiest part

Two requirements pull in opposite directions: we want **A2DP output** (good quality,
output-only) for clips AND we want to **record the phone mic** for push-to-talk. The
danger is that asking for mic input naively makes iOS switch to the **HFP headset
profile**, which (a) drops output to low-quality mono and (b) starts capturing from the
*earpiece's* mic instead of the phone's. We must prevent that.

- Soundboard-only (no mic active): category `.playback` with `.allowBluetoothA2DP`.
- Push-to-talk active: category `.playAndRecord` with options
  `[.allowBluetoothA2DP, .defaultToSpeaker]` and **do NOT include `.allowBluetooth`**
  (that flag is what enables HFP). Then explicitly `setPreferredInput(...)` to the
  built-in mic so capture comes from the phone, not the earpiece.
- Net effect: mic = phone, output = A2DP earpiece, quality stays high, and the earpiece
  has no active mic path — it is physically receive-only.
- Add `NSMicrophoneUsageDescription` to `Info.plist` (mic permission prompt).
- Enable the Background Audio capability so the app is not suspended between calls and
  the keep-alive tone survives a screen lock.
- Audio should play regardless of the physical mute/silent switch.
- Use a keep-awake plugin (e.g. `@capacitor-community/keep-awake`) so the screen does
  not sleep mid-inning and suspend the JS context.

Hardware note: pick an earpiece/speaker that advertises an **A2DP sink**. Mono "call"
earpieces that are HFP-primary may force the bad profile above. A small Bluetooth speaker
is the safest test device; confirm the real earpiece behaves before the field test.

## 6. Live push-to-talk (coach mic → catcher earpiece)

A hold-to-talk button (walkie-talkie style). While held: capture the phone mic via
`getUserMedia` and route it through Web Audio straight to the output (the A2DP earpiece).
Release: stop capture. This is one-way live monitoring — there is no return audio and no
network; it is purely local passthrough.

- `getUserMedia` constraints: `noiseSuppression: true` (cut crowd/dugout noise),
  `autoGainControl: true`, `echoCancellation: false` (no loopback to cancel; turning it
  off avoids added latency and artifacts).
- Hold-to-talk, not tap-to-toggle, so the mic can never be left open by accident.
  Show a clear "LIVE" indicator + haptic while transmitting.
- Live voice and the soundboard share one output. A held talk button takes priority and
  ducks/interrupts any clip currently playing.
- While talking, the live stream itself keeps the Bluetooth link awake, so the keep-alive
  tone is redundant during transmission (let it run; it is harmless).
- Latency: A2DP adds roughly 150–250 ms. Fine for one-way instruction; the catcher simply
  hears you a fraction of a second late. Do not chase ultra-low latency here.
- Capacitor: the WebView's `getUserMedia` works once mic permission + the `.playAndRecord`
  session from Section 5 are configured natively. A native audio plugin is only needed if
  WebView passthrough latency proves unacceptable on device (unlikely for this use).

## 7. Audio content strategy

Two options — build option A first, plan for option B for the field:

**A. TTS (prototype / dev):** generate calls on the fly with `speechSynthesis` in the
browser, or `@capacitor-community/text-to-speech` natively. Zero asset management, fast
to iterate. Good enough to validate the concept this week.

**B. Pre-recorded clips (field-ready):** consistent voice, no on-device TTS variability,
fully offline-deterministic. Two sub-approaches:
- Pre-render every combination (e.g. 6 types × 9 zones = 54 short mp3/m4a files).
  Cleanest playback, more assets.
- Compose from parts: ~6 type clips + ~9 location clips, played back-to-back. Far fewer
  files; accept a tiny inter-clip gap or add a short crossfade.

Recommendation: ship the prototype on TTS, then move to composed pre-recorded clips for
field use.

## 8. UI

- Two-step or single-grid pitch picker, designed for one-handed taps in a dugout
  (bright sun, possibly gloves): large buttons, high contrast, minimal text.
- Suggested flow: tap pitch type → tap location → call fires immediately and a brief
  visual + haptic confirms it played. A "repeat last call" button is valuable.
- Configurable label sets for pitch types and zones (a 9-box zone grid mirrors how
  catchers think; in/out/up/down is simpler for younger players — make it data-driven).
- A clear "calling mode" on/off toggle that controls the keep-alive tone and screen-wake.
- A large hold-to-talk (push-to-talk) button, visually distinct from the pitch grid and
  easy to find by feel, with a prominent "LIVE" state while held.

## 9. Local data model (JSON config, no DB)

```json
{
  "pitchTypes": [
    { "id": "fb", "label": "Fastball", "clip": "type_fb" },
    { "id": "cb", "label": "Curveball", "clip": "type_cb" },
    { "id": "ch", "label": "Changeup", "clip": "type_ch" }
  ],
  "locations": [
    { "id": "in", "label": "Inside", "clip": "loc_in" },
    { "id": "out", "label": "Outside", "clip": "loc_out" },
    { "id": "up", "label": "Up", "clip": "loc_up" },
    { "id": "down", "label": "Down", "clip": "loc_down" }
  ],
  "playbackMode": "compose"
}
```

`playbackMode` is one of `"compose" | "prerendered" | "tts"`.

Editable in-app so a coach can rename pitches without a rebuild. Persist with Capacitor
Preferences (not browser localStorage, which is unavailable in some embedded contexts).

## 10. Build phases (do in order)

1. **Browser soundboard.** React grid → speaks the call via Web Speech. Pair a Bluetooth
   earbud to the laptop/phone, confirm the OS routes the audio to it. Validates the whole
   premise in well under an hour.
2. **Keep-alive tone.** Add the near-silent tone + calling-mode toggle. Measure first-call
   latency with it on vs off. Do not skip this before any field test.
3. **Push-to-talk.** Add the hold-to-talk mic passthrough. Verify in-browser that mic
   audio reaches the paired Bluetooth output and that releasing fully stops it.
4. **Pre-recorded clips.** Swap TTS for composed clips; add repeat-last-call.
5. **Capacitor wrap.** Configure the iOS audio session (the Section 5 mic-routing config),
   mic permission, background audio + keep-awake, build to a device, run the field test.

## 11. Field-test checklist

- Range: dugout → plate, with the catcher's body between phone and earpiece (worst case).
- First-call latency: keep-alive on vs off.
- Live voice: clarity over crowd noise, perceived delay, and that the profile stayed A2DP
  (output didn't drop to muffled HFP mono when the mic engaged).
- Battery drain over a full game with the tone running.
- Volume/clarity under crowd and helmet.
- Earpiece fit and comfort under a youth catcher's mask.

## 12. Out of scope for v1 (the v2 upgrade path)

If Bluetooth range or reliability fails the field test, fall back to a networked relay:
coach phone → Supabase Realtime channel → catcher phone (in back pocket) → paired
earpiece. Same UI and audio layer; you only add the network transport and a catcher-side
listener screen. Keep the audio/UI code transport-agnostic so this swap is clean.

## 13. Open item — confirm league rules BEFORE game use

USSSA was previously confirmed, but **Little League International is a different
sanctioning body and its rules do not carry over.** Many youth rule sets restrict or ban
electronic player communication, and some require a helmet-mounted, receive-only device
rather than an in-ear earbud. Confirm with your specific league/division before using it
in a game. Practice/bullpen use is a safe place to start regardless.

On compliance, the A2DP-output-only design helps: the earpiece has no active mic path, so
it is inherently receive-only by construction. Note that *live open-mic talk* may be
treated differently from *discrete pitch signals* under some rules — worth asking about
specifically, since continuous coaching chatter is a bigger rule-change than a pitch call.
