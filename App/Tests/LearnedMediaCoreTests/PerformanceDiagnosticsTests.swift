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

    func testCircularHistoryMatchesNewestSixtyFourEventsAcrossManyWraps() throws {
        let diagnostics = PerformanceDiagnostics()
        let schemas = ProviderResponseSchema.allCases
        let payloads: [Any?] = [
            nil, NSNull(), [], true, 42, "PRIVATE", ["items": []], ["items": [NSNull()]],
            ["items": [["snippet": ["title": "PRIVATE"]]]], ["query": ["pages": []]],
            ["query": ["pages": [NSNull()]]], ["error": []], ["error": ["code": "PRIVATE"]]
        ]
        var recent: [String] = []
        for index in 0..<777 {
            let schema = schemas[(index * 7 + index / 13) % schemas.count]
            let payload = payloads[(index * 11 + index / 9) % payloads.count]
            let override: ProviderResponseRootOverride? = index % 29 == 0 ? (index % 58 == 0 ? .nonJSON : .invalidJSON) : nil

            let single = PerformanceDiagnostics()
            single.recordProviderSchemaFailure(schema, payload: payload, rootOverride: override)
            if let fingerprint = failures(single).first?["fingerprint"] as? String {
                recent.append(fingerprint)
                if recent.count > 64 { recent.removeFirst() }
            }
            diagnostics.recordProviderSchemaFailure(schema, payload: payload, rootOverride: override)

            if index % 41 == 40 || index == 776 {
                let expected = Dictionary(grouping: recent, by: { $0 }).mapValues(\.count)
                let observed = Dictionary(uniqueKeysWithValues: try XCTUnwrap(failures(diagnostics)).map {
                    (try XCTUnwrap($0["fingerprint"] as? String), try XCTUnwrap($0["count"] as? Int))
                })
                XCTAssertEqual(observed, expected)
                XCTAssertEqual(recent.count, min(index + 1, 64))
            }
        }

        diagnostics.reset()
        XCTAssertTrue(failures(diagnostics).isEmpty)
        diagnostics.recordProviderSchemaFailure(.youtubeVideos, payload: [:])
        XCTAssertEqual(failures(diagnostics).first?["count"] as? Int, 1)
    }
}
