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
                  let checkpoint = checkpoint(ownerID: ownerID, workspaceID: workspaceID) else { return rawRecord }
            var record = rawRecord
            var state = record["state"] as? [String: Any] ?? [:]
            var activity = state["youtubeActivity"] as? [String: Any] ?? [:]
            var positions = activity["playbackPositions"] as? [String: Any] ?? [:]
            positions[checkpoint.videoID] = checkpoint.seconds
            activity["playbackPositions"] = positions
            state["youtubeActivity"] = activity
            record["state"] = state
            changed = true
            return record
        }
        if changed { envelope["workspaces"] = merged }
        return envelope
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
