import XCTest
@testable import LearnedMediaCore

final class DifficultyPolicyTests: XCTestCase {
    func testEveryLevelMatchesSharedWebsitePolicy() throws {
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let data = try Data(contentsOf: root.appendingPathComponent("Website/lib/difficulty-policy.json"))
        let policy = try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        let levels = try XCTUnwrap(policy["levels"] as? [String])
        XCTAssertEqual(levels.count, 10)
        XCTAssertEqual(Set(levels).count, 10)
        XCTAssertEqual(DifficultyPolicy.version, policy["version"] as? String)
        XCTAssertEqual(DifficultyPolicy.innerSectionFrom, policy["innerSectionFrom"] as? Int)
        for level in 1...10 {
            let common = try XCTUnwrap(policy["common"] as? String)
            let evidence = try XCTUnwrap(policy[level >= 5 ? "innerEvidence" : "easyEvidence"] as? String)
            let expected = "Difficulty \(level)/10: \(levels[level - 1]) \(common) \(evidence)"
            XCTAssertEqual(DifficultyPolicy.rubric(level), expected)
            XCTAssertEqual(FactQuality.rubric(level), expected)
            let lead = "The coastal bell used a cork float to sound an alarm when water passed the brass pin inside its protective housing."
            XCTAssertEqual(FactQuality.evidence(lead, focus: "coastal bell cork float", level: level).isEmpty, level >= 5)
        }
        XCTAssertEqual(DifficultyPolicy.rubric(0), DifficultyPolicy.rubric(1))
        XCTAssertEqual(DifficultyPolicy.rubric(11), DifficultyPolicy.rubric(10))
    }
}
