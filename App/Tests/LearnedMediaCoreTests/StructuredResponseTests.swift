import XCTest
@testable import LearnedMediaCore

final class StructuredResponseTests: XCTestCase {
    private let item: [String: Any] = ["type": "OBJECT", "properties": ["slot": ["type": "INTEGER"], "claim": ["type": "STRING"], "hook": ["type": "STRING"], "evidenceIds": ["type": "ARRAY", "items": ["type": "STRING"]]], "required": ["slot", "claim"]]
    private var schema: [String: Any] { ["type": "OBJECT", "properties": ["facts": ["type": "ARRAY", "items": item], "terms": ["type": "ARRAY", "items": ["type": "STRING"]], "alternatives": ["type": "BOOLEAN"]], "required": ["facts"]] }

    func testBoundaryBomPreservesLiteralAndEscapedStringCharacters() throws {
        let fields: [String: Any] = ["type": "OBJECT", "properties": ["answer": ["type": "STRING"], "quote": ["type": "STRING"]]]
        let answer = "\u{FEFF}Answer\u{FEFF}", quote = "A source \u{FEFF} quotation."
        let body = String(data: try JSONSerialization.data(withJSONObject: ["answer": answer, "quote": quote]), encoding: .utf8)!
        for value in [body, body.replacingOccurrences(of: "\u{FEFF}", with: "\\uFEFF")] {
            for raw in ["\u{FEFF}" + value, "\u{FEFF}```json\n" + value + "\n```"] {
                let parsed = try StructuredResponse.parse(raw, schema: fields)
                XCTAssertEqual(parsed["answer"] as? String, answer)
                XCTAssertEqual(parsed["quote"] as? String, quote)
            }
        }
        XCTAssertEqual(StructuredResponse.stripResponseBom("x\u{FEFF}y"), "x\u{FEFF}y")
        XCTAssertEqual(StructuredResponse.stripResponseBom("\"\u{FEFF}inside\u{FEFF}\""), "\"\u{FEFF}inside\u{FEFF}\"")
        XCTAssertEqual(StructuredResponse.stripResponseBom("\u{FEFF}{}"), "{}")
    }

    func testStreamAndPartialRecoveryPreserveBomInClaims() throws {
        let claim = "\u{FEFF}Supported claim\u{FEFF}"
        let item = String(data: try JSONSerialization.data(withJSONObject: ["slot": 0, "claim": claim]), encoding: .utf8)!
        let partial = "\u{FEFF}{\"facts\":[" + item + ",{\"slot\":1,\"claim\":\"unfinished"
        let parser = JSONArrayItemStreamParser(property: "facts")
        var streamed: [[String: Any]] = []
        for character in partial { streamed += parser.append(String(character)) }
        XCTAssertEqual(streamed.first?["claim"] as? String, claim)
        let recovered = try StructuredResponse.parse(partial, schema: schema)
        XCTAssertEqual((recovered["facts"] as? [[String: Any]])?.first?["claim"] as? String, claim)
    }

