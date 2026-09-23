import XCTest
@testable import Tokenmaxxing

/// Decodes the fixture the TypeScript side writes (app/helper/test/protocol.test.ts).
final class ProtocolTests: XCTestCase {
    func testDecodesEveryHelperMessage() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "messages", withExtension: "ndjson", subdirectory: "Fixtures"))
        let lines = try String(contentsOf: url, encoding: .utf8).split(separator: "\n")
        let messages = try lines.map { try JSONDecoder().decode(IncomingMessage.self, from: Data($0.utf8)) }
        XCTAssertEqual(messages.count, 7)

        let state = try XCTUnwrap(messages[0].state)
        XCTAssertEqual(state.phase, .ready)
        XCTAssertEqual(state.view, ViewSettings(range: .week, groupId: 4, sort: .prs))
        XCTAssertEqual(state.me?.parallelism, 3.25)
        XCTAssertEqual(state.me?.prs, 5)
        XCTAssertEqual(state.leaderboard.first?.parallelism, nil)
        XCTAssertEqual(state.groups.first?.code, "K7QM-2XRP-9D")

        XCTAssertEqual(state.update, UpdateInfo(version: "1.3.0", viaBrew: true, installing: false))

        XCTAssertEqual(messages[1].state?.phase, .onboarding)
        XCTAssertNil(messages[1].state?.update)
        XCTAssertEqual(messages[2].token, "tok_abc")
        XCTAssertEqual(messages[3].event, "token")
        XCTAssertNil(messages[3].token)
        XCTAssertEqual(messages[5].result?.url, "https://example.com/login?code=x")
        XCTAssertEqual(messages[6].error, "name_taken")
    }

    func testCommandsEncodeNullGroupId() throws {
        let cmd = OutgoingCommand(cmd: "setView", view: .default)
        let json = try XCTUnwrap(String(data: JSONEncoder().encode(cmd), encoding: .utf8))
        XCTAssertTrue(json.contains("\"groupId\":null"), json)
        XCTAssertFalse(json.contains("\"token\""), json)
    }
}
