import Foundation

public enum EvidenceDates {
    /// Explicit source wording only. UTF-16 offsets identify dates without altering quotations.
    public static func roles(in text: String) -> [[String: Any]] {
        let source = text as NSString
        let bounded = NSRange(location: 0, length: min(source.length, 16_000))
        var dates: [[String: Any]] = []
        for (role, regex) in EvidenceDatePatterns.all {
            for match in regex.matches(in: text, range: bounded).prefix(24) {
                if source.length > bounded.length && NSMaxRange(match.range) == bounded.length { continue }
                let range = match.range(at: 1)
                dates.append(["date": source.substring(with: range), "role": role, "at": range.location])
            }
        }
        return Array(dates.sorted { ($0["at"] as? Int ?? 0) < ($1["at"] as? Int ?? 0) }.prefix(24))
    }

    /// Derived annotations belong only to prompts, never to persisted sources or citation IDs.
    public static func annotate(_ value: Any) -> Any {
        if let values = value as? [Any] { return values.map(annotate) }
        guard let record = value as? [String: Any] else { return value }
        var result = record.filter { $0.key != "dateRoles" }.mapValues(annotate)
        if let text = record["text"] as? String ?? record["extract"] as? String {
            let dates = roles(in: text)
            if !dates.isEmpty { result["dateRoles"] = dates }
        }
        return result
    }
}
