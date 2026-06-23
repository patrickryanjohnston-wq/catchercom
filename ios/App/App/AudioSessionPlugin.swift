// AudioSessionPlugin — native push-to-talk mic passthrough (ARCHITECTURE.md §5/§6).
//
// The web view's getUserMedia insists on the Bluetooth (HFP) mic, so we bypass it: capture
// the PHONE's built-in mic natively with AVAudioEngine and play it straight to the current
// output (the A2DP Bluetooth speaker). We control the session, so the Bluetooth link stays
// OUTPUT-ONLY high-quality A2DP (never HFP) and capture is the phone, not the speaker.
//
// SELF-HEALING: iOS stops AVAudioEngine on route changes / interruptions (very common with
// Bluetooth — the link renegotiates, a notification arrives, etc.). We observe those events
// and automatically rebuild + restart the graph so push-to-talk stays reliable.

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
    private var eqAttached = false
    private var running = false       // user is holding the talk button
    private var recovering = false    // guards against recovery feedback loops
    private var lastBoost: Float = 3.0

    override public func load() {
        NSLog("PitchCall AudioSession: plugin loaded")
        let nc = NotificationCenter.default
        nc.addObserver(self, selector: #selector(handleConfigChange(_:)),
                       name: .AVAudioEngineConfigurationChange, object: engine)
        nc.addObserver(self, selector: #selector(handleInterruption(_:)),
                       name: AVAudioSession.interruptionNotification, object: nil)
        nc.addObserver(self, selector: #selector(handleRouteChange(_:)),
                       name: AVAudioSession.routeChangeNotification, object: nil)
    }

    private func boostToDb(_ boost: Float) -> Float {
        return max(-24, min(24, 20 * log10f(max(0.01, boost))))
    }

    // MARK: - Plugin methods

    @objc func startMic(_ call: CAPPluginCall) {
        lastBoost = Float(call.getDouble("boost") ?? 3.0)
        DispatchQueue.main.async {
            do {
                try self.activateRecordSession()
                try self.startGraph()
                self.running = true
                call.resolve(self.routeInfo())
            } catch {
                NSLog("PitchCall AudioSession: startMic error \(error.localizedDescription)")
                call.reject("startMic error: \(error.localizedDescription)")
            }
        }
    }

    @objc func stopMic(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.running = false
            if self.engine.isRunning { self.engine.stop() }
            let session = AVAudioSession.sharedInstance()
            try? session.setCategory(.playback, options: [.allowBluetoothA2DP])
            try? session.setActive(true)
            call.resolve()
        }
    }

    @objc func setBoost(_ call: CAPPluginCall) {
        lastBoost = Float(call.getDouble("boost") ?? 3.0)
        DispatchQueue.main.async { self.eq.globalGain = self.boostToDb(self.lastBoost) }
        call.resolve()
    }

    @objc func setMode(_ call: CAPPluginCall) { call.resolve() } // legacy no-op

    // MARK: - Engine graph

    private func activateRecordSession() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .default,
                                options: [.allowBluetoothA2DP, .defaultToSpeaker])
        try session.setActive(true)
        if let builtIn = session.availableInputs?.first(where: { $0.portType == .builtInMic }) {
            try? session.setPreferredInput(builtIn)
        }
    }

    /// (Re)connect mic -> EQ -> output with the CURRENT input format, then start.
    private func startGraph() throws {
        if !eqAttached { engine.attach(eq); eqAttached = true }
        eq.globalGain = boostToDb(lastBoost)
        let input = engine.inputNode
        let fmt = input.inputFormat(forBus: 0)
        // A sampleRate of 0 means the route isn't ready yet — let it settle and retry.
        guard fmt.sampleRate > 0 else {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { [weak self] in
                guard let self = self, self.running else { return }
                try? self.startGraph()
            }
            return
        }
        engine.connect(input, to: eq, format: fmt)
        engine.connect(eq, to: engine.mainMixerNode, format: fmt)
        engine.prepare()
        if !engine.isRunning { try engine.start() }
    }

    /// Restart the engine after iOS halted it — only while the user is still talking, only
    /// if the engine actually stopped, and never re-touching the session here (that would
    /// fire more route/config events and loop). The `recovering` flag blocks re-entry.
    private func recover(_ reason: String) {
        guard running, !recovering, !engine.isRunning else { return }
        recovering = true
        DispatchQueue.main.async {
            defer { self.recovering = false }
            do {
                self.engine.stop()
                try self.startGraph() // reconnect with the current format + start; no session change
                NSLog("PitchCall AudioSession: recovered after \(reason)")
            } catch {
                NSLog("PitchCall AudioSession: recover(\(reason)) failed \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Self-healing observers

    @objc private func handleConfigChange(_ n: Notification) { recover("configuration change") }

    @objc private func handleInterruption(_ n: Notification) {
        guard let info = n.userInfo,
              let raw = info[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
        // An interruption deactivates our session; reactivating is a legitimate change.
        if type == .ended, running {
            try? AVAudioSession.sharedInstance().setActive(true)
            recover("interruption")
        }
    }

    @objc private func handleRouteChange(_ n: Notification) {
        guard running, !recovering else { return }
        let session = AVAudioSession.sharedInstance()
        if session.currentRoute.inputs.first?.portType != .builtInMic,
           let builtIn = session.availableInputs?.first(where: { $0.portType == .builtInMic }) {
            try? session.setPreferredInput(builtIn)
        }
        recover("route change") // no-ops unless the route change actually stopped the engine
    }

    private func routeInfo() -> [String: Any] {
        let session = AVAudioSession.sharedInstance()
        let input = session.currentRoute.inputs.first?.portName ?? "?"
        let output = session.currentRoute.outputs.first?.portName ?? "?"
        NSLog("PitchCall AudioSession route: IN=\(input) OUT=\(output)")
        return ["input": input, "output": output]
    }
}
