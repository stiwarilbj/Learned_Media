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
        try await mustFail { try await store.assertCompleted(source, identity: "wrong", generation: generation) }
        try await mustFail { try await store.assertCompleted(source, identity: identity, generation: "superseded") }
        let restored = YouTubeImportCheckpointStore(directory: directory)
        try await restored.assertCompleted(source, identity: identity, generation: generation)
        try await restored.clear(source)
        try await mustFail { try await restored.assertCompleted(source, identity: identity, generation: generation) }
        print("Native refresh checkpoints: completion, generation isolation, failure retention and restoration passed")
    }
}
