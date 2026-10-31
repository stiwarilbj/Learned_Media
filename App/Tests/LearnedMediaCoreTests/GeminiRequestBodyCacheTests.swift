import XCTest
@testable import LearnedMediaCore

final class GeminiRequestBodyCacheTests: XCTestCase {
    func testBodyMatchesTheExistingGeminiPayload() throws {
        let prompt = "Write one fact about a café's unusual bell."
        let schema: [String: Any] = [
            "type": "OBJECT",
            "properties": ["answer": ["type": "STRING"]],
            "required": ["answer"]
        ]
        let expected: [String: Any] = [
            "contents": [["role": "user", "parts": [["text": prompt]]]],
            "generationConfig": [
                "temperature": 0.92,
                "maxOutputTokens": 4096,
                "responseMimeType": "application/json",
                "responseSchema": schema
            ]
        ]
        let actual = try GeminiRequestBodyCache.serialize(prompt: prompt, schema: schema, maxOutputTokens: 4096, temperature: 0.92)
        let decoded = try XCTUnwrap(JSONSerialization.jsonObject(with: actual) as? [String: Any])
        // JSON object member order is unspecified, so compare the payload
        // structure here. The next test separately verifies byte reuse across
        // model fallbacks for one serialized operation.
        XCTAssertTrue((decoded as NSDictionary).isEqual(to: expected))
    }

    func testOperationCacheReusesFallbackBodiesAndSeparatesCapacityChanges() throws {
        let prompt = "A fixed logical operation"
        let schema: [String: Any] = ["type": "OBJECT", "required": ["answer"]]
        var cache = GeminiRequestBodyCache(prompt: prompt, schema: schema, temperature: 0.92)

        let firstModel = try cache.body(maxOutputTokens: 4096)
        let fallbackModel = try cache.body(maxOutputTokens: 4096)
        XCTAssertEqual(firstModel, fallbackModel)
        XCTAssertEqual(cache.cachedBodyCount, 1)

        let expandedRetry = try cache.body(maxOutputTokens: 8192)
        XCTAssertNotEqual(firstModel, expandedRetry)
        XCTAssertEqual(cache.cachedBodyCount, 2)
    }
}
