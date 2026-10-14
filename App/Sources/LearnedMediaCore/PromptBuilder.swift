import Foundation

public enum PromptOperation: String, CaseIterable {
    case connection, candidate, grounding, learn, question, videoInterpret, topicInterpret, videoVerify
}

public struct PromptField {
    let label: String
    let value: Any?
    let multiline: Bool
    let reference: Bool

    public init(_ label: String, _ value: Any?, multiline: Bool = false, reference: Bool = false) {
        self.label = label
        self.value = value
        self.multiline = multiline
        self.reference = reference
    }
}

public enum PromptBuilder {
    /// Normalize only instructions; evidence and user input retain their exact text.
    public static func build(_ operation: PromptOperation, rules: [String] = [], fields: [PromptField] = []) -> String {
        var seenRules = Set<String>()
        let priority = operation == .connection ? [] : (PromptInstructions.rules[operation == .question ? "questionPriority" : "taskPriority"] ?? [])
        let sourceData = fields.contains(where: { $0.reference }) ? (PromptInstructions.rules["sourceData"] ?? []) : []
        let instructions = ((PromptInstructions.rules[operation.rawValue] ?? []) + priority + sourceData + rules)
            .flatMap { $0.components(separatedBy: "\n") }
            .map { $0.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ") }
            .filter { !$0.isEmpty && seenRules.insert($0).inserted }
        var seenFields = Set<String>()
        let data: [String] = fields.compactMap { field in
            guard let value = field.value, !(value is NSNull) else { return nil }
            let text: String
            if field.reference {
                if let array = value as? [Any], array.isEmpty { return nil }
                if let string = value as? String, string.isEmpty { return nil }
                guard let serialized = try? JSONSerialization.data(withJSONObject: ["kind": "reference_material", "data": value], options: [.sortedKeys]),
                      let string = String(data: serialized, encoding: .utf8) else { return nil }
                text = string
            } else if let string = value as? String {
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

    public static func factCard(sentenceCount: Int, difficulties: [Int], fields: [PromptField]) -> String {
        build(.grounding, rules: [FactQuality.writingRules(for: sentenceCount, evidenceIDs: true)]
            + Array(Set(difficulties)).sorted().map { FactQuality.rubric($0) }, fields: fields)
    }

    private static func supportingCard(_ card: [String: Any]) -> [String: Any] {
        card.filter { ["topicPath", "hook", "title", "body"].contains($0.key) }
    }

    public static func question(card: [String: Any], query: String?, detailed: Bool = false,
                                history: [[String: Any]] = [], evidence: [[String: Any]]) -> String {
        let rules = (PromptInstructions.rules["answerWriting"] ?? [])
            + (PromptInstructions.rules["questionEvidence"] ?? [])
            + (PromptInstructions.rules[detailed ? "answerDetailed" : "answerShort"] ?? [])
        return build(.question, rules: rules, fields: [
            PromptField("Original user query", query),
            PromptField("Supporting card context", supportingCard(card), reference: true),
            PromptField("Previous conversation (context only)", Array(history.suffix(6)), reference: true),
            PromptField("Wikipedia evidence", evidence, reference: true)
        ])
    }

    public static func learning(action: PromptOperation, card: [String: Any], question: String? = nil,
                                detailed: Bool = false, history: [[String: Any]] = [], evidence: [[String: Any]]) -> String {
        if action == .question {
            return self.question(card: card, query: question, detailed: detailed, history: history, evidence: evidence)
        }
        return build(.learn, rules: PromptInstructions.rules["learningEvidence"] ?? [], fields: [
            PromptField("Card", supportingCard(card), reference: true), PromptField("Wikipedia evidence", evidence, reference: true)
        ])
    }
}
