import Foundation

// Mirrors core/src/protocol.ts. Tests/TokenmaxxingTests/Fixtures/messages.ndjson
// is written by the TypeScript side and decoded in ProtocolTests, so drift fails CI.

enum RangeKey: String, Codable, CaseIterable, Sendable {
    case today
    case week = "7d"
    case month = "30d"
    case all

    var label: String {
        switch self {
        case .today: "Today"
        case .week: "7d"
        case .month: "30d"
        case .all: "All"
        }
    }
}

enum SortKey: String, Codable, CaseIterable, Sendable {
    case tokens, parallelism, cost, prs

    var label: String {
        switch self {
        case .tokens: "Tokens"
        case .parallelism: "Parallel"
        case .cost: "Cost"
        case .prs: "PRs"
        }
    }
}

struct ViewSettings: Codable, Equatable, Sendable {
    var range: RangeKey
    var groupId: Int?
    var sort: SortKey

    static let `default` = ViewSettings(range: .today, groupId: nil, sort: .tokens)

    /// `groupId` must go out as `null`, not be omitted: the helper compares against null.
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(range, forKey: .range)
        try c.encode(groupId, forKey: .groupId)
        try c.encode(sort, forKey: .sort)
    }
}

struct MeStats: Codable, Equatable, Sendable {
    let name: String
    let rank: Int?
    let of: Int
    let tokens: Double
    let costUsd: Double
    let parallelism: Double?
    let peakAgents: Int
    let tokensPerActiveHour: Double?
    let prs: Int
}

struct LeaderboardRow: Codable, Equatable, Identifiable, Sendable {
    let rank: Int
    let name: String
    let tokens: Double
    let costUsd: Double
    let parallelism: Double?
    let peakAgents: Int
    let prs: Int
    let isMe: Bool
    var id: String { name }
}

struct GroupInfo: Codable, Equatable, Identifiable, Sendable {
    let id: Int
    let name: String
    let code: String
    let memberCount: Int
    let isOwner: Bool
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

enum Phase: String, Codable, Sendable {
    case starting, onboarding, ready
}

struct AppState: Codable, Equatable, Sendable {
    let phase: Phase
    let version: String
    let view: ViewSettings
    let me: MeStats?
    let leaderboard: [LeaderboardRow]
    let groups: [GroupInfo]
    let sync: SyncInfo
    let sources: [SourceInfo]
    let update: UpdateInfo?
}

/// The few fields any command result carries (`openDashboard` → url, group actions → code).
struct CommandResult: Decodable, Sendable {
    let url: String?
    let code: String?
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
    var view: ViewSettings? = nil
    var enabledSources: [String]? = nil
    var name: String? = nil
    var code: String? = nil
    var groupId: Int? = nil
}
