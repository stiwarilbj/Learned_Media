import Foundation
import CoreFoundation

public enum DiagnosticService: String, CaseIterable { case gemini, youtube, wikipedia, cloud, cache }
public enum DiagnosticMetric: String, CaseIterable {
    case requests, coalesced, retries
    case cacheHits = "cache_hits", cacheMisses = "cache_misses", queueMs = "queue_ms"
    case requestBytes = "request_bytes", responseBytesReported = "response_bytes_reported", responseBytesRead = "response_bytes_read"
}

public enum ProviderResponseRootOverride: String {
    case invalidJSON = "invalid-json"
    case nonJSON = "non-json"
}

/// Fixed numeric aggregates, in process memory only. Never accepts identifiers or text.
public final class PerformanceDiagnostics: @unchecked Sendable {
    private struct PathStep: Sendable {
        let key: String
        let firstElement: Bool
    }
    private struct PreparedPath: Sendable {
        let path: String
        let steps: [PathStep]
        init(_ path: String) {
            self.path = path
            steps = path == "$" ? [] : path.split(separator: ".").map { component in
                let firstElement = component.hasSuffix("[0]")
                return PathStep(key: firstElement ? String(component.dropLast(3)) : String(component), firstElement: firstElement)
            }
        }
    }
    // Static initialization is synchronized; metadata contains only generated
    // allowlisted paths and never any provider payload or caller content.
    private static let preparedSchemaFields = Dictionary(uniqueKeysWithValues: ProviderResponseSchema.allCases.map { schema in
        (schema, schema.fields.map(PreparedPath.init))
    })
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
        let fingerprint = schema.rawValue + "|" + (Self.preparedSchemaFields[schema] ?? []).map { field in
            "\(field.path):\(Self.observedType(Self.value(at: field.steps, in: payload), override: field.path == "$" ? rootOverride?.rawValue : nil))"
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

    private static func value(at steps: [PathStep], in root: Any?) -> Any? {
        var current = root
        for step in steps {
            guard let object = current as? [String: Any], let next = object[step.key] else { return nil }
            if step.firstElement {
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
