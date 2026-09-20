import XCTest
@testable import LearnedMediaCore

final class ModelPolicyTests: XCTestCase {
    func testEligibleModelsRequireStructuredTextGeneration() {
        XCTAssertTrue(GeminiModelPolicy.isEligible(id: "models/gemini-2.5-flash", methods: ["generateContent"]))
        XCTAssertTrue(GeminiModelPolicy.isEligible(id: "gemini-flash-lite-latest", methods: ["generateContent"]))
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
            "gemini-3.5-flash-lite"
        ])
        XCTAssertEqual(sorted, ["gemini-3.7-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-2.5-flash", "gemini-2.5-flash-lite"])
        XCTAssertEqual(GeminiModelPolicy.sort(GeminiModelPolicy.allowedModels), GeminiModelPolicy.allowedModels)
    }
}
