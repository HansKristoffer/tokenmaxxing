import XCTest
@testable import Tokenmaxxing

/// Decodes the fixture the TypeScript side writes (app/helper/test/protocol.test.ts).
final class ProtocolTests: XCTestCase {
    func testDecodesEveryHelperMessage() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "messages", withExtension: "ndjson", subdirectory: "Fixtures"))
        let lines = try String(contentsOf: url, encoding: .utf8).split(separator: "\n")
        let messages = try lines.map { try JSONDecoder().decode(IncomingMessage.self, from: Data($0.utf8)) }
        XCTAssertEqual(messages.count, 8)

        let state = try XCTUnwrap(messages[0].state)
        XCTAssertEqual(state.phase, .ready)
        XCTAssertEqual(state.me, MeStats(name: "alice", rank: 2, tokensToday: 123_456_789, level: 5, levelTitle: "Subagent Shepherd"))
        XCTAssertEqual(state.leaderboard.first?.company, "Arox")
        XCTAssertNil(state.leaderboard.last?.company)
        XCTAssertEqual(state.leaderboard.last?.isMe, true)
        XCTAssertEqual(state.update, UpdateInfo(version: "1.3.0", viaBrew: true, installing: false))
        XCTAssertEqual(state.sources.first?.label, "Claude Code")

        XCTAssertEqual(messages[1].state?.phase, .onboarding)
        XCTAssertNil(messages[1].state?.me)
        XCTAssertNil(messages[1].state?.update)
        XCTAssertNil(messages[2].state?.me?.rank)
        XCTAssertEqual(messages[3].token, "12.tok_abc")
        XCTAssertEqual(messages[4].event, "token")
        XCTAssertNil(messages[4].token)
        XCTAssertEqual(messages[6].result?.url, "https://example.com/#code=12.x")
        XCTAssertEqual(messages[7].error, "name_taken")
    }

    func testCommandsOmitNilFields() throws {
        let cmd = OutgoingCommand(cmd: "openWorld")
        let json = try XCTUnwrap(String(data: JSONEncoder().encode(cmd), encoding: .utf8))
        XCTAssertFalse(json.contains("\"token\""), json)
        XCTAssertTrue(json.contains("\"openWorld\""), json)
    }
}
