import XCTest
@testable import LearnedMediaCore

final class CausalValidationTests: XCTestCase {
    func testSharedCausalFixtures() throws {
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let data = try Data(contentsOf: root.appendingPathComponent("Website/scripts/causal-fixtures.json"))
        let fixtures = try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [[String: Any]])
        for fixture in fixtures {
            let claim = try XCTUnwrap(fixture["claim"] as? String), passages = try XCTUnwrap(fixture["passages"] as? [String])
            XCTAssertEqual(CausalValidation.unsupported(claim, passages: passages).isEmpty, fixture["valid"] as? Bool, claim)
        }
    }
    func testPublicationRequiresEachSentencesOwnCausalEvidence() {
        let causal = "Flooding caused the bridge to collapse during the severe storm."
        let together = "Flooding and bridge collapse occurred together during the severe storm."
        let sources: [[String: Any]] = [["extract": causal + " " + together]]
        func valid(_ sentences: [String], _ evidence: [[String: Any]], claim: String? = nil, title: String = "The Bridge Collapsed During Flooding") -> Bool {
            FactQuality.validate(title: title, hook: "Storm Flooding Damaged The Bridge", claim: claim ?? causal, sentences: sentences, evidence: evidence, sources: sources, expectedSentences: sentences.count, claimEvidence: [evidence[0]["quote"] as! String])
        }
        let yes: [String: Any] = ["sentence": 0, "sourceIndex": 0, "quote": causal]
        let no: [String: Any] = ["sentence": 0, "sourceIndex": 0, "quote": together]
        XCTAssertTrue(valid([causal], [yes]))
        XCTAssertFalse(valid([causal], [no]))
        XCTAssertFalse(valid([together], [no]))
        XCTAssertFalse(valid([causal,together], [no, ["sentence": 1, "sourceIndex": 0, "quote": causal]]))
        XCTAssertFalse(valid([together], [no], claim: together, title: "Flooding Caused The Bridge Collapse"))
    }
}
