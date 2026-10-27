import XCTest
@testable import LearnedMediaCore

final class CausalValidationTests: XCTestCase {
    func testSharedCausalFixtures() throws {
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let data = try Data(contentsOf: root.appendingPathComponent("Website/scripts/causal-fixtures.json"))
        let fixtures = try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [[String: Any]])
        var preparation = CausalValidation.PreparedEvidence()
        for fixture in fixtures + fixtures.reversed() {
            let claim = try XCTUnwrap(fixture["claim"] as? String), passages = try XCTUnwrap(fixture["passages"] as? [String])
            let expected = CausalValidation.unsupported(claim, passages: passages)
            XCTAssertEqual(expected.isEmpty, fixture["valid"] as? Bool, claim)
            XCTAssertEqual(preparation.unsupported(claim, passages: passages), expected, "Warm preparation must retain exact results and evidence scope: \(claim)")
        }
    }

    func testPreparedEvidenceDoesNotBorrowCachedSupportOrPersistBetweenDrafts() {
        let claim = "Flooding caused bridge collapse."
        let supported = "Flooding caused bridge collapse during the severe storm."
        let unrelated = "Flooding and bridge collapse occurred together during the severe storm."
        var preparation = CausalValidation.PreparedEvidence()
        for _ in 0..<5 {
            XCTAssertTrue(preparation.unsupported(claim, passages: [supported, supported]).isEmpty)
            XCTAssertEqual(preparation.unsupported(claim, passages: [unrelated]), [claim])
            XCTAssertEqual(preparation.unsupported(claim, passages: []), [claim])
            XCTAssertEqual(preparation.unsupported(claim, passages: ["Flooding did not cause bridge collapse."]), [claim])
            XCTAssertEqual(preparation.unsupported(claim, passages: ["Flooding might have caused bridge collapse."]), [claim])
            XCTAssertEqual(preparation.unsupported(claim, passages: ["Did flooding cause bridge collapse?"]), [claim])
        }
        var nextDraft = CausalValidation.PreparedEvidence()
        XCTAssertEqual(nextDraft.unsupported(claim, passages: []), [claim])
        XCTAssertTrue(nextDraft.unsupported(claim, passages: [supported]).isEmpty)
        XCTAssertEqual(CausalValidation.unsupported(claim, passages: []), [claim])
    }

    func testPreparedPublicationKeepsMainClaimAndHookEvidenceScoped() {
        let causal = "Flooding caused the bridge to collapse during the severe storm."
        let together = "Flooding and bridge collapse occurred together during the severe storm."
        let sources: [[String: Any]] = [["extract": causal + " " + together]]
        let evidence: [[String: Any]] = [["sentence": 0, "sourceIndex": 0, "quote": causal], ["sentence": 1, "sourceIndex": 0, "quote": together]]
        func valid(_ claimEvidence: [String], hook: String = "Flooding Led To Bridge Collapse") -> Bool {
            FactQuality.validate(title: "Flooding Caused The Bridge Collapse", hook: hook, claim: causal,
                sentences: [causal, together], evidence: evidence, sources: sources, expectedSentences: 2, claimEvidence: claimEvidence)
        }
        XCTAssertTrue(valid([causal]))
        XCTAssertFalse(valid([together]), "Cached sentence evidence must not establish a claim with a different assignment")
        XCTAssertFalse(valid([causal], hook: "Flooding Caused The Tower Collapse"))
        XCTAssertTrue(valid([causal]), "Failed validation must not affect a later draft")
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
