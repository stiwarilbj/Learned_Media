import XCTest
@testable import LearnedMediaCore

final class ParityTests: XCTestCase {
    func testGenerationContextIsOptionalAndOperationLocal() {
        let plain = PromptBuilder.build(.candidate, fields: GenerationPromptContext().fields)
        XCTAssertFalse(plain.contains("Surprise mode"))
        XCTAssertFalse(plain.contains("Optional thread context"))
        let context = GenerationPromptContext(surpriseMe: true, rabbitHole: "  pendulums  ")
        let prompt = PromptBuilder.build(.candidate, fields: context.fields)
        XCTAssertTrue(prompt.contains("Choose a surprising example within the selected fact angle and assigned topic."))
        XCTAssertTrue(prompt.contains("pendulums"))
        XCTAssertFalse(plain.contains("pendulums"))
    }

    func testFactAngleOptionsStayStableAndReachCandidateAndGroundingPrompts() {
        let expected: [FactAngle] = [.varied, .unexpectedMechanism, .unusualDecision, .failedExperiment, .overlookedDetail]
        XCTAssertEqual(FactAngle.allCases, expected)
        XCTAssertEqual(expected.map(\.rawValue), ["varied", "unexpected-mechanism", "unusual-decision", "failed-experiment", "overlooked-detail"])
        XCTAssertEqual(GenerationPromptContext().factAngle, .varied)

        for angle in expected {
            let context = GenerationPromptContext(factAngle: angle)
            let candidate = PromptBuilder.build(.candidate, rules: [context.factAngleRule], fields: context.fields)
            let grounding = PromptBuilder.factCard(sentenceCount: 3, difficulties: [5], fields: context.fields, additionalRules: [context.factAngleRule])
            XCTAssertTrue(candidate.contains(angle.label))
            XCTAssertTrue(candidate.contains(angle.instruction))
            XCTAssertTrue(grounding.contains(angle.label))
            XCTAssertTrue(grounding.contains(angle.instruction))
            XCTAssertEqual(candidate.components(separatedBy: angle.instruction).count - 1, 1)
            XCTAssertEqual(grounding.components(separatedBy: angle.instruction).count - 1, 1)
        }
        XCTAssertNil(FactAngle(rawValue: "Unexpected mechanism"))
        XCTAssertTrue(FactAngle.failedExperiment.instruction.contains("negative finding"))
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
