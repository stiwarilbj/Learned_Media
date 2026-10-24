import XCTest
@testable import LearnedMediaCore
final class FactDownloadArchiveTests: XCTestCase {
    func testUTF8ArchiveAndBoundaries() throws {
        let data = try FactDownloadArchive.build([(name: "Folder/001-Émilie.txt", data: Data("complete".utf8)), (name: "Folder/002-Émilie.txt", data: Data("second".utf8))])
        XCTAssertEqual(Array(data.prefix(4)), [0x50, 0x4b, 3, 4])
        XCTAssertEqual(data[7], 8)
        XCTAssertNotNil(data.range(of: Data("Folder/002-Émilie.txt".utf8)))
        XCTAssertThrowsError(try FactDownloadArchive.build([(name: "../bad.txt", data: Data())]))
        XCTAssertThrowsError(try FactDownloadArchive.build(Array(repeating: (name: "a", data: Data()), count: 65536)))
    }
}
