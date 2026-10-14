import Foundation

public enum PromptOperation: String, CaseIterable {
    case connection, candidate, grounding, learn, question, videoInterpret, topicInterpret, videoVerify
}

public struct PromptField {
    let label: String
    let value: Any?
    let multiline: Bool

    public init(_ label: String, _ value: Any?, multiline: Bool = false) {
        self.label = label
        self.value = value
        self.multiline = multiline
    }
}

public enum PromptBuilder {
    /// Normalize only instructions; evidence and user input retain their exact text.
    public static func build(_ operation: PromptOperation, rules: [String] = [], fields: [PromptField] = []) -> String {
        var seenRules = Set<String>()
        let instructions = ((PromptInstructions.rules[operation.rawValue] ?? []) + rules)
            .flatMap { $0.components(separatedBy: "\n") }
            .map { $0.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ") }
            .filter { !$0.isEmpty && seenRules.insert($0).inserted }
        var seenFields = Set<String>()
        let data: [String] = fields.compactMap { field in
            guard let value = field.value, !(value is NSNull) else { return nil }
            let text: String
            if let string = value as? String {
                guard !string.isEmpty else { return nil }
                text = string
            } else {
                if let array = value as? [Any], array.isEmpty { return nil }
                guard let serialized = try? JSONSerialization.data(withJSONObject: value, options: [.fragmentsAllowed, .sortedKeys]),
                      let string = String(data: serialized, encoding: .utf8) else { return nil }
                text = string
            }
            let rendered = field.label + (field.multiline ? ":\n" : ": ") + text
            return seenFields.insert(rendered).inserted ? rendered : nil
        }
        return ([instructions.joined(separator: " ")] + data).joined(separator: "\n\n")
    }
}
