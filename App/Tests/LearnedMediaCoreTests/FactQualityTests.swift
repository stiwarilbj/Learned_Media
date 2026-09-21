import XCTest
@testable import LearnedMediaCore

final class FactQualityTests: XCTestCase {
    private let source: [[String: Any]] = [[
        "extract": "The 1847 Relief Act created soup kitchens in Ireland. The kitchens served millions of meals during the famine. Parliament later replaced the program with a revised poor-law system. The revised system changed how relief was administered. The policy left a documented mark on Ireland’s relief institutions. County inspectors recorded the kitchens’ daily operations in detailed reports. Local committees purchased food through a centralized relief network. The program connected emergency meals with the broader poor-law administration. Historians use the surviving records to compare relief across counties. The legislation changed how officials measured hunger during the crisis."
    ]]

    func testAcceptsOneSupportedThreeSentenceFact() {
        let sentences = [
            "The 1847 Relief Act created soup kitchens in Ireland.",
            "The kitchens served millions of meals during the famine.",
            "Parliament later replaced the program with a revised poor-law system."
        ]
        let evidence: [[String: Any]] = [
            ["sentence": 0, "sourceIndex": 0, "quote": sentences[0]],
            ["sentence": 1, "sourceIndex": 0, "quote": sentences[1]],
            ["sentence": 2, "sourceIndex": 0, "quote": sentences[2]]
        ]

        XCTAssertTrue(FactQuality.validate(
            title: "Ireland’s 1847 Soup Kitchen Law",
            hook: "Soup Kitchens Became National Policy",
            claim: "The 1847 Relief Act created a national soup-kitchen program in Ireland.",
            sentences: sentences,
            evidence: evidence,
            sources: source
        ))
    }

    func testRejectsNearDuplicateAndUnsupportedSentence() async {
        let first: [String: Any] = [
            "id": "first",
            "title": "Ireland’s 1847 Soup Kitchen Law",
            "claim": "The law created soup kitchens.",
            "body": "The 1847 Relief Act created soup kitchens in Ireland. The kitchens served millions of meals during the famine. Parliament later replaced the program with a revised poor-law system."
        ]
        let duplicate: [String: Any] = [
            "id": "second",
            "title": "Ireland’s Soup Kitchen Law of 1847",
            "claim": "The law created soup kitchens.",
            "body": first["body"] as Any
        ]
        let ledger = FactPublicationLedger()
        let acceptedFirst = await ledger.accept(first)
        let acceptedDuplicate = await ledger.accept(duplicate)
        XCTAssertTrue(acceptedFirst)
        XCTAssertFalse(acceptedDuplicate)

        XCTAssertFalse(FactQuality.validate(
            title: "Unsupported Detail",
            hook: "A Detail That Was Never Sourced",
            claim: "A made-up claim.",
            sentences: ["The 1847 Relief Act created soup kitchens in Ireland.", "The kitchens served millions of meals during the famine.", "The kitchens changed weather patterns across Europe."],
            evidence: [
                ["sentence": 0, "sourceIndex": 0, "quote": "The 1847 Relief Act created soup kitchens in Ireland."],
                ["sentence": 1, "sourceIndex": 0, "quote": "The kitchens served millions of meals during the famine."],
                ["sentence": 2, "sourceIndex": 0, "quote": "The kitchens changed weather patterns across Europe."]
            ],
            sources: source
        ))
    }

    func testSupportsEverySavedSentenceLength() {
        let sentences = [
            "The 1847 Relief Act created soup kitchens in Ireland.",
            "The kitchens served millions of meals during the famine.",
            "Parliament later replaced the program with a revised poor-law system.",
            "The revised system changed how relief was administered.",
            "The policy left a documented mark on Ireland’s relief institutions.",
            "County inspectors recorded the kitchens’ daily operations in detailed reports.",
            "Local committees purchased food through a centralized relief network.",
            "The program connected emergency meals with the broader poor-law administration.",
            "Historians use the surviving records to compare relief across counties.",
            "The legislation changed how officials measured hunger during the crisis."
        ]
        for count in [1, 2, 3, 4, 6, 8, 10] {
            let selected = Array(sentences.prefix(count))
            let evidence = selected.enumerated().map { index, sentence in
                ["sentence": index, "sourceIndex": 0, "quote": sentence] as [String: Any]
            }
            XCTAssertTrue(FactQuality.validate(title: "Ireland’s Named Relief Program", hook: "A National Soup Kitchen Law", claim: "The 1847 Relief Act created a specific relief program.", sentences: selected, evidence: evidence, sources: source, expectedSentences: count), "length \(count) should validate")
        }
    }

    func testInvalidSavedSentenceLengthClampsToThree() {
        let sentences = [
            "The 1847 Relief Act created soup kitchens in Ireland.",
            "The kitchens served millions of meals during the famine.",
            "Parliament later replaced the program with a revised poor-law system."
        ]
        let evidence = sentences.enumerated().map { index, sentence in
            ["sentence": index, "sourceIndex": 0, "quote": sentence] as [String: Any]
        }
        XCTAssertTrue(FactQuality.validate(title: "Ireland’s Named Relief Program", hook: "A National Soup Kitchen Law", claim: "The 1847 Relief Act created a specific relief program.", sentences: sentences, evidence: evidence, sources: source, expectedSentences: 99))
    }
}
