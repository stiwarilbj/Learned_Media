import XCTest
@testable import LearnedMediaCore
final class FactDownloadArchiveTests: XCTestCase {
    func testUTF8ArchiveAndBoundaries() async throws {
        let data = try await FactDownloadArchive.build([(name: "Folder/001-Émilie.txt", data: Data("complete".utf8)), (name: "Folder/002-Émilie.txt", data: Data("second".utf8))])
        XCTAssertEqual(Array(data.prefix(4)), [0x50, 0x4b, 3, 4])
        XCTAssertEqual(data[7], 8)
        XCTAssertEqual(Array(data[14..<18]), [0x23, 0xd0, 0x67, 0x42])
        XCTAssertNotNil(data.range(of: Data("Folder/002-Émilie.txt".utf8)))
        do {
            _ = try await FactDownloadArchive.build([(name: "../bad.txt", data: Data())])
            XCTFail("Unsafe archive paths must be rejected")
        } catch {}
        XCTAssertThrowsError(try FactDownloadArchive.validateSize(Array(repeating: (name: "a", byteCount: 0), count: 65536)))
        XCTAssertThrowsError(try FactDownloadArchive.validateSize([(name: "a", byteCount: 512 * 1024 * 1024)]))
        var tracker = FactDownloadArchive.SizeTracker()
        try tracker.append(name: "Folder/one.txt", byteCount: 8)
        try tracker.append(name: "Folder/two.txt", byteCount: 6)
        XCTAssertThrowsError(try tracker.append(name: "../bad.txt", byteCount: 1))
    }

    func testCanceledArchiveStopsBeforeReturningBytes() async {
        var progressReached = false
        let task = Task {
            try await FactDownloadArchive.build(
                [(name: "Folder/large.bin", data: Data(repeating: 65, count: 24 * 1024 * 1024))],
                onProgress: { _, _, _ in
                    progressReached = true
                    withUnsafeCurrentTask { $0?.cancel() }
                }
            )
        }
        do {
            _ = try await task.value
            XCTFail("An archive canceled during checksum work must not be returned")
        } catch is CancellationError {
            XCTAssertTrue(progressReached, "The test must cancel while a large checksum is running")
        } catch {
            XCTFail("Expected cancellation, got \(error)")
        }
    }
}
