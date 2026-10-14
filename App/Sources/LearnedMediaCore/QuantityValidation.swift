import Foundation

public enum QuantityValidation {
    private struct Quantity {
        let text: String, value: Double, unit: QuantityUnits.Unit?, literalUnit: String?
        let approximate: Bool, decimals: Int
        var delta = false
        var magnitudeScale = 1.0
    }
    private static let aliases: [String: QuantityUnits.Unit] = Dictionary(uniqueKeysWithValues: QuantityUnits.all.flatMap { unit in unit.aliases.map { ($0, unit) } })
    private static let unitRegex = try! NSRegularExpression(pattern: "^(?:" + aliases.keys.sorted { $0.count > $1.count }.map { NSRegularExpression.escapedPattern(for: $0) }.joined(separator: "|") + ")(?![a-zA-Z])", options: .caseInsensitive)
    private static let words = QuantityUnits.numberWords.keys.sorted { $0.count > $1.count }.map { NSRegularExpression.escapedPattern(for: $0) }.joined(separator: "|")
    private static let hundredPattern = "(?:one|two|three|four|five|six|seven|eight|nine) hundred(?: (?:and )?(?:" + words + "))?"
    private static let wordRegex = try! NSRegularExpression(pattern: "\\b(?:" + hundredPattern + "|" + words + ")(?=(?:\\s+|[-‑])(?:(?:thousand|million|billion)\\s+)?(?:" + aliases.keys.sorted { $0.count > $1.count }.map { NSRegularExpression.escapedPattern(for: $0) }.joined(separator: "|") + ")(?![a-zA-Z]))", options: .caseInsensitive)
    private static func wordValue(_ word: String) -> Int? {
        if let value = QuantityUnits.numberWords[word] { return value }
        let parts = word.components(separatedBy: " hundred")
        guard parts.count == 2, let hundreds = QuantityUnits.numberWords[parts[0]], (1...9).contains(hundreds) else { return nil }
        let rest = parts[1].trimmingCharacters(in: .whitespaces).replacingOccurrences(of: "^and ", with: "", options: .regularExpression)
        guard rest.isEmpty || QuantityUnits.numberWords[rest] != nil else { return nil }
        return hundreds*100 + (QuantityUnits.numberWords[rest] ?? 0)
    }
    private static let numberRegex = try! NSRegularExpression(pattern: #"(?<![\p{L}\p{N}_.,+−-])[+−-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:e[+−-]?\d+)?(?![\p{N}_]|[.,]\d)"#, options: .caseInsensitive)
    private static func quantities(_ original: String) -> [Quantity] {
        var text = original
        let originalText = original as NSString
        for match in wordRegex.matches(in: original, range: NSRange(location: 0, length: originalText.length)).reversed() {
            let word = originalText.substring(with: match.range).lowercased()
            if let value = wordValue(word) { text = (text as NSString).replacingCharacters(in: match.range, with: String(value)) }
        }
        text = text.replacingOccurrences(of: #"(?<=\d)[-–—−](?=\d)"#, with: " – ", options: .regularExpression)
        let input = text as NSString
        var occupiedThrough = 0
        var result: [Quantity] = numberRegex.matches(in: text, range: NSRange(location: 0, length: input.length)).compactMap { match in
            guard match.range.location >= occupiedThrough else { return nil }
            let number = input.substring(with: match.range)
            let significantDigits = number.lowercased().components(separatedBy: "e")[0].replacingOccurrences(of: #"[^0-9]"#, with: "", options: .regularExpression).replacingOccurrences(of: #"^0+|0+$"#, with: "", options: .regularExpression).count
            var value = Double(number.replacingOccurrences(of: ",", with: "").replacingOccurrences(of: "−", with: "-")) ?? .nan
            let originalTail = input.substring(from: NSMaxRange(match.range))
            let magnitudeRange = originalTail.range(of: #"^\s+(hundred|thousand|million|billion)\b"#, options: [.regularExpression,.caseInsensitive])
            let magnitude = magnitudeRange.map { String(originalTail[$0]) } ?? ""
            let magnitudeScale = magnitude.isEmpty ? 1.0 : ["hundred":100.0,"thousand":1000,"million":1e6,"billion":1e9][magnitude.trimmingCharacters(in: .whitespaces).lowercased()]!
            value *= magnitudeScale
            let tail = String(originalTail.dropFirst(magnitude.count))
            let space = (tail as NSString).range(of: #"^(?:\s*[-‑]\s*(?=[a-zA-Z°])|\s*)"#, options: .regularExpression).length
            let rest = (tail as NSString).substring(from: space)
            let token = unitRegex.firstMatch(in: rest, range: NSRange(location: 0, length: (rest as NSString).length)).map { (rest as NSString).substring(with: $0.range) }
            let unit = token.flatMap { aliases[$0.lowercased()] }
            let unknown = unit == nil && space == 0 ? tail.range(of: #"^[\p{L}][\p{L}\p{N}-]*"#, options: .regularExpression).map { String(tail[$0]) } : nil
            let suffix = token.map { (rest as NSString).substring(from: ($0 as NSString).length) } ?? ""
            let compound = suffix.range(of: #"^(?:[\/²³^][^\s,;.!?]*|\s+per\s+[^\s,;.!?]+|\s+(?:squared|cubed)\b)"#, options: .regularExpression).map { String(suffix[$0]) }
            let prefix = input.substring(with: NSRange(location: max(0, match.range.location-30), length: min(30,match.range.location)))
            let approximate = prefix.range(of: #"\b(?:about|approximately|around|roughly|circa)\s*$"#, options: [.regularExpression,.caseInsensitive]) != nil
            let entirePrefix = input.substring(to: match.range.location)
            let delta = unit?.dimension == "temperature" && entirePrefix.range(of: #"\b(?:from|to|at|between)\s*$"#, options: [.regularExpression,.caseInsensitive]) == nil && (entirePrefix.range(of: #"\b(?:rose|rise|increased|increase|decreased|decrease|dropped|drop|difference|change|changed)\b[^.!?]{0,35}$"#, options: [.regularExpression,.caseInsensitive]) != nil || suffix.range(of: #"^\s+(?:higher|lower|warmer|cooler|colder|difference)\b"#, options: [.regularExpression,.caseInsensitive]) != nil)
            let decimals = number.lowercased().contains("e") ? -1 : (number.split(separator: ".", omittingEmptySubsequences: false).dropFirst().first?.count ?? 0)
            occupiedThrough = NSMaxRange(match.range) + (magnitude as NSString).length + space + ((token ?? unknown ?? "") as NSString).length + ((compound ?? "") as NSString).length
            return Quantity(text: number + magnitude + (token.map { (tail as NSString).substring(to: space + ($0 as NSString).length) + (compound ?? "") } ?? (unknown ?? "")), value: significantDigits > 15 || !value.isFinite ? .nan : value,
                            unit: compound == nil ? unit : nil, literalUnit: compound.map { (token ?? "").lowercased() + $0.lowercased() } ?? unknown?.lowercased(), approximate: approximate, decimals: decimals, delta: delta, magnitudeScale: magnitudeScale)
        }
        let formats = try! NSRegularExpression(pattern: #"\d+(?:[.,]\d+)+"#)
        for match in formats.matches(in: text, range: NSRange(location: 0, length: input.length)) {
            let raw = input.substring(with: match.range)
            let validRange = numberRegex.firstMatch(in: raw, range: NSRange(location: 0, length: (raw as NSString).length))?.range
            let valid = validRange?.location == 0 && validRange?.length == (raw as NSString).length
            let tail = input.substring(from: NSMaxRange(match.range)).trimmingCharacters(in: .whitespacesAndNewlines)
            if !valid && unitRegex.firstMatch(in: tail, range: NSRange(location: 0, length: (tail as NSString).length)) != nil {
                result.append(Quantity(text: raw, value: .nan, unit: nil, literalUnit: nil, approximate: false, decimals: 0))
            }
        }
        return result;
    }
    private static func equivalent(_ claim: Quantity, _ source: Quantity) -> Bool {
        guard claim.value.isFinite, source.value.isFinite else { return false }
        if claim.literalUnit != nil || source.literalUnit != nil { return claim.literalUnit == source.literalUnit && claim.value == source.value }
        guard let unit = claim.unit, let sourceUnit = source.unit else { return claim.unit == nil && source.unit == nil && claim.value == source.value }
        guard unit.dimension == sourceUnit.dimension, claim.delta == source.delta else { return false }
        if unit.id == sourceUnit.id { return claim.value == source.value }
        let converted = (source.value * sourceUnit.factor + (source.delta ? 0 : sourceUnit.offset) - (claim.delta ? 0 : unit.offset)) / unit.factor
        let epsilon = max(abs(converted),abs(claim.value)) * Double.ulpOfOne * 16
        if abs(converted-claim.value) <= epsilon { return true }
        guard claim.approximate, (0...9).contains(claim.decimals) else { return false }
        let scale = pow(10, Double(claim.decimals)) / claim.magnitudeScale
        let rounded = (converted < 0 ? -1.0 : 1.0) * floor(abs(converted)*scale + 0.5) / scale
        return abs(rounded-claim.value) <= epsilon
    }
    /// Only the assigned passages may establish a sentence's numerical quantities.
    public static func unsupported(_ claim: String, passages: [String]) -> [String] {
        let sources = passages.flatMap { quantities($0) }
        var seen = Set<String>()
        return quantities(claim).filter { quantity in !sources.contains { equivalent(quantity,$0) } }.map(\.text).filter { seen.insert($0).inserted }
    }
}
