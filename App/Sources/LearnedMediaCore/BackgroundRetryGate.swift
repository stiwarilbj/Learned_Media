import Foundation

/// Delays existing background retries without replaying requests or affecting Gemini.
public actor BackgroundRetryGate {
    private struct Failure {
        let id = UUID()
        let retryAt: Date
        let recordedAt: Date
    }
    private var failures: [String: Failure] = [:]
    public init() {}

    public func wait(_ key: String) async throws -> UUID? {
        let now = Date()
        failures = failures.filter { now.timeIntervalSince($0.value.recordedAt) < 1_800 || $0.value.retryAt > now }
        while let failure = failures[key] {
            let deadline = max(failure.retryAt, Date()).addingTimeInterval(Double.random(in: 0...0.25))
            while deadline > Date() {
                try Task.checkCancellation()
                try await Task.sleep(nanoseconds: UInt64(max(0, min(60, deadline.timeIntervalSinceNow)) * 1_000_000_000))
            }
            try Task.checkCancellation()
            if failures[key]?.id == failure.id { return failure.id }
        }
        try Task.checkCancellation()
        return nil
    }

    public func failed(_ key: String, retryAfter: String? = nil) {
        let now = Date()
        var deadline = now
        if let previous = failures[key] { deadline = max(deadline, previous.retryAt) }
        if let value = retryAfter?.trimmingCharacters(in: .whitespacesAndNewlines) {
            if let seconds = Double(value), seconds.isFinite, seconds >= 0 {
                deadline = max(deadline, now.addingTimeInterval(seconds))
            } else {
                let formatter = DateFormatter()
                formatter.locale = Locale(identifier: "en_US_POSIX")
                formatter.timeZone = TimeZone(secondsFromGMT: 0)
                for format in ["EEE, dd MMM yyyy HH:mm:ss zzz", "EEEE, dd-MMM-yy HH:mm:ss zzz", "EEE MMM d HH:mm:ss yyyy"] {
                    formatter.dateFormat = format
                    if let date = formatter.date(from: value) { deadline = max(deadline, date); break }
                }
            }
        }
        if failures.count >= 100, let oldest = failures.filter({ $0.value.retryAt <= now }).min(by: { $0.value.recordedAt < $1.value.recordedAt }) { failures.removeValue(forKey: oldest.key) }
        failures[key] = Failure(retryAt: deadline, recordedAt: now)
    }

    public func succeeded(_ key: String, observed: UUID?) {
        if failures[key]?.id == observed { failures.removeValue(forKey: key) }
    }
}
