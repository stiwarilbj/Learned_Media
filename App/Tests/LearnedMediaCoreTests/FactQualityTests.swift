import XCTest
@testable import LearnedMediaCore

final class FactQualityTests: XCTestCase {
    private let source: [[String: Any]] = [[
        "extract": "The 1847 Relief Act created soup kitchens in Ireland. The kitchens served millions of meals during the famine. Parliament later replaced the program with a revised poor-law system. The revised system changed how relief was administered. The policy left a documented mark on Ireland’s relief institutions. County inspectors recorded the kitchens’ daily operations in detailed reports. Local committees purchased food through a centralized relief network. The program connected emergency meals with the broader poor-law administration. Historians use the surviving records to compare relief across counties. The legislation changed how officials measured hunger during the crisis."
    ]]

    func testEvidenceIDsMustBelongToCurrentCard() {
        let own = Set(["own"])
        XCTAssertTrue(FactQuality.validEvidenceReferences([(0, ["own"])], assignedIDs: own, sentenceCount: 3))
        let invalid: [(sentence: Int, evidenceIDs: [String]?)] = [
            (0, ["unknown"]), (0, ["other-card"]), (0, nil), (0, []),
            (0, ["own", "own", "own", "own"]), (-1, ["own"]), (3, ["own"])
        ]
        for reference in invalid {
            XCTAssertFalse(FactQuality.validEvidenceReferences([(0, ["own"]), reference], assignedIDs: own, sentenceCount: 3))
        }
    }

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

    func testLevelTenRequiresOneNamedInnerSection() {
        let sources: [[String: Any]] = [[
            "extract": "[Section: Introduction]\nThe relief program is remembered as an important response to famine.\n\n[Section: County Inspection Records]\nCounty inspectors recorded that the 1847 Relief Act required local committees to submit weekly soup-kitchen ledgers. The ledgers listed meal counts by district and let officials compare shortages across counties. Officials used the records to compare shortages across counties."
        ]]
        let sentences = [
            "The 1847 Relief Act required local committees to submit weekly soup-kitchen ledgers.",
            "Those ledgers listed meal counts by district for county inspectors.",
            "Officials used the records to compare shortages across counties."
        ]
        let evidence: [[String: Any]] = [
            ["sentence": 0, "sourceIndex": 0, "quote": sentences[0], "section": "County Inspection Records"],
            ["sentence": 1, "sourceIndex": 0, "quote": "The ledgers listed meal counts by district and let officials compare shortages across counties.", "section": "County Inspection Records"],
            ["sentence": 2, "sourceIndex": 0, "quote": "Officials used the records to compare shortages across counties.", "section": "County Inspection Records"]
        ]
        XCTAssertTrue(FactQuality.validate(title: "The Ledgers Behind County Relief", hook: "Soup Kitchens Kept Weekly Ledgers", claim: "The law required local committees to submit weekly ledgers that tracked meals by district.", sentences: sentences, evidence: evidence, sources: sources, difficulty: 10))

        let leadEvidence: [[String: Any]] = [
            ["sentence": 0, "sourceIndex": 0, "quote": "The relief program is remembered as an important response to famine.", "section": "Introduction"],
            ["sentence": 1, "sourceIndex": 0, "quote": "The relief program is remembered as an important response to famine.", "section": "Introduction"],
            ["sentence": 2, "sourceIndex": 0, "quote": "The relief program is remembered as an important response to famine.", "section": "Introduction"]
        ]
        XCTAssertFalse(FactQuality.validate(title: "A Broad Relief Overview", hook: "The Relief Program Mattered", claim: "The program mattered during famine.", sentences: sentences, evidence: leadEvidence, sources: sources, difficulty: 10))
    }

    func testPublicationLedgerRejectsSeededMemory() async {
        let remembered: [String: Any] = [
            "id": "remembered",
            "title": "A Named Relief Event",
            "claim": "A particular law created a particular relief program.",
            "body": "A particular law created a particular relief program with a documented consequence.",
            "fingerprint": "a particular law created a particular relief program a particular law created a particular relief program with a documented consequence."
        ]
        let ledger = FactPublicationLedger(initial: [remembered])
        let accepted = await ledger.accept(remembered)
        XCTAssertFalse(accepted)
    }
    func testPassageIdentityDeduplicatesOnlyFormattingWithinSourceSection() {
        let url = "https://en.wikipedia.org/wiki/Pressure"
        let quote = "A precise café measurement recorded 3.5 units, not 35 units."
        let key = FactQuality.evidencePassageKey(sourceURL: url, section: "Évidence records", quote: quote)
        XCTAssertEqual(FactQuality.stableEvidenceID(key), "ebfac99220a71d1d4")
        let variant = quote.replacingOccurrences(of: "café", with: "cafe\u{301}").replacingOccurrences(of: " ", with: "\t ")
        XCTAssertEqual(key, FactQuality.evidencePassageKey(sourceURL: url, section: " E\u{301}vidence   records ", quote: variant))
        XCTAssertEqual(FactQuality.stableEvidenceID(key), FactQuality.stableEvidenceID(FactQuality.evidencePassageKey(sourceURL: url, section: "Évidence records", quote: quote + "\n")))
        XCTAssertNotEqual(key, FactQuality.evidencePassageKey(sourceURL: url + "_Other", section: "Évidence records", quote: quote))
        XCTAssertNotEqual(key, FactQuality.evidencePassageKey(sourceURL: url, section: "Different section", quote: quote))
        XCTAssertNotEqual(key, FactQuality.evidencePassageKey(sourceURL: url, section: "Évidence records", quote: quote.replacingOccurrences(of: "3.5", with: "35")))
        XCTAssertNotEqual(key, FactQuality.evidencePassageKey(sourceURL: url, section: "Évidence records", quote: quote.replacingOccurrences(of: "not ", with: "")))
    }

    func testLocalEvidenceRankingAndStableIdentity() {
        let focused = "Mercury barometers measured atmospheric pressure by balancing a column of dense liquid against the surrounding air. Operators recorded the column height and temperature to compare weather observations at different stations."
        let generic = "Mercury appears in several unrelated traditions and stories whose names changed over the centuries. Curators kept these old stories in decorated volumes beside several collections of handwritten songs."
        let unrelated = "Coastal crews repaired their bamboo frames with tarred cord after the storm damaged the lighthouse roof. The workers then carried their supplies to an inland storage shed before sunset."
        let extract = "== Instruments ==\n\(generic)\n\(focused)\n\(unrelated)\n== References ==\n\(focused)"
        let query = "Mercury barometer atmospheric pressure column height temperature"
        let selected = FactQuality.evidence(extract, focus: query, level: 5)
        XCTAssertTrue(selected.contains(focused))
        XCTAssertFalse(selected.contains(generic) || selected.contains(unrelated))
        XCTAssertTrue(selected.hasPrefix("[Section: Instruments]"))
        XCTAssertEqual(FactQuality.evidence(extract, focus: query, level: 5), selected)
        XCTAssertEqual(FactQuality.evidence("== Barometer ==\n" + unrelated, focus: "barometer pressure", level: 5), "")
        XCTAssertEqual(FactQuality.evidence("== Instruments ==\n" + String(focused.dropLast()), focus: query, level: 5), "")
        let key = "https://en.wikipedia.org/wiki/Pressure\u{0}Évidence\u{0}A precise quotation about pressure."
        XCTAssertEqual(FactQuality.stableEvidenceID(key), "ecfc3b174d5b0577b")
        XCTAssertNotEqual(FactQuality.stableEvidenceID(key + " changed"), FactQuality.stableEvidenceID(key))
    }

}
