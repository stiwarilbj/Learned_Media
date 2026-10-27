import XCTest
@testable import LearnedMediaCore

final class PerformanceDiagnosticsTests: XCTestCase {
    private func failures(_ diagnostics: PerformanceDiagnostics) -> [[String: Any]] {
        diagnostics.snapshot()["providerSchemaFailures"] as? [[String: Any]] ?? []
    }

    func testPreparedPathsKeepFirstElementAndMissingTypeSemantics() throws {
        let diagnostics = PerformanceDiagnostics()
        diagnostics.recordProviderSchemaFailure(.wikipediaImages, payload: ["query": ["pages": [["imageinfo": [["thumburl": "PRIVATE"], ["url": "PRIVATE"]]]]]])
        let fingerprint = try XCTUnwrap(failures(diagnostics).first?["fingerprint"] as? String)
        XCTAssertTrue(fingerprint.contains("query.pages[0].imageinfo[0].thumburl:string"))
        XCTAssertTrue(fingerprint.contains("query.pages[0].imageinfo[0].url:missing"))
        XCTAssertFalse(fingerprint.contains("PRIVATE"))

        for items: Any in [[], [NSNull(), ["snippet": ["title": "PRIVATE"]]], ["0": ["snippet": ["title": "PRIVATE"]]]] {
            diagnostics.reset()
            diagnostics.recordProviderSchemaFailure(.youtubeVideos, payload: ["items": items])
            let value = try XCTUnwrap(failures(diagnostics).first?["fingerprint"] as? String)
            XCTAssertTrue(value.contains("items[0].snippet.title:missing"))
            XCTAssertFalse(value.contains("PRIVATE"))
        }
    }

    func testPreparedMetadataRemainsSafeAcrossInstancesConcurrentCallsAndReset() throws {
        let diagnostics = PerformanceDiagnostics()
        let payload: [String: Any] = ["error": ["code": 429, "message": "PRIVATE", "status": "PRIVATE"]]
        diagnostics.recordProviderSchemaFailure(.youtubeError, payload: payload, rootOverride: .invalidJSON)
        let expected = try XCTUnwrap(failures(diagnostics).first?["fingerprint"] as? String)
        XCTAssertTrue(expected.hasPrefix("youtube.error|$:invalid-json,error:object,error.code:number,"))
        DispatchQueue.concurrentPerform(iterations: 200) { _ in
            diagnostics.recordProviderSchemaFailure(.youtubeError, payload: payload, rootOverride: .invalidJSON)
        }
        let snapshot = failures(diagnostics)
        XCTAssertEqual(snapshot.count, 1)
        XCTAssertEqual(snapshot.first?["fingerprint"] as? String, expected)
        XCTAssertEqual(snapshot.first?["count"] as? Int, 64)
        XCTAssertFalse(expected.contains("PRIVATE"))
        diagnostics.reset()
        XCTAssertTrue(failures(diagnostics).isEmpty)
        for recorder in [diagnostics, PerformanceDiagnostics()] {
            recorder.recordProviderSchemaFailure(.youtubeError, payload: payload, rootOverride: .invalidJSON)
            XCTAssertEqual(failures(recorder).first?["fingerprint"] as? String, expected)
            XCTAssertEqual(failures(recorder).first?["count"] as? Int, 1)
        }
    }
}
