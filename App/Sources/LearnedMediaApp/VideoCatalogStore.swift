import Foundation

/// Immutable batches plus an atomic manifest preserve the usable library if a
/// refresh stops before all changed records have been written.
actor VideoCatalogStore {
    private let files = FileManager.default
    private var cached: [String: Any]?
    private var references: [String: String] = [:]
    private var manifestData: Data?
    private let metadataKeys = ["channels", "sourceStates", "catalogVersion", "incomplete", "libraryIncomplete", "lastSyncAt"]

    private func root() throws -> URL {
        let base = try files.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        return base.appendingPathComponent("Learned Media", isDirectory: true)
    }

    private func batchFolder() throws -> URL { try root().appendingPathComponent("youtube-records-v1", isDirectory: true) }
    private func manifestURL() throws -> URL { try root().appendingPathComponent("youtube-catalog-manifest-v1.json") }

    private func readManifest(_ data: Data) throws -> ([String: Any], [String: String]) {
        guard let manifest = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              manifest["storageVersion"] as? Int == 1, let entries = manifest["entries"] as? [[String]],
              entries.allSatisfy({ $0.count == 2 && validBatchName($0[1]) }) else { throw invalid() }
        let directory = try batchFolder()
        var batches: [String: [String: Any]] = [:], refs: [String: String] = [:], videos: [[String: Any]] = []
        for entry in entries {
            let id = entry[0], name = entry[1]
            guard refs[id] == nil else { throw invalid() }
            if batches[name] == nil {
                let data = try Data(contentsOf: directory.appendingPathComponent(name))
                guard let batch = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw invalid() }
                batches[name] = batch
            }
            guard let video = batches[name]?[id] as? [String: Any], video["id"] as? String == id else { throw invalid() }
            refs[id] = name; videos.append(video)
        }
        var catalog = manifest.filter { metadataKeys.contains($0.key) }
        catalog["videos"] = videos
        return (catalog, refs)
    }

    func load() throws -> Any {
        if let cached { return cached }
        let manifest = try manifestURL()
        for url in [manifest, manifest.appendingPathExtension("backup")] where files.fileExists(atPath: url.path) {
            guard let data = try? Data(contentsOf: url), let (catalog, refs) = try? readManifest(data) else { continue }
            cached = catalog; references = refs; manifestData = data
            return catalog
        }
        // Legacy files remain recovery copies until the new manifest commits.
        let legacy = try root().appendingPathComponent("youtube-catalog.json")
        for url in [legacy, legacy.appendingPathExtension("backup")] where files.fileExists(atPath: url.path) {
            guard let data = try? Data(contentsOf: url), let catalog = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { continue }
            cached = catalog
            return catalog
        }
        if files.fileExists(atPath: manifest.path) { throw invalid() }
        return NSNull()
    }

    func save(_ catalog: [String: Any]) throws {
        guard let videos = catalog["videos"] as? [[String: Any]], JSONSerialization.isValidJSONObject(catalog) else { throw invalid() }
        _ = try load()
        var oldVideos: [String: [String: Any]] = [:]
        for video in cached?["videos"] as? [[String: Any]] ?? [] { if let id = video["id"] as? String { oldVideos[id] = video } }
        let directory = try batchFolder()
        try files.createDirectory(at: directory, withIntermediateDirectories: true)
        var entries: [[String]] = [], nextRefs: [String: String] = [:], changes: [[String: Any]] = []
        var seen = Set<String>()
        for video in videos {
            guard let id = video["id"] as? String, !id.isEmpty, seen.insert(id).inserted else { throw invalid() }
            if let name = references[id], let previous = oldVideos[id], sameRecord(previous, video) { nextRefs[id] = name }
            else { changes.append(video) }
        }
        let revision = UUID().uuidString
        for start in stride(from: 0, to: changes.count, by: 100) {
            let name = "\(revision)-\(start / 100).json"
            var batch: [String: Any] = [:]
            for video in changes[start..<min(start + 100, changes.count)] {
                let id = video["id"] as! String
                batch[id] = video; nextRefs[id] = name
            }
            let data = try JSONSerialization.data(withJSONObject: batch, options: [.sortedKeys])
            try data.write(to: directory.appendingPathComponent(name), options: [.atomic])
        }
        for video in videos {
            let id = video["id"] as! String
            guard let name = nextRefs[id] else { throw invalid() }
            entries.append([id, name])
        }
        let metadata = catalog.filter { metadataKeys.contains($0.key) }
        var manifest = metadata
        manifest["storageVersion"] = 1; manifest["entries"] = entries
        let data = try JSONSerialization.data(withJSONObject: manifest, options: [.sortedKeys])
        let target = try manifestURL()
        if let manifestData { try manifestData.write(to: target.appendingPathExtension("backup"), options: [.atomic]) }
        try data.write(to: target, options: [.atomic])
        // Retain the previous manifest's batches for recovery. Cleanup failure
        // cannot invalidate the already published catalog.
        let retained = Set(references.values).union(nextRefs.values)
        cached = metadata.merging(["videos": videos]) { _, new in new }
        references = nextRefs; manifestData = data
        if let stored = try? files.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil, options: [.skipsHiddenFiles]) {
            for url in stored where validBatchName(url.lastPathComponent) && !retained.contains(url.lastPathComponent) { try? files.removeItem(at: url) }
        }
    }

    private func sameRecord(_ left: [String: Any], _ right: [String: Any]) -> Bool {
        let lhs = left.filter { $0.key != "metadataRefreshedAt" }, rhs = right.filter { $0.key != "metadataRefreshedAt" }
        return NSDictionary(dictionary: lhs).isEqual(to: rhs)
    }

    private func validBatchName(_ name: String) -> Bool {
        name.hasSuffix(".json") && name.count < 100 && !name.contains("/") && !name.contains("\\") && !name.contains("..")
    }

    private func invalid() -> NSError {
        NSError(domain: "LearnedMedia.VideoCatalog", code: 1, userInfo: [NSLocalizedDescriptionKey: "The YouTube catalog could not be restored or committed safely. Import checkpoints were retained."])
    }
}
