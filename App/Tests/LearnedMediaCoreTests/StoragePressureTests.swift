import Foundation
import XCTest
@testable import LearnedMediaCore

final class StoragePressureTests: XCTestCase {
    func testOnlyLargeWritesWithKnownInsufficientCapacityReclaim() {
        let size = StoragePressure.largeWriteBytes
        XCTAssertFalse(StoragePressure.needsReclamation(writeBytes: size - 1, availableBytes: 0))
        XCTAssertFalse(StoragePressure.needsReclamation(writeBytes: size, availableBytes: nil))
        XCTAssertFalse(StoragePressure.needsReclamation(writeBytes: size, availableBytes: -1))
        XCTAssertFalse(StoragePressure.needsReclamation(writeBytes: size, availableBytes: Int64(size * 3)))
        XCTAssertTrue(StoragePressure.needsReclamation(writeBytes: size, availableBytes: Int64(size * 3 - 1)))
        XCTAssertTrue(StoragePressure.needsReclamation(writeBytes: size, additionalBytes: size, availableBytes: Int64(size * 3)))
        XCTAssertFalse(StoragePressure.needsReclamation(writeBytes: size, additionalBytes: -1, availableBytes: 0))
        XCTAssertTrue(StoragePressure.needsReclamation(writeBytes: Int.max, additionalBytes: Int.max, availableBytes: 0))
    }

    func testFailedEstimatesAndSmallWritesDoNotTouchCaches() {
        let directory = URL(fileURLWithPath: NSTemporaryDirectory()), size = StoragePressure.largeWriteBytes
        var estimates = 0, reclaimed = 0
        StoragePressure.prepare(writeBytes: 64, at: directory, capacity: { _ in estimates += 1; return 0 }, reclaim: { reclaimed += 1 })
        XCTAssertEqual(estimates, 0)
        StoragePressure.prepare(writeBytes: size, at: directory, capacity: { _ in nil }, reclaim: { reclaimed += 1 })
        StoragePressure.prepare(writeBytes: size, at: directory, capacity: { _ in throw CocoaError(.fileReadUnknown) }, reclaim: { reclaimed += 1 })
        StoragePressure.prepare(writeBytes: size, at: directory, capacity: { _ in Int64(size * 4) }, reclaim: { reclaimed += 1 })
        XCTAssertEqual(reclaimed, 0)
        StoragePressure.prepare(writeBytes: size, at: directory, capacity: { _ in 0 }, reclaim: { reclaimed += 1 })
        XCTAssertEqual(reclaimed, 1)
    }

    func testPressureNeverDeletesWorkspaceOrRecoveryFiles() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let names = ["learning-state.json", "learning-state.json.backup", "youtube-catalog.json", "youtube-import-pages-v1", "credentials", "saved-videos"]
        for name in names { try Data(name.utf8).write(to: directory.appendingPathComponent(name)) }
        // Use the real default cleanup; only URLCache is allowed, never this folder.
        StoragePressure.prepare(writeBytes: StoragePressure.largeWriteBytes, at: directory, capacity: { _ in 0 })
        for name in names { XCTAssertEqual(try Data(contentsOf: directory.appendingPathComponent(name)), Data(name.utf8)) }
    }
}
