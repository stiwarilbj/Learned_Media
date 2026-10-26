import Foundation

/// Delays existing background retries without replaying requests or affecting Gemini.
public actor BackgroundRetryGate {
    private struct Failure {
        let id = UUID()
        let retryDeadline: ContinuousClock.Instant
        let recordedAt: ContinuousClock.Instant
    }
    private var failures: [String: Failure] = [:]
    private let clock = ContinuousClock()
    public init() {}

    public func wait(_ key: String) async throws -> UUID? {
        let now = clock.now
        failures = failures.filter { $0.value.recordedAt.duration(to: now) < .seconds(1_800) || $0.value.retryDeadline > now }
        while let failure = failures[key] {
            let deadline = max(failure.retryDeadline, clock.now).advanced(by: .milliseconds(Int64.random(in: 0...250)))
            while clock.now < deadline {
                try Task.checkCancellation()
                let nextCheck = min(deadline, clock.now.advanced(by: .seconds(60)))
                try await clock.sleep(until: nextCheck)
            }
            try Task.checkCancellation()
            if failures[key]?.id == failure.id { return failure.id }
        }
        try Task.checkCancellation()
        return nil
    }

    public func failed(_ key: String, retryAfter: String? = nil) {
        let wallNow = Date()
        let now = clock.now
        var deadline = now
        if let previous = failures[key] { deadline = max(deadline, previous.retryDeadline) }
        if let value = retryAfter?.trimmingCharacters(in: .whitespacesAndNewlines) {
            if let seconds = Double(value), seconds.isFinite, seconds >= 0 {
                deadline = max(deadline, now.advanced(by: .milliseconds(Self.milliseconds(seconds))))
            } else {
                let formatter = DateFormatter()
                formatter.locale = Locale(identifier: "en_US_POSIX")
                formatter.timeZone = TimeZone(secondsFromGMT: 0)
                for format in ["EEE, dd MMM yyyy HH:mm:ss zzz", "EEEE, dd-MMM-yy HH:mm:ss zzz", "EEE MMM d HH:mm:ss yyyy"] {
                    formatter.dateFormat = format
                    if let date = formatter.date(from: value) {
                        let delay = max(0, date.timeIntervalSince(wallNow))
                        deadline = max(deadline, now.advanced(by: .milliseconds(Self.milliseconds(delay))))
                        break
                    }
                }
            }
        }
        if failures.count >= 100, let oldest = failures.filter({ $0.value.retryDeadline <= now }).min(by: { $0.value.recordedAt < $1.value.recordedAt }) { failures.removeValue(forKey: oldest.key) }
        failures[key] = Failure(retryDeadline: deadline, recordedAt: now)
    }

    public func succeeded(_ key: String, observed: UUID?) {
        if failures[key]?.id == observed { failures.removeValue(forKey: key) }
    }

    private static func milliseconds(_ seconds: TimeInterval) -> Int64 {
        let milliseconds = max(0, seconds * 1_000).rounded(.up)
        guard milliseconds.isFinite, milliseconds < Double(Int64.max) else { return Int64.max }
        return Int64(milliseconds)
    }
}
