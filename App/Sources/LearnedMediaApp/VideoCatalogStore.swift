import Foundation
import CryptoKit

/// Immutable batches plus an atomic manifest preserve the usable library if a
/// refresh stops before all changed records have been written.
actor VideoCatalogStore {
    private static let orphanBatchMinimumAge: TimeInterval = 15 * 60
    private let files = FileManager.default
    private let applicationSupportRoot: URL?
    private var cached: [String: Any]?
    private var cachedVideosByID: [String: [String: Any]]?
    private var references: [String: String] = [:]
    private var batchDigests: [String: String] = [:]
    private var manifestData: Data?
    private let metadataKeys = ["channels", "sourceStates", "catalogVersion", "incomplete", "libraryIncomplete", "lastSyncAt"]

    init(applicationSupportRoot: URL? = nil) {
        self.applicationSupportRoot = applicationSupportRoot
    }

    private func root() throws -> URL {
        let base = try applicationSupportRoot ?? files.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        return base.appendingPathComponent("Learned Media", isDirectory: true)
    }

    private func batchFolder() throws -> URL { try root().appendingPathComponent("youtube-records-v1", isDirectory: true) }
    private func manifestURL() throws -> URL { try root().appendingPathComponent("youtube-catalog-manifest-v1.json") }

    private func indexVideos(_ videos: [[String: Any]]) -> [String: [String: Any]] {
        var indexed = [String: [String: Any]](minimumCapacity: videos.count)
        for video in videos {
            if let id = video["id"] as? String { indexed[id] = video }
        }
        return indexed
    }

    private func readManifest(_ data: Data) throws -> ([String: Any], [String: String], [String: String]) {
        guard let manifest = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              manifest["storageVersion"] as? Int == 1, let entries = manifest["entries"] as? [[String]],
              entries.allSatisfy({ $0.count == 2 && validBatchName($0[1]) }) else { throw invalid() }
        let referencedBatches = Set(entries.map { $0[1] })
        let suppliedDigests: [String: String]?
        if manifest.keys.contains("batchDigests") {
            guard let digests = manifest["batchDigests"] as? [String: String],
                  Set(digests.keys) == referencedBatches,
                  digests.values.allSatisfy(validDigest) else { throw invalid() }
            suppliedDigests = digests
        } else {
            // Manifests written before batch integrity checks remain readable;
            // their file bytes are digested now and recorded on the next save.
            suppliedDigests = nil
        }
        let directory = try batchFolder()
        var entriesByBatch: [String: [(position: Int, id: String)]] = [:]
        var refs: [String: String] = [:]
        for (position, entry) in entries.enumerated() {
            let id = entry[0], name = entry[1]
            guard refs[id] == nil else { throw invalid() }
            refs[id] = name
            entriesByBatch[name, default: []].append((position, id))
        }

        // Keep one decoded batch alive at a time. The manifest may reference a
        // batch from many non-adjacent positions, so write each validated
        // record directly into its original slot before releasing that batch.
        var videos = Array(repeating: [String: Any](), count: entries.count)
        var verifiedDigests: [String: String] = [:]
        for (name, batchEntries) in entriesByBatch {
            let batchData = try Data(contentsOf: directory.appendingPathComponent(name))
            let digest = sha256(batchData)
            if let expected = suppliedDigests?[name], expected != digest { throw invalid() }
            verifiedDigests[name] = digest
            guard let batch = try JSONSerialization.jsonObject(with: batchData) as? [String: Any] else { throw invalid() }
            for entry in batchEntries {
                guard let video = batch[entry.id] as? [String: Any], video["id"] as? String == entry.id else { throw invalid() }
                videos[entry.position] = video
            }
        }
        var catalog = manifest.filter { metadataKeys.contains($0.key) }
        catalog["videos"] = videos
        return (catalog, refs, verifiedDigests)
    }

    func load() throws -> Any {
        if let cached { return cached }
        let manifest = try manifestURL()
        let candidates = [manifest, manifest.appendingPathExtension("backup")]
        var validManifests: [(data: Data, catalog: [String: Any], refs: [String: String], digests: [String: String])] = []
        var referencedBatches = Set<String>()
        var allExistingManifestsValid = true
        for url in candidates where files.fileExists(atPath: url.path) {
            guard let data = try? Data(contentsOf: url), let (catalog, refs, digests) = try? readManifest(data) else {
                allExistingManifestsValid = false
                continue
            }
            referencedBatches.formUnion(refs.values)
            validManifests.append((data, catalog, refs, digests))
        }
        // Never guess at reachability when either recovery manifest is corrupt.
        // Missing manifests are valid absences; any present one must validate.
        if allExistingManifestsValid {
            removeOrphanedBatches(referenced: referencedBatches,
                modifiedBefore: Date().addingTimeInterval(-Self.orphanBatchMinimumAge))
        }
        if let selected = validManifests.first {
            cached = selected.catalog
            cachedVideosByID = indexVideos(selected.catalog["videos"] as? [[String: Any]] ?? [])
            references = selected.refs; batchDigests = selected.digests; manifestData = selected.data
            return selected.catalog
        }
        // Legacy files remain recovery copies until the new manifest commits.
        let legacy = try root().appendingPathComponent("youtube-catalog.json")
        for url in [legacy, legacy.appendingPathExtension("backup")] where files.fileExists(atPath: url.path) {
            guard let data = try? Data(contentsOf: url), let catalog = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { continue }
            cached = catalog
            cachedVideosByID = indexVideos(catalog["videos"] as? [[String: Any]] ?? [])
            return catalog
        }
        if files.fileExists(atPath: manifest.path) { throw invalid() }
        return NSNull()
    }

    func save(_ catalog: [String: Any]) throws {
        guard let videos = catalog["videos"] as? [[String: Any]], JSONSerialization.isValidJSONObject(catalog) else { throw invalid() }
        _ = try load()
        let directory = try batchFolder()
        try files.createDirectory(at: directory, withIntermediateDirectories: true)
        var entries: [[String]] = [], nextRefs: [String: String] = [:], nextDigests: [String: String] = [:], changes: [[String: Any]] = []
        var seen = Set<String>(), cachedVideoMatches = 0
        for video in videos {
            guard let id = video["id"] as? String, !id.isEmpty, seen.insert(id).inserted else { throw invalid() }
            let previous = cachedVideosByID?[id]
            if previous != nil { cachedVideoMatches += 1 }
            if let name = references[id], let previous, sameRecord(previous, video) {
                guard let digest = batchDigests[name] else { throw invalid() }
                nextRefs[id] = name
                nextDigests[name] = digest
            }
            else { changes.append(video) }
        }
        let removedIDs = cachedVideoMatches == cachedVideosByID?.count ? [] : cachedVideosByID?.keys.filter { !seen.contains($0) } ?? []
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
            nextDigests[name] = sha256(data)
        }
        for video in videos {
            let id = video["id"] as! String
            guard let name = nextRefs[id] else { throw invalid() }
            entries.append([id, name])
        }
        let metadata = catalog.filter { metadataKeys.contains($0.key) }
        var manifest = metadata
        manifest["storageVersion"] = 1; manifest["entries"] = entries; manifest["batchDigests"] = nextDigests
        let data = try JSONSerialization.data(withJSONObject: manifest, options: [.sortedKeys])
        let target = try manifestURL()
        if let manifestData { try manifestData.write(to: target.appendingPathExtension("backup"), options: [.atomic]) }
        try data.write(to: target, options: [.atomic])
        // Retain the previous manifest's batches for recovery. Cleanup failure
        // cannot invalidate the already published catalog.
        let retained = Set(references.values).union(nextRefs.values)
        cached = metadata.merging(["videos": videos]) { _, new in new }
        if cachedVideosByID == nil {
            cachedVideosByID = indexVideos(videos)
        } else {
            for id in removedIDs { cachedVideosByID?.removeValue(forKey: id) }
            for video in changes {
                if let id = video["id"] as? String { cachedVideosByID?[id] = video }
            }
        }
        references = nextRefs; batchDigests = nextDigests; manifestData = data
        removeOrphanedBatches(referenced: retained,
            // Both the just-published manifest and its recovery copy are known
            // here, so retain the existing immediate post-commit cleanup.
            modifiedBefore: .distantFuture)
    }

    private func sameRecord(_ left: [String: Any], _ right: [String: Any]) -> Bool {
        let leftCount = left.keys.reduce(into: 0) { if $1 != "metadataRefreshedAt" { $0 += 1 } }
        let rightCount = right.keys.reduce(into: 0) { if $1 != "metadataRefreshedAt" { $0 += 1 } }
        guard leftCount == rightCount else { return false }
        for (key, value) in left where key != "metadataRefreshedAt" {
            guard let other = right[key], let object = value as? NSObject, object.isEqual(other) else { return false }
        }
        return true
    }

    private func validBatchName(_ name: String) -> Bool {
        name.hasSuffix(".json") && name.count < 100 && !name.contains("/") && !name.contains("\\") && !name.contains("..")
    }

    private func validDigest(_ digest: String) -> Bool {
        digest.utf8.count == 64 && digest.utf8.allSatisfy { (48...57).contains($0) || (97...102).contains($0) }
    }

    private func sha256(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    private func removeOrphanedBatches(referenced: Set<String>, modifiedBefore cutoff: Date) {
        guard let directory = try? batchFolder(),
              let stored = try? files.contentsOfDirectory(at: directory,
                includingPropertiesForKeys: [.isRegularFileKey, .contentModificationDateKey],
                options: [.skipsHiddenFiles]) else { return }
        for url in stored {
            let name = url.lastPathComponent
            guard validBatchName(name), !referenced.contains(name),
                  let values = try? url.resourceValues(forKeys: [.isRegularFileKey, .contentModificationDateKey]),
                  values.isRegularFile == true,
                  let modified = values.contentModificationDate, modified < cutoff else { continue }
            try? files.removeItem(at: url)
        }
    }

    private func invalid() -> NSError {
        NSError(domain: "LearnedMedia.VideoCatalog", code: 1, userInfo: [NSLocalizedDescriptionKey: "The YouTube catalog could not be restored or committed safely. Import checkpoints were retained."])
    }
}
