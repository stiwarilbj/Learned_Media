import Foundation
import XCTest
@testable import LearnedMediaCore

final class QuestionInstructionPolicyTests: XCTestCase {
    private struct Fixture: Decodable {
        let name: String
        let question: String
        let detailed: Bool
        let structure: String
        let preference: String
        let expected: Expected
    }

    private struct Expected: Decodable {
        let conflict: Bool
        let conflictLabel: String
        let effectiveDetailed: Bool
        let effectiveStructure: String
        let questionForPrompt: String
        let directive: Directive?
    }

    private struct Directive: Decodable {
        let label: String
        let structure: String?
        let length: Length?
    }

    private struct Length: Decodable {
        let count: Int
        let exact: Bool
        let kind: String
    }

    private func fixtures() throws -> [Fixture] {
        let url = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .appendingPathComponent("../../../Website/scripts/fixtures/question-instruction-overrides.json")
            .standardizedFileURL
        return try JSONDecoder().decode([Fixture].self, from: Data(contentsOf: url))
    }

    func testSharedWebsiteFixturesResolveIdentically() throws {
        for fixture in try fixtures() {
            let actual = QuestionInstructionPolicy.resolve(fixture.question, detailed: fixture.detailed,
                structure: fixture.structure, preference: fixture.preference)
            XCTAssertEqual(actual.conflict, fixture.expected.conflict, fixture.name)
            XCTAssertEqual(actual.conflictLabel, fixture.expected.conflictLabel, fixture.name)
            XCTAssertEqual(actual.effectiveDetailed, fixture.expected.effectiveDetailed, fixture.name)
            XCTAssertEqual(actual.effectiveStructure, fixture.expected.effectiveStructure, fixture.name)
            XCTAssertEqual(actual.questionForPrompt, fixture.expected.questionForPrompt, fixture.name)
            let actualDirective = actual.directive.flatMap { try? JSONSerialization.data(withJSONObject: $0, options: [.sortedKeys]) }
            if let expectedDirective = fixture.expected.directive {
                let actualObject = try XCTUnwrap(actualDirective.flatMap { try JSONSerialization.jsonObject(with: $0) as? [String: Any] })
                XCTAssertEqual(actualObject["label"] as? String, expectedDirective.label, fixture.name)
                XCTAssertEqual(actualObject["structure"] as? String, expectedDirective.structure, fixture.name)
                let actualLength = actualObject["length"] as? [String: Any]
                XCTAssertEqual(actualLength?["count"] as? Int, expectedDirective.length?.count, fixture.name)
                XCTAssertEqual(actualLength?["exact"] as? Bool, expectedDirective.length?.exact, fixture.name)
                XCTAssertEqual(actualLength?["kind"] as? String, expectedDirective.length?.kind, fixture.name)
            } else {
                XCTAssertNil(actual.directive, fixture.name)
            }
        }
    }

    func testPromptUsesResolvedLengthAndDoesNotKeepConflictingDefaults() {
        let written = PromptBuilder.question(card: ["body": "Card context"],
            query: "Answer in one sentence: Why does the sky appear blue?", detailed: true,
            instructionPreference: "written", evidence: [])
        XCTAssertTrue(written.contains("Original user query: Why does the sky appear blue?"))
        XCTAssertTrue(written.contains("Requested answer structure: short-explanation"))
        XCTAssertTrue(written.contains("Write exactly 1 complete sentence in the entire answer text"))
        XCTAssertTrue(written.contains("citation metadata and controls do not count"))
        XCTAssertFalse(written.contains("150 to 250 words"))
        XCTAssertFalse(written.contains("Prefer 2 to 4 sentences"))

        let normal = PromptBuilder.question(card: [:], query: "Explain this result in at most 100 words.", detailed: true,
            instructionPreference: "settings", evidence: [])
        XCTAssertTrue(normal.contains("Original user query: Explain this result."))
        XCTAssertTrue(normal.contains("150 to 250 words"))
        XCTAssertFalse(normal.contains("100 words"))
    }

    func testAmbiguousNegatedQuotedAndInstructionOnlyDraftsStayUnchanged() {
        for question in [
            "The note says \"answer in one sentence\"; why did the result change?",
            "Do not answer in one sentence; explain why the result changed.",
            "If I asked you to answer in one sentence, why did the result change?",
            "Answer in one sentence or three sentences: why did it fail?",
            "Use numbered steps."
        ] {
            let resolution = QuestionInstructionPolicy.resolve(question, detailed: true, structure: "automatic")
            XCTAssertNil(resolution.directive, question)
            XCTAssertFalse(resolution.conflict, question)
            XCTAssertEqual(resolution.questionForPrompt, question, question)
        }
    }
}
