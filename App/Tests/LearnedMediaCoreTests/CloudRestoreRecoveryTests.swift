import Foundation
import XCTest
@testable import LearnedMediaCore

final class CloudRestoreRecoveryTests: XCTestCase {
    private func temporaryDirectory() throws -> URL {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        addTeardownBlock { try? FileManager.default.removeItem(at: url) }
        return url
    }
    private func row(_ id: String) -> [String: Any] {
        ["id": id, "revision": "revision-\(id)", "record": ["id": id, "name": id,
            "createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-01-01T00:00:00Z",
            "state": ["topics": [], "cards": [], "settings": ["obscurity": 5, "sentenceLength": 3, "displayMode": "text"]]]]
    }

    func testReopensOnlyCommittedPagesAndIgnoresOrphans() throws {
        let directory = try temporaryDirectory(), journal = CloudRestoreRecovery(directory: directory)
        let start = try XCTUnwrap(journal.begin(owner: "owner", source: "source", through: "z"))
        let first = try XCTUnwrap(journal.commit(start, rows: [row("a")], after: "a", complete: false))
        // Simulate an interrupted write after its page landed but before cursor replacement.
        let orphan: [String: Any] = ["token": start.token, "rows": [row("b")]]
        try JSONSerialization.data(withJSONObject: orphan).write(to: directory.appendingPathComponent("page-1.json"))
        let reopened = CloudRestoreRecovery(directory: directory)
        let restored = try XCTUnwrap(reopened.read(owner: "owner", source: "source"))
        XCTAssertEqual(restored.after, "a")
        XCTAssertEqual(restored.rows.compactMap { $0["id"] as? String }, ["a"])
        let complete = try XCTUnwrap(reopened.commit(restored, rows: [row("c")], after: "c", complete: true))
        XCTAssertTrue(complete.complete)
        XCTAssertEqual(reopened.read(owner: "owner", source: "source")?.rows.compactMap { $0["id"] as? String }, ["a", "c"])
        journal.discard(owner: "owner", token: first.token)
        XCTAssertNil(reopened.read(owner: "owner", source: "source"))
    }

    func testStaleWriterAndForeignDiscardCannotReplaceProgress() throws {
        let journal = CloudRestoreRecovery(directory: try temporaryDirectory())
        let start = try XCTUnwrap(journal.begin(owner: "owner", source: "source", through: "z"))
        XCTAssertNil(journal.begin(owner: "owner", source: "source", through: "z"))
        XCTAssertNotNil(journal.commit(start, rows: [row("a")], after: "a", complete: false))
        XCTAssertNil(journal.commit(start, rows: [row("b")], after: "b", complete: false))
        journal.discard(owner: "other")
        journal.discard(owner: "owner", token: UUID().uuidString)
        XCTAssertEqual(journal.read(owner: "owner", source: "source")?.after, "a")
        XCTAssertNil(journal.read(owner: "other", source: "source"))
        XCTAssertNil(journal.read(owner: "owner", source: "source"))
    }

    func testMissingOrCorruptCommittedPagesRestartRecovery() throws {
        for damage in ["missing", "malformed", "identity", "source"] {
            let directory = try temporaryDirectory(), journal = CloudRestoreRecovery(directory: directory)
            let start = try XCTUnwrap(journal.begin(owner: "owner", source: "source", through: "z"))
            XCTAssertNotNil(journal.commit(start, rows: [row("a")], after: "a", complete: false))
            let page = directory.appendingPathComponent("page-0.json")
            if damage == "missing" { try FileManager.default.removeItem(at: page) }
            if damage == "malformed" { try Data("invalid JSON".utf8).write(to: page) }
            if damage == "identity" {
                try JSONSerialization.data(withJSONObject: ["token": start.token, "rows": [row("z")]]).write(to: page)
            }
            XCTAssertNil(journal.read(owner: "owner", source: damage == "source" ? "foreign" : "source"), damage)
            XCTAssertNotNil(journal.begin(owner: "owner", source: "source", through: "z"), damage)
        }
    }

    func testFailedPageWriteKeepsPreviousCursorAndWorkspaceData() throws {
        let directory = try temporaryDirectory(), journal = CloudRestoreRecovery(directory: directory)
        let protected = directory.appendingPathComponent("learning-state.json")
        try Data("protected".utf8).write(to: protected)
        let start = try XCTUnwrap(journal.begin(owner: "owner", source: "source", through: "z"))
        let first = try XCTUnwrap(journal.commit(start, rows: [row("a")], after: "a", complete: false))
        // A directory cannot be atomically replaced with a page file.
        try FileManager.default.createDirectory(at: directory.appendingPathComponent("page-1.json"), withIntermediateDirectories: false)
        XCTAssertNil(journal.commit(first, rows: [row("b")], after: "b", complete: false))
        XCTAssertEqual(journal.read(owner: "owner", source: "source")?.after, "a")
        journal.discard()
        XCTAssertEqual(try Data(contentsOf: protected), Data("protected".utf8))
    }

    func testEmptyCompletionAndUnavailableStorage() throws {
        let journal = CloudRestoreRecovery(directory: try temporaryDirectory())
        let start = try XCTUnwrap(journal.begin(owner: "owner", source: "source", through: "z"))
        XCTAssertNotNil(journal.commit(start, rows: [], after: nil, complete: true))
        XCTAssertEqual(journal.read(owner: "owner", source: "source")?.complete, true)
        let parent = try temporaryDirectory(), file = parent.appendingPathComponent("not-a-directory")
        try Data().write(to: file)
        XCTAssertNil(CloudRestoreRecovery(directory: file).begin(owner: "owner", source: "source", through: "z"))
    }
}
