import XCTest
import Foundation
@testable import LearnedMediaCore

private actor ImageDownloadCounter {
    private(set) var count = 0
    func next() -> Int { count += 1; return count }
}

private actor ImageWorkGate {
    private var started = false
    private var releaseWork: CheckedContinuation<Void, Never>?
    private var startWaiters: [CheckedContinuation<Void, Never>] = []

    func waitUntilStarted() async {
        if started { return }
        await withCheckedContinuation { startWaiters.append($0) }
    }

    func hold() async {
        started = true
        startWaiters.forEach { $0.resume() }
        startWaiters.removeAll()
        await withCheckedContinuation { releaseWork = $0 }
    }

    func release() {
        releaseWork?.resume()
        releaseWork = nil
    }
}

final class SharedImageDataCacheTests: XCTestCase {
    func testOverlappingExportsShareImageBytesAndBrieflyReuseSuccess() async throws {
        let cache = SharedImageDataCache(lifetime: 0.5)
        let counter = ImageDownloadCounter()
        let operation: @Sendable () async throws -> Data = {
            let attempt = await counter.next()
            try await Task.sleep(nanoseconds: 50_000_000)
            return Data([UInt8(attempt), 2, 3])
        }

        async let first = cache.data(for: "https://example.invalid/shared.jpg", operation: operation)
        async let second = cache.data(for: "https://example.invalid/shared.jpg", operation: operation)
        let (firstBytes, secondBytes) = try await (first, second)
        XCTAssertEqual(firstBytes, Data([1, 2, 3]))
        XCTAssertEqual(secondBytes, firstBytes)

        let cached = try await cache.data(for: "https://example.invalid/shared.jpg") {
            _ = await counter.next()
            return Data([9])
        }
        XCTAssertEqual(cached, firstBytes)
        let attempts = await counter.count
        XCTAssertEqual(attempts, 1)
    }

    func testCancelingOneExportLeavesSharedImageDownloadForTheOther() async throws {
        let cache = SharedImageDataCache()
        let counter = ImageDownloadCounter()
        let operation: @Sendable () async throws -> Data = {
            let attempt = await counter.next()
            try await Task.sleep(nanoseconds: 80_000_000)
            return Data([UInt8(attempt)])
        }
        let first = Task { try await cache.data(for: "https://example.invalid/one.jpg", operation: operation) }
        let second = Task { try await cache.data(for: "https://example.invalid/one.jpg", operation: operation) }
        try await Task.sleep(nanoseconds: 15_000_000)
        first.cancel()
        do {
            _ = try await first.value
            XCTFail("The canceled export should not receive image bytes")
        } catch is CancellationError { }
        let secondBytes = try await second.value
        XCTAssertEqual(secondBytes, Data([1]))
        let attempts = await counter.count
        XCTAssertEqual(attempts, 1)
    }

    func testOneCanceledExportReturnsWhileTheSharedImageIsStillPending() async throws {
        let cache = SharedImageDataCache()
        let gate = ImageWorkGate()
        let firstFinished = expectation(description: "Canceled export leaves the shared wait promptly")
        let operation: @Sendable () async throws -> Data = {
            await gate.hold()
            return Data([4, 5, 6])
        }
        let first = Task {
            defer { firstFinished.fulfill() }
            return try await cache.data(for: "https://example.invalid/pending.jpg", operation: operation)
        }
        await gate.waitUntilStarted()
        let second = Task { try await cache.data(for: "https://example.invalid/pending.jpg", operation: operation) }
        try await Task.sleep(nanoseconds: 15_000_000)

        first.cancel()
        await fulfillment(of: [firstFinished], timeout: 1)
        do { _ = try await first.value; XCTFail("Canceled export should not return image bytes") } catch is CancellationError { }

        await gate.release()
        let remaining = try await second.value
        XCTAssertEqual(remaining, Data([4, 5, 6]))
    }

    func testCancelingEveryExportStopsFlightAndAllowsFreshRetry() async throws {
        let cache = SharedImageDataCache()
        let counter = ImageDownloadCounter()
        let started = expectation(description: "Image request started")
        let canceled = expectation(description: "Underlying image request canceled")
        let operation: @Sendable () async throws -> Data = {
            _ = await counter.next()
            started.fulfill()
            return try await withTaskCancellationHandler {
                try await Task.sleep(nanoseconds: 2_000_000_000)
                return Data([1])
            } onCancel: {
                canceled.fulfill()
            }
        }
        let first = Task { try await cache.data(for: "https://example.invalid/cancel.jpg", operation: operation) }
        await fulfillment(of: [started], timeout: 1)
        let second = Task { try await cache.data(for: "https://example.invalid/cancel.jpg", operation: operation) }
        try await Task.sleep(nanoseconds: 20_000_000)
        first.cancel()
        second.cancel()
        do { _ = try await first.value; XCTFail("First export should cancel") } catch is CancellationError { }
        do { _ = try await second.value; XCTFail("Second export should cancel") } catch is CancellationError { }
        await fulfillment(of: [canceled], timeout: 1)

        let retry = try await cache.data(for: "https://example.invalid/cancel.jpg") {
            let attempt = await counter.next()
            return Data([UInt8(attempt)])
        }
        XCTAssertEqual(retry, Data([2]))
    }

    func testURLFailureIsNotCachedAndCanBeRetried() async throws {
        let cache = SharedImageDataCache()
        let counter = ImageDownloadCounter()
        do {
            _ = try await cache.data(for: "https://example.invalid/failure.jpg") {
                _ = await counter.next()
                throw URLError(.badServerResponse)
            }
            XCTFail("Expected a failed image response")
        } catch let error as URLError {
            XCTAssertEqual(error.code, .badServerResponse)
        }

        let recovered = try await cache.data(for: "https://example.invalid/failure.jpg") {
            let attempt = await counter.next()
            return Data([UInt8(attempt)])
        }
        XCTAssertEqual(recovered, Data([2]))
        let attempts = await counter.count
        XCTAssertEqual(attempts, 2)
    }

    func testSuccessfulImageBytesExpireAfterTheShortReuseWindow() async throws {
        let cache = SharedImageDataCache(lifetime: 0.03)
        let counter = ImageDownloadCounter()
        let first = try await cache.data(for: "https://example.invalid/short-lived.jpg") {
            let attempt = await counter.next()
            return Data([UInt8(attempt)])
        }
        let immediate = try await cache.data(for: "https://example.invalid/short-lived.jpg") {
            let attempt = await counter.next()
            return Data([UInt8(attempt)])
        }
        XCTAssertEqual(first, immediate)
        try await Task.sleep(nanoseconds: 60_000_000)
        let afterExpiration = try await cache.data(for: "https://example.invalid/short-lived.jpg") {
            let attempt = await counter.next()
            return Data([UInt8(attempt)])
        }
        XCTAssertEqual(afterExpiration, Data([2]))
    }
}
