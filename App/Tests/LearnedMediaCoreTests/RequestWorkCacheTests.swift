import XCTest
@testable import LearnedMediaCore

private actor WorkCounter {
    var count = 0
    func next() -> Int { count += 1; return count }
}

final class RequestWorkCacheTests: XCTestCase {
    func testIdentityNormalizesQueryButKeepsFiltersAndContextExact() throws {
        let first = try RequestIdentity.data(task: "question", query: " WHY  does this work? ", topics: ["Science"], filters: ["channelID": "UCAbC"], context: ["quote": "Exact  Quote."])
        XCTAssertEqual(first, try RequestIdentity.data(task: "question", query: "why does this work?", topics: ["Science"], filters: ["channelID": "UCAbC"], context: ["quote": "Exact  Quote."]))
        XCTAssertNotEqual(first, try RequestIdentity.data(task: "question", query: "why does this work?", topics: ["Science"], filters: ["channelID": "ucabc"], context: ["quote": "Exact  Quote."]))
        XCTAssertNotEqual(first, try RequestIdentity.data(task: "learn", query: "why does this work?", topics: ["Science"], filters: ["channelID": "UCAbC"], context: ["quote": "Exact  Quote."]))
    }

    func testPendingAndCachedRequestsPerformWorkOnce() async throws {
        let cache = RequestWorkCache<Int>(), counter = WorkCounter()
        let operation = { let value = await counter.next(); try await Task.sleep(nanoseconds: 30_000_000); return value }
        async let first = cache.value(key: "same", operation: operation)
        async let second = cache.value(key: "same", operation: operation)
        let results = try await [first, second]
        XCTAssertEqual(results, [1, 1])
        let cached = try await cache.value(key: "same", operation: operation)
        XCTAssertEqual(cached, 1)
        let count = await counter.count
        XCTAssertEqual(count, 1)
    }

    func testCancellationOfOneSubscriberPreservesAnother() async throws {
        let cache = RequestWorkCache<Int>(), counter = WorkCounter()
        let operation = { let value = await counter.next(); try await Task.sleep(nanoseconds: 60_000_000); return value }
        let first = Task { try await cache.value(key: "same", operation: operation) }
        let second = Task { try await cache.value(key: "same", operation: operation) }
        try await Task.sleep(nanoseconds: 20_000_000); first.cancel()
        do { _ = try await first.value; XCTFail("Cancelled subscriber should fail") } catch is CancellationError {} catch { XCTFail("Unexpected error: \(error)") }
        let result = try await second.value, count = await counter.count
        XCTAssertEqual(result, 1); XCTAssertEqual(count, 1)
    }

    func testAllCancelledSubscribersAllowFreshWork() async throws {
        let cache = RequestWorkCache<Int>()
        let started = expectation(description: "Shared task started")
        let first = Task { try await cache.value(key: "same") { started.fulfill(); try await Task.sleep(nanoseconds: 1_000_000_000); return 1 } }
        await fulfillment(of: [started], timeout: 1)
        first.cancel()
        _ = try? await first.value
        let result = try await cache.value(key: "same") { 2 }
        XCTAssertEqual(result, 2)
    }

    func testExpiryEvictionInvalidResultsAndFailuresAreNotReused() async throws {
        let cache = RequestWorkCache<Int>(limit: 1), counter = WorkCounter()
        _ = try await cache.value(key: "a") { await counter.next() }
        _ = try await cache.value(key: "b") { await counter.next() }
        let evicted = try await cache.value(key: "a") { await counter.next() }
        XCTAssertEqual(evicted, 3)
        _ = try await cache.value(key: "invalid", reusable: { _ in false }) { 4 }
        let valid = try await cache.value(key: "invalid") { 5 }
        XCTAssertEqual(valid, 5)
        do { _ = try await cache.value(key: "failure") { throw CancellationError() }; XCTFail("Expected failure") } catch {}
        let recovered = try await cache.value(key: "failure") { 6 }
        XCTAssertEqual(recovered, 6)
        let expired = RequestWorkCache<Int>(lifetime: 0)
        _ = try await expired.value(key: "x") { 1 }
        let fresh = try await expired.value(key: "x") { 2 }
        XCTAssertEqual(fresh, 2)
        await cache.clear()
        let reset = try await cache.value(key: "failure") { 7 }
        XCTAssertEqual(reset, 7)
    }

    func testOnlyValidStructuredResultsAreReusable() {
        let schema: [String: Any] = ["type": "OBJECT", "required": ["answer"], "properties": ["answer": ["type": "STRING"]]]
        XCTAssertTrue(RequestIdentity.reusableJSON(#"{"answer":"Supported answer."}"#, schema: schema))
        for value in [#"{}"#, #"{"answer":""}"#, #"{"answer":123}"#, "invalid JSON"] {
            XCTAssertFalse(RequestIdentity.reusableJSON(value, schema: schema))
        }
    }
}
