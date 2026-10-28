import Foundation

/// Coalesces image preparation by URL while keeping each export's cancellation independent.
public actor SharedImageDataCache {
    private typealias Continuation = CheckedContinuation<Data, Error>

    private struct Flight {
        let id: UUID
        var task: Task<Void, Never>?
        var subscribers: [UUID: Continuation]
    }

    private struct Entry {
        let id: UUID
        let data: Data
        let expiresAt: Date
        let expiryTask: Task<Void, Never>
    }

    private enum Outcome {
        case success(Data)
        case failure(Error)
    }

    private var flights: [String: Flight] = [:]
    private var entries: [String: Entry] = [:]
    private var order: [String] = []
    private var cachedBytes = 0
    private let entryLimit: Int
    private let lifetime: TimeInterval
    private let byteLimit: Int

    public init(limit: Int = 24, lifetime: TimeInterval = 30, maxBytes: Int = 24 * 1024 * 1024) {
        entryLimit = max(1, limit)
        self.lifetime = min(max(0, lifetime), 86_400)
        byteLimit = max(0, maxBytes)
    }

    public func data(
        for key: String,
        operation: @escaping @Sendable () async throws -> Data
    ) async throws -> Data {
        try Task.checkCancellation()
        let subscriberID = UUID()
        let result = try await withTaskCancellationHandler {
            try Task.checkCancellation()
            return try await withCheckedThrowingContinuation { (continuation: Continuation) in
                register(key: key, subscriberID: subscriberID, continuation: continuation, operation: operation)
            }
        } onCancel: {
            Task { await self.cancel(key: key, subscriberID: subscriberID) }
        }
        try Task.checkCancellation()
        return result
    }

    private func register(
        key: String,
        subscriberID: UUID,
        continuation: Continuation,
        operation: @escaping @Sendable () async throws -> Data
    ) {
        if let entry = entries[key] {
            if entry.expiresAt > Date() {
                order.removeAll { $0 == key }
                order.append(key)
                continuation.resume(returning: entry.data)
                return
            }
            removeEntry(key)
        }

        if var flight = flights[key] {
            flight.subscribers[subscriberID] = continuation
            flights[key] = flight
            return
        }

        let flightID = UUID()
        flights[key] = Flight(id: flightID, task: nil, subscribers: [subscriberID: continuation])
        let task = Task { [weak self] in
            let outcome: Outcome
            do {
                outcome = .success(try await operation())
            } catch {
                outcome = .failure(error)
            }
            await self?.finish(key: key, flightID: flightID, outcome: outcome)
        }
        flights[key]?.task = task
    }

    private func cancel(key: String, subscriberID: UUID) {
        guard var flight = flights[key], let continuation = flight.subscribers.removeValue(forKey: subscriberID) else { return }
        continuation.resume(throwing: CancellationError())
        if flight.subscribers.isEmpty {
            flights[key] = nil
            flight.task?.cancel()
        } else {
            flights[key] = flight
        }
    }

    private func finish(key: String, flightID: UUID, outcome: Outcome) {
        guard let flight = flights[key], flight.id == flightID else { return }
        flights[key] = nil

        switch outcome {
        case .success(let data):
            if !flight.subscribers.isEmpty { remember(data, for: key) }
            for continuation in flight.subscribers.values {
                continuation.resume(returning: data)
            }
        case .failure(let error):
            for continuation in flight.subscribers.values {
                continuation.resume(throwing: error)
            }
        }
    }

    private func remember(_ data: Data, for key: String) {
        guard !data.isEmpty, lifetime > 0, data.count <= byteLimit else { return }
        let now = Date()
        for expired in entries.keys.filter({ entries[$0]!.expiresAt <= now }) {
            removeEntry(expired)
        }
        removeEntry(key)
        while (entries.count >= entryLimit || cachedBytes + data.count > byteLimit), let oldest = order.first {
            removeEntry(oldest)
        }
        let entryID = UUID()
        let delay = UInt64(lifetime * 1_000_000_000)
        let expiryTask = Task { [weak self] in
            do { try await Task.sleep(nanoseconds: delay) } catch { return }
            await self?.expire(key: key, entryID: entryID)
        }
        entries[key] = Entry(id: entryID, data: data, expiresAt: now.addingTimeInterval(lifetime), expiryTask: expiryTask)
        cachedBytes += data.count
        order.append(key)
    }

    private func removeEntry(_ key: String) {
        if let entry = entries.removeValue(forKey: key) {
            entry.expiryTask.cancel()
            cachedBytes -= entry.data.count
        }
        order.removeAll { $0 == key }
    }

    private func expire(key: String, entryID: UUID) {
        guard entries[key]?.id == entryID else { return }
        removeEntry(key)
    }

    public func clear() {
        for flight in flights.values {
            flight.subscribers.values.forEach { $0.resume(throwing: CancellationError()) }
            flight.task?.cancel()
        }
        entries.values.forEach { $0.expiryTask.cancel() }
        flights.removeAll()
        entries.removeAll()
        order.removeAll()
        cachedBytes = 0
    }
}
