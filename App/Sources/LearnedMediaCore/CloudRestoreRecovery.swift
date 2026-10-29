import Foundation
import Darwin

/// Disposable local merge journal, separate from workspace/recovery snapshots.
/// Page bytes land before the atomic cursor replacement; orphan pages are ignored.
public final class CloudRestoreRecovery {
    public struct Progress {
        public var header: [String: Any]
        public var rows: [[String: Any]]
        public var token: String { header["token"] as! String }
        public var through: String { header["through"] as! String }
        public var after: String? { header["after"] as? String }
        public var complete: Bool { header["complete"] as? Bool ?? false }
    }
    private let root: URL
    private let lock = NSLock()
    public init(directory: URL? = nil) {
        root = directory ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("LearnedMedia/CloudRestoreRecovery", isDirectory: true)
    }
    private func coordinated<T>(_ work: () throws -> T) rethrows -> T? {
        lock.lock(); defer { lock.unlock() }
        do { try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true) } catch { return nil }
        let descriptor = open(root.appendingPathComponent("journal.lock").path, O_CREAT | O_RDWR, S_IRUSR | S_IWUSR)
        guard descriptor >= 0 else { return nil }
        defer { close(descriptor) }
        guard flock(descriptor, LOCK_EX | LOCK_NB) == 0 else { return nil }
        defer { flock(descriptor, LOCK_UN) }
        return try work()
    }
    private func object(_ name: String) -> [String: Any]? {
        guard let bytes = try? Data(contentsOf: root.appendingPathComponent(name)) else { return nil }
        return try? JSONSerialization.jsonObject(with: bytes) as? [String: Any]
    }
    private func write(_ value: [String: Any], _ name: String) throws {
        try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]).write(to: root.appendingPathComponent(name), options: .atomic)
    }
    private func clear() throws {
        for file in try FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil)
            where file.lastPathComponent == "checkpoint.json" || file.lastPathComponent.hasPrefix("page-") {
            try FileManager.default.removeItem(at: file)
        }
    }
    private func valid(_ header: [String: Any], owner: String, source: String) -> Bool {
        guard header["version"] as? Int == 1, header["ownerId"] as? String == owner, header["source"] as? String == source,
              let token = header["token"] as? String, UUID(uuidString: token) != nil,
              let through = header["through"] as? String, !through.isEmpty,
              let pages = header["pages"] as? Int, pages >= 0, let count = header["count"] as? Int, count >= 0,
              header["complete"] is Bool else { return false }
        if let after = header["after"] as? String { return !after.isEmpty && after <= through }
        return header["after"] is NSNull && count == 0
    }
    private func validRows(_ rows: [[String: Any]], through: String, after: String?) -> Bool {
        var previous: String?
        for row in rows {
            guard let id = row["id"] as? String, !id.isEmpty, let after, id <= after, id <= through,
                  previous == nil || id > previous!, let revision = row["revision"] as? String, !revision.isEmpty else { return false }
            if let record = row["record"] {
                guard SnapshotValidation.validate(record, kind: .record, operation: .import),
                      (record as? [String: Any])?["id"] as? String == id else { return false }
            }
            previous = id
        }
        return true
    }
    public func read(owner: String, source: String) -> Progress? {
        try? coordinated {
            guard let header = object("checkpoint.json"), valid(header, owner: owner, source: source) else { try clear(); return nil }
            var rows: [[String: Any]] = []
            for index in 0..<(header["pages"] as! Int) {
                guard let page = object("page-\(index).json"), page["token"] as? String == header["token"] as? String,
                      let entries = page["rows"] as? [[String: Any]] else { try clear(); return nil }
                rows.append(contentsOf: entries)
            }
            guard rows.count == header["count"] as? Int,
                  validRows(rows, through: header["through"] as! String, after: header["after"] as? String) else { try clear(); return nil }
            return Progress(header: header, rows: rows)
        } ?? nil
    }
    public func begin(owner: String, source: String, through: String) -> Progress? {
        try? coordinated {
            guard object("checkpoint.json") == nil else { return nil }
            try clear()
            let header: [String: Any] = ["version": 1, "ownerId": owner, "source": source, "token": UUID().uuidString,
                                       "through": through, "after": NSNull(), "complete": false, "pages": 0, "count": 0]
            try write(header, "checkpoint.json")
            return Progress(header: header, rows: [])
        } ?? nil
    }
    public func commit(_ previous: Progress, rows: [[String: Any]], after: String?, complete: Bool) -> Progress? {
        try? coordinated {
            guard !previous.complete, let current = object("checkpoint.json"),
                  current["token"] as? String == previous.token, current["pages"] as? Int == previous.header["pages"] as? Int,
                  current["after"] as? String == previous.after,
                  validRows(rows, through: previous.through, after: after),
                  previous.after == nil || (after != nil && after! >= previous.after!),
                  rows.allSatisfy({ previous.after == nil || ($0["id"] as! String) > previous.after! }) else { return nil }
            let page = previous.header["pages"] as! Int
            var header = previous.header
            header["after"] = after ?? (NSNull() as Any)
            header["complete"] = complete; header["pages"] = page + 1
            header["count"] = (header["count"] as! Int) + rows.count
            try write(["token": previous.token, "rows": rows], "page-\(page).json")
            try write(header, "checkpoint.json")
            return Progress(header: header, rows: [])
        } ?? nil
    }
    public func discard(owner: String? = nil, token: String? = nil) {
        _ = try? coordinated {
            let header = object("checkpoint.json")
            guard (owner == nil || header?["ownerId"] as? String == owner),
                  (token == nil || header?["token"] as? String == token) else { return }
            try clear()
        }
    }
}
