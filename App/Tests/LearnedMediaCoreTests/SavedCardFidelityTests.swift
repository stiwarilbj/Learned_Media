import XCTest
@testable import LearnedMediaCore

final class SavedCardFidelityTests: XCTestCase {
    func testSnapshotRoundTripKeepsIndependentCitationsAndOptionalMetadata() throws {
        let source: [String: Any] = [
            "title": "A source",
            "url": "https://en.wikipedia.org/wiki/A_source",
            "canonicalUrl": "https://en.wikipedia.org/wiki/A_source",
            "extract": "Supporting passage."
        ]
        let chronology: [String: Any] = [
            "events": [["dateText": "1900", "eventText": "The event happened", "anchor": ["field": "body", "sentenceIndex": 0]]],
            "fingerprint": "0123456789abcdef"
        ]
        let card: [String: Any] = [
            "id": "saved-card", "hook": "A detail", "title": "A specific fact", "body": "The first sentence. The second sentence.",
            "sentences": ["The first sentence.", "The second sentence."], "sentenceCount": 2,
            "topicPath": ["History", "A topic"], "sources": [source], "difficulty": 5, "obscurity": 5,
            "questionDetailed": true, "question": "Why did it happen?", "answer": "Because of the cause.",
            "answerSources": [source], "learnMore": "An additional explanation.", "learnMoreSources": [source],
            "chronology": chronology, "followUpQuestions": ["questions": ["How was this discovered?"], "fingerprint": "0123456789abcdef"],
            "questionHistory": [["role": "user", "content": "Why?"], ["role": "assistant", "content": "Because."]]
        ]
        let state: [String: Any] = [
            "persistenceVersion": 3,
            "topics": [[String: Any]](),
            "settings": ["obscurity": 5, "displayMode": "text", "sentenceLength": 2],
            "cards": [card]
        ]

        XCTAssertTrue(SnapshotValidation.validate(state, kind: .state, operation: .read))
        let data = try JSONSerialization.data(withJSONObject: state)
        let decoded = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        let restored = try XCTUnwrap((decoded["cards"] as? [[String: Any]])?.first)
        XCTAssertEqual(restored["questionDetailed"] as? Bool, true)
        XCTAssertEqual((restored["learnMoreSources"] as? [[String: Any]])?.first?["title"] as? String, "A source")
        XCTAssertEqual((restored["answerSources"] as? [[String: Any]])?.first?["title"] as? String, "A source")
        XCTAssertEqual((restored["chronology"] as? [String: Any])?["fingerprint"] as? String, "0123456789abcdef")
        XCTAssertEqual((restored["followUpQuestions"] as? [String: Any])?["questions"] as? [String], ["How was this discovered?"])
        XCTAssertEqual((restored["questionHistory"] as? [[String: String]])?.count, 2)
    }
}
