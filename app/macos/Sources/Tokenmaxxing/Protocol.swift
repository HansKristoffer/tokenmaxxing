import Foundation

// Mirrors core/src/protocol.ts. Tests/TokenmaxxingTests/Fixtures/messages.ndjson
// is written by the TypeScript side and decoded in ProtocolTests, so drift fails CI.

enum Phase: String, Codable, Sendable {
    case starting, onboarding, ready
}

struct AppState: Codable, Equatable, Sendable {
    let phase: Phase
    let version: String
}

/// The few fields any command result carries (`openWorld` → url, `signUp` → name).
struct CommandResult: Decodable, Sendable {
    let url: String?
    let name: String?
}

/// One line from the helper: a reply (`id`) or an event (`event`).
struct IncomingMessage: Decodable, Sendable {
    let id: Int?
    let ok: Bool?
    let error: String?
    let result: CommandResult?
    let event: String?
    let state: AppState?
    let token: String?
}

/// One line to the helper. Nil fields are omitted from the JSON.
struct OutgoingCommand: Encodable, Sendable {
    var id = 0
    let cmd: String
    var token: String? = nil
    var serverUrl: String? = nil
    var name: String? = nil
}
