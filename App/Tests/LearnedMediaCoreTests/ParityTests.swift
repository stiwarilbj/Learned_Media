import XCTest
@testable import LearnedMediaCore

final class ParityTests: XCTestCase {
    func testGenerationContextIsOptionalAndOperationLocal() {
        let plain = PromptBuilder.build(.candidate, fields: GenerationPromptContext().fields)
        XCTAssertFalse(plain.contains("Surprise mode"))
        XCTAssertFalse(plain.contains("Optional thread context"))
        let context = GenerationPromptContext(surpriseMe: true, rabbitHole: "  pendulums  ")
        let prompt = PromptBuilder.build(.candidate, fields: context.fields)
        XCTAssertTrue(prompt.contains("Choose an unexpected angle within each assigned topic."))
        XCTAssertTrue(prompt.contains("pendulums"))
        XCTAssertFalse(plain.contains("pendulums"))
    }
    func testActivityExchangePreservesExplicitFalseAndCanonicalFields() throws {
        let source: [String: Any] = ["topic":"Science", "tab":"saved", "order":"oldest", "prioritizeRecentByChannel":["Crash Course":false,"Other":true], "savedIds":["video"]]
        let restored = WorkspaceActivity.canonicalized(source)
        XCTAssertEqual(restored["selectedTopic"] as? String, "Science")
        XCTAssertEqual(restored["activeTab"] as? String, "saved")
        XCTAssertEqual(restored["channelOrder"] as? String, "oldest")
        XCTAssertNil(restored["topic"])
        let bytes = try JSONSerialization.data(withJSONObject: restored)
        let roundTrip = try XCTUnwrap(JSONSerialization.jsonObject(with: bytes) as? [String:Any])
        XCTAssertEqual((roundTrip["prioritizeRecentByChannel"] as? [String:Bool])?["Crash Course"], false)
        XCTAssertEqual(WorkspaceActivity.canonicalized(["selectedTopic":"History","topic":"Science"])["selectedTopic"] as? String,"History")
    }
}
