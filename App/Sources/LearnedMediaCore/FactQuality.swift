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
        DifficultyPolicy.rubric(level)
    }
    public static func normalized(_ text: String) -> String {
        text.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "en_US_POSIX")).lowercased().replacingOccurrences(of: "[^a-z0-9]+", with: " ", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
    }
    private static let stop = Set("a an the of in on at to for from by with and or but is was were are be been this that it its as his her their had has have who which they he she into through about also one two three".split(separator: " ").map(String.init))
    public static func words(_ text: String) -> Set<String> { Set(normalized(text).split(separator: " ").map(String.init).filter { $0.count > 2 && !stop.contains($0) }) }
    public static func overlap(_ a: Set<String>, _ b: Set<String>) -> Double { Double(a.intersection(b).count) / Double(max(1, min(a.count,b.count))) }

    private static let noveltyAliases: [String: String] = [
        "build":"build", "built":"build", "construct":"build", "constructed":"build", "erect":"build", "erected":"build",
        "found":"found", "founded":"found", "establish":"found", "established":"found", "form":"found", "formed":"found",
        "begin":"begin", "began":"begin", "start":"begin", "started":"begin", "commence":"begin", "commenced":"begin",
        "end":"end", "ended":"end", "cease":"end", "ceased":"end", "conclude":"end", "concluded":"end",
        "discover":"discover", "discovered":"discover", "identify":"discover", "identified":"discover", "uncover":"discover", "uncovered":"discover",
        "invent":"invent", "invented":"invent", "devise":"invent", "devised":"invent",
        "ban":"ban", "banned":"ban", "prohibit":"ban", "prohibited":"ban", "forbid":"ban", "forbade":"ban", "outlaw":"ban", "outlawed":"ban",
        "declare":"declare", "declared":"declare", "proclaim":"declare", "proclaimed":"declare", "sign":"sign", "signed":"sign",
        "kill":"kill", "killed":"kill", "slay":"kill", "slain":"kill",
        "create":"create", "created":"create", "make":"create", "made":"create", "produce":"create", "produced":"create",
        "use":"use", "used":"use", "employ":"use", "employed":"use",
        "measure":"measure", "measured":"measure", "record":"record", "recorded":"record",
        "contain":"contain", "contained":"contain", "include":"include", "included":"include",
        "reach":"reach", "reached":"reach", "survive":"survive", "survived":"survive",
        "travel":"travel", "travelled":"travel", "traveled":"travel", "orbit":"orbit", "orbited":"orbit",
        "erupt":"erupt", "erupted":"erupt", "collapse":"collapse", "collapsed":"collapse",
        "cause":"cause", "caused":"cause", "lead":"cause", "led":"cause",
        "weigh":"weigh", "weighed":"weigh", "publish":"publish", "published":"publish", "release":"publish", "released":"publish",
        "write":"write", "wrote":"write", "written":"write", "author":"write", "authored":"write",
        "win":"win", "won":"win", "serve":"serve", "served":"serve", "name":"name", "named":"name", "call":"name", "called":"name",
        "award":"award", "awarded":"award", "grant":"award", "granted":"award",
        "elect":"elect", "elected":"elect", "choose":"elect", "chosen":"elect", "select":"elect", "selected":"elect",
        "acquire":"acquire", "acquired":"acquire", "purchase":"acquire", "purchased":"acquire", "buy":"acquire", "bought":"acquire",
        "convert":"convert", "converted":"convert", "transform":"convert", "transformed":"convert",
        "move":"move", "moved":"move", "relocate":"move", "relocated":"move",
        "remove":"remove", "removed":"remove", "abolish":"remove", "abolished":"remove", "dismantle":"remove", "dismantled":"remove",
        "defeat":"defeat", "defeated":"defeat", "beat":"defeat", "beaten":"defeat",
        "separate":"separate", "separated":"separate", "split":"separate", "divided":"separate",
        "restore":"restore", "restored":"restore", "rebuild":"restore", "rebuilt":"restore",
        "expand":"expand", "expanded":"expand", "enlarge":"expand", "enlarged":"expand",
        "reduce":"reduce", "reduced":"reduce", "decrease":"reduce", "decreased":"reduce",
        "km":"distance", "kilometer":"distance", "kilometers":"distance", "kilometre":"distance", "kilometres":"distance",
        "meter":"distance", "meters":"distance", "metre":"distance", "metres":"distance", "mile":"distance", "miles":"distance", "mi":"distance", "m":"distance",
        "kilogram":"mass", "kilograms":"mass", "kg":"mass", "pound":"mass", "pounds":"mass", "lb":"mass",
        "celsius":"temperature", "centigrade":"temperature", "fahrenheit":"temperature", "c":"temperature", "f":"temperature"
    ]
    private static let noveltyRelations = Set(["build", "found", "begin", "end", "discover", "invent", "ban", "declare", "sign", "kill", "create", "use", "measure", "record", "contain", "include", "reach", "survive", "travel", "orbit", "erupt", "collapse", "cause", "weigh", "publish", "write", "win", "serve", "name", "award", "elect", "acquire", "convert", "move", "remove", "defeat", "separate", "restore", "expand", "reduce"])

    private static func noveltyWords(_ text: String) -> Set<String> {
        var result = Set(normalized(text).split(separator: " ").map(String.init).filter { $0.count > 2 && Int($0) == nil && !stop.contains($0) }.map { noveltyAliases[$0] ?? $0 })
        if let expression = try? NSRegularExpression(pattern: #"\b[A-Z]{2,}\b"#) {
            let range = NSRange(text.startIndex..<text.endIndex, in: text)
            for match in expression.matches(in: text, range: range) {
                if let value = Range(match.range, in: text) { result.insert(String(text[value]).lowercased()) }
            }
        }
        return result
    }

    public static func noveltyLookupTerms(_ card: [String: Any]) -> Set<String> {
        let title = card["title"] as? String ?? ""
        let claim = card["claim"] as? String ?? title
        let body = card["body"] as? String ?? ""
        return noveltyWords(title).union(noveltyWords(claim)).union(noveltyWords(body))
    }

    public static func noveltyClaimKey(_ card: [String: Any]) -> String {
        guard let claim = card["claim"] as? String, !claim.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return "" }
        return normalized(claim)
    }

    public static func noveltyBodyKey(_ card: [String: Any]) -> String {
        normalized(card["body"] as? String ?? "")
    }

    private static func noveltyDetails(_ text: String) -> [String] {
        guard let expression = try? NSRegularExpression(pattern: #"\b(\d[\d,]*(?:\.\d+)?)\s*(km|kilometers?|kilometres?|miles?|mi|meters?|metres?|kg|kilograms?|pounds?|lb|celsius|centigrade|fahrenheit|c|f)?\b"#, options: [.caseInsensitive]) else { return [] }
        let range = NSRange(text.startIndex..<text.endIndex, in: text)
        return expression.matches(in: text, range: range).compactMap { match -> String? in
            guard let amountRange = Range(match.range(at: 1), in: text) else { return nil }
            guard let amount = Double(String(text[amountRange]).replacingOccurrences(of: ",", with: "")) else { return nil }
            let rawUnit = Range(match.range(at: 2), in: text).map { String(text[$0]).lowercased() } ?? ""
            var value = amount, base = rawUnit
            if ["km", "kilometer", "kilometers", "kilometre", "kilometres"].contains(rawUnit) { value *= 1_000; base = "m" }
            else if ["mile", "miles", "mi"].contains(rawUnit) { value *= 1_609.344; base = "m" }
            else if ["meter", "meters", "metre", "metres", "m"].contains(rawUnit) { base = "m" }
            else if ["kilogram", "kilograms", "kg"].contains(rawUnit) { base = "kg" }
            else if ["pound", "pounds", "lb"].contains(rawUnit) { value *= 0.45359237; base = "kg" }
            else if ["fahrenheit", "f"].contains(rawUnit) { value = (value - 32) * 5 / 9; base = "c" }
            else if ["celsius", "centigrade", "c"].contains(rawUnit) { base = "c" }
            let rounded = (value * 1_000_000).rounded() / 1_000_000
            var amountText = String(format: "%.6f", rounded)
            while amountText.contains("."), amountText.last == "0" { amountText.removeLast() }
            if amountText.last == "." { amountText.removeLast() }
            return "\(amountText):\(base)"
        }.sorted()
    }

    private static func noveltyPolarity(_ text: String) -> Bool {
        text.range(of: #"\b(?:no|not|never|without|neither|cannot|can't|didn't|doesn't|wasn't|weren't|failed to)\b"#, options: [.regularExpression, .caseInsensitive]) != nil
    }

    private static func noveltyEvidenceKeys(_ card: [String: Any]) -> Set<String> {
        if let keys = card["evidenceKeys"] as? [String], !keys.isEmpty { return Set(keys) }
        let sources = card["sources"] as? [[String: Any]] ?? []
        let evidence = card["evidence"] as? [[String: Any]] ?? []
        return Set(evidence.compactMap { item -> String? in
            guard let quote = item["quote"] as? String, !quote.isEmpty else { return nil }
            let index = item["sourceIndex"] as? Int ?? -1
            guard sources.indices.contains(index) else { return nil }
            let source = sources[index]
            let url = (source["canonicalUrl"] as? String ?? source["url"] as? String ?? "").components(separatedBy: "#").first ?? ""
            guard !url.isEmpty else { return nil }
            return url + "\u{0}" + normalized(item["section"] as? String ?? "") + "\u{0}" + normalized(quote)
        })
    }

    public static func repeated(_ card: [String: Any], _ old: [String: Any]) -> Bool {
        if let id = card["id"] as? String, id == old["id"] as? String { return true }
        let explicitNewClaim = (card["claim"] as? String).map { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty } ?? false
        let explicitOldClaim = (old["claim"] as? String).map { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty } ?? false
        let newClaim = explicitNewClaim ? card["claim"] as? String ?? "" : card["title"] as? String ?? ""
        let oldClaim = explicitOldClaim ? old["claim"] as? String ?? "" : old["title"] as? String ?? ""
        let newBody = card["body"] as? String ?? "", oldBody = old["body"] as? String ?? ""
        let newComparisonText = explicitNewClaim ? newClaim : newBody
        let oldComparisonText = explicitOldClaim ? oldClaim : oldBody
        let newDetails = noveltyDetails(newComparisonText), oldDetails = noveltyDetails(oldComparisonText)
        if noveltyPolarity(newComparisonText) != noveltyPolarity(oldComparisonText) || (!newDetails.isEmpty && !oldDetails.isEmpty && newDetails != oldDetails) { return false }
        if explicitNewClaim && explicitOldClaim && !newClaim.isEmpty && normalized(newClaim) == normalized(oldClaim) { return true }
        if !newBody.isEmpty && normalized(newBody) == normalized(oldBody) { return true }
        let newClaimWords = noveltyWords(newComparisonText), oldClaimWords = noveltyWords(oldComparisonText)
        let newRelations = newClaimWords.intersection(noveltyRelations), oldRelations = oldClaimWords.intersection(noveltyRelations)
        if !newRelations.isEmpty && !oldRelations.isEmpty && newRelations.isDisjoint(with: oldRelations) { return false }
        if (explicitNewClaim && explicitOldClaim || (!newBody.isEmpty && !oldBody.isEmpty)) && newClaimWords.count >= 3 && oldClaimWords.count >= 3 {
            let common = newClaimWords.intersection(oldClaimWords).count
            let containment = Double(common) / Double(max(1, min(newClaimWords.count, oldClaimWords.count)))
            let jaccard = Double(common) / Double(max(1, newClaimWords.union(oldClaimWords).count))
            let sharedRelation = !newRelations.isDisjoint(with: oldRelations)
            if containment >= 0.84 && jaccard >= 0.68 && (sharedRelation || jaccard >= 0.9) { return true }
            let sharedEvidence = !noveltyEvidenceKeys(card).isDisjoint(with: noveltyEvidenceKeys(old))
            if sharedEvidence && containment >= 0.78 && jaccard >= 0.58 { return true }
        }

        let newBodyWords = noveltyWords(newBody), oldBodyWords = noveltyWords(oldBody)
        guard newBodyWords.count >= 5 && oldBodyWords.count >= 5 else { return false }
        let sharedBody = newBodyWords.intersection(oldBodyWords).count
        let bodyContainment = Double(sharedBody) / Double(max(1, min(newBodyWords.count, oldBodyWords.count)))
        let bodyJaccard = Double(sharedBody) / Double(max(1, newBodyWords.union(oldBodyWords).count))
        let titleWords = noveltyWords(card["title"] as? String ?? ""), oldTitleWords = noveltyWords(old["title"] as? String ?? "")
        let sharedTitle = titleWords.intersection(oldTitleWords).count
        let titleContainment = Double(sharedTitle) / Double(max(1, min(titleWords.count, oldTitleWords.count)))
        return bodyContainment >= 0.92 && bodyJaccard >= 0.78 && titleContainment >= 0.65
    }
    // Bump when sentence, section, tokenization or passage-eligibility rules change.
    private static let passageValidationPolicyVersion = "wikipedia-passages-v1"
    private struct PreparedChunk { let text: String; let terms: Set<String>; let complete: Bool }
    private struct PreparedParagraph { let section: String; let skipped: Bool; let chunks: [PreparedChunk] }
    private final class PreparedArticle: NSObject {
        let paragraphs: [PreparedParagraph]
        let expiresAt = Date().addingTimeInterval(3600)
        init(_ paragraphs: [PreparedParagraph]) { self.paragraphs = paragraphs }
    }
    private final class PreparedSentences: NSObject {
        let sentences: [String]
        let expiresAt = Date().addingTimeInterval(3600)
        init(_ sentences: [String]) { self.sentences = sentences }
    }
    // NSCache supports concurrent readers and evicts under memory pressure.
    private static let passageCache: NSCache<NSData, PreparedArticle> = {
        let cache = NSCache<NSData, PreparedArticle>()
        cache.countLimit = 24; cache.totalCostLimit = 8 * 1024 * 1024
        return cache
    }()
    private static let sentenceCache: NSCache<NSData, PreparedSentences> = {
        let cache = NSCache<NSData, PreparedSentences>()
        cache.countLimit = 128; cache.totalCostLimit = 4 * 1024 * 1024
        return cache
    }()
    private static func preprocessingKey(_ content: String) -> NSData {
        // UTF-8 identity preserves exact source characters, without hash collisions.
        Data((passageValidationPolicyVersion + "\u{0}" + content).utf8) as NSData
    }
    public static func completeSentences(_ paragraph: String) -> [String] {
        let key = preprocessingKey(paragraph)
        if let cached = sentenceCache.object(forKey: key), cached.expiresAt > Date() { return cached.sentences }
        var sentences: [String] = []
        paragraph.enumerateSubstrings(in: paragraph.startIndex..<paragraph.endIndex, options: .bySentences) { sentence, _, _, _ in
            if let sentence { sentences.append(sentence.trimmingCharacters(in: .whitespacesAndNewlines)) }
        }
        if sentences.isEmpty { sentences = [paragraph] }
        if paragraph.utf8.count <= 20_000 {
            sentenceCache.setObject(PreparedSentences(sentences), forKey: key, cost: key.length + paragraph.utf8.count)
        }
        return sentences
    }
    private static func preparedPassages(_ extract: String) -> [PreparedParagraph] {
        let key = preprocessingKey(extract)
        if let cached = passageCache.object(forKey: key), cached.expiresAt > Date() { return cached.paragraphs }
        var section = "Introduction"
        var paragraphs: [PreparedParagraph] = []
        for paragraph in extract.components(separatedBy: .newlines) {
            if paragraph.hasPrefix("==") { section = paragraph.trimmingCharacters(in: CharacterSet(charactersIn: "= ")); continue }
            let skipped = ["References", "Notes", "External links", "Further reading", "Bibliography", "See also"].contains(section) || paragraph.count < 90
            if skipped {
                paragraphs.append(PreparedParagraph(section: section, skipped: true, chunks: []))
                continue
            }
            let sentences = completeSentences(paragraph)
            var chunks: [String] = []
            var chunk = ""
            for sentence in sentences {
                if !chunk.isEmpty && chunk.count + sentence.count + 1 > 1200 {
                    if chunk.count >= 90 {
                        chunks.append(chunk)
                    }
                    chunk = ""
                }
                if sentence.count > 1200 {
                    if chunk.count >= 90 {
                        chunks.append(chunk)
                    }
                    chunk = ""
                    chunks.append(sentence)
                } else { chunk += (chunk.isEmpty ? "" : " ") + sentence }
            }
            if chunk.count >= 90 {
                chunks.append(chunk)
            }
            paragraphs.append(PreparedParagraph(section: section, skipped: false, chunks: chunks.map {
                PreparedChunk(text: $0, terms: words($0), complete: $0.range(of: "[.!?][”’\"')\\]]*$", options: .regularExpression) != nil)
            }))
        }
        if extract.utf8.count <= 200_000 {
            passageCache.setObject(PreparedArticle(paragraphs), forKey: key, cost: key.length + extract.utf8.count * 4)
        }
        return paragraphs
    }
    public static func evidence(_ extract: String, focus: String, level: Int) -> String {
        let terms = words(focus)
        var passages: [(String, PreparedChunk, Int)] = []
        var position = 0
        for paragraph in preparedPassages(extract) {
            if paragraph.skipped || (level >= DifficultyPolicy.innerSectionFrom && paragraph.section == "Introduction") { position += 1; continue }
            for chunk in paragraph.chunks {
                passages.append((paragraph.section, chunk, position)); position += 1
            }
        }
        // Require body support, not a heading-only match, and rank deterministically.
        let candidates = passages.compactMap { passage -> (Int, String, String, Double)? in
            let coverage = overlap(terms, passage.1.terms)
            guard coverage > 0, passage.1.complete else { return nil }
            return (passage.2, passage.0, passage.1.text, coverage * 5 * (level < DifficultyPolicy.innerSectionFrom && passage.0 != "Introduction" ? 1.05 : 1))
        }.sorted { $0.3 == $1.3 ? $0.0 < $1.0 : $0.3 > $1.3 }
        guard let best = candidates.first else { return "" }
        let neighbor = candidates.dropFirst().first { $0.1 == best.1 && abs($0.0 - best.0) == 1 && $0.3 >= best.3 * 0.5 && $0.2 != best.2 }
        return ([best] + (neighbor.map { [$0] } ?? [])).sorted { $0.0 < $1.0 }
            .map { "[Section: \($0.1)]\n\($0.2)" }.joined(separator: "\n\n")
    }

    /// Normalize formatting only; do not merge different source sections or factual text.
    public static func evidencePassageKey(sourceURL: String, section: String, quote: String) -> String {
        func normalize(_ text: String) -> String {
            text.precomposedStringWithCanonicalMapping.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return sourceURL.trimmingCharacters(in: .whitespacesAndNewlines) + "\u{0}" + normalize(section) + "\u{0}" + normalize(quote)
    }

    public static func stableEvidenceID(_ key: String) -> String {
        var hash: UInt64 = 0xcbf29ce484222325
        for byte in key.utf8 { hash = (hash ^ UInt64(byte)) &* 0x100000001b3 }
        return "e" + String(format: "%016llx", hash)
    }
    /// Every ID must be assigned to this card, even if it exists elsewhere in the batch.
    public static func validEvidenceReferences(_ references: [(sentence: Int, evidenceIDs: [String]?)], assignedIDs: Set<String>, sentenceCount: Int) -> Bool {
        guard !references.isEmpty, references.count <= 12 else { return false }
        var count = 0
        for reference in references {
            guard (0..<sentenceCount).contains(reference.sentence), let ids = reference.evidenceIDs,
                  !ids.isEmpty, ids.count <= 3, ids.allSatisfy({ assignedIDs.contains($0) }) else { return false }
            count += ids.count
        }
        return count <= 12
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
    public static func validate(title: String, hook: String, claim: String, sentences: [String], evidence: [[String: Any]], sources: [[String: Any]], expectedSentences: Any? = 3, difficulty: Int = 0, claimEvidence: [String]? = nil) -> Bool {
        let expected = sentenceCount(expectedSentences)
        let count = hook.split(whereSeparator: { $0.isWhitespace }).count
        guard !title.isEmpty, !claim.isEmpty, normalized(title) != normalized(hook), (4...12).contains(count), sentences.count == expected, evidence.count <= 12 else { return false }
        guard FactSpecificity.reason(claim, sentences: sentences) == nil else { return false }
        guard hook.range(of: "\\b(and|or|of|the|a|to|with)$", options: [.regularExpression,.caseInsensitive]) == nil else { return false }
        guard evidence.allSatisfy({ item in
            guard let sentence = item["sentence"] as? Int else { return false }
            return sentences.indices.contains(sentence)
        }) else { return false }
        var sections = Set<String>()
        var causalEvidence = CausalValidation.PreparedEvidence()
        for (index, sentence) in sentences.enumerated() {
            guard (35...600).contains(sentence.count), sentence.split(whereSeparator: { $0.isWhitespace }).count >= 8, sentence.range(of: "[.!?][”\"']?$", options: .regularExpression) != nil else { return false }
            let quotes = evidence.filter { $0["sentence"] as? Int == index }
            if quotes.isEmpty { return false }
            guard QuantityValidation.unsupported(sentence, passages: quotes.compactMap { $0["quote"] as? String }).isEmpty else { return false }
            guard causalEvidence.unsupported(sentence, passages: quotes.compactMap { $0["quote"] as? String }).isEmpty else { return false }
            for item in quotes {
                guard let source = item["sourceIndex"] as? Int, sources.indices.contains(source), let quote = item["quote"] as? String, quote.count >= 30,
                      let extract = sources[source]["extract"] as? String, normalized(extract).contains(normalized(quote)) else { return false }
                if difficulty > 0 {
                    guard let section = item["section"] as? String, !section.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, evidenceIsInSection(extract, quote: quote, section: section.trimmingCharacters(in: .whitespacesAndNewlines)) else { return false }
                    sections.insert(normalized(section))
                }
            }
        }
        let allQuotes = evidence.compactMap { $0["quote"] as? String }
        if let claimEvidence, claimEvidence.isEmpty || !claimEvidence.allSatisfy({ allQuotes.contains($0) }) { return false }
        guard QuantityValidation.unsupported(claim, passages: claimEvidence ?? allQuotes).isEmpty,
              QuantityValidation.unsupported(title, passages: allQuotes).isEmpty,
              QuantityValidation.unsupported(hook, passages: allQuotes).isEmpty else { return false }
        guard causalEvidence.unsupported(claim, passages: claimEvidence ?? allQuotes).isEmpty,
              causalEvidence.unsupported(title, passages: allQuotes).isEmpty,
              causalEvidence.unsupported(hook, passages: allQuotes).isEmpty else { return false }
        if difficulty >= DifficultyPolicy.innerSectionFrom && sections.contains(where: { $0 == "introduction" || $0 == "lead" }) { return false }
        if difficulty > 0 && sections.count != 1 { return false }
        return true
    }
}

public struct FactNoveltyIndex {
    private var records: [[String: Any]] = []
    private var ids: [String: Int] = [:]
    private var claims: [String: [Int]] = [:]
    private var bodies: [String: [Int]] = [:]
    private var terms: [String: [Int]] = [:]

    public init(_ initial: [[String: Any]] = []) { for card in initial { add(card) } }

    public mutating func add(_ card: [String: Any]) {
        let id = card["id"] as? String ?? ""
        if !id.isEmpty, ids[id] != nil { return }
        let index = records.count
        records.append(card)
        if !id.isEmpty { ids[id] = index }
        let claim = FactQuality.noveltyClaimKey(card)
        if !claim.isEmpty { claims[claim, default: []].append(index) }
        let body = FactQuality.noveltyBodyKey(card)
        if !body.isEmpty { bodies[body, default: []].append(index) }
        for term in FactQuality.noveltyLookupTerms(card) { terms[term, default: []].append(index) }
    }

    public func findDuplicate(_ card: [String: Any]) -> [String: Any]? {
        if let id = card["id"] as? String, let index = ids[id] { return records[index] }
        var candidates = Set<Int>()
        let claim = FactQuality.noveltyClaimKey(card)
        let body = FactQuality.noveltyBodyKey(card)
        if let matches = claims[claim] { candidates.formUnion(matches) }
        if let matches = bodies[body] { candidates.formUnion(matches) }
        let queryTerms = FactQuality.noveltyLookupTerms(card)
        // Check the rarest terms first; near-duplicates share most of their claim tokens.
        for term in queryTerms.sorted(by: { (terms[$0]?.count ?? 0) < (terms[$1]?.count ?? 0) }) {
            if let matches = terms[term] { candidates.formUnion(matches) }
        }
        for index in max(0, records.count - 24)..<records.count { candidates.insert(index) }
        for index in candidates.sorted() where FactQuality.repeated(card, records[index]) { return records[index] }
        return nil
    }

    public var count: Int { records.count }
}

public actor FactPublicationLedger {
    private var index: FactNoveltyIndex
    public init(initial: [[String: Any]] = []) { index = FactNoveltyIndex(initial) }
    public func isDuplicate(_ card: [String: Any]) -> Bool { index.findDuplicate(card) != nil }
    public func accept(_ card: [String: Any]) -> Bool {
        if index.findDuplicate(card) != nil { return false }
        index.add(card)
        return true
    }
}
