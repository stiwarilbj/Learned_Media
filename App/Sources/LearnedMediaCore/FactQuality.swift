import Foundation

public enum FactQuality {
    public static let sentenceLengthOptions = [1, 2, 3, 4, 6, 8, 10]
    public static let writingRules = writingRules(for: 3)

    public static func sentenceCount(_ value: Any?) -> Int {
        let number: Int
        if let value = value as? Int { number = value }
        else if let value = value as? NSNumber { number = value.intValue }
        else if let value = value as? String, let parsed = Int(value) { number = parsed }
        else { number = 3 }
        return sentenceLengthOptions.contains(number) ? number : 3
    }

    public static func writingRules(for value: Any? = 3, evidenceIDs: Bool = false) -> String {
        let count = sentenceCount(value)
        let structure: String
        switch count {
        case 1: structure = "Use one complete sentence that states the concrete fact and its essential named detail."
        case 2: structure = "Sentence one states the concrete fact; sentence two gives a directly supported detail or consequence."
        case 3: structure = "Sentence one states the concrete fact; sentence two gives a supported detail about how it happened; sentence three gives its supported consequence or significance."
        case 4: structure = "Use the first three sentences for the fact, a named supporting detail, and its consequence; sentence four adds one more directly supported piece of context."
        case 6: structure = "Use the first three sentences for the fact, named support, and consequence; use sentences four through six for additional named context that stays on the same claim."
        case 8: structure = "Build a coherent, well-developed explanation around one claim: establish the fact, add named evidence and consequences, then use sentences four through eight only for closely related context."
        case 10: structure = "Build a complete explanation of one narrow claim: state the fact, identify the named evidence and mechanism, explain documented consequences, and use the remaining sentences only for closely related context."
        default: structure = "Use a clear, coherent explanation of one narrow claim."
        }
        let citationRule = evidenceIDs
            ? "Use supplied evidence IDs for sentence support; quotations and section names are restored locally."
            : "For every sentence, provide a verbatim quotation and its exact section name; every quotation must occur in the supplied Wikipedia passage."
        let supportRule = evidenceIDs ? "Keep evidence within the same narrow passage whenever possible."
            : "Keep all quotations within the same narrow passage whenever possible."
        let resultRule = evidenceIDs ? "" : " Return an empty facts array if the evidence cannot support the candidate. Never silently substitute a different fact."
        return ((PromptInstructions.rules["cardWriting"] ?? []) + [structure,
            "Write exactly \(count) complete, useful sentences—no more and no fewer. Each sentence must contain at least 8 words and 35–600 characters, express one complete thought, and include supported detail.",
            citationRule, supportRule, resultRule.trimmingCharacters(in: .whitespacesAndNewlines)])
            .filter { !$0.isEmpty }.joined(separator: " ")
    }

