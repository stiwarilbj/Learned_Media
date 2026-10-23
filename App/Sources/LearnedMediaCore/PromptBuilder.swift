import Foundation

public enum PromptOperation: String, CaseIterable {
    case connection, candidate, combined, grounding, learn, adapt, question, videoInterpret, topicInterpret, videoVerify
}

public enum QuestionType: String {
    case when, why, difference
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
    /// Retain explicit question clauses; do not split quoted or parenthetical text.
    public static func coverageChecklist(_ question: String?) -> [String] {
        guard let question, question.utf16.count <= 4000 else { return [] }
        let query = question.precomposedStringWithCanonicalMapping
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let questionStart = "^(?:please\\s+)?(?:how|why|when|where|who|what|which|can|could|does|do|did|is|are|was|were|will|would|should|has|have|had)\\b"
        func isQuestion(_ text: String) -> Bool {
            text.range(of: questionStart, options: [.regularExpression, .caseInsensitive]) != nil
        }
        guard isQuestion(query) else { return [] }
        let units = Array(query.utf16)
        var safe = Array(repeating: false, count: units.count)
        var quote: UInt16? = nil
        var depth = 0, escaped = false
        func isWord(_ char: UInt16) -> Bool {
            (65...90).contains(char) || (97...122).contains(char) || (48...57).contains(char)
        }
        for i in units.indices {
            let char = units[i]
            safe[i] = quote == nil && depth == 0 && !escaped
            if escaped { escaped = false; continue }
            if char == 92 { escaped = true; continue }
            if let closing = quote { if char == closing { quote = nil }; continue }
            if char == 34 || char == 8220 { quote = char == 8220 ? 8221 : char }
            else if (char == 39 || char == 8216) && (i == 0 || !isWord(units[i - 1])) { quote = char == 8216 ? 8217 : char }
            else if [UInt16(40), 91, 123].contains(char) { depth += 1 }
            else if [UInt16(41), 93, 125].contains(char) { depth = max(0, depth - 1) }
        }
        let pattern = "(?:[,;]?\\s+(?:and|also|plus)\\s+|[?,;]\\s*)(?=(?:how|why|when|where|who|what|which|can|could|does|do|did|is|are|was|were|will|would|should|has|have|had)\\b)"
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else { return [] }
        let text = query as NSString
        var parts: [String] = [], start = 0
        for match in regex.matches(in: query, range: NSRange(location: 0, length: text.length)) where safe[match.range.location] {
            parts.append(text.substring(with: NSRange(location: start, length: match.range.location - start)))
            start = NSMaxRange(match.range)
        }
        guard !parts.isEmpty else { return [] }
        parts.append(text.substring(from: start))
        var seen = Set<String>()
        let items = parts.map {
            $0.trimmingCharacters(in: .whitespacesAndNewlines)
                .replacingOccurrences(of: "\\?+$", with: "", options: .regularExpression)
                .trimmingCharacters(in: .whitespacesAndNewlines)
        }.filter { seen.insert($0.lowercased()).inserted }
        return (2...6).contains(items.count) && items.allSatisfy({ $0.utf16.count <= 300 && isQuestion($0) }) ? items : []
    }

