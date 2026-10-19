import Foundation

public enum DiagnosticService: String, CaseIterable { case gemini, youtube, wikipedia, cloud, cache }
public enum DiagnosticMetric: String, CaseIterable {
    case requests, coalesced, retries
    case cacheHits = "cache_hits", cacheMisses = "cache_misses", queueMs = "queue_ms"
    case requestBytes = "request_bytes", responseBytesReported = "response_bytes_reported", responseBytesRead = "response_bytes_read"
}

/// Fixed numeric aggregates, in process memory only. Never accepts identifiers or text.
public final class PerformanceDiagnostics: @unchecked Sendable {
    public static let shared = PerformanceDiagnostics()
    private let lock = NSLock()
    private var counters: [String: [String: Double]] = [:]
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
    public func snapshot() -> [String: Any] {
        lock.lock(); defer { lock.unlock() }
        return ["version": 1, "scope": "native-process", "counters": counters]
    }
    public func reset() {
        lock.lock(); defer { lock.unlock() }
        counters.removeAll(keepingCapacity: true)
    }
}
