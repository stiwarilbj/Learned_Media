import XCTest
@testable import LearnedMediaCore

final class ParityTests: XCTestCase {
    func testGenerationContextIsOptionalAndOperationLocal() {
        let plain = PromptBuilder.build(.candidate, fields: GenerationPromptContext().fields)
        XCTAssertFalse(plain.contains("Surprise mode"))
        XCTAssertFalse(plain.contains("Optional thread context"))
        let context = GenerationPromptContext(surpriseMe: true, rabbitHole: "  pendulums  ")
        let prompt = PromptBuilder.build(.candidate, fields: context.fields)
        XCTAssertTrue(prompt.contains("Choose a surprising example within the selected fact angle and assigned topic."))
        XCTAssertTrue(prompt.contains("pendulums"))
        XCTAssertFalse(plain.contains("pendulums"))
    }

    func testFactAngleOptionsStayStableAndReachCandidateAndGroundingPrompts() {
        let expected: [FactAngle] = [.varied, .unexpectedMechanism, .unusualDecision, .failedExperiment, .overlookedDetail]
        XCTAssertEqual(FactAngle.allCases, expected)
        XCTAssertEqual(expected.map(\.rawValue), ["varied", "unexpected-mechanism", "unusual-decision", "failed-experiment", "overlooked-detail"])
        XCTAssertEqual(GenerationPromptContext().factAngle, .varied)

        for angle in expected {
            let context = GenerationPromptContext(factAngle: angle)
            let candidate = PromptBuilder.build(.candidate, rules: [context.factAngleRule], fields: context.fields)
            let grounding = PromptBuilder.factCard(sentenceCount: 3, difficulties: [5], fields: context.fields, additionalRules: [context.factAngleRule])
            XCTAssertTrue(candidate.contains(angle.label))
            XCTAssertTrue(candidate.contains(angle.instruction))
            XCTAssertTrue(grounding.contains(angle.label))
            XCTAssertTrue(grounding.contains(angle.instruction))
            XCTAssertEqual(candidate.components(separatedBy: angle.instruction).count - 1, 1)
            XCTAssertEqual(grounding.components(separatedBy: angle.instruction).count - 1, 1)
        }
        XCTAssertNil(FactAngle(rawValue: "Unexpected mechanism"))
        XCTAssertTrue(FactAngle.failedExperiment.instruction.contains("negative finding"))
    }
    func testActivityExchangePreservesExplicitFalseAndCanonicalFields() throws {
        let source: [String: Any] = ["topic":"Science", "tab":"saved", "order":"oldest", "prioritizeRecentByChannel":["Crash Course":false,"Other":true], "savedIds":["video"]]
        let restored = WorkspaceActivity.canonicalized(source)
        XCTAssertEqual(restored["selectedTopic"] as? String, "Science")
        XCTAssertEqual(restored["activeTab"] as? String, "saved")
        XCTAssertEqual(restored["channelOrder"] as? String, "oldest")
        XCTAssertNil(restored["topic"])
        let bytes = try JSONSerialization.data(withJSONObject: restored)
        let roundTrip = try XCTUnwrap(JSONSerialization.jsonObject(with: bytes) as? [String:Any])
        XCTAssertEqual((roundTrip["prioritizeRecentByChannel"] as? [String:Bool])?["Crash Course"], false)
        XCTAssertEqual(WorkspaceActivity.canonicalized(["selectedTopic":"History","topic":"Science"])["selectedTopic"] as? String,"History")
    }

    func testYouTubePlaybackCheckpointIsCompactScopedAndMergedOnLoadAndSave() throws {
        let suite = "LearnedMediaPlaybackCheckpointTests-\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        let store = YouTubePlaybackCheckpointStore(defaults: defaults)
        try store.save(ownerID: "account-a", workspaceID: "workspace-a", videoID: "video-1", seconds: 42, updatedAt: Date(timeIntervalSince1970: 100))
        try store.save(ownerID: "account-b", workspaceID: "workspace-a", videoID: "video-2", seconds: 88, updatedAt: Date(timeIntervalSince1970: 200))
        try store.save(ownerID: "account-a", workspaceID: "workspace-b", videoID: "video-3", seconds: 17, updatedAt: Date(timeIntervalSince1970: 300))

        XCTAssertEqual(store.checkpoint(ownerID: "account-a", workspaceID: "workspace-a")?.seconds, 42)
        XCTAssertEqual(store.checkpoint(ownerID: "account-b", workspaceID: "workspace-a")?.videoID, "video-2")
        XCTAssertNil(store.checkpoint(ownerID: "account-c", workspaceID: "workspace-a"))

        let snapshot: [String: Any] = [
            "cloudOwnerId": "account-a",
            "workspaces": [
                ["id": "workspace-a", "state": ["youtubeActivity": ["playbackPositions": ["older-video": 9]]]],
                ["id": "workspace-b", "state": ["youtubeActivity": ["savedIds": ["keep"]]]]
            ]
        ]
        let merged = try XCTUnwrap(store.mergingIntoSnapshot(snapshot) as? [String: Any])
        let records = try XCTUnwrap(merged["workspaces"] as? [[String: Any]])
        let firstState = try XCTUnwrap(records[0]["state"] as? [String: Any])
        let firstActivity = try XCTUnwrap(firstState["youtubeActivity"] as? [String: Any])
        let firstPositions = try XCTUnwrap(firstActivity["playbackPositions"] as? [String: Int])
        XCTAssertEqual(firstPositions["video-1"], 42)
        XCTAssertEqual(firstPositions["older-video"], 9)
        let secondState = try XCTUnwrap(records[1]["state"] as? [String: Any])
        let secondActivity = try XCTUnwrap(secondState["youtubeActivity"] as? [String: Any])
        XCTAssertEqual(secondActivity["savedIds"] as? [String], ["keep"])
        XCTAssertEqual((secondActivity["playbackPositions"] as? [String: Int])?["video-3"], 17)
    }

    func testYouTubePlaybackCheckpointRejectsInvalidValues() {
        let suite = "LearnedMediaPlaybackCheckpointInvalid-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        let store = YouTubePlaybackCheckpointStore(defaults: defaults)
        XCTAssertThrowsError(try store.save(ownerID: "", workspaceID: "workspace", videoID: "video", seconds: 1))
        XCTAssertThrowsError(try store.save(ownerID: "account", workspaceID: "workspace", videoID: "video", seconds: -1))
        XCTAssertThrowsError(try store.save(ownerID: "account", workspaceID: "workspace", videoID: "video", seconds: 86_401))
    }
}