    /// Extract bounded scope phrases locally; the original question stays authoritative.
    public static func questionScope(_ question: String?) -> [String] {
        guard let question, question.utf16.count <= 4000 else { return [] }
        let query = question.precomposedStringWithCanonicalMapping
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let units = Array(query.utf16)
        var safe = Array(repeating: false, count: units.count)
        var quote: UInt16? = nil
        var escaped = false
        for i in units.indices {
            let char = units[i]
            safe[i] = quote == nil && !escaped
            if escaped { escaped = false; continue }
            if char == 92 { escaped = true; continue }
            if let closing = quote { if char == closing { quote = nil }; continue }
            let previousIsWord = i > 0 && ((65...90).contains(units[i-1]) || (97...122).contains(units[i-1]) || (48...57).contains(units[i-1]))
            if char == 34 || char == 8220 { quote = char == 8220 ? 8221 : char }
            else if (char == 39 || char == 8216) && !previousIsWord { quote = char == 8216 ? 8217 : char }
        }
        let pattern = #"\b(?:(?:(?:not|only)\s+)?(?:outside|within|in|before|after|during|since|until)\s+|for\s+(?=(?:beginners|experts|children|students|adults|researchers)\b)|compared\s+(?:with|to)\s+|versus\s+|vs\.?\s+|(?:no\s+)?(?:earlier|later)\s+than\s+)[^?;!\n]+"#
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else { return [] }
        let text = query as NSString
        var scopes: [String] = [], seen = Set<String>()
        let masked = String(decoding: units.enumerated().map { safe[$0.offset] ? $0.element : UInt16(32) }, as: UTF16.self)
        for match in regex.matches(in: masked, range: NSRange(location: 0, length: text.length)) where safe[match.range.location] {
            let prefix = text.substring(to: match.range.location)
            let clausePrefix = prefix.components(separatedBy: CharacterSet(charactersIn: "?;!")).last ?? ""
            let negated = clausePrefix.range(of: #"\b(?:not|never|except|without|only|just)\b|rather than|at least|at most"#, options: [.regularExpression, .caseInsensitive]) != nil
            let scope = ((negated ? clausePrefix : "") + text.substring(with: match.range))
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .replacingOccurrences(of: #"[.\s]+$"#, with: "", options: .regularExpression)
            guard scope.utf16.count <= 300 else { return [] }
            if seen.insert(scope.lowercased()).inserted { scopes.append(scope) }
        }
        return scopes.count <= 6 ? scopes : []
    }

    /// Match only the leading question, without changing the query sent to the model.
    public static func questionType(_ query: String?) -> QuestionType? {
        let normalized = (query ?? "").precomposedStringWithCanonicalMapping.lowercased()
            .replacingOccurrences(of: "[’‘]", with: "'", options: .regularExpression)
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "^please\\s+", with: "", options: .regularExpression)
        func matches(_ pattern: String) -> Bool {
            normalized.range(of: pattern, options: .regularExpression) != nil
        }
        if matches("^why\\b") { return .why }
        if matches("^when(?:\\s+(?:exactly|approximately))?\\s+(?:did|does|do|was|were|is|are|will|would|can|could|should|has|have|had)\\b")
            || matches("^when\\s*[?!]*$") { return .when }
        if matches("^(?:what(?:'s| is| are))\\s+the\\s+(?:main\\s+)?differences?(?=\\s|[?!.:,]|$)") { return .difference }
        return nil
    }

    /// Normalize only instructions; evidence and user input retain their exact text.
    public static func build(_ operation: PromptOperation, rules: [String] = [], fields: [PromptField] = []) -> String {
        var seenRules = Set<String>()
        let priority = operation == .connection ? [] : (PromptInstructions.rules[operation == .question ? "questionPriority" : "taskPriority"] ?? [])
        let sourceData = fields.contains(where: { $0.reference }) ? (PromptInstructions.rules["sourceData"] ?? []) : []
        let datedEvidence = [PromptOperation.grounding, .combined, .learn, .question].contains(operation)
        let dateRules = datedEvidence ? (PromptInstructions.rules["evidenceDates"] ?? []) : []
        let acronymRules = datedEvidence ? (PromptInstructions.rules["acronymWriting"] ?? []) : []
        let instructions = ((PromptInstructions.rules[operation.rawValue] ?? []) + priority + sourceData + dateRules + acronymRules + rules)
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
                guard let serialized = try? JSONSerialization.data(withJSONObject: ["kind": "reference_material", "data": datedEvidence ? EvidenceDates.annotate(value) : value], options: [.sortedKeys]),
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

    public static func searchInterpretation(_ operation: PromptOperation, query: String) -> String {
        precondition(operation == .topicInterpret || operation == .videoInterpret)
        let normalized = query.precomposedStringWithCanonicalMapping.lowercased().replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
        return build(operation, fields: [PromptField("Query", normalized)])
    }

    public static func factCard(sentenceCount: Int, difficulties: [Int], fields: [PromptField], combined: Bool = false) -> String {
        build(combined ? .combined : .grounding, rules: [FactQuality.writingRules(for: sentenceCount, evidenceIDs: true)]
            + Array(Set(difficulties)).sorted().map { FactQuality.rubric($0) }, fields: fields)
    }

    private static func supportingCard(_ card: [String: Any]) -> [String: Any] {
        card.filter { ["topicPath", "hook", "title", "body", "claim"].contains($0.key) }
    }

    public static func question(card: [String: Any], query: String?, detailed: Bool = false,
                                history: [[String: Any]] = [], evidence: [[String: Any]]) -> String {
        let checklist = coverageChecklist(query)
        let scope = questionScope(query)
        let typeKey: String?
        switch questionType(query) {
        case .when: typeKey = "questionWhen"
        case .why: typeKey = "questionWhy"
        case .difference: typeKey = "questionDifference"
        case nil: typeKey = nil
        }
        let rules = (PromptInstructions.rules["answerWriting"] ?? [])
            + (PromptInstructions.rules["questionEvidence"] ?? [])
            + (typeKey.flatMap { PromptInstructions.rules[$0] } ?? [])
            + (checklist.isEmpty ? [] : (PromptInstructions.rules["questionCoverage"] ?? []))
            + (scope.isEmpty ? [] : (PromptInstructions.rules["questionScope"] ?? []))
            + (PromptInstructions.rules[detailed ? "answerDetailed" : "answerShort"] ?? [])
        return build(.question, rules: rules, fields: [
            PromptField("Original user query", query),
            PromptField("Supporting card context", supportingCard(card), reference: true),
            PromptField("Previous conversation (context only)", Array(history.suffix(6)), reference: true),
            PromptField("Wikipedia evidence", evidence, reference: true),
            PromptField("Coverage checklist", checklist, reference: true),
            PromptField("Question scope", scope, reference: true)
        ])
    }

    public static func learning(action: PromptOperation, card: [String: Any], question: String? = nil,
                                detailed: Bool = false, history: [[String: Any]] = [], mode: String? = nil,
                                evidence: [[String: Any]]) -> String {
        if action == .question {
            return self.question(card: card, query: question, detailed: detailed, history: history, evidence: evidence)
        }
        if action == .adapt {
            let modeRule = mode == "deeper" ? "adaptDeeper" : "adaptSimpler"
            return build(.adapt, rules: (PromptInstructions.rules["learningEvidence"] ?? []) + (PromptInstructions.rules[modeRule] ?? []), fields: [
                PromptField("Original fact card", supportingCard(card), reference: true), PromptField("Wikipedia evidence", evidence, reference: true)
            ])
        }
        return build(.learn, rules: PromptInstructions.rules["learningEvidence"] ?? [], fields: [
            PromptField("Card", supportingCard(card), reference: true), PromptField("Wikipedia evidence", evidence, reference: true)
        ])
    }
}
