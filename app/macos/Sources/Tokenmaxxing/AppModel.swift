import AppKit
import Observation
import ServiceManagement

/// Owns the helper and the Keychain token. The helper syncs in the background;
/// the views only sign up and open the world.
@MainActor
@Observable
final class AppModel {
    private(set) var state: AppState?

    private let helper: HelperProcess
    private let serverURL: String
    private let defaults = UserDefaults.standard
    private static let onboardedKey = "onboarded"

    init() {
        let bundle = Bundle.main
        serverURL = bundle.object(forInfoDictionaryKey: "TMServerURL") as? String ?? "http://localhost:8787"
        let helperURL = bundle.bundleURL.appendingPathComponent("Contents/Helpers/tokenmaxxing-helper")
        let logURL = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Logs/Tokenmaxxing/helper.log")
        helper = HelperProcess(executable: helperURL, logURL: logURL)

        helper.onMessage = { [weak self] msg in self?.handle(msg) }
        helper.onStart = { [weak self] in self?.sendInit() }
        helper.start()

        NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.didWakeNotification, object: nil, queue: .main
        ) { [weak self] _ in
            Task { @MainActor in _ = try? await self?.helper.send(OutgoingCommand(cmd: "syncNow")) }
        }
    }

    // MARK: - Actions

    func signUp(name: String) async -> String? {
        await run(OutgoingCommand(cmd: "signUp", name: name))
    }

    /// Opens the world in the browser, signed in with a single-use code.
    func openWorld() async -> String? {
        do {
            let result = try await helper.send(OutgoingCommand(cmd: "openWorld"))
            if let url = result?.url.flatMap(URL.init(string:)) { NSWorkspace.shared.open(url) }
            return nil
        } catch {
            return Self.message(for: error)
        }
    }

    func quit() {
        helper.stop()
        NSApp.terminate(nil)
    }

    // MARK: - Helper plumbing

    private func sendInit() {
        Task { _ = await run(OutgoingCommand(cmd: "init", token: Keychain.load(), serverUrl: serverURL)) }
    }

    private func handle(_ msg: IncomingMessage) {
        switch msg.event {
        case "state":
            guard let next = msg.state else { return }
            // Launch at login, once, right after onboarding: the sync only runs while the app does.
            if state?.phase == .onboarding, next.phase == .ready, !defaults.bool(forKey: Self.onboardedKey) {
                defaults.set(true, forKey: Self.onboardedKey)
                try? SMAppService.mainApp.register()
            }
            state = next
        case "token":
            if let token = msg.token { Keychain.save(token) } else { Keychain.delete() }
        default:
            break
        }
    }

    private func run(_ cmd: OutgoingCommand) async -> String? {
        do {
            try await helper.send(cmd)
            return nil
        } catch {
            return Self.message(for: error)
        }
    }

    static func message(for error: Error) -> String {
        switch (error as? HelperError)?.code {
        case "name_taken": "That name is taken."
        case "invalid_name": "Use 2–32 characters: a–z, 0–9, dot, dash or underscore."
        case "rate_limited": "Too many sign-ups right now. Try again in a few minutes."
        case "offline": "Can't reach the server."
        case "helper_unavailable": "The background helper is restarting. Try again."
        default: "Something went wrong."
        }
    }
}
