import XCTest
@testable import LearnedMediaCore

final class EvidenceDatesTests: XCTestCase {
    func testSharedFixturesPreserveDateRolesAndUTF16Offsets() throws {
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let data = try Data(contentsOf: root.appendingPathComponent("Website/scripts/evidence-date-fixtures.json"))
        let fixtures = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [[String: Any]])
        for fixture in fixtures {
            let text = try XCTUnwrap(fixture["text"] as? String)
            let expected = try XCTUnwrap(fixture["dates"] as? [[String: Any]])
            let actual = EvidenceDates.roles(in: text)
            XCTAssertEqual(actual as NSArray, expected as NSArray, text)
            for date in actual {
                let value = try XCTUnwrap(date["date"] as? String), at = try XCTUnwrap(date["at"] as? Int)
                XCTAssertEqual((text as NSString).substring(with: NSRange(location: at, length: (value as NSString).length)), value)
            }
        }
        XCTAssertEqual(EvidenceDates.roles(in: String(repeating: "Published in 2020. ", count: 100)).count, 24)
        XCTAssertTrue(EvidenceDates.roles(in: String(repeating: "x", count: 16_000) + " Published in 2020.").isEmpty)
        XCTAssertTrue(EvidenceDates.roles(in: String(repeating: "x", count: 16_000 - " Published in 2020".count) + " Published in 20201").isEmpty)
    }

    func testPromptOnlyAnnotationsPreserveSourceAndEvidenceIdentity() throws {
        let text = "The event occurred in 1847. The report was published in 2020."
        let source: [String: Any] = ["text": text, "id": "e1", "dateRoles": [["date": "2020", "role": "event"]]]
        let annotated = try XCTUnwrap(EvidenceDates.annotate(source) as? [String: Any])
        XCTAssertEqual(annotated["text"] as? String, text)
        XCTAssertEqual(annotated["id"] as? String, "e1")
        XCTAssertEqual((annotated["dateRoles"] as? [[String: Any]])?.first?["role"] as? String, "event")
        XCTAssertEqual((source["dateRoles"] as? [[String: Any]])?.first?["date"] as? String, "2020")
        let unknown: [String: Any] = ["title": "Published in 2020", "extract": "A thing from 1847."]
        XCTAssertEqual(EvidenceDates.annotate(unknown) as? NSDictionary, unknown as NSDictionary)
        let rule = try XCTUnwrap(PromptInstructions.rules["evidenceDates"]?.first)
        for operation in [PromptOperation.grounding, .combined, .learn, .question] {
            let prompt = PromptBuilder.build(operation, fields: [PromptField("Evidence", [source], reference: true)])
            XCTAssertEqual(prompt.components(separatedBy: rule).count - 1, 1)
            XCTAssertTrue(prompt.contains("dateRoles"))
            XCTAssertTrue(prompt.contains(text))
        }
        for operation in [PromptOperation.connection, .candidate, .topicInterpret, .videoInterpret, .videoVerify] {
            let prompt = PromptBuilder.build(operation, fields: [PromptField("Evidence", [["text": text]], reference: true)])
            XCTAssertFalse(prompt.contains(rule)); XCTAssertFalse(prompt.contains("dateRoles"))
        }
        for action in [PromptOperation.learn, .question] {
            let prompt = PromptBuilder.learning(action: action, card: [:], question: "When did it happen?", evidence: [["extract": text]])
            XCTAssertTrue(prompt.contains(rule)); XCTAssertTrue(prompt.contains("dateRoles"))
        }
    }
}
