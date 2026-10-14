import XCTest
@testable import LearnedMediaCore

final class OutputCapacityTests: XCTestCase {
    func testOnlyOutputLimitStopsIncreaseCapacity() {
        for reason in [nil, "STOP", "SAFETY", "OTHER", "UNKNOWN"] {
            XCTAssertEqual(OutputCapacity.next(4096, finishReason: reason), 4096)
        }
        XCTAssertEqual(OutputCapacity.next(4096, finishReason: "MAX_TOKENS"), 8192)
        XCTAssertEqual(OutputCapacity.next(65_536, finishReason: "MAX_TOKENS"), 65_536)
        XCTAssertEqual(OutputCapacity.next(Int.max, finishReason: "MAX_TOKENS"), 65_536)
    }
    func testTruncatedBatchRetainsItemsAndCarriesCapacityToMissingSlot() throws {
        let schema: [String: Any] = ["type": "OBJECT", "properties": ["facts": ["type": "ARRAY", "items": ["type": "OBJECT", "properties": ["slot": ["type": "INTEGER"], "claim": ["type": "STRING"]], "required": ["slot", "claim"]]]]]
        let raw = #"{"facts":[{"slot":0,"claim":"Complete"},{"slot":1,"claim":"unfinished"#
        let parsed = try StructuredResponse.parse(raw, schema: schema)
        XCTAssertEqual((parsed["facts"] as? [[String: Any]])?.count, 1)
        let outcomes: [[String: Any]] = [["finishReason": "MAX_TOKENS", "maxOutputTokens": 20_000], ["finishReason": "STOP", "maxOutputTokens": 4000]]
        XCTAssertEqual(OutputCapacity.truncatedFloor(outcomes), 40_000)
        XCTAssertEqual(OutputCapacity.truncatedFloor([["finishReason": "STOP", "maxOutputTokens": 4000]]), 0)
    }
}
