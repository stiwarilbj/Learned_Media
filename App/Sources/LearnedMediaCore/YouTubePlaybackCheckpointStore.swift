import Foundation

public struct YouTubePlaybackCheckpoint: Codable, Equatable {
    public let ownerID: String
    public let workspaceID: String
    public let videoID: String
    public let seconds: Int
    public let updatedAt: Date

    public init(ownerID: String, workspaceID: String, videoID: String, seconds: Int, updatedAt: Date = Date()) {
        self.ownerID = ownerID
        self.workspaceID = workspaceID
        self.videoID = videoID
        self.seconds = seconds
        self.updatedAt = updatedAt
    }
}

/// Stores the latest native player position separately from the much larger workspace snapshot.
public final class YouTubePlaybackCheckpointStore: @unchecked Sendable {
    private let defaults: UserDefaults
    private let lock = NSLock()
    private let prefix = "learned-media-youtube-playback-v1."

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    public func save(ownerID: String, workspaceID: String, videoID: String, seconds: Int, updatedAt: Date = Date()) throws {
        let checkpoint = YouTubePlaybackCheckpoint(ownerID: ownerID, workspaceID: workspaceID, videoID: videoID, seconds: seconds, updatedAt: updatedAt)
        guard valid(checkpoint) else { throw PlaybackCheckpointError.invalid }
        let data = try JSONEncoder().encode(checkpoint)
        lock.lock()
        defer { lock.unlock() }
        defaults.set(data, forKey: key(ownerID: ownerID, workspaceID: workspaceID))
    }

    public func checkpoint(ownerID: String, workspaceID: String) -> YouTubePlaybackCheckpoint? {
        lock.lock()
        defer { lock.unlock() }
        guard let data = defaults.data(forKey: key(ownerID: ownerID, workspaceID: workspaceID)),
              let checkpoint = try? JSONDecoder().decode(YouTubePlaybackCheckpoint.self, from: data),
              valid(checkpoint), checkpoint.ownerID == ownerID, checkpoint.workspaceID == workspaceID else { return nil }
        return checkpoint
    }

    public func checkpoints(ownerID: String, workspaceIDs: [String]) -> [String: [String: Any]] {
        guard !ownerID.isEmpty else { return [:] }
        var result: [String: [String: Any]] = [:]
        for workspaceID in Set(workspaceIDs).prefix(250) where !workspaceID.isEmpty && workspaceID.utf8.count <= 256 {
            guard let value = checkpoint(ownerID: ownerID, workspaceID: workspaceID) else { continue }
            result[workspaceID] = [
                "videoID": value.videoID,
                "seconds": value.seconds,
                "updatedAt": value.updatedAt.timeIntervalSince1970
            ]
        }
        return result
    }

    /// Overlays only the local latest position; the sidecar is never added to the cloud schema.
    public func mergingIntoSnapshot(_ value: Any) -> Any {
        guard var envelope = value as? [String: Any], let records = envelope["workspaces"] as? [[String: Any]] else { return value }
        let account = envelope["account"] as? [String: Any]
        let ownerID = (account?["id"] as? String).flatMap { $0.isEmpty ? nil : $0 }
            ?? (envelope["cloudOwnerId"] as? String).flatMap { $0.isEmpty ? nil : $0 }
            ?? "local"
        var changed = false
        let merged = records.map { rawRecord -> [String: Any] in
            guard let workspaceID = rawRecord["id"] as? String,
                  !workspaceID.isEmpty else { return rawRecord }
            var record = rawRecord
            var state = record["state"] as? [String: Any] ?? [:]
            let legacyActivity = state["youtube"] as? [String: Any] ?? [:]
            let canonicalActivity = state["youtubeActivity"] as? [String: Any] ?? [:]
            var activity = Self.mergeActivity(legacy: legacyActivity, canonical: canonicalActivity)
            let checkpoint = checkpoint(ownerID: ownerID, workspaceID: workspaceID)
            guard !activity.isEmpty || checkpoint != nil else { return rawRecord }
            var positions = activity["playbackPositions"] as? [String: Any] ?? [:]
            if let checkpoint { positions[checkpoint.videoID] = checkpoint.seconds }
            if !positions.isEmpty || activity["playbackPositions"] != nil { activity["playbackPositions"] = positions }
            state["youtubeActivity"] = activity
            record["state"] = state
            changed = true
            return record
        }
        if changed { envelope["workspaces"] = merged }
        return envelope
    }

    private static func mergeActivity(legacy: [String: Any], canonical: [String: Any]) -> [String: Any] {
        var result = legacy.merging(canonical) { _, newer in newer }
        let savedIDs = (canonical["savedIds"] as? [String] ?? []) + (legacy["savedIds"] as? [String] ?? [])
        if canonical["savedIds"] != nil || legacy["savedIds"] != nil {
            var seen = Set<String>()
            result["savedIds"] = savedIDs.filter { seen.insert($0).inserted }
        }
        let history = (canonical["history"] as? [[String: Any]] ?? []) + (legacy["history"] as? [[String: Any]] ?? [])
        if canonical["history"] != nil || legacy["history"] != nil {
            var seen = Set<String>()
            result["history"] = history.filter { entry in
                guard let videoID = entry["videoId"] as? String, !videoID.isEmpty else { return true }
                return seen.insert(videoID).inserted
            }.prefix(200).map { $0 }
        }
        for field in ["playbackPositions", "prioritizeRecentByChannel"] {
            let old = legacy[field] as? [String: Any] ?? [:]
            let new = canonical[field] as? [String: Any] ?? [:]
            if legacy[field] != nil || canonical[field] != nil {
                result[field] = old.merging(new) { _, newer in newer }
            }
        }
        return result
    }

    private func key(ownerID: String, workspaceID: String) -> String {
        let scope = Data((ownerID + "\u{0}" + workspaceID).utf8).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
        return prefix + scope
    }

    private func valid(_ checkpoint: YouTubePlaybackCheckpoint) -> Bool {
        !checkpoint.ownerID.isEmpty && checkpoint.ownerID.utf8.count <= 256
            && !checkpoint.workspaceID.isEmpty && checkpoint.workspaceID.utf8.count <= 256
            && !checkpoint.videoID.isEmpty && checkpoint.videoID.utf8.count <= 200
            && (0...86_400).contains(checkpoint.seconds)
            && checkpoint.updatedAt.timeIntervalSince1970.isFinite
    }
}

public enum PlaybackCheckpointError: Error {
    case invalid
}
