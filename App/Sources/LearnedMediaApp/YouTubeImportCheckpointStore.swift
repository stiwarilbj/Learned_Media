import CryptoKit
import Foundation

/// One atomic file contains a validated page and its continuation token.
/// The next cursor is derived from the contiguous page chain, never a second file.
actor YouTubeImportCheckpointStore {
    private let files = FileManager.default
    private let directory: URL?

    init(directory: URL? = nil) { self.directory = directory }

    private func root() throws -> URL {
        if let directory { return directory }
        let base = try files.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        return base.appendingPathComponent("Learned Media/youtube-import-pages-v1", isDirectory: true)
    }

    private func folder(_ sourceID: String) throws -> URL {
        guard !sourceID.isEmpty, sourceID.utf8.count <= 1024 else { throw invalid() }
        let name = SHA256.hash(data: Data(sourceID.utf8)).map { String(format: "%02x", $0) }.joined()
        return try root().appendingPathComponent(name, isDirectory: true)
    }

    private func pageFiles(_ directory: URL) throws -> [URL] {
        guard files.fileExists(atPath: directory.path) else { return [] }
        return try files.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil, options: [.skipsHiddenFiles])
            .filter { $0.pathExtension == "json" }.sorted { $0.lastPathComponent < $1.lastPathComponent }
    }

    func has(_ sourceID: String?) throws -> Bool {
        if let sourceID { return try !pageFiles(folder(sourceID)).isEmpty }
        let directory = try root()
        guard files.fileExists(atPath: directory.path) else { return false }
        for item in try files.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil, options: [.skipsHiddenFiles]) {
            if try !pageFiles(item).isEmpty { return true }
        }
        return false
    }

    func load(_ sourceID: String) throws -> [[String: Any]] {
        var pages: [[String: Any]] = []
        for file in try pageFiles(folder(sourceID)) {
            let data = try Data(contentsOf: file)
            // Let the shared validator discard a corrupt chain as a unit.
            guard let page = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [[:]] }
            pages.append(page)
        }
        return pages
    }

    func save(_ page: [String: Any]) throws {
        guard page["version"] as? Int == 1, let sourceID = page["sourceId"] as? String,
              let identity = page["identity"] as? String, !identity.isEmpty, identity.utf8.count <= 4096,
              let generation = page["refreshGeneration"] as? String, !generation.isEmpty, generation.utf8.count <= 128,
              let index = page["index"] as? Int, (0...99_999_999).contains(index),
              let token = page["requestToken"] as? String, token.utf8.count <= 4096,
              page["nextPageToken"] is NSNull || (page["nextPageToken"] as? String).map({ !$0.isEmpty && $0.utf8.count <= 4096 }) == true,
              let videos = page["videos"] as? [[String: Any]], videos.count <= 50,
              videos.allSatisfy({ $0["approved"] as? Bool == true && ($0["sourceIds"] as? [String])?.contains(sourceID) == true }),
              JSONSerialization.isValidJSONObject(page) else { throw invalid() }
        let directory = try folder(sourceID)
        let target = directory.appendingPathComponent(String(format: "%08d.json", index))
        let data = try JSONSerialization.data(withJSONObject: page, options: [.sortedKeys])
        guard data.count <= 8 * 1024 * 1024 else { throw invalid() }
        if files.fileExists(atPath: target.path) {
            guard try Data(contentsOf: target) == data else { throw invalid() }
            return // An acknowledged write is safe to repeat.
        }
        if index == 0 {
            guard token.isEmpty else { throw invalid() }
        } else {
            let previousURL = directory.appendingPathComponent(String(format: "%08d.json", index - 1))
            guard let previous = try JSONSerialization.jsonObject(with: Data(contentsOf: previousURL)) as? [String: Any],
                  previous["identity"] as? String == identity, previous["sourceId"] as? String == sourceID,
                  previous["refreshGeneration"] as? String == generation,
                  previous["nextPageToken"] as? String == token else { throw invalid() }
        }
        try files.createDirectory(at: directory, withIntermediateDirectories: true)
        try data.write(to: target, options: [.atomic])
    }

    /// Only a contiguous terminal generation can replace published membership.
    func assertCompleted(_ sourceID: String, identity: String, generation: String) throws {
        let pages = try load(sourceID)
        guard !pages.isEmpty, !generation.isEmpty, generation.utf8.count <= 128 else { throw invalid() }
        var expected: String? = ""
        var seen = Set<String>()
        for (index, page) in pages.enumerated() {
            guard let token = expected, seen.insert(token).inserted,
                  page["version"] as? Int == 1, page["sourceId"] as? String == sourceID,
                  page["identity"] as? String == identity, page["refreshGeneration"] as? String == generation,
                  page["index"] as? Int == index, page["requestToken"] as? String == token else { throw invalid() }
            if page["nextPageToken"] is NSNull { expected = nil }
            else {
                guard let next = page["nextPageToken"] as? String, !next.isEmpty,
                      next.utf8.count <= 4096, !seen.contains(next) else { throw invalid() }
                expected = next
            }
        }
        guard expected == nil else { throw invalid() }
    }

    func clear(_ sourceID: String) throws {
        let directory = try folder(sourceID)
        if files.fileExists(atPath: directory.path) { try files.removeItem(at: directory) }
    }

    private func invalid() -> NSError {
        NSError(domain: "LearnedMedia.YouTubeCheckpoint", code: 1, userInfo: [NSLocalizedDescriptionKey: "The YouTube import checkpoint could not be committed. Retry to resume safely."])
    }
}
