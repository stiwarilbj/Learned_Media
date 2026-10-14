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

    func testQuestionIsSeparateAndTakesPriorityOverCardAndHistory() throws {
        let question = "  Why does warm air rise, and when does it stop rising?  "
        let card: [String: Any] = ["title": "An observatory's pressure logbook", "body": "Clerks kept a leather-bound logbook."]
        let history: [[String: Any]] = (0..<8).map { ["role": "user", "content": "Earlier request \($0): summarize the logbook."] }
        let evidence: [[String: Any]] = [["index": 0, "kind": "supplemental", "title": "Convection", "extract": "A  complete passage.\nAnother sentence."]]
        let prompt = PromptBuilder.learning(action: .question, card: card, question: question, history: history, evidence: evidence)
        let blocks = prompt.components(separatedBy: "\n\n")
        XCTAssertEqual(blocks[1], "Original user query: " + question)
        let decodedCard = try JSONSerialization.jsonObject(with: Data(blocks[2].dropFirst("Supporting card context: ".count).utf8)) as? [String: String]
        XCTAssertEqual(decodedCard?["body"], card["body"] as? String)
        let decodedHistory = try JSONSerialization.jsonObject(with: Data(blocks[3].dropFirst("Previous conversation (context only): ".count).utf8)) as? [[String: String]]
        XCTAssertEqual(decodedHistory?.count, 6)
        XCTAssertEqual(decodedHistory?.first?["content"], history[2]["content"] as? String)
        let decodedEvidence = try JSONSerialization.jsonObject(with: Data(blocks[4].dropFirst("Wikipedia evidence: ".count).utf8)) as? [[String: Any]]
        XCTAssertEqual(decodedEvidence?.first?["extract"] as? String, evidence[0]["extract"] as? String)
        XCTAssertTrue(blocks[0].contains("omit card details that do not help answer it"))
        XCTAssertTrue(blocks[0].contains("must not replace the current query"))
        XCTAssertTrue(blocks[0].contains("Supplemental sources may directly support the answer to the query"))
        XCTAssertTrue(blocks[0].contains("state that limitation in the first sentence"))
        XCTAssertFalse(blocks[0].contains("stay on its subject") || blocks[0].contains("100 to 160 words"))
        let learn = PromptBuilder.learning(action: .learn, card: card, question: question, history: history, evidence: evidence)
        XCTAssertTrue(learn.hasPrefix("Explain this one card"))
        XCTAssertFalse(learn.contains(question) || learn.contains("Previous conversation (context only):"))
    }

    func testCandidateBatchKeepsSevenAssignedIDsAndAllowsOmittingWeakFacts() throws {
        let assignments: [[String: Any]] = (0..<7).map { ["slot": $0, "topicPath": ["Science", "Physics"], "difficulty": 5] }
        let prompt = PromptBuilder.build(.candidate, fields: [PromptField("Assignments", assignments)])
        XCTAssertTrue(prompt.contains("Return each ID at most once"))
        XCTAssertTrue(prompt.contains("different fact and angle across the batch, including slots with the same topic"))
        XCTAssertTrue(prompt.contains("Different titles or wording of the same underlying claim do not count as distinct facts"))
        XCTAssertTrue(prompt.contains("omit that slot instead of padding the batch"))
        XCTAssertTrue(prompt.contains("Return an empty facts array if none qualifies"))
        let payload = prompt.components(separatedBy: "Assignments: ")[1]
        let decoded = try JSONSerialization.jsonObject(with: Data(payload.utf8)) as? [[String: Any]]
        XCTAssertEqual(decoded?.compactMap { $0["slot"] as? Int }, Array(0..<7))
        XCTAssertEqual(decoded?.compactMap { $0["topicPath"] as? [String] }, Array(repeating: ["Science", "Physics"], count: 7))
    }

}
