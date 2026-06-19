// AudioSessionPlugin — native side of ARCHITECTURE.md §5.
//
// Keeps high-quality A2DP OUTPUT to the Bluetooth earpiece while recording from the
// PHONE mic for push-to-talk, without iOS dropping to the low-quality HFP profile.
//
// INSTALL (after `npx cap add ios`):
//   1. Drag this file into the App target in Xcode (ios/App/App/), "Copy if needed".
//   2. Nothing else to register — Capacitor auto-discovers CAPBridgedPlugin classes.
//   3. JS calls it via src/native/audioSession.js (registerPlugin('AudioSession')).

import Foundation
import Capacitor
import AVFoundation

@objc(AudioSessionPlugin)
public class AudioSessionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AudioSessionPlugin"
    public let jsName = "AudioSession"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setMode", returnType: CAPPluginReturnPromise)
    ]

    @objc func setMode(_ call: CAPPluginCall) {
        let mode = call.getString("mode") ?? "playback"
        let session = AVAudioSession.sharedInstance()
        do {
            if mode == "playAndRecord" {
                // CRITICAL: include .allowBluetoothA2DP but NOT .allowBluetooth — the
                // latter is what enables the HFP headset profile we must avoid (§5).
                try session.setCategory(
                    .playAndRecord,
                    mode: .default,
                    options: [.allowBluetoothA2DP, .defaultToSpeaker]
                )
                try session.setActive(true)
                // Force capture from the phone's own mic, not the earpiece's.
                if let builtIn = session.availableInputs?.first(where: { $0.portType == .builtInMic }) {
                    try session.setPreferredInput(builtIn)
                }
            } else {
                // Output-only, high quality, plays regardless of the silent switch.
                try session.setCategory(.playback, options: [.allowBluetoothA2DP])
                try session.setActive(true)
            }
            call.resolve(["mode": mode])
        } catch {
            call.reject("audio session error: \(error.localizedDescription)")
        }
    }
}
