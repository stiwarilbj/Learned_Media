import XCTest
@testable import LearnedMediaCore

final class StreamParserCompactionTests: XCTestCase {
    private let prefix = "{\"ignored\":\"" + String(repeating: "p", count: 4300) + "\","
    private let tail = #""fa\u0063ts":[{"slot":0,"title":"A } quoted \"title\" \\ 😀 e\u0301","nested":{"values":[{"name":"inner"},[1,2,null]],"flag":true}},{"slot":1,"title":"Second","text":"line\nend"}],"after":{"facts":[{"slot":99}]}}"#

    private func retainedCount(_ parser: JSONArrayItemStreamParser) throws -> Int {
        // Inspect retained text without adding production instrumentation.
        let buffer = Mirror(reflecting: parser).children.first { $0.label == "buffer" }?.value
        return try XCTUnwrap(buffer as? [Character]).count
    }

    private func append(_ text: String, size: Int, to parser: JSONArrayItemStreamParser) -> [[String: Any]] {
        let characters = Array(text)
        return stride(from: 0, to: characters.count, by: size).flatMap { offset in
            parser.append(String(characters[offset..<min(offset + size, characters.count)]))
        }
    }

    private func assertSame(_ actual: [[String: Any]], _ expected: [[String: Any]], file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertEqual(actual as NSArray, expected as NSArray, file: file, line: line)
    }

    func testEverySplitAcrossEscapesUnicodeKeysAndNestedArrays() throws {
        let source = prefix + tail
        let characters = Array(source)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(source.utf8)) as? [String: Any])
        let expected = try XCTUnwrap(object["facts"] as? [[String: Any]])
        for cut in (prefix.count - 10)...characters.count {
            let parser = JSONArrayItemStreamParser(property: "facts")
            let first = parser.append(String(characters[..<cut]))
            XCTAssertTrue(parser.append("").isEmpty)
            assertSame(first + parser.append(String(characters[cut...])), expected)
        }
        for size in [1, 2, 3, 7, 31, 4095, 4096, 4097] {
            assertSame(append(source, size: size, to: JSONArrayItemStreamParser(property: "facts")), expected)
        }
    }

    func testLiveItemAndEscapedPropertyNameSurviveCompaction() throws {
        let parser = JSONArrayItemStreamParser(property: "facts")
        let item = #"{"slot":0,"title":"unfinished"#
        let opening = prefix + #""facts":["# + item
        XCTAssertTrue(parser.append(opening).isEmpty)
        XCTAssertEqual(try retainedCount(parser), item.count)
        let rest = " 😀 " + String(repeating: "x", count: 9000) + #"\"still text"}]}"#
        let expectedObject = try XCTUnwrap(JSONSerialization.jsonObject(with: Data((opening + rest).utf8)) as? [String: Any])
        assertSame(append(rest, size: 13, to: parser), try XCTUnwrap(expectedObject["facts"] as? [[String: Any]]))
        XCTAssertEqual(try retainedCount(parser), 0)

        let keyParser = JSONArrayItemStreamParser(property: "facts")
        XCTAssertTrue(keyParser.append(prefix + #""fa\u00"#).isEmpty)
        XCTAssertEqual(try retainedCount(keyParser), 7)
        assertSame(keyParser.append(#"63ts":[{"slot":7}]}"#), [["slot": 7]])
    }

    func testLargeStreamsRetainOnlySmallPrefixAndUnfinishedItem() throws {
        let facts: [[String: Any]] = (0..<1200).map { slot in
            ["slot": slot, "title": "A specific detail 😀", "claim": String(repeating: "Exact quotation ", count: 12), "nested": ["values": [slot, slot + 1]]]
        }
        let data = try JSONSerialization.data(withJSONObject: ["facts": facts], options: [.sortedKeys])
        let characters = Array(try XCTUnwrap(String(data: data, encoding: .utf8)))
        let parser = JSONArrayItemStreamParser(property: "facts")
        var actual: [[String: Any]] = []
        var peak = 0
        for offset in stride(from: 0, to: characters.count, by: 127) {
            actual += parser.append(String(characters[offset..<min(offset + 127, characters.count)]))
            peak = max(peak, try retainedCount(parser))
        }
        assertSame(actual, facts)
        XCTAssertGreaterThan(characters.count, 300_000)
        XCTAssertLessThan(peak, 8192)
    }

    func testMalformedSiblingsAndResetKeepExistingBehavior() throws {
        let source = prefix + #""facts":[{"slot":0,"text":"valid"},null,[{"slot":88}],{"slot":1,"slot":9},{"slot":2,"text":"also valid"},{"slot":3,"text":"unfinished"#
        for size in [1, 3, 11, 4096] {
            let parser = JSONArrayItemStreamParser(property: "facts")
            XCTAssertEqual(append(source, size: size, to: parser).compactMap { $0["slot"] as? Int }, [0, 2])
            parser.reset()
            assertSame(parser.append(#"{"facts":[{"slot":9}]}"#), [["slot": 9]])
        }
        let parser = JSONArrayItemStreamParser(property: "sentences")
        assertSame(append(prefix + #""sentences":[{"value":"A sentence."}]}"#, size: 3, to: parser), [["value": "A sentence."]])
    }
}
