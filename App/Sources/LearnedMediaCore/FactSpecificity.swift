import Foundation

public enum FactSpecificity {
    public static let failure = "This fact is a basic definition or topic overview. Choose a specific incident, mechanism, exception, experiment, decision, or result within the assigned topic."

    private static func matches(_ pattern: NSRegularExpression, _ value: String) -> Bool {
        pattern.firstMatch(in: value, range: NSRange(value.startIndex..., in: value)) != nil
    }

    private static func clauses(_ text: String) -> [String] {
        text.replacingOccurrences(of: "’", with: "'").replacingOccurrences(of: "‘", with: "'").lowercased()
            .components(separatedBy: CharacterSet(charactersIn: ".!?;"))
            .map { $0.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .replacingOccurrences(of: "^(?:in|by|on) (?:[a-z]+ \\d{1,2},? )?\\d{4},? ", with: "", options: .regularExpression) }
            .filter { !$0.isEmpty }
    }

    private static func basic(_ value: String) -> Bool {
        !matches(FactSpecificityPolicy.detail, value) && FactSpecificityPolicy.basic.contains { matches($0, value) }
    }

    /// Unknown wording passes; pattern matching cannot establish obscurity or truth.
    public static func reason(_ claim: String, sentences: [String] = []) -> String? {
        let main = clauses(claim)
        guard !main.isEmpty, main.allSatisfy(basic) else { return nil }
        return sentences.flatMap(clauses).allSatisfy { value in
            basic(value) || FactSpecificityPolicy.padding.contains { matches($0, value) }
        } ? failure : nil
    }
}