    public static func rubric(_ level: Int) -> String {
        let target = max(1, min(10, level))
        let key = target >= 10 ? "difficultyMaximum" : target >= 9 ? "difficultyHigh" : target >= 5 ? "difficultyMedium" : "difficultyLow"
        return "Difficulty \(target)/10: " + (PromptInstructions.rules[key] ?? []).joined(separator: " ")
    }
    public static func normalized(_ text: String) -> String {
        text.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "en_US_POSIX")).lowercased().replacingOccurrences(of: "[^a-z0-9]+", with: " ", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
    }
    private static let stop = Set("a an the of in on at to for from by with and or but is was were are be been this that it its as his her their had has have who which they he she into through about also one two three".split(separator: " ").map(String.init))
    public static func words(_ text: String) -> Set<String> { Set(normalized(text).split(separator: " ").map(String.init).filter { $0.count > 2 && !stop.contains($0) }) }
    public static func overlap(_ a: Set<String>, _ b: Set<String>) -> Double { Double(a.intersection(b).count) / Double(max(1, min(a.count,b.count))) }
    public static func repeated(_ card: [String: Any], _ old: [String: Any]) -> Bool {
        if let id = card["id"] as? String, id == old["id"] as? String { return true }
        for field in ["title", "body", "claim"] {
            if let a = card[field] as? String, let b = old[field] as? String, !a.isEmpty, normalized(a) == normalized(b) { return true }
        }
        if let a = card["fingerprint"] as? String, let b = old["fingerprint"] as? String, !a.isEmpty, a == b { return true }
        if let a = card["claimFingerprint"] as? String, let b = old["claimFingerprint"] as? String, !a.isEmpty, a == b { return true }
        let newEvidence = card["evidence"] as? [[String: Any]] ?? []
        let oldEvidence = old["evidence"] as? [[String: Any]] ?? []
        if newEvidence.contains(where: { item in
            guard let quote = item["quote"] as? String else { return false }
            return oldEvidence.contains { oldItem in normalized(quote) == normalized(oldItem["quote"] as? String ?? "") }
        }) { return true }
        let a = words(card["body"] as? String ?? ""), b = words(old["body"] as? String ?? "")
        return overlap(a,b) >= 0.78 && overlap(words(card["title"] as? String ?? ""),words(old["title"] as? String ?? "")) >= 0.5
    }
    public static func evidence(_ extract: String, focus: String, level: Int) -> String {
        let terms = words(focus)
        var section = "Introduction"
        var passages: [(String, String, Int)] = []
        var position = 0
        for paragraph in extract.components(separatedBy: .newlines) {
            if paragraph.hasPrefix("==") { section = paragraph.trimmingCharacters(in: CharacterSet(charactersIn: "= ")); continue }
            if ["References", "Notes", "External links", "Further reading", "Bibliography", "See also"].contains(section) || paragraph.count < 90 { position += 1; continue }
            if level >= 5 && section == "Introduction" { position += 1; continue }
            var sentences: [String] = []
            paragraph.enumerateSubstrings(in: paragraph.startIndex..<paragraph.endIndex, options: .bySentences) { sentence, _, _, _ in
                if let sentence { sentences.append(sentence.trimmingCharacters(in: .whitespacesAndNewlines)) }
            }
            if sentences.isEmpty { sentences = [paragraph] }
            var chunk = ""
            for sentence in sentences {
                if !chunk.isEmpty && chunk.count + sentence.count + 1 > 1200 {
                    if chunk.count >= 90 {
                        passages.append((section, chunk, position)); position += 1
                    }
                    chunk = ""
                }
                if sentence.count > 1200 {
                    if chunk.count >= 90 {
                        passages.append((section, chunk, position)); position += 1
                    }
                    chunk = ""
                    passages.append((section, sentence, position)); position += 1
                } else { chunk += (chunk.isEmpty ? "" : " ") + sentence }
            }
            if chunk.count >= 90 {
                passages.append((section, chunk, position)); position += 1
            }
        }
        // Require body support, not a heading-only match, and rank deterministically.
        let candidates = passages.compactMap { passage -> (Int, String, String, Double)? in
            let coverage = overlap(terms, words(passage.1))
            guard coverage > 0, passage.1.range(of: "[.!?][”’\"')\\]]*$", options: .regularExpression) != nil else { return nil }
            return (passage.2, passage.0, passage.1, coverage * 5)
        }.sorted { $0.3 == $1.3 ? $0.0 < $1.0 : $0.3 > $1.3 }
        guard let best = candidates.first else { return "" }
        let neighbor = candidates.dropFirst().first { $0.1 == best.1 && abs($0.0 - best.0) == 1 && $0.3 >= best.3 * 0.5 && $0.2 != best.2 }
        return ([best] + (neighbor.map { [$0] } ?? [])).sorted { $0.0 < $1.0 }
            .map { "[Section: \($0.1)]\n\($0.2)" }.joined(separator: "\n\n")
    }

    public static func stableEvidenceID(_ key: String) -> String {
        var hash: UInt64 = 0xcbf29ce484222325
        for byte in key.utf8 { hash = (hash ^ UInt64(byte)) &* 0x100000001b3 }
        return "e" + String(format: "%016llx", hash)
    }
    private static func evidenceIsInSection(_ extract: String, quote: String, section: String) -> Bool {
        for passage in extract.components(separatedBy: "[Section: ").dropFirst() {
            let parts = passage.split(separator: "]", maxSplits: 1, omittingEmptySubsequences: false)
            guard parts.count == 2 else { continue }
            if String(parts[0]).trimmingCharacters(in: .whitespacesAndNewlines) == section {
                return normalized(String(parts[1])).contains(normalized(quote))
            }
        }
        return false
    }
    public static func validate(title: String, hook: String, claim: String, sentences: [String], evidence: [[String: Any]], sources: [[String: Any]], expectedSentences: Any? = 3, difficulty: Int = 0) -> Bool {
        let expected = sentenceCount(expectedSentences)
        let count = hook.split(whereSeparator: { $0.isWhitespace }).count
        guard !title.isEmpty, !claim.isEmpty, normalized(title) != normalized(hook), (4...12).contains(count), sentences.count == expected, evidence.count <= 12 else { return false }
        guard hook.range(of: "\\b(and|or|of|the|a|to|with)$", options: [.regularExpression,.caseInsensitive]) == nil else { return false }
        var sections = Set<String>()
        for (index, sentence) in sentences.enumerated() {
            guard (35...600).contains(sentence.count), sentence.split(whereSeparator: { $0.isWhitespace }).count >= 8, sentence.range(of: "[.!?][”\"']?$", options: .regularExpression) != nil else { return false }
            let quotes = evidence.filter { $0["sentence"] as? Int == index }
            if quotes.isEmpty { return false }
            for item in quotes {
                guard let source = item["sourceIndex"] as? Int, sources.indices.contains(source), let quote = item["quote"] as? String, quote.count >= 30,
                      let extract = sources[source]["extract"] as? String, normalized(extract).contains(normalized(quote)) else { return false }
                if difficulty > 0 {
                    guard let section = item["section"] as? String, !section.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, evidenceIsInSection(extract, quote: quote, section: section.trimmingCharacters(in: .whitespacesAndNewlines)) else { return false }
                    sections.insert(normalized(section))
                }
            }
        }
        if difficulty >= 5 && sections.contains(where: { $0 == "introduction" || $0 == "lead" }) { return false }
        if difficulty > 0 && sections.count != 1 { return false }
        return true
    }
}

public actor FactPublicationLedger {
    private var cards: [[String: Any]] = []
    public init(initial: [[String: Any]] = []) { cards = initial }
    public func accept(_ card: [String: Any]) -> Bool {
        if cards.contains(where: { FactQuality.repeated(card,$0) }) { return false }
        cards.append(card)
        return true
    }
}
