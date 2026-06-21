// AudioSessionPlugin — native push-to-talk mic passthrough (ARCHITECTURE.md §5/§6).
//
// The web view's getUserMedia insists on the Bluetooth (HFP) mic, so we bypass it: capture
// the PHONE's built-in mic natively with AVAudioEngine and play it straight to the current
// output (the A2DP Bluetooth speaker). We control the session, so:
//   - category .playAndRecord + [.allowBluetoothA2DP, .defaultToSpeaker], NO .allowBluetooth
//     (keeps the Bluetooth link as high-quality OUTPUT-only A2DP, never HFP),
//   - setPreferredInput(built-in mic) so capture is the phone, not the speaker.
// Loudness is an AVAudioUnitEQ globalGain (dB) so the live voice matches the TTS calls.

import Foundation
import Capacitor
import AVFoundation

@objc(AudioSessionPlugin)
public class AudioSessionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AudioSessionPlugin"
    public let jsName = "AudioSession"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startMic", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopMic", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setBoost", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setMode", returnType: CAPPluginReturnPromise),
    ]

    private let engine = AVAudioEngine()
    private let eq = AVAudioUnitEQ(numberOfBands: 1)
    private var running = false

    override public func load() {
        NSLog("PitchCall AudioSession: plugin loaded")
    }

    private func boostToDb(_ boost: Float) -> Float {
        // 1x = 0 dB, 3x ≈ +9.5 dB, 6x ≈ +15.6 dB. Clamp to the EQ's range.
        return max(-24, min(24, 20 * log10f(max(0.01, boost))))
    }

    @objc func startMic(_ call: CAPPluginCall) {
        let boost = Float(call.getDouble("boost") ?? 3.0)
        DispatchQueue.main.async {
            let session = AVAudioSession.sharedInstance()
            do {
                try session.setCategory(
                    .playAndRecord, mode: .default,
                    options: [.allowBluetoothA2DP, .defaultToSpeaker]
                )
                try session.setActive(true)
                if let builtIn = session.availableInputs?.first(where: { $0.portType == .builtInMic }) {
                    try session.setPreferredInput(builtIn)
                }

                if !self.running {
                    let input = self.engine.inputNode
                    let fmt = input.inputFormat(forBus: 0)
                    self.eq.globalGain = self.boostToDb(boost)
                    self.engine.attach(self.eq)
                    self.engine.connect(input, to: self.eq, format: fmt)
                    self.engine.connect(self.eq, to: self.engine.mainMixerNode, format: fmt)
                    self.engine.prepare()
                    try self.engine.start()
                    self.running = true
                } else {
                    self.eq.globalGain = self.boostToDb(boost)
                }
                call.resolve(self.routeInfo(session))
            } catch {
                NSLog("PitchCall AudioSession: startMic error \(error.localizedDescription)")
                call.reject("startMic error: \(error.localizedDescription)")
            }
        }
    }

    @objc func stopMic(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if self.running {
                self.engine.stop()
                self.engine.disconnectNodeInput(self.engine.mainMixerNode)
                self.engine.detach(self.eq)
                self.running = false
            }
            let session = AVAudioSession.sharedInstance()
            try? session.setCategory(.playback, options: [.allowBluetoothA2DP])
            try? session.setActive(true)
            call.resolve()
        }
    }

    @objc func setBoost(_ call: CAPPluginCall) {
        let boost = Float(call.getDouble("boost") ?? 3.0)
        DispatchQueue.main.async { self.eq.globalGain = self.boostToDb(boost) }
        call.resolve()
    }

    // Kept so older JS calls don't reject; the passthrough handles the session now.
    @objc func setMode(_ call: CAPPluginCall) {
        call.resolve()
    }

    private func routeInfo(_ session: AVAudioSession) -> [String: Any] {
        let input = session.currentRoute.inputs.first?.portName ?? "?"
        let output = session.currentRoute.outputs.first?.portName ?? "?"
        NSLog("PitchCall AudioSession route: IN=\(input) OUT=\(output)")
        return ["input": input, "output": output]
    }
}
