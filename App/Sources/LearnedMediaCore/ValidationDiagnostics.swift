import Foundation

/// Coalesces diagnostics only. Every newly returned item must still be validated.
public struct ValidationDiagnostics {
    private var records: [[String: Any]] = []
    public init() {}
    public var snapshot: [[String: Any]] { records }
    private static let rules: [(String, String, String)] = [
        ("unknown-evidence-id", "unknown evidence ID|unknown ID|unassigned evidence", "The card referenced unknown or unassigned evidence."),
        ("needs-evidence", "more evidence is needed", "The main claim needs supporting evidence."),
        ("duplicate-fact", "already been shown|repeats another|duplicate", "The card repeats a completed fact."),
        ("missing-slot", "omitted", "Gemini omitted a slot or returned the wrong topic."),
        ("topic-mismatch", "different topic|wrong topic", "The card has the wrong topic."),
        ("invalid-evidence", "evidence reference|evidence IDs|claim evidence", "The card has invalid evidence references."),
        ("unsupported-quantity", "number|unit|quantit", "A numerical claim lacks matching support."),
        ("unsupported-causality", "causal", "A causal claim lacks supporting evidence."),
        ("invalid-status", "valid evidence status", "The card is missing a valid evidence status."),
        ("invalid-headings", "heading|hook", "The card has invalid headings."),
        ("invalid-sentences", "complete sentence|supported sentences", "The card has invalid sentences."),
        ("quotation-mismatch", "quotation|verifiable evidence", "A sentence lacks a matching source passage."),
        ("invalid-section", "Wikipedia section|article lead", "The card uses an invalid source section."),
        ("invalid-card", ".*", "The card failed local content validation."),
]
    public mutating func record(operation: String, slot: Int, detail: String) -> String {
        let bounded = String(detail.prefix(1024))
        let rule = Self.rules.first { bounded.range(of: $0.1, options: [.regularExpression, .caseInsensitive]) != nil } ?? Self.rules.last!
        let index: Int
        if let found = records.firstIndex(where: { $0["operation"] as? String == operation && $0["slot"] as? Int == slot && $0["failureType"] as? String == rule.0 }) {
            index = found
            records[index]["occurrences"] = (records[index]["occurrences"] as? Int ?? 0) + 1
        } else {
            index = records.count
            records.append(["operation": operation, "slot": slot, "failureType": rule.0, "message": rule.2, "occurrences": 1])
        }
        let count = records[index]["occurrences"] as? Int ?? 1
        return count > 1 ? "\(rule.2) (\(count) occurrences)" : rule.2
    }
}
