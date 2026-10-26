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
        try store.save(ownerID: "account-a", workspaceID: "workspace-legacy", videoID: "video-legacy", seconds: 63, updatedAt: Date(timeIntervalSince1970: 400))

        XCTAssertEqual(store.checkpoint(ownerID: "account-a", workspaceID: "workspace-a")?.seconds, 42)
        XCTAssertEqual(store.checkpoint(ownerID: "account-b", workspaceID: "workspace-a")?.videoID, "video-2")
        XCTAssertNil(store.checkpoint(ownerID: "account-c", workspaceID: "workspace-a"))
        XCTAssertEqual(store.checkpoints(ownerID: "account-a", workspaceIDs: ["workspace-a", "workspace-legacy", "workspace-missing"]).count, 2)
        XCTAssertNil(store.checkpoints(ownerID: "account-b", workspaceIDs: ["workspace-a"])["workspace-legacy"])

        let snapshot: [String: Any] = [
            "cloudOwnerId": "account-a",
            "workspaces": [
                ["id": "workspace-a", "state": ["youtubeActivity": ["playbackPositions": ["older-video": 9]]]],
                ["id": "workspace-b", "state": ["youtubeActivity": ["savedIds": ["keep"]]]],
                ["id": "workspace-legacy", "state": [
                    "youtube": ["savedIds": ["legacy-saved", "shared-saved"], "history": [["videoId": "legacy-history"], ["videoId": "shared-history", "watchedAt": "old"]], "playbackPositions": ["older-video": 7, "legacy-video": 6], "prioritizeRecentByChannel": ["Crash Course": true]],
                    "youtubeActivity": ["savedIds": ["canonical-saved", "shared-saved"], "history": [["videoId": "canonical-history"], ["videoId": "shared-history", "watchedAt": "new"]], "playbackPositions": ["older-video": 8, "canonical-video": 5], "prioritizeRecentByChannel": ["Crash Course": false, "Mental Floss": false]]
                ]],
                ["id": "workspace-legacy-no-checkpoint", "state": ["youtube": ["savedIds": ["legacy-without-checkpoint"], "playbackPositions": ["older-video": 11]]]]
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
        let legacyState = try XCTUnwrap(records[2]["state"] as? [String: Any])
        let legacyActivity = try XCTUnwrap(legacyState["youtubeActivity"] as? [String: Any])
        XCTAssertEqual(legacyActivity["savedIds"] as? [String], ["canonical-saved", "shared-saved", "legacy-saved"])
        let restoredHistory = try XCTUnwrap(legacyActivity["history"] as? [[String: String]])
        XCTAssertEqual(restoredHistory.map { $0["videoId"] }, ["canonical-history", "shared-history", "legacy-history"])
        XCTAssertEqual(restoredHistory[1]["watchedAt"], "new")
        let restoredPositions = try XCTUnwrap(legacyActivity["playbackPositions"] as? [String: Int])
        XCTAssertEqual(restoredPositions["older-video"], 8)
        XCTAssertEqual(restoredPositions["legacy-video"], 6)
        XCTAssertEqual(restoredPositions["canonical-video"], 5)
        XCTAssertEqual((legacyActivity["playbackPositions"] as? [String: Int])?["video-legacy"], 63)
        XCTAssertEqual((legacyActivity["prioritizeRecentByChannel"] as? [String: Bool])?["Crash Course"], false)
        XCTAssertEqual((legacyActivity["prioritizeRecentByChannel"] as? [String: Bool])?["Mental Floss"], false)
        let legacyWithoutCheckpoint = try XCTUnwrap(records[3]["state"] as? [String: Any])
        let legacyWithoutCheckpointActivity = try XCTUnwrap(legacyWithoutCheckpoint["youtubeActivity"] as? [String: Any])
        XCTAssertEqual(legacyWithoutCheckpointActivity["savedIds"] as? [String], ["legacy-without-checkpoint"])
        XCTAssertEqual((legacyWithoutCheckpointActivity["playbackPositions"] as? [String: Int])?["older-video"], 11)
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
