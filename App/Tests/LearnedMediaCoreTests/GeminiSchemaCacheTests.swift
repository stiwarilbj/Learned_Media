import XCTest
@testable import LearnedMediaCore

final class GeminiSchemaCacheTests: XCTestCase {
    func testSameSchemaKeyReusesFragmentWithoutMutatingCachedValue() {
        let cache = GeminiSchemaCache(capacity: 4)
        var builds = 0
        let makeSchema: () -> [String: Any] = {
            builds += 1
            return ["properties": ["facts": ["maxItems": 7, "items": ["properties": ["title": ["type": "STRING"]]]]]]
        }

        let first = cache.value(for: "candidate:7", create: makeSchema)
        var requestCopy = cache.value(for: "candidate:7", create: makeSchema)
        var properties = requestCopy["properties"] as! [String: Any]
        var facts = properties["facts"] as! [String: Any]
        facts["maxItems"] = 99
        properties["facts"] = facts
        requestCopy["properties"] = properties

        let reused = cache.value(for: "candidate:7", create: makeSchema)
        let firstFacts = (first["properties"] as! [String: Any])["facts"] as! [String: Any]
        let reusedFacts = (reused["properties"] as! [String: Any])["facts"] as! [String: Any]
        XCTAssertEqual(builds, 1)
        XCTAssertEqual(firstFacts["maxItems"] as? Int, 7)
        XCTAssertEqual(reusedFacts["maxItems"] as? Int, 7)
    }

    func testParameterizedKeysUseBoundedLeastRecentlyUsedEviction() {
        let cache = GeminiSchemaCache(capacity: 2)
        var builds = 0
        func schema(_ value: Int) -> [String: Any] {
            builds += 1
            return ["maxItems": value, "build": builds]
        }

        _ = cache.value(for: "candidate:7") { schema(7) }
        _ = cache.value(for: "grounded:3:0") { schema(3) }
        _ = cache.value(for: "candidate:7") { schema(70) }
        _ = cache.value(for: "grounded:4:1") { schema(4) }
        XCTAssertEqual(cache.count, 2)

        let rebuilt = cache.value(for: "grounded:3:0") { schema(30) }
        XCTAssertEqual(rebuilt["maxItems"] as? Int, 30)
        XCTAssertEqual(cache.count, 2)
        XCTAssertEqual(cache.value(for: "candidate:7") { schema(70) }["maxItems"] as? Int, 70)
    }
}
