import AVFoundation
import CoreHaptics
import SwiftUI
import WebKit

/// Groove on an iPhone: the same page as on the web (it is loaded from the site), in a thin shell that gives it
/// what a web page on an iPhone cannot have: the Taptic Engine. The page tells the app what the finger just
/// met ("notch", "stop", …) and the app plays the matching click.
let page = URL(string: "https://amrojsawan.github.io/blender-threejs-flow/tactile.html")!

/// One click: how strong (0–1) and how sharp (0 a dull thud … 1 a crisp tick), starting `at` seconds from now.
/// With `lasts` it is a short hum instead of a single tap.
struct Click {
    var at: TimeInterval = 0
    var strong: Float
    var sharp: Float
    var lasts: TimeInterval = 0
}

/// What each thing the finger meets feels like. `part` is how high the value is in its range (0–1):
/// notches get crisper toward the top, as their tick gets higher in pitch.
func clicks(for kind: String, part: Float) -> [Click] {
    switch kind {
    case "land": return [Click(strong: 0.4, sharp: 0.25)]
    case "notch": return [Click(strong: 0.65, sharp: 0.5 + 0.45 * part)]
    case "heavy": return [Click(strong: 0.9, sharp: 0.45)]
    case "stop": return [Click(strong: 1, sharp: 0.15), Click(at: 0.005, strong: 0.55, sharp: 0.1, lasts: 0.07)]
    case "on": return [Click(strong: 0.7, sharp: 0.4), Click(at: 0.075, strong: 0.9, sharp: 0.8)]
    case "off": return [Click(strong: 0.9, sharp: 0.8), Click(at: 0.075, strong: 0.6, sharp: 0.3)]
    default: return []
    }
}

final class Feel: NSObject, WKScriptMessageHandler {
    private var engine: CHHapticEngine?

    override init() {
        super.init()
        // The page's ticks and voice should be heard even with the ring switch on silent.
        try? AVAudioSession.sharedInstance().setCategory(.playback, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics, let made = try? CHHapticEngine() else { return }
        made.playsHapticsOnly = true
        made.isAutoShutdownEnabled = false // kept running, so the first notch is not late
        made.resetHandler = { [weak made] in try? made?.start() }
        try? made.start()
        engine = made
        NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak made] _ in
            try? made?.start()
        }
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let said = message.body as? [String: Any], let kind = said["kind"] as? String else { return }
        play(clicks(for: kind, part: Float((said["part"] as? Double) ?? 0.5)))
    }

    private func play(_ wanted: [Click]) {
        guard let engine, !wanted.isEmpty else {
            // An iPhone without the engine (or the simulator): the plain system tap, once.
            if let first = wanted.first { UIImpactFeedbackGenerator(style: .rigid).impactOccurred(intensity: CGFloat(first.strong)) }
            return
        }
        let events = wanted.map { click in
            let feel = [
                CHHapticEventParameter(parameterID: .hapticIntensity, value: click.strong),
                CHHapticEventParameter(parameterID: .hapticSharpness, value: click.sharp),
            ]
            return click.lasts > 0
                ? CHHapticEvent(eventType: .hapticContinuous, parameters: feel, relativeTime: click.at, duration: click.lasts)
                : CHHapticEvent(eventType: .hapticTransient, parameters: feel, relativeTime: click.at)
        }
        guard let pattern = try? CHHapticPattern(events: events, parameters: []), let player = try? engine.makePlayer(with: pattern) else { return }
        try? player.start(atTime: CHHapticTimeImmediate)
    }
}

struct Page: UIViewRepresentable {
    let feel = Feel()

    func makeUIView(context: Context) -> WKWebView {
        let setup = WKWebViewConfiguration()
        setup.userContentController.add(feel, name: "groove") // the page looks for this name
        setup.allowsInlineMediaPlayback = true
        setup.mediaTypesRequiringUserActionForPlayback = []
        let web = WKWebView(frame: .zero, configuration: setup)
        web.isOpaque = false
        web.backgroundColor = .black
        web.scrollView.isScrollEnabled = false
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.load(URLRequest(url: page))
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {}
}

@main
struct GrooveApp: App {
    var body: some Scene {
        WindowGroup {
            Page()
                .ignoresSafeArea()
                .background(.black)
                .statusBarHidden()
                .persistentSystemOverlays(.hidden)
        }
    }
}
