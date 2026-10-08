import XCTest
@testable import LearnedMediaCore

final class ModelPolicyTests: XCTestCase {
    func testBothPrimaryModelsAreRequiredForConnection() {
        XCTAssertEqual(GeminiModelPolicy.primaryModels, ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"])
        XCTAssertEqual(Array(GeminiModelPolicy.allowedModels.prefix(2)), GeminiModelPolicy.primaryModels)
        XCTAssertEqual(GeminiModelPolicy.requiredWorkingModels, 2)
    }

    func testRecoveryRetriesEachPrimaryThreeTimesBeforeOtherModelsAndRepeats() {
        let rounds = GeminiModelPolicy.attemptRounds(models: GeminiModelPolicy.allowedModels)
        let recovery = GeminiModelPolicy.primaryModels + GeminiModelPolicy.primaryModels + GeminiModelPolicy.primaryModels + Array(GeminiModelPolicy.allowedModels.dropFirst(2))
        XCTAssertEqual(rounds, [GeminiModelPolicy.allowedModels, recovery, recovery])
        XCTAssertEqual(rounds.flatMap { $0 }.count, 35)
        for primary in GeminiModelPolicy.primaryModels {
            XCTAssertEqual(rounds[1].filter { $0 == primary }.count, 3)
            XCTAssertEqual(rounds[2].filter { $0 == primary }.count, 3)
        }
    }

    func testOptionalSearchUsesOnlyOnePassAndUnavailableModelsStayExcluded() {
        XCTAssertEqual(GeminiModelPolicy.attemptRounds(models: GeminiModelPolicy.primaryModels, recover: false), [GeminiModelPolicy.primaryModels])
        let models = [GeminiModelPolicy.primaryModels[1], "gemini-2.5-flash"]
        XCTAssertEqual(GeminiModelPolicy.attemptRounds(models: models)[1], [models[0], models[0], models[0], models[1]])
    }

    func testEligibleModelsRequireStructuredTextGeneration() {
        XCTAssertTrue(GeminiModelPolicy.isEligible(id: "models/gemini-2.5-flash", methods: ["generateContent"]))
        XCTAssertTrue(GeminiModelPolicy.isEligible(id: "gemini-3.5-flash-lite", methods: ["generateContent"]))
        XCTAssertFalse(GeminiModelPolicy.isEligible(id: "gemini-2.5-image", methods: ["generateContent"]))
        XCTAssertFalse(GeminiModelPolicy.isEligible(id: "gemini-2.5-pro", methods: ["generateContent"]))
        XCTAssertFalse(GeminiModelPolicy.isEligible(id: "gemini-2.5-pro", methods: ["countTokens"]))
    }

    func testOnlyRequestedModelsAreSortedNewestToOldest() {
        let sorted = GeminiModelPolicy.sort([
            "gemini-2.5-pro",
            "gemini-2.5-flash-lite",
            "gemini-2.5-flash",
            "gemini-2.5-flash",
            "gemini-3.5-flash",
            "gemini-3.7-flash",
            "gemini-3.5-flash-lite",
            "gemini-3.8-flash",
            "gemini-3.1-flash-lite"
        ])
        XCTAssertEqual(sorted, ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite", "gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.5-flash", "gemini-2.5-flash"])
        XCTAssertEqual(GeminiModelPolicy.sort(GeminiModelPolicy.allowedModels), GeminiModelPolicy.allowedModels)
    }
}
