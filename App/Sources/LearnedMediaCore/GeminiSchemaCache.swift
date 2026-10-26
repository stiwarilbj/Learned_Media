import Foundation

/// Bounded, thread-safe cache for immutable JSON schema fragments.
public final class GeminiSchemaCache: @unchecked Sendable {
    private let lock = NSLock()
    private let capacity: Int
    private var schemas: [String: [String: Any]] = [:]
    private var order: [String] = []

    public init(capacity: Int = 16) {
        self.capacity = max(1, capacity)
    }

    public var count: Int {
        lock.lock()
        defer { lock.unlock() }
        return schemas.count
    }

    public func value(for key: String, create: () -> [String: Any]) -> [String: Any] {
        lock.lock()
        defer { lock.unlock() }
        if let cached = schemas[key] {
            order.removeAll { $0 == key }
            order.append(key)
            return cached
        }
        let schema = create()
        schemas[key] = schema
        order.append(key)
        if order.count > capacity {
            let evicted = order.removeFirst()
            schemas.removeValue(forKey: evicted)
        }
        return schema
    }
}
