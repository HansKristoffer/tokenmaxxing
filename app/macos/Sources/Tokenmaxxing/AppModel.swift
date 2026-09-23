import AppKit
import Observation
import ServiceManagement

/// Owns the helper, the Keychain token and the user's settings. Views render
/// `state` and call the async actions, which return a user-facing error or nil.
@MainActor
@Observable
final class AppModel {
    private(set) var state: AppState?
    var showCountInMenuBar: Bool {
        didSet { defaults.set(showCountInMenuBar, forKey: Keys.showCount) }
    }
    private(set) var launchAtLogin = SMAppService.mainApp.status == .enabled

    private let helper: HelperProcess
    private let serverURL: String
    private let defaults = UserDefaults.standard

    private enum Keys {
        static let view = "view"
        static let disabledSources = "disabledSources"
        static let showCount = "showCountInMenuBar"
        static let onboarded = "onboarded"
    }

    static let allSources = ["claude_code", "claude_cowork", "codex", "cursor_local", "github"]

    init() {
        let bundle = Bundle.main
        serverURL = bundle.object(forInfoDictionaryKey: "TMServerURL") as? String ?? "http://localhost:8787"
        let helperURL = bundle.bundleURL.appendingPathComponent("Contents/Helpers/tokenmaxxing-helper")
        let logURL = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Logs/Tokenmaxxing/helper.log")
        helper = HelperProcess(executable: helperURL, logURL: logURL)
        showCountInMenuBar = defaults.object(forKey: Keys.showCount) as? Bool ?? true

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

    func rename(to name: String) async -> String? {
        await run(OutgoingCommand(cmd: "rename", name: name))
    }

    func createGroup(name: String) async -> String? {
        await run(OutgoingCommand(cmd: "createGroup", name: name))
    }

    func joinGroup(code: String) async -> String? {
        await run(OutgoingCommand(cmd: "joinGroup", code: code))
    }

    func leaveGroup(_ id: Int) async -> String? {
        await run(OutgoingCommand(cmd: "leaveGroup", groupId: id))
    }

    func rotateCode(_ id: Int) async -> String? {
        await run(OutgoingCommand(cmd: "rotateCode", groupId: id))
    }

    func setView(_ view: ViewSettings) async {
        if let data = try? JSONEncoder().encode(view) { defaults.set(data, forKey: Keys.view) }
        _ = await run(OutgoingCommand(cmd: "setView", view: view))
    }

    func setSource(_ id: String, enabled: Bool) async {
        var disabled = Set(defaults.stringArray(forKey: Keys.disabledSources) ?? [])
        if enabled { disabled.remove(id) } else { disabled.insert(id) }
        defaults.set(Array(disabled), forKey: Keys.disabledSources)
        _ = await run(OutgoingCommand(cmd: "setSources", enabledSources: enabledSources()))
    }

    func refresh() {
        Task { _ = await run(OutgoingCommand(cmd: "refresh")) }
    }

    func syncNow() {
        Task { _ = await run(OutgoingCommand(cmd: "syncNow")) }
    }

    func openDashboard() async -> String? {
        do {
            let result = try await helper.send(OutgoingCommand(cmd: "openDashboard"))
            if let url = result?.url.flatMap(URL.init(string:)) { NSWorkspace.shared.open(url) }
            return nil
        } catch {
            return Self.message(for: error)
        }
    }

    /// Homebrew installs upgrade in place (the app quits and relaunches); others open the release page.
    func installUpdate() async -> String? {
        do {
            let result = try await helper.send(OutgoingCommand(cmd: "installUpdate"))
            if let url = result?.url.flatMap(URL.init(string:)) { NSWorkspace.shared.open(url) }
            return nil
        } catch {
            return Self.message(for: error)
        }
    }

    func copyInvite(_ group: GroupInfo) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString("Join my tokenmaxxing group: \(group.code)", forType: .string)
    }

    /// Forgets the token; the helper drops its sync offsets so the next account starts clean.
    func signOut() async {
        Keychain.delete()
        _ = await run(OutgoingCommand(cmd: "signOut"))
    }

    func setLaunchAtLogin(_ on: Bool) {
        do {
            if on { try SMAppService.mainApp.register() } else { try SMAppService.mainApp.unregister() }
        } catch {
            NSLog("launch at login: \(error)")
        }
        launchAtLogin = SMAppService.mainApp.status == .enabled
    }

    func quit() {
        helper.stop()
        NSApp.terminate(nil)
    }

    // MARK: - Helper plumbing

    private func sendInit() {
        let view = defaults.data(forKey: Keys.view).flatMap { try? JSONDecoder().decode(ViewSettings.self, from: $0) }
        let cmd = OutgoingCommand(
            cmd: "init",
            token: Keychain.load(),
            serverUrl: serverURL,
            view: view ?? .default,
            enabledSources: enabledSources()
        )
        Task { _ = await run(cmd) }
    }

    private func enabledSources() -> [String] {
        let disabled = Set(defaults.stringArray(forKey: Keys.disabledSources) ?? [])
        return Self.allSources.filter { !disabled.contains($0) }
    }

    private func handle(_ msg: IncomingMessage) {
        switch msg.event {
        case "state":
            guard let next = msg.state else { return }
            // Launch at login defaults to on, once, right after onboarding.
            if state?.phase == .onboarding, next.phase == .ready, !defaults.bool(forKey: Keys.onboarded) {
                defaults.set(true, forKey: Keys.onboarded)
                setLaunchAtLogin(true)
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
        case "invalid_body": "That doesn't look right."
        case "not_found": "No group with that code."
        case "group_full": "That group is full."
        case "too_many_groups": "You're in the maximum number of groups."
        case "not_owner": "Only the group owner can do that."
        case "rate_limited": "Too many attempts. Try again in a few minutes."
        case "offline": "Can't reach the server."
        case "helper_unavailable": "The background helper is restarting. Try again."
        default: "Something went wrong."
        }
    }
}
