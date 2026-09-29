import XCTest
@testable import Tokenmaxxing

/// Decodes the fixture the TypeScript side writes (app/helper/test/protocol.test.ts).
final class ProtocolTests: XCTestCase {
    func testDecodesEveryHelperMessage() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "messages", withExtension: "ndjson", subdirectory: "Fixtures"))
        let lines = try String(contentsOf: url, encoding: .utf8).split(separator: "\n")
        let messages = try lines.map { try JSONDecoder().decode(IncomingMessage.self, from: Data($0.utf8)) }
        XCTAssertEqual(messages.count, 7)

        XCTAssertEqual(messages[0].state, AppState(phase: .ready, version: "1.2.3"))
        XCTAssertEqual(messages[1].state?.phase, .onboarding)
        XCTAssertEqual(messages[2].token, "12.tok_abc")
        XCTAssertEqual(messages[3].event, "token")
        XCTAssertNil(messages[3].token)
        XCTAssertEqual(messages[5].result?.url, "https://example.com/#code=12.x")
        XCTAssertEqual(messages[6].error, "name_taken")
    }

    func testCommandsOmitNilFields() throws {
        let cmd = OutgoingCommand(cmd: "openWorld")
        let json = try XCTUnwrap(String(data: JSONEncoder().encode(cmd), encoding: .utf8))
        XCTAssertFalse(json.contains("\"token\""), json)
        XCTAssertTrue(json.contains("\"openWorld\""), json)
    }
}
