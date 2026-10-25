import Foundation

public struct QuestionInstructionResolution {
    public let preference: String
    public let directive: [String: Any]?
    public let conflict: Bool
    public let conflictLabel: String
    public let effectiveDetailed: Bool
    public let effectiveStructure: String
    public let questionForPrompt: String
    public let policyVersion: String
}

/// Native prompt counterpart of Website/lib/answer-structure.ts.
public enum QuestionInstructionPolicy {
    public static let version = "question-instruction-override-v1"

    private struct Match {
        let kind: String
        let key: String
        let label: String
        let range: NSRange
        let count: Int?
        let exact: Bool
        let lengthKind: String?
        let structure: String?
    }

    private static let numberWords: [String: Int] = ["one": 1, "a": 1, "an": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10]
    private static let action = #"(?:please\s+)?(?:answer|respond|explain|summarize|write|use|give(?:\s+me)?|provide|keep\s+(?:it|the answer))"#

    public static func resolve(_ question: String, detailed: Bool, structure: String, preference requestedPreference: String = "written") -> QuestionInstructionResolution {
        let preference = requestedPreference == "settings" ? "settings" : "written"
        let settingStructure = ["automatic", "short-explanation", "ordered-steps", "side-by-side-comparison"].contains(structure) ? structure : "automatic"
        let matches = detect(question)
        let rawCleaned = removing(matches, from: question)
        let instructionOnly = rawCleaned.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            || rawCleaned.range(of: #"^(?:please\s+)?(?:answer|respond|explain|write|use|format|present|organize|structure|give|provide)\s*[.!?]*$"#, options: .regularExpression.union(.caseInsensitive)) != nil
            || rawCleaned.range(of: #"^(?:can|could|would)\s+you\s*$"#, options: .regularExpression.union(.caseInsensitive)) != nil
        let activeMatches = instructionOnly ? [] : matches
        let length = activeMatches.first(where: { $0.kind == "length" })
        let format = activeMatches.first(where: { $0.kind == "structure" })
        let sentenceLimit = length?.lengthKind == "sentences"
        let wordLimit = length?.lengthKind == "words"
        let shortFormat = format?.structure == "short-explanation"
        let lengthConflict: Bool = {
            guard let length, let count = length.count else { return false }
            if sentenceLimit { return count == 1 || (!detailed && length.exact && count > 4) }
            if wordLimit && detailed { return length.exact ? count < 150 || count > 250 : count < 150 }
            return false
        }() || (shortFormat && detailed)
        let structureConflict = (format?.structure != nil && settingStructure != "automatic" && format?.structure != settingStructure)
            || (length?.lengthKind == "sentences" && length?.count == 1 && (settingStructure == "ordered-steps" || settingStructure == "side-by-side-comparison"))
        let conflict = lengthConflict || structureConflict
        let suppressLength = preference == "settings" && conflict && lengthConflict
        let suppressStructure = preference == "settings" && conflict && structureConflict
        let activeLength = suppressLength ? nil : length
        let activeFormat = suppressStructure ? nil : format
        let proseForOneSentence = activeLength?.lengthKind == "sentences" && activeLength?.count == 1
        let effectiveStructure = activeFormat?.structure ?? (proseForOneSentence ? "short-explanation" : settingStructure)
        let effectiveDetailed = effectiveStructure == "short-explanation" || proseForOneSentence ? false : detailed
        // Preserve the submitted draft in card history, but give the writer
        // the substantive question separately from resolved output options.
        let questionForPrompt = activeMatches.isEmpty ? question : removing(activeMatches, from: question)
        let conflictingLabels = activeMatches.filter { ($0.kind == "length" && lengthConflict) || ($0.kind == "structure" && structureConflict) }
            .map(\.label).reduce(into: [String]()) { if !$0.contains($1) { $0.append($1) } }
        let directiveMatches = activeMatches.filter { ($0.kind == "length" && !suppressLength) || ($0.kind == "structure" && !suppressStructure) }
        var directive: [String: Any]?
        if !directiveMatches.isEmpty {
            var value: [String: Any] = ["label": directiveMatches.map(\.label).reduce(into: [String]()) { if !$0.contains($1) { $0.append($1) } }.joined(separator: " · ")]
            if let activeLength, let count = activeLength.count {
                value["length"] = ["count": count, "exact": activeLength.exact, "kind": activeLength.lengthKind ?? "sentences"]
            }
            if let activeFormat, let structure = activeFormat.structure { value["structure"] = structure }
            directive = value
        }
        return QuestionInstructionResolution(preference: preference, directive: directive, conflict: conflict,
            conflictLabel: conflictingLabels.joined(separator: " · "), effectiveDetailed: effectiveDetailed,
            effectiveStructure: effectiveStructure, questionForPrompt: questionForPrompt, policyVersion: version)
    }

    private static func detect(_ question: String) -> [Match] {
        let masked = maskQuotes(question)
        var matches: [Match] = []
        let sentenceNumber = #"(?:one|a|an|two|three|four|five|six|seven|eight|nine|ten|[1-9]|10)"#
        let wordNumber = #"(?:one|a|an|two|three|four|five|six|seven|eight|nine|ten|\d{1,3})"#
        let sentenceLength = #"((?:in|within)\s+(?:(?:exactly|at most|no more than|up to)\s+)?"# + sentenceNumber + #"\s+sentences?|(?:in|within)\s+(?:a\s+)?(?:maximum|max)(?:\s+of)?\s+"# + sentenceNumber + #"\s+sentences?|(?:exactly|at most|no more than|up to|(?:a\s+)?(?:maximum|max)(?:\s+of)?)\s+"# + sentenceNumber + #"\s+sentences?)\b"#
        let wordLength = #"((?:in|within)\s+(?:(?:exactly|at most|no more than|up to)\s+)?"# + wordNumber + #"\s+words?|(?:in|within)\s+(?:a\s+)?(?:maximum|max)(?:\s+of)?\s+"# + wordNumber + #"\s+words?|(?:exactly|at most|no more than|up to|(?:a\s+)?(?:maximum|max)(?:\s+of)?)\s+"# + wordNumber + #"\s+words?)\b"#
        for (kind, noun, number, maximum) in [("sentences", "sentence", sentenceNumber, 10), ("words", "word", wordNumber, 500)] {
            let phrase = kind == "sentences" ? sentenceLength : wordLength
            let pattern = #"\b"# + action + #"\b[^?!.;\n]{0,70}?\b"# + phrase
            for raw in captureMatches(pattern, in: masked) {
                let phrase = (masked as NSString).substring(with: raw.capture).replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
                guard let countText = capture(#"("# + number + #")\s+"# + noun + #"s?"#, in: phrase), let count = parseNumber(countText), count >= 1, count <= maximum else { continue }
                let prefix = instructionPrefix(masked, before: raw.capture.location)
                if isNegatedOrHypothetical(prefix) { continue }
                let exact = phrase.range(of: #"\bexactly\b"#, options: .regularExpression.union(.caseInsensitive)) != nil
                    || phrase.range(of: #"\b(?:in|within)\b"#, options: .regularExpression.union(.caseInsensitive)) != nil
                    && phrase.range(of: #"\b(?:at most|no more than|up to|maximum|max)\b"#, options: .regularExpression.union(.caseInsensitive)) == nil
                let label = kind == "sentences" ? (exact ? (count == 1 ? "one sentence" : "\(count) sentences") : "up to \(count) \(count == 1 ? "sentence" : "sentences")")
                    : (exact ? "exactly \(count) \(count == 1 ? "word" : "words")" : "up to \(count) \(count == 1 ? "word" : "words")")
                matches.append(Match(kind: "length", key: "\(kind):\(count):\(exact)", label: label, range: raw.capture, count: count, exact: exact, lengthKind: kind, structure: nil))
            }
        }
        let formats: [(String, String, String)] = [
            (#"\b(?:please\s+)?(?:use|answer|respond|explain|format|present|organize|write|give|provide)\b[^?!.;\n]{0,55}?\b((?:(?:in|as|with|using)\s+(?:(?:clear|ordered|numbered)\s+)?steps?|(?:numbered|ordered)\s+steps?|(?:in|as|with|using)\s+(?:numbered|ordered)\s+lists?))\b"#, "ordered-steps", "ordered steps"),
            (#"\b(?:please\s+)?(?:compare|use|answer|respond|format|present|organize|write|give|provide)\b[^?!.;\n]{0,75}?\b(side[- ]by[- ]side(?:\s+comparison)?(?:\s+table)?|(?:in|as)\s+(?:a\s+)?comparison\s+table)\b"#, "side-by-side-comparison", "side-by-side comparison"),
            (#"\b(?:please\s+)?(?:give(?:\s+me)?|provide|write|answer|explain|keep(?:\s+it)?)\b[^?!.;\n]{0,50}?\b((?:a\s+)?(?:short|brief)\s+explanation|in\s+(?:plain\s+)?prose|as\s+(?:a\s+)?paragraph)\b"#, "short-explanation", "short explanation")
        ]
        for (pattern, structure, label) in formats {
            for raw in captureMatches(pattern, in: masked) {
                let prefix = instructionPrefix(masked, before: raw.capture.location)
                if isNegatedOrHypothetical(prefix) { continue }
                matches.append(Match(kind: "structure", key: "structure:\(structure)", label: label, range: raw.capture, count: nil, exact: false, lengthKind: nil, structure: structure))
            }
        }
        var unique: [String: Match] = [:]
        matches.forEach { unique[$0.key] = $0 }
        let all = Array(unique.values)
        let lengths = all.filter { $0.kind == "length" }
        let structures = all.filter { $0.kind == "structure" }
        let contradictoryRemainder = lengths.contains { item in
            let source = masked as NSString
            let end = min(source.length, item.range.location + item.range.length)
            let tail = source.substring(from: end)
            let clause = tail.components(separatedBy: CharacterSet(charactersIn: ".!?;\n")).first ?? tail
            let number = item.lengthKind == "sentences" ? sentenceNumber : wordNumber
            let noun = item.lengthKind == "sentences" ? "sentences?" : "words?"
            let connector = #"\b(?:or|rather than|instead of|not|but|and)\s+(?:(?:then|instead)\s+)?(?:(?:please\s+)?(?:use|write|answer|keep(?:\s+it)?|respond)\s+)?(?:(?:in|within)\s+)?(?:exactly\s+|at most\s+|no more than\s+|up to\s+)?("# + number + #")(?:\s+"# + noun + #")?\b"#
            guard let alternative = capture(connector, in: clause),
                  let count = parseNumber(alternative), let originalCount = item.count else { return false }
            return count != originalCount
        }
        let conflictingLengthValues = Set(lengths.map { "\($0.lengthKind ?? ""):\($0.count ?? 0)" }).count > 1
        let conflictingStructures = Set(structures.map(\.key)).count > 1
        let incompatible = lengths.contains { $0.lengthKind == "sentences" && $0.count == 1 }
            && structures.contains { $0.structure == "ordered-steps" || $0.structure == "side-by-side-comparison" }
        return contradictoryRemainder || conflictingLengthValues || conflictingStructures || incompatible ? [] : all.sorted { $0.range.location < $1.range.location }
    }

    private static func captureMatches(_ pattern: String, in text: String) -> [(match: NSRange, capture: NSRange)] {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { return [] }
        let range = NSRange(location: 0, length: (text as NSString).length)
        return regex.matches(in: text, range: range).compactMap { result in
            guard result.numberOfRanges > 1, result.range(at: 1).location != NSNotFound else { return nil }
            return (result.range, result.range(at: 1))
        }
    }

    private static func capture(_ pattern: String, in text: String) -> String? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]),
              let match = regex.firstMatch(in: text, range: NSRange(location: 0, length: (text as NSString).length)), match.numberOfRanges > 1 else { return nil }
        return (text as NSString).substring(with: match.range(at: 1))
    }

    private static func parseNumber(_ value: String) -> Int? {
        let normalized = value.lowercased()
        return Int(normalized) ?? numberWords[normalized]
    }

    private static func isNegatedOrHypothetical(_ prefix: String) -> Bool {
        prefix.range(of: #"\b(?:if|unless|imagine|suppose|hypothetically|would|could|might|should|don't|do not|never|not to)\b"#, options: .regularExpression.union(.caseInsensitive)) != nil
    }

    private static func instructionPrefix(_ text: String, before utf16Offset: Int) -> String {
        let source = text as NSString
        let prefix = source.substring(to: min(max(0, utf16Offset), source.length)) as NSString
        var clauseStart = 0
        for separator in [".", "?", "!", ";", "\n"] {
            let found = prefix.range(of: separator, options: .backwards)
            if found.location != NSNotFound { clauseStart = max(clauseStart, NSMaxRange(found)) }
        }
        return prefix.substring(from: clauseStart)
    }

    private static func maskQuotes(_ text: String) -> String {
        var units = Array(text.utf16)
        var quote: UInt16?
        for index in units.indices {
            let char = units[index]
            if let closing = quote {
                units[index] = 32
                if char == closing || (closing == 8220 && char == 8221) || (closing == 8216 && char == 8217) { quote = nil }
                continue
            }
            let previousIsSpace = index == 0 || (units[index - 1] < 128 && CharacterSet.whitespacesAndNewlines.contains(UnicodeScalar(units[index - 1]) ?? " "))
            if char == 34 || char == 8220 || (char == 8216 && previousIsSpace) {
                quote = char
                units[index] = 32
            }
        }
        return String(decoding: units, as: UTF16.self)
    }

    private static func removing(_ matches: [Match], from text: String) -> String {
        let source = NSMutableString(string: text)
        for item in matches.sorted(by: { $0.range.location > $1.range.location }) { source.replaceCharacters(in: item.range, with: " ") }
        var result = (source as String)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .replacingOccurrences(of: #"\s+([,.;:?!])"#, with: "$1", options: .regularExpression)
            .replacingOccurrences(of: #"([,;:]\s*){2,}"#, with: " ", options: .regularExpression)
            .replacingOccurrences(of: #"^(?:please\s+)?(?:answer|respond|write|use|format|present|organize|structure|give|provide)\s*[:,-]\s*"#, with: "", options: .regularExpression.union(.caseInsensitive))
            .replacingOccurrences(of: #"^use\s+to\s+"#, with: "", options: .regularExpression.union(.caseInsensitive))
            .replacingOccurrences(of: #"^[,;:–—-]+\s*|[\s,;:–—-]+$"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: #"(?:^|[\s,;:–—-])(?:please\s+)?(?:answer|respond|write|use|format|present|organize|structure|give|provide)\s*[.!?]*$"#, with: "", options: .regularExpression.union(.caseInsensitive))
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if let first = result.first, first.isLowercase {
            result.replaceSubrange(result.startIndex...result.startIndex, with: String(first).uppercased())
        }
        return result
    }
}
