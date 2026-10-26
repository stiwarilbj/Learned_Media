import XCTest
@testable import LearnedMediaCore

final class BackgroundRetryGateTests: XCTestCase {
    func testRetryAfterUsesMonotonicElapsedTimeAndSuccessClearsOnlyObservedFailure() async throws {
        let gate = BackgroundRetryGate()
        let clock = ContinuousClock()
        let started = clock.now

        await gate.failed("videos", retryAfter: "0.03")
        let observed = try await gate.wait("videos")
        let elapsed = started.duration(to: clock.now)

        XCTAssertNotNil(observed)
        XCTAssertGreaterThanOrEqual(elapsed, .milliseconds(20))
        XCTAssertLessThan(elapsed, .seconds(2))

        await gate.succeeded("videos", observed: observed)
        let afterSuccess = try await gate.wait("videos")
        XCTAssertNil(afterSuccess)
    }

    func testPastHttpDateDoesNotCreateAnAdditionalWait() async throws {
        let gate = BackgroundRetryGate()
        await gate.failed("search", retryAfter: "Thu, 01 Jan 1970 00:00:00 GMT")

        let started = ContinuousClock().now
        let observed = try await gate.wait("search")
        XCTAssertNotNil(observed)
        XCTAssertLessThan(started.duration(to: ContinuousClock().now), .seconds(1))
    }
}
