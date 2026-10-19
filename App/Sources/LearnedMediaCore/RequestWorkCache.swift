import Foundation
import CoreFoundation

public enum RequestIdentity {
    public static func data(task: String, query: String? = nil, topics: Any = [], filters: Any = [:], context: Any = [:]) throws -> Data {
        let normalized = (query ?? "").precomposedStringWithCanonicalMapping.lowercased()
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
        return try JSONSerialization.data(withJSONObject: ["version": 1, "task": task, "query": normalized,
                                                          "topics": topics, "filters": filters, "context": context], options: [.sortedKeys])
    }
    public static func reusableJSON(_ text: String, schema: [String: Any]) -> Bool {
        guard let value = try? JSONSerialization.jsonObject(with: Data(text.utf8)) else { return false }
        return reusable(value, schema: schema)
    }
    private static func reusable(_ value: Any, schema: [String: Any]) -> Bool {
        if let options = schema["enum"] as? [String], let string = value as? String, !options.contains(string) { return false }
        switch schema["type"] as? String {
        case "OBJECT":
            guard let object = value as? [String: Any] else { return false }
            if (schema["required"] as? [String] ?? []).contains(where: { object[$0] == nil }) { return false }
            return (schema["properties"] as? [String: [String: Any]] ?? [:]).allSatisfy { key, field in
                object[key].map { reusable($0, schema: field) } ?? true
            }
        case "ARRAY":
            guard let items = value as? [Any], items.count >= (schema["minItems"] as? Int ?? 0), items.count <= (schema["maxItems"] as? Int ?? Int.max) else { return false }
            return items.allSatisfy { reusable($0, schema: schema["items"] as? [String: Any] ?? [:]) }
        case "STRING": return (value as? String)?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
        case "BOOLEAN": return (value as? NSNumber).map { CFGetTypeID($0) == CFBooleanGetTypeID() } ?? false
        case "INTEGER", "NUMBER":
            guard let number = value as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID(), number.doubleValue.isFinite else { return false }
            return schema["type"] as? String != "INTEGER" || number.doubleValue.rounded() == number.doubleValue
        default: return true
        }
    }

}

/// Shared work is registered before entering the provider queue. Each caller owns its cancellation.
public actor RequestWorkCache<Value> {
    private struct Flight { let id: UUID; let task: Task<Value, Error>; var subscribers: Set<UUID> }
    private struct Entry { let value: Value; let expiresAt: Date; let bytes: Int }
    private var flights: [String: Flight] = [:]
    private var entries: [String: Entry] = [:]
    private var order: [String] = []
    private let limit: Int
    private let lifetime: TimeInterval
    private let maxBytes: Int
    private var bytes = 0

    public init(limit: Int = 100, lifetime: TimeInterval = 1800, maxBytes: Int = 4 * 1024 * 1024) {
        self.limit = max(1, limit); self.lifetime = lifetime; self.maxBytes = max(0, maxBytes)
    }
    private func remove(_ key: String) {
        if let entry = entries.removeValue(forKey: key) { bytes -= entry.bytes }
        order.removeAll { $0 == key }
    }

    public func value(key: String, reusable: @escaping (Value) -> Bool = { _ in true }, operation: @escaping () async throws -> Value) async throws -> Value {
        try Task.checkCancellation()
        if let entry = entries[key], entry.expiresAt > Date() {
            order.removeAll { $0 == key }; order.append(key)
            PerformanceDiagnostics.shared.record(.cache, .cacheHits)
            return entry.value
        }
        remove(key)
        PerformanceDiagnostics.shared.record(.cache, flights[key] == nil ? .cacheMisses : .coalesced)
        let subscriber = UUID()
        var flight = flights[key] ?? Flight(id: UUID(), task: Task { try await operation() }, subscribers: [])
        flight.subscribers.insert(subscriber); flights[key] = flight
        let flightID = flight.id, task = flight.task
        return try await withTaskCancellationHandler {
            do {
                let result = try await task.value
                try Task.checkCancellation()
                if flights[key]?.id == flightID {
                    flights[key] = nil
                    if reusable(result) {
                        let now = Date()
                        for expired in entries.keys.filter({ entries[$0]!.expiresAt <= now }) { remove(expired) }
                        remove(key)
                        let cost = 96 + key.utf16.count * 2 + CacheMemory.estimatedBytes(result, limit: maxBytes)
                        if cost <= maxBytes && lifetime > 0 {
                            entries[key] = Entry(value: result, expiresAt: now.addingTimeInterval(lifetime), bytes: cost)
                            bytes += cost; order.append(key)
                            while (order.count > limit || bytes > maxBytes), let oldest = order.first { remove(oldest) }
                        }
                    }
                }
                return result
            } catch {
                if !Task.isCancelled, flights[key]?.id == flightID { flights[key] = nil }
                release(key: key, flightID: flightID, subscriber: subscriber)
                throw error
            }
        } onCancel: {
            Task { await self.release(key: key, flightID: flightID, subscriber: subscriber) }
        }
    }

    private func release(key: String, flightID: UUID, subscriber: UUID) {
        guard var flight = flights[key], flight.id == flightID else { return }
        flight.subscribers.remove(subscriber)
        if flight.subscribers.isEmpty { flights[key] = nil; flight.task.cancel() }
        else { flights[key] = flight }
    }

    public func clear() {
        flights.values.forEach { $0.task.cancel() }
        flights.removeAll(); entries.removeAll(); order.removeAll(); bytes = 0
    }
}
