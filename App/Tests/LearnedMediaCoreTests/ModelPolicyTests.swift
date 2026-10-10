import XCTest
@testable import LearnedMediaCore

final class ModelPolicyTests: XCTestCase {
    func testBothPrimaryModelsAreRequiredForConnection() {
        XCTAssertEqual(GeminiModelPolicy.primaryModels, ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"])
        XCTAssertEqual(Array(GeminiModelPolicy.allowedModels.prefix(2)), GeminiModelPolicy.primaryModels)
        XCTAssertEqual(GeminiModelPolicy.requiredWorkingModels, 2)
    }

    func testRecoveryRetriesEachPrimaryThreeTimesBeforeOtherModelsAndRepeats() {
        let rounds = GeminiModelPolicy.attemptRounds(models: GeminiModelPolicy.allowedModels)
        let recovery = GeminiModelPolicy.primaryModels + GeminiModelPolicy.primaryModels + GeminiModelPolicy.primaryModels + Array(GeminiModelPolicy.allowedModels.dropFirst(2))
        XCTAssertEqual(rounds, [GeminiModelPolicy.allowedModels, recovery, recovery])
        XCTAssertEqual(rounds.flatMap { $0 }.count, 35)
        for primary in GeminiModelPolicy.primaryModels {
            XCTAssertEqual(rounds[1].filter { $0 == primary }.count, 3)
            XCTAssertEqual(rounds[2].filter { $0 == primary }.count, 3)
        }
    }

    func testOptionalSearchUsesOnlyOnePassAndUnavailableModelsStayExcluded() {
        XCTAssertEqual(GeminiModelPolicy.attemptRounds(models: GeminiModelPolicy.primaryModels, recover: false), [GeminiModelPolicy.primaryModels])
        let models = [GeminiModelPolicy.primaryModels[1], "gemini-2.5-flash"]
        XCTAssertEqual(GeminiModelPolicy.attemptRounds(models: models)[1], [models[0], models[0], models[0], models[1]])
    }

    func testEligibleModelsRequireStructuredTextGeneration() {
        XCTAssertTrue(GeminiModelPolicy.isEligible(id: "models/gemini-2.5-flash", methods: ["generateContent"]))
        XCTAssertTrue(GeminiModelPolicy.isEligible(id: "gemini-3.5-flash-lite", methods: ["generateContent"]))
        XCTAssertFalse(GeminiModelPolicy.isEligible(id: "gemini-2.5-image", methods: ["generateContent"]))
        XCTAssertFalse(GeminiModelPolicy.isEligible(id: "gemini-2.5-pro", methods: ["generateContent"]))
        XCTAssertFalse(GeminiModelPolicy.isEligible(id: "gemini-2.5-pro", methods: ["countTokens"]))
    }

    func testOnlyRequestedModelsAreSortedNewestToOldest() {
        let sorted = GeminiModelPolicy.sort([
            "gemini-2.5-pro",
            "gemini-2.5-flash-lite",
            "gemini-2.5-flash",
            "gemini-2.5-flash",
            "gemini-3.5-flash",
            "gemini-3.7-flash",
            "gemini-3.5-flash-lite",
            "gemini-3.8-flash",
            "gemini-3.1-flash-lite"
        ])
        XCTAssertEqual(sorted, ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite", "gemini-3.8-flash", "gemini-2.5-flash"])
        XCTAssertEqual(GeminiModelPolicy.sort(GeminiModelPolicy.allowedModels), GeminiModelPolicy.allowedModels)
    }

    func testTransientRetriesUseShortPerModelBackoffAndRespectRetryAfter() {
        XCTAssertEqual(GeminiRetryTiming.transientDelay(failureCount: 1), 2)
        XCTAssertEqual(GeminiRetryTiming.transientDelay(failureCount: 2), 4)
        XCTAssertEqual(GeminiRetryTiming.transientDelay(failureCount: 3), 8)
        XCTAssertEqual(GeminiRetryTiming.transientDelay(failureCount: 8), 8)
        XCTAssertEqual(GeminiRetryTiming.transientDelay(failureCount: 1, retryAfter: 12.5), 12.5)
    }

    func testCandidateStreamParserHandlesChunkBoundariesAndEscapedText() throws {
        let parser = JSONArrayItemStreamParser(property: "facts")
        let source = #"{"ignored":[{"value":1}],"facts":[{"slot":2,"title":"A } quoted \"title\"","nested":{"values":[1,2]}},{"slot":7,"title":"Second"}]}"#
        var parsed: [[String: Any]] = []
        let characters = Array(source)
        for index in stride(from: 0, to: characters.count, by: 3) {
            parsed += parser.append(String(characters[index..<min(index + 3, characters.count)]))
        }
        XCTAssertEqual(parsed.compactMap { $0["slot"] as? Int }, [2, 7])
        XCTAssertEqual(parsed.first?["title"] as? String, "A } quoted \"title\"")
        let nested = parsed.first?["nested"] as? [String: Any]
        XCTAssertEqual(nested?["values"] as? [Int], [1, 2])

        parser.reset()
        XCTAssertEqual(parser.append(#"{"facts":[{"slot":9}]}"#).compactMap { $0["slot"] as? Int }, [9])
    }
}
