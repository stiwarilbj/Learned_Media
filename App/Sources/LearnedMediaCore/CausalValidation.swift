import Foundation

public enum CausalValidation {
    private struct Relation {
        let kind: String, cause: [String], effect: [String]
        let negative: Bool, uncertain: Bool, text: String, ambiguous: Bool, question: Bool
    }
    private static func anchors(_ text: String) -> [String] {
        let words = text.lowercased().components(separatedBy: CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyz").inverted)
        var seen = Set<String>()
        return words.filter { $0.count > 2 && !CausalPolicy.stop.contains($0) }.map { word in
            var stem = word.replacingOccurrences(of: "(?:ing|ed|s)$", with: "", options: .regularExpression)
            if word.range(of: "(?:ing|ed)$", options: .regularExpression) != nil {
                stem = stem.replacingOccurrences(of: "([a-z])\\1$", with: "$1", options: .regularExpression)
            }
            return stem.replacingOccurrences(of: "e$", with: "", options: .regularExpression)
        }.filter { $0.count > 2 && seen.insert($0).inserted }
    }
    private static func relations(_ text: String) -> [Relation] {
        var result: [Relation] = []
        let bounded = (text as NSString).substring(to: min((text as NSString).length, 16_000))
        let clauses = try! NSRegularExpression(pattern: "[^.;!?\n]+[.;!?]?")
        for clauseMatch in clauses.matches(in: bounded, range: NSRange(location: 0, length: (bounded as NSString).length)) {
            let clause = (bounded as NSString).substring(with: clauseMatch.range)
            let source = clause as NSString, range = NSRange(location: 0, length: (clause as NSString).length)
            let matches = CausalPolicy.patterns.flatMap { pattern in pattern.regex.matches(in: clause, range: range).map { (pattern, $0) } }
            for (pattern, match) in matches {
                let left = anchors(source.substring(to: match.range.location)), right = anchors(source.substring(from: NSMaxRange(match.range)))
                result.append(Relation(kind: pattern.kind, cause: pattern.reverse ? right : left, effect: pattern.reverse ? left : right,
                    negative: CausalPolicy.negative.firstMatch(in: clause, range: range) != nil,
                    uncertain: CausalPolicy.uncertain.firstMatch(in: clause, range: range) != nil,
                    text: clause.trimmingCharacters(in: .whitespacesAndNewlines), ambiguous: matches.count != 1, question: clause.trimmingCharacters(in: .whitespacesAndNewlines).hasSuffix("?")))
            }
        }
        return result
    }
    private static func covers(_ required: [String], _ supplied: [String]) -> Bool {
        let available = Set(supplied)
        return !required.isEmpty && required.prefix(2).allSatisfy { available.contains($0) }
            && Double(required.filter { available.contains($0) }.count) / Double(required.count) >= 0.6
    }
    /// Conservative explicit-relationship check; uncertainty and unsupported paraphrases cannot establish causation.
    public static func unsupported(_ claim: String, passages: [String]) -> [String] {
        let requested = relations(claim)
        if requested.isEmpty { return [] }
        let supplied = passages.flatMap(relations).filter { !$0.ambiguous && !$0.question }
        return requested.filter { relation in
            relation.ambiguous || !supplied.contains { source in
                source.kind == relation.kind && source.negative == relation.negative && (!source.uncertain || relation.uncertain)
                    && covers(relation.cause, source.cause) && covers(relation.effect, source.effect)
            }
        }.map(\.text)
    }
}
