import XCTest
@testable import LearnedMediaCore

final class ValidationDiagnosticsTests: XCTestCase {
    func testCompactRepeatedFailuresAndIndependentFingerprints() {
        var diagnostics = ValidationDiagnostics()
        for n in 0..<1000 {
            _ = diagnostics.record(operation: "grounding", slot: 2, detail: "Unknown evidence ID private-\(n): " + String(repeating: "x", count: 50000))
        }
        XCTAssertEqual(diagnostics.snapshot.count, 1)
        XCTAssertEqual(diagnostics.snapshot[0]["occurrences"] as? Int, 1000)
        let data = try! JSONSerialization.data(withJSONObject: diagnostics.snapshot)
        XCTAssertLessThan(data.count, 250)
        XCTAssertFalse(String(data: data, encoding: .utf8)!.contains("private"))
        _ = diagnostics.record(operation: "candidate", slot: 2, detail: "Unknown evidence ID")
        _ = diagnostics.record(operation: "grounding", slot: 3, detail: "Unknown evidence ID")
        _ = diagnostics.record(operation: "grounding", slot: 2, detail: "more evidence is needed")
        XCTAssertEqual(diagnostics.snapshot.count, 4)
        XCTAssertEqual(diagnostics.record(operation: "grounding", slot: 2, detail: "Unknown evidence ID"), "The card referenced unknown or unassigned evidence. (1001 occurrences)")
    }
}
