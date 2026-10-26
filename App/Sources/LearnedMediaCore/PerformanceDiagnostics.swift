import Foundation
import CoreFoundation

public enum DiagnosticService: String, CaseIterable { case gemini, youtube, wikipedia, cloud, cache }
public enum DiagnosticMetric: String, CaseIterable {
    case requests, coalesced, retries
    case cacheHits = "cache_hits", cacheMisses = "cache_misses", queueMs = "queue_ms"
    case requestBytes = "request_bytes", responseBytesReported = "response_bytes_reported", responseBytesRead = "response_bytes_read"
}

public enum ProviderResponseSchema: String {
    case wikipediaSearch = "wikipedia.search"
    case wikipediaPages = "wikipedia.pages"
    case wikipediaImages = "wikipedia.images"
    case wikipediaSummary = "wikipedia.summary"
    case youtubeChannels = "youtube.channels"
    case youtubeSearch = "youtube.search"
    case youtubePlaylistItems = "youtube.playlistItems"
    case youtubeVideos = "youtube.videos"
    case youtubeError = "youtube.error"

    fileprivate var fields: [String] {
        switch self {
        case .wikipediaSearch: return ["$", "error", "error.code", "error.info", "query", "query.search", "query.search[0]", "query.search[0].title"]
        case .wikipediaPages: return ["$", "error", "error.code", "error.info", "query", "query.normalized", "query.redirects", "query.pages", "query.pages[0]", "query.pages[0].title", "query.pages[0].fullurl", "query.pages[0].extract", "query.pages[0].pageimage", "query.pages[0].thumbnail", "query.pages[0].thumbnail.source", "query.pages[0].original", "query.pages[0].original.source", "query.pages[0].coordinates", "query.pages[0].coordinates[0]", "query.pages[0].coordinates[0].lat", "query.pages[0].coordinates[0].lon", "query.pages[0].pageprops", "query.pages[0].pageprops.disambiguation"]
        case .wikipediaImages: return ["$", "error", "error.code", "error.info", "query", "query.pages", "query.pages[0]", "query.pages[0].imageinfo", "query.pages[0].imageinfo[0]", "query.pages[0].imageinfo[0].url", "query.pages[0].imageinfo[0].thumburl", "query.pages[0].imageinfo[0].descriptionurl", "query.pages[0].imageinfo[0].extmetadata"]
        case .wikipediaSummary: return ["$", "title", "thumbnail", "thumbnail.source", "originalimage", "originalimage.source", "content_urls", "content_urls.desktop", "content_urls.desktop.page"]
        case .youtubeChannels: return ["$", "items", "items[0]", "items[0].id", "items[0].snippet", "items[0].snippet.title", "items[0].snippet.customUrl", "items[0].snippet.thumbnails", "items[0].contentDetails", "items[0].contentDetails.relatedPlaylists", "items[0].contentDetails.relatedPlaylists.uploads"]
        case .youtubeSearch: return ["$", "items", "items[0]", "items[0].id", "items[0].id.channelId", "items[0].id.videoId", "items[0].snippet", "items[0].snippet.title", "items[0].snippet.channelTitle", "items[0].snippet.channelId"]
        case .youtubePlaylistItems: return ["$", "items", "items[0]", "items[0].contentDetails", "items[0].contentDetails.videoId", "items[0].snippet", "items[0].snippet.title", "items[0].snippet.description", "items[0].snippet.publishedAt", "items[0].snippet.channelId", "nextPageToken"]
        case .youtubeVideos: return ["$", "items", "items[0]", "items[0].id", "items[0].snippet", "items[0].snippet.title", "items[0].snippet.description", "items[0].snippet.publishedAt", "items[0].snippet.channelId", "items[0].snippet.channelTitle", "items[0].snippet.tags", "items[0].snippet.thumbnails", "items[0].contentDetails", "items[0].contentDetails.duration", "items[0].status", "items[0].status.privacyStatus", "items[0].status.embeddable"]
        case .youtubeError: return ["$", "error", "error.code", "error.message", "error.status", "error.errors", "error.errors[0]", "error.errors[0].reason"]
        }
    }
}

