import Foundation

@main struct YouTubeRefreshCheckpointsTest {
    static func main() async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = YouTubeImportCheckpointStore(directory: directory)
        let source = "playlist:fixture", identity = "fixture-identity", generation = "generation-one"
        func page(_ index: Int, _ token: String, _ next: Any, generation: String = "generation-one") -> [String: Any] {
            ["version": 1, "sourceId": source, "identity": identity, "refreshGeneration": generation,
             "index": index, "requestToken": token, "nextPageToken": next,
             "videos": [["id": "video-\(index)", "approved": true, "sourceIds": [source]]]]
        }
        func mustFail(_ operation: () async throws -> Void) async throws {
            do { try await operation() } catch { return }
            throw NSError(domain: "RefreshTest", code: 1, userInfo: [NSLocalizedDescriptionKey: "An incomplete or mismatched refresh was accepted"])
        }
        try await store.save(page(0, "", "next"))
        try await mustFail { try await store.assertCompleted(source, identity: identity, generation: generation) }
        try await mustFail { try await store.save(page(1, "next", NSNull(), generation: "another-generation")) }
        let staged = try await store.load(source)
        precondition(staged.count == 1, "Failed publication must preserve the staged checkpoint")
        try await store.save(page(1, "next", NSNull()))
        try await store.assertCompleted(source, identity: identity, generation: generation)
        let firstBatch = try await store.loadBatch(source, offset: 0, limit: 1)
        let secondBatch = try await store.loadBatch(source, offset: 1, limit: 1)
        let endBatch = try await store.loadBatch(source, offset: 2, limit: 1)
        precondition(firstBatch.map { $0["index"] as? Int } == [0] && secondBatch.map { $0["index"] as? Int } == [1] && endBatch.isEmpty,
                     "Native checkpoint batches preserve sequence and stop at the end")
        try await mustFail { try await store.assertCompleted(source, identity: "wrong", generation: generation) }
        try await mustFail { try await store.assertCompleted(source, identity: identity, generation: "superseded") }
        let restored = YouTubeImportCheckpointStore(directory: directory)
        try await restored.assertCompleted(source, identity: identity, generation: generation)
        try await restored.clear(source)
        try await mustFail { try await restored.assertCompleted(source, identity: identity, generation: generation) }

        let largeSource = "playlist:batch-fixture", largeIdentity = "batch-identity", largeGeneration = "batch-generation"
        func largePage(_ index: Int) -> [String: Any] {
            ["version": 1, "sourceId": largeSource, "identity": largeIdentity, "refreshGeneration": largeGeneration,
             "index": index, "requestToken": index == 0 ? "" : "token-\(index)",
             "nextPageToken": index == 69 ? NSNull() : "token-\(index + 1)", "videos": [], "savedAt": ISO8601DateFormatter().string(from: Date())]
        }
        for index in 0..<70 { try await store.save(largePage(index)) }
        let batchA = try await store.loadBatch(largeSource, offset: 0, limit: 25)
        let batchB = try await store.loadBatch(largeSource, offset: 25, limit: 25)
        let batchC = try await store.loadBatch(largeSource, offset: 50, limit: 25)
        precondition([batchA.count, batchB.count, batchC.count] == [25, 25, 20], "Native checkpoint reads stay bounded and ordered")
        try await store.assertCompleted(largeSource, identity: largeIdentity, generation: largeGeneration)
        print("Native refresh checkpoints: bounded batches, completion, generation isolation, failure retention and restoration passed")
    }
}
