import Foundation

/// Best-effort preflight only. An estimate or cache-cleanup failure must never
/// replace the normal atomic write or decide that user data was saved.
public enum StoragePressure {
    public static let largeWriteBytes = 4 * 1024 * 1024
    private static let reserveBytes = 8 * 1024 * 1024

    public static func availableBytes(at directory: URL) throws -> Int64? {
        try directory.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey]).volumeAvailableCapacityForImportantUsage
    }

    public static func needsReclamation(writeBytes: Int, additionalBytes: Int = 0, availableBytes: Int64?) -> Bool {
        guard writeBytes >= largeWriteBytes, additionalBytes >= 0, let availableBytes, availableBytes >= 0 else { return false }
        return Double(availableBytes) < Double(writeBytes) + Double(additionalBytes) + Double(reserveBytes)
    }

    public static func prepare(writeBytes: Int, additionalBytes: Int = 0, at directory: URL,
                               capacity: (URL) throws -> Int64? = { try availableBytes(at: $0) },
                               reclaim: () -> Void = { URLCache.shared.removeAllCachedResponses() }) {
        guard writeBytes >= largeWriteBytes else { return }
        guard let available = try? capacity(directory),
              needsReclamation(writeBytes: writeBytes, additionalBytes: additionalBytes, availableBytes: available) else { return }
        // Only the process's reproducible HTTP cache. Never enumerate or delete
        // Application Support, WebKit databases, snapshots, Keychain or imports.
        reclaim()
    }
}