    func testMalformedItemAndOptionalFieldDoNotDiscardValidCards() throws {
        let parsed = try StructuredResponse.parse(#"{"facts":[{"slot":0,"claim":"Valid","hook":123},null,{"slot":1,"claim":123},{"slot":2,"claim":"Other valid"}]}"#, schema: schema)
        struct Item: Decodable { let slot: Int; let claim: String; let hook: String? }
        struct Envelope: Decodable { let facts: [Item] }
        let envelope = try JSONDecoder().decode(Envelope.self, from: JSONSerialization.data(withJSONObject: parsed))
        XCTAssertEqual(envelope.facts.map(\.slot), [0, 2]); XCTAssertNil(envelope.facts[0].hook)
    }
    func testClosedPrefixAndOtherCompleteSearchFieldsAreSalvaged() throws {
        let parsed = try StructuredResponse.parse(#"{"terms":["stars"],"alternatives":false,"facts":[{"slot":0,"claim":"complete"},{"slot":1,"claim":"unfinished"#, schema: schema)
        XCTAssertEqual(parsed["terms"] as? [String], ["stars"])
        XCTAssertEqual(parsed["alternatives"] as? Bool, false)
        XCTAssertEqual((parsed["facts"] as? [[String: Any]])?.compactMap { $0["slot"] as? Int }, [0])
        XCTAssertThrowsError(try StructuredResponse.parse(#"{"facts":[{"slot":0,"claim":"unfinished"#, schema: schema))
    }
    func testTrailingCommasNumericIDsAndWhitespaceCanBeRepairedWithoutEditingQuotes() throws {
        let parsed = try StructuredResponse.parse(#"{"facts":[{"slot":"0","claim":"Quoted ,} and ,] stay exact","evidenceIds":[" unknown ","unknown"],},],}"#, schema: schema)
        let facts = try XCTUnwrap(parsed["facts"] as? [[String: Any]])
        XCTAssertEqual(facts[0]["slot"] as? Int, 0)
        XCTAssertEqual(facts[0]["claim"] as? String, "Quoted ,} and ,] stay exact")
        XCTAssertEqual(facts[0]["evidenceIds"] as? [String], ["unknown"], "Unknown evidence stays available for citation validation to reject")
    }
    func testExactDuplicatesCollapseButConflictingSlotsRemainUnresolved() throws {
        let parsed = try StructuredResponse.parse(#"{"facts":[{"slot":0,"claim":"A"},{"claim":"A","slot":0},{"slot":0,"claim":"B"}]}"#, schema: schema)
        XCTAssertEqual((parsed["facts"] as? [[String: Any]])?.count, 2)
    }
    func testInvalidIntegersAndMissingClaimsAreNotInvented() throws {
        let parsed = try StructuredResponse.parse(#"{"facts":[{"slot":"1.5","claim":"Bad slot"},{"slot":1},{"slot":2,"claim":"Valid"}]}"#, schema: schema)
        XCTAssertEqual((parsed["facts"] as? [[String: Any]])?.compactMap { $0["slot"] as? Int }, [2])
    }
    func testMalformedGroundedDuplicateDoesNotRejectItsValidSibling() throws {
        var properties = item["properties"] as! [String: Any]
        properties["status"] = ["type": "STRING", "enum": ["grounded", "needs_evidence"]]
        properties["title"] = ["type": "STRING"]
        properties["sentences"] = ["type": "ARRAY", "items": ["type": "STRING"]]
        properties["evidence"] = ["type": "ARRAY", "items": ["type": "STRING"]]
        properties["claimEvidenceIds"] = ["type": "ARRAY", "items": ["type": "STRING"]]
        let groundedSchema: [String: Any] = ["type": "OBJECT", "properties": ["facts": ["type": "ARRAY", "items": ["type": "OBJECT", "properties": properties, "required": ["slot", "status", "claim"]]]]]
        let good: [String: Any] = ["slot": 0, "status": "grounded", "claim": "Supported claim", "title": "Valid title", "hook": "Valid hook", "sentences": ["Complete supported sentence."], "evidence": ["e1"], "claimEvidenceIds": ["e1"]]
        var bad = good; bad["title"] = 123
        let raw = String(data: try JSONSerialization.data(withJSONObject: ["facts": [good, bad]]), encoding: .utf8)!
        let parsed = try StructuredResponse.parse(raw, schema: groundedSchema)
        XCTAssertEqual((parsed["facts"] as? [[String: Any]])?.count, 1)
    }
    func testPartialSearchPlansRetainEveryValidTerm() throws {
        let group: [String: Any] = ["type": "OBJECT", "properties": ["label": ["type": "STRING"], "terms": ["type": "ARRAY", "items": ["type": "STRING"]], "related": ["type": "ARRAY", "items": ["type": "STRING"]]], "required": ["label", "terms", "related"]]
        let planSchema: [String: Any] = ["type": "OBJECT", "properties": ["terms": ["type": "ARRAY", "items": ["type": "STRING"]], "groups": ["type": "ARRAY", "items": group]]]
        let parsed = try StructuredResponse.parse(#"{"terms":["stars",null,12,"supernova"],"groups":[null,{"label":12,"terms":["stellar collapse",99],"related":123},{"terms":123}]}"#, schema: planSchema)
        XCTAssertEqual(parsed["terms"] as? [String], ["stars", "supernova"])
        let groups = try XCTUnwrap(parsed["groups"] as? [[String: Any]])
        XCTAssertEqual(groups.count, 1); XCTAssertEqual(groups[0]["terms"] as? [String], ["stellar collapse"])
        XCTAssertEqual(groups[0]["related"] as? [String], []); XCTAssertEqual(groups[0]["label"] as? String, "stellar collapse")
    }
}
