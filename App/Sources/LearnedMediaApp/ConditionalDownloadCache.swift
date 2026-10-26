import Foundation
import CryptoKit

/// Session-only backing responses. Every reuse requires a successful server revalidation.
actor ConditionalDownloadCache {
    struct Snapshot: Sendable {
        let body: Data
        let etag: String?
        let modified: String?
    }
    struct Prepared: Sendable {
        let request: URLRequest
        let key: String
        let previous: Snapshot?
    }
    private struct Entry {
        let snapshot: Snapshot
        let expiresAt: Date
        var touchedAt: Date
        let bytes: Int
    }
    private var entries: [String: Entry] = [:]
    private let budget = 4 * 1024 * 1024
    private let httpDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "EEE, dd MMM yyyy HH:mm:ss 'GMT'"
        return formatter
    }()

    func prepare(_ request: URLRequest, credential: String = "") -> Prepared {
        let context = ["Accept", "Origin", "X-Origin", "Referer", "User-Agent"].map { request.value(forHTTPHeaderField: $0) ?? "" }.joined(separator: "\u{0}")
        let identity = credential + "\u{0}" + (request.url?.absoluteString ?? "") + "\u{0}" + context
        let key = SHA256.hash(data: Data(identity.utf8)).map { String(format: "%02x", $0) }.joined()
        let now = Date()
        entries = entries.filter { $0.value.expiresAt > now }
        var previous: Snapshot?
        if var entry = entries[key] {
            entry.touchedAt = now; entries[key] = entry
            previous = entry.snapshot
        }
        var conditional = request
        // Explicit revalidation owns the cached body, including 304 handling.
        conditional.cachePolicy = .reloadIgnoringLocalCacheData
        if let etag = previous?.etag { conditional.setValue(etag, forHTTPHeaderField: "If-None-Match") }
        else if let modified = previous?.modified { conditional.setValue(modified, forHTTPHeaderField: "If-Modified-Since") }
        return Prepared(request: conditional, key: key, previous: previous)
    }

    /// Invoke only after the caller validates the response for its operation.
    func validated(_ prepared: Prepared, response: HTTPURLResponse, body: Data, bodyETag: String? = nil, previous: Snapshot? = nil) {
        let vary = (response.value(forHTTPHeaderField: "Vary") ?? "").lowercased().split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
        let allowed: Set<String> = ["accept", "accept-encoding", "origin", "x-origin", "referer", "user-agent", "x-goog-api-key"]
        let etag = entityTag(response.value(forHTTPHeaderField: "ETag")) ?? entityTag(bodyETag, fromBody: true) ?? previous?.etag
        let modified = modificationDate(response.value(forHTTPHeaderField: "Last-Modified")) ?? previous?.modified
        let noStore = (response.value(forHTTPHeaderField: "Cache-Control") ?? "").range(of: "\\bno-store\\b", options: [.regularExpression, .caseInsensitive]) != nil
        guard !noStore, vary.allSatisfy({ allowed.contains($0) }), etag != nil || modified != nil else { entries[prepared.key] = nil; return }
        let bytes = body.count + (etag?.utf8.count ?? 0) + (modified?.utf8.count ?? 0) + 256
        guard bytes <= budget else { entries[prepared.key] = nil; return }
        let now = Date()
        entries = entries.filter { $0.value.expiresAt > now }
        entries[prepared.key] = Entry(snapshot: Snapshot(body: body, etag: etag, modified: modified), expiresAt: now.addingTimeInterval(24 * 60 * 60), touchedAt: now, bytes: bytes)
        while entries.count > 100 || entries.values.reduce(0, { $0 + $1.bytes }) > budget {
            guard let oldest = entries.min(by: { $0.value.touchedAt < $1.value.touchedAt })?.key else { break }
            entries[oldest] = nil
        }
    }

    func notModified(_ prepared: Prepared, response: HTTPURLResponse) -> Data? {
        guard response.statusCode == 304, let previous = prepared.previous else { return nil }
        validated(prepared, response: response, body: previous.body, previous: previous)
        return previous.body
    }

    func discard(_ prepared: Prepared) { entries[prepared.key] = nil }

    private func entityTag(_ value: String?, fromBody: Bool = false) -> String? {
        guard let value, value.count <= 1024 else { return nil }
        let tag = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if tag.range(of: "^(?:W/)?\"[\\x21\\x23-\\x7e\\x80-\\xff]*\"$", options: .regularExpression) != nil { return tag }
        if fromBody, tag.range(of: "^[\\x21\\x23-\\x7e]+$", options: .regularExpression) != nil { return "\"\(tag)\"" }
        return nil
    }

    private func modificationDate(_ value: String?) -> String? {
        guard let value, value.count <= 128, !value.contains("\r"), !value.contains("\n") else { return nil }
        guard let date = httpDateFormatter.date(from: value) else { return nil }
        return httpDateFormatter.string(from: date)
    }
}
