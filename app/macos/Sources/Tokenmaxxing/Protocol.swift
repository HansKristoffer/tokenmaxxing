import Foundation

// Mirrors core/src/protocol.ts. Tests/TokenmaxxingTests/Fixtures/messages.ndjson
// is written by the TypeScript side and decoded in ProtocolTests, so drift fails CI.

struct MeStats: Codable, Equatable, Sendable {
    let name: String
    /// World rank today by tokens; nil before any tokens today.
    let rank: Int?
    let tokensToday: Double
    let level: Int
    let levelTitle: String
}

struct LeaderboardRow: Codable, Equatable, Identifiable, Sendable {
    let rank: Int
    let name: String
    let company: String?
    let tokens: Double
    let level: Int
    let isMe: Bool
    var id: String { name }
}

struct SourceInfo: Codable, Equatable, Identifiable, Sendable {
    let id: String
    let label: String
    let enabled: Bool
}

struct SyncInfo: Codable, Equatable, Sendable {
    let syncing: Bool
    let lastSyncedAt: Double?
    let lastError: String?
    let online: Bool
}

struct UpdateInfo: Codable, Equatable, Sendable {
    let version: String
    let viaBrew: Bool
    let installing: Bool
}

/// A Tokenmaxxing battle I'm in, for the battle line.
struct Battle: Codable, Equatable, Sendable {
    let matchId: Int
    let name: String
    /// Nil before anyone has burned a token.
    let place: Int?
    let players: Int
    let tokens: Double
    let startsAt: Double
    let endsAt: Double
    let until: Double
}

enum Phase: String, Codable, Sendable {
    case starting, onboarding, ready
}

struct AppState: Codable, Equatable, Sendable {
    let phase: Phase
    let version: String
    let me: MeStats?
    /// Today's world top 10 by tokens, with me appended when I'm outside it.
    let leaderboard: [LeaderboardRow]
    let sync: SyncInfo
    let sources: [SourceInfo]
    let battle: Battle?
    let update: UpdateInfo?
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
    var enabledSources: [String]? = nil
    var name: String? = nil
}
