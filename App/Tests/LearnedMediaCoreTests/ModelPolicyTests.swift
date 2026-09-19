import XCTest
@testable import LearnedMediaCore

final class ModelPolicyTests: XCTestCase {
    func testEligibleModelsRequireStructuredTextGeneration() {
        XCTAssertTrue(GeminiModelPolicy.isEligible(id: "gemini-2.5-flash", methods: ["generateContent"]))
        XCTAssertFalse(GeminiModelPolicy.isEligible(id: "gemini-2.5-image", methods: ["generateContent"]))
        XCTAssertFalse(GeminiModelPolicy.isEligible(id: "gemini-2.5-flash-live", methods: ["generateContent"]))
        XCTAssertFalse(GeminiModelPolicy.isEligible(id: "gemini-2.5-pro", methods: ["countTokens"]))
    }

    func testFlashModelsArePreferredAndDuplicatesAreRemoved() {
        let sorted = GeminiModelPolicy.sort([
            "gemini-2.5-pro",
            "gemini-2.5-flash-lite",
            "gemini-2.5-flash",
            "gemini-2.5-flash"
        ])
        XCTAssertEqual(sorted, ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"])
    }
}