public enum ProviderResponseRootOverride: String {
    case invalidJSON = "invalid-json"
    case nonJSON = "non-json"
}

/// Fixed numeric aggregates, in process memory only. Never accepts identifiers or text.
public final class PerformanceDiagnostics: @unchecked Sendable {
    public static let shared = PerformanceDiagnostics()
    private let lock = NSLock()
    private var counters: [String: [String: Double]] = [:]
    private var schemaRing: [String] = []
    private var schemaCounts: [String: Int] = [:]
    private let schemaRingCapacity = 64
    private let limit = 9_007_199_254_740_991.0
    public init() {}

    public func record(_ service: DiagnosticService, _ metric: DiagnosticMetric, _ value: Double = 1) {
        guard value.isFinite, value >= 0 else { return }
        lock.lock(); defer { lock.unlock() }
        let key = "\(service.rawValue).\(metric.rawValue)"
        let sample = min(limit, value)
        let previous = counters[key] ?? [:]
        counters[key] = ["samples": min(limit, (previous["samples"] ?? 0) + 1), "total": min(limit, (previous["total"] ?? 0) + sample), "max": max(previous["max"] ?? 0, sample)]
    }
    public func recordProviderSchemaFailure(_ schema: ProviderResponseSchema, payload: Any?, rootOverride: ProviderResponseRootOverride? = nil) {
        let fingerprint = schema.rawValue + "|" + schema.fields.map { path in
            "\(path):\(Self.observedType(Self.value(at: path, in: payload), override: path == "$" ? rootOverride?.rawValue : nil))"
        }.joined(separator: ",")
        lock.lock(); defer { lock.unlock() }
        if schemaRing.count == schemaRingCapacity {
            let expired = schemaRing.removeFirst()
            let remaining = (schemaCounts[expired] ?? 1) - 1
            if remaining <= 0 { schemaCounts.removeValue(forKey: expired) }
            else { schemaCounts[expired] = remaining }
        }
        schemaRing.append(fingerprint)
        schemaCounts[fingerprint, default: 0] += 1
    }
    public func snapshot() -> [String: Any] {
        lock.lock(); defer { lock.unlock() }
        let schemaFailures = schemaCounts.keys.sorted().map { key -> [String: Any] in
            ["fingerprint": key, "count": schemaCounts[key] ?? 0]
        }
        return ["version": 1, "scope": "native-process", "counters": counters,
                "providerSchemaFailures": schemaFailures]
    }
    public func reset() {
        lock.lock(); defer { lock.unlock() }
        counters.removeAll(keepingCapacity: true)
        schemaRing.removeAll(keepingCapacity: true)
        schemaCounts.removeAll(keepingCapacity: true)
    }

    private static func value(at path: String, in root: Any?) -> Any? {
        if path == "$" { return root }
        var current = root
        for segment in path.split(separator: ".") {
            let component = String(segment)
            let firstElement = component.hasSuffix("[0]")
            let key = firstElement ? String(component.dropLast(3)) : component
            guard let object = current as? [String: Any], let next = object[key] else { return nil }
            if firstElement {
                guard let array = next as? [Any] else { return nil }
                current = array.first
            } else { current = next }
        }
        return current
    }

    private static func observedType(_ value: Any?, override: String?) -> String {
        if let override { return override }
        guard let value else { return "missing" }
        if value is NSNull { return "null" }
        if value is String { return "string" }
        if let number = value as? NSNumber { return CFGetTypeID(number) == CFBooleanGetTypeID() ? "boolean" : "number" }
        if value is [String: Any] { return "object" }
        if value is [Any] { return "array" }
        return "other"
    }
}
