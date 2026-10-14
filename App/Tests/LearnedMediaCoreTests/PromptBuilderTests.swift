import XCTest
@testable import LearnedMediaCore

final class PromptBuilderTests: XCTestCase {
    func testCompactionPreservesEvidenceAndRemovesOnlyRepeatedInstructionsAndFields() {
        let evidence = "[Section: Record]\nA  verbatim quotation.\n\nAnother paragraph."
        let prompt = PromptBuilder.build(.topicInterpret, rules: [" Preserve   intent. ", "Preserve intent."], fields: [
            PromptField("Query", "Why  does the ground shake?"), PromptField("Query", "Why  does the ground shake?"),
            PromptField("Absent", nil), PromptField("History", [String]()),
            PromptField("Evidence", evidence, multiline: true), PromptField("Flag", false), PromptField("Index", 0)
        ])
        XCTAssertEqual(prompt.components(separatedBy: "Preserve intent.").count, 2)
        XCTAssertEqual(prompt.components(separatedBy: "Query:").count, 2)
        XCTAssertTrue(prompt.contains(evidence))
        XCTAssertTrue(prompt.contains("Why  does the ground shake?"))
        XCTAssertTrue(prompt.contains("Flag: false") && prompt.contains("Index: 0"))
        XCTAssertFalse(prompt.contains("Absent:") || prompt.contains("History:"))
    }

    func testOperationInstructionsAndCitationFormat() {
        XCTAssertEqual(PromptBuilder.build(.connection), "Return {\"ok\":true}.")
        for operation in [PromptOperation.topicInterpret, .videoInterpret, .videoVerify] {
            let prompt = PromptBuilder.build(operation)
            XCTAssertFalse(prompt.contains("complete, useful sentences") || prompt.contains("citationIndexes"))
        }
        let grounded = PromptBuilder.build(.grounding, rules: [FactQuality.writingRules(for: 7, evidenceIDs: true)])
        XCTAssertTrue(grounded.contains("only evidence IDs assigned to that slot"))
        XCTAssertTrue(grounded.contains("exactly 3 complete, useful sentences"))
        XCTAssertFalse(grounded.contains("provide a verbatim quotation"))
        XCTAssertTrue(FactQuality.writingRules().contains("provide a verbatim quotation"))
    }
}
