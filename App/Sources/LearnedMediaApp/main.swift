import AppKit
import AuthenticationServices
import Cocoa
import CryptoKit
import Foundation
import WebKit
import LearnedMediaCore

private struct NativeError: Error { let message: String }

private struct GeminiCandidate: Decodable {
    let title: String?
    let hook: String?
    let fact: String?
    let topicPath: [String]?
    let wikipediaSearchTitles: [String]?
    let difficulty: Int?
}
private struct GeminiCandidateEnvelope: Decodable { let facts: [GeminiCandidate]? }
private struct GeminiGroundedFact: Decodable {
    let candidateIndex: Int?
    let title: String?
    let hook: String?
    let body: String?
    let sourceIndexes: [Int]?
    let difficulty: Int?
}
private struct GeminiGroundedEnvelope: Decodable { let facts: [GeminiGroundedFact]? }
private struct GeminiAnswerEnvelope: Decodable { let answer: String?; let citationIndexes: [Int]? }

private struct GeminiTextResponse: Decodable {
    struct Candidate: Decodable {
        struct Content: Decodable {
            struct Part: Decodable { let text: String? }
            let parts: [Part]?
        }
        let content: Content?
    }
    let candidates: [Candidate]?
}

private struct WikipediaSearchResponse: Decodable {
    struct Query: Decodable {
        struct Result: Decodable { let title: String? }
        let search: [Result]?
    }
    let query: Query?
}

private struct WikipediaPageResponse: Decodable {
    struct Query: Decodable {
        struct Page: Decodable {
            let title: String?
            let fullurl: String?
            let extract: String?
            let pageimage: String?
            let thumbnail: Thumbnail?
            struct Thumbnail: Decodable { let source: String? }
        }
        let pages: [String: Page]?
    }
    let query: Query?
}

private struct WikipediaImageInfoResponse: Decodable {
    struct Query: Decodable {
        struct Page: Decodable {
            struct ImageInfo: Decodable {
                let url: String?
                let thumburl: String?
                let descriptionurl: String?
                let extmetadata: [String: MetadataValue]?
            }
            let imageinfo: [ImageInfo]?
        }
        let pages: [String: Page]?
    }
    let query: Query?
}
private struct MetadataValue: Decodable { let value: String? }

private final class KeychainStore {
    private let service = "com.learnedmedia.app"
    private let account = "supabase-session"
    func saveSession(_ data: Data) throws {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
        SecItemDelete(query as CFDictionary)
        var item = query
        item[kSecValueData as String] = data
        guard SecItemAdd(item as CFDictionary, nil) == errSecSuccess else { throw NativeError(message: "The Google session could not be stored in Keychain.") }
    }
    func deleteSession() {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
        SecItemDelete(query as CFDictionary)
    }
}

private final class WikipediaClient {
    private let session = URLSession(configuration: .ephemeral)
    private func request<T: Decodable>(_ url: URL) async throws -> T {
        var request = URLRequest(url: url, timeoutInterval: 20)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("LearnedMedia/1.0 (knowledge-feed)", forHTTPHeaderField: "User-Agent")
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { throw NativeError(message: "Wikipedia could not be reached right now.") }
        return try JSONDecoder().decode(T.self, from: data)
    }
    private func apiURL(_ values: [String: String]) -> URL? {
        var components = URLComponents(string: "https://en.wikipedia.org/w/api.php")
        components?.queryItems = [URLQueryItem(name: "format", value: "json"), URLQueryItem(name: "origin", value: "*")] + values.map { URLQueryItem(name: $0.key, value: $0.value) }
        return components?.url
    }
    private func wikiURL(_ title: String) -> String {
        let encoded = title.replacingOccurrences(of: " ", with: "_").addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? title
        return "https://en.wikipedia.org/wiki/\(encoded)"
    }
    func resolve(title: String, searchTitles: [String]) async -> (sources: [[String: Any]], image: [String: Any]?) {
        let queries = ([title] + searchTitles).filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        var searched: [String] = []
        if let url = apiURL(["action": "query", "list": "search", "srsearch": queries.joined(separator: " "), "srnamespace": "0", "srlimit": "3"]), let result: WikipediaSearchResponse = try? await request(url) {
            searched = result.query?.search?.compactMap(\.title) ?? []
        }
        var titles = Array(NSOrderedSet(array: searched + queries)) as? [String] ?? (searched + queries)
        titles = Array(titles.prefix(3))
        if titles.isEmpty { titles = [title] }
        guard let pageURL = apiURL([
            "action": "query",
            "titles": titles.joined(separator: "|"),
            "prop": "pageimages|info|extracts",
            "inprop": "url",
            "exintro": "1",
            "explaintext": "1",
            "piprop": "thumbnail|name",
            "pilicense": "free",
            "pithumbsize": "1200"
        ]), let page: WikipediaPageResponse = try? await request(pageURL) else {
            return ([], nil)
        }
        let pages = page.query?.pages?.values.filter { $0.title != nil && $0.fullurl != nil } ?? []
        guard !pages.isEmpty else { return ([], nil) }
        let sources: [[String: Any]] = pages.compactMap { wikipediaPage in
            guard let sourceTitle = wikipediaPage.title, let sourceURL = wikipediaPage.fullurl else { return nil }
            var source: [String: Any] = ["title": sourceTitle, "url": sourceURL]
            if let extract = wikipediaPage.extract?.trimmingCharacters(in: .whitespacesAndNewlines), !extract.isEmpty {
                source["extract"] = String(extract.prefix(1200))
            }
            return source
        }
        var image: [String: Any]?
        if let wikipediaPage = pages.first(where: { $0.pageimage != nil }) ?? pages.first {
            let sourceTitle = wikipediaPage.title ?? titles[0]
            let sourceURL = wikipediaPage.fullurl ?? wikiURL(sourceTitle)
            if let pageimage = wikipediaPage.pageimage, let infoURL = apiURL(["action": "query", "titles": "File:\(pageimage)", "prop": "imageinfo", "iiprop": "url|extmetadata", "iiurlwidth": "1400"]), let infoPayload: WikipediaImageInfoResponse = try? await request(infoURL), let info = infoPayload.query?.pages?.values.first?.imageinfo?.first {
                let credit = info.extmetadata?["Artist"]?.value ?? info.extmetadata?["Credit"]?.value ?? "Wikipedia image"
                image = ["url": info.thumburl ?? info.url ?? wikipediaPage.thumbnail?.source ?? "", "alt": sourceTitle, "sourceTitle": sourceTitle, "sourceUrl": sourceURL, "fileUrl": info.url ?? "", "filePageUrl": info.descriptionurl ?? "https://commons.wikimedia.org/wiki/File:\(pageimage)", "credit": credit.replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)]
            } else if let thumbnail = wikipediaPage.thumbnail?.source {
                image = ["url": thumbnail, "alt": sourceTitle, "sourceTitle": sourceTitle, "sourceUrl": sourceURL, "filePageUrl": sourceURL, "credit": "Wikipedia image"]
            }
        }
        return (sources, image)
    }
}

private actor ModelScheduler {
    private var models: [String] = []
    private var healthy = Set<String>()
    private var cooldowns: [String: Date] = [:]
    private var cursor = 0

    func update(_ next: [String]) {
        models = next
        healthy = healthy.intersection(Set(next))
        cursor = cursor % max(next.count, 1)
    }

    func hasModels() -> Bool { !models.isEmpty }

    func reset() { models = []; healthy.removeAll(); cooldowns.removeAll(); cursor = 0 }

    func nextModels(limit: Int) -> [String] {
        let now = Date()
        let available = models.filter { (cooldowns[$0] ?? .distantPast) <= now }
        let preferred = available.filter { healthy.contains($0) }
        let backups = available.filter { !healthy.contains($0) }
        let ordered = preferred + backups
        guard !ordered.isEmpty else { return [] }
        let start = cursor % ordered.count
        cursor = (cursor + 1) % ordered.count
        return Array((ordered[start...] + ordered[..<start]).prefix(limit))
    }

    func markSuccess(_ model: String) { healthy.insert(model); cooldowns[model] = nil }
    func markFailure(_ model: String, cooldown: Bool) { if cooldown { cooldowns[model] = Date().addingTimeInterval(45) }; healthy.remove(model) }
}

private struct GeminiDiscoveredModel {
    let id: String
    let methods: [String]
}

private struct GeminiModelCheckResult {
    let model: String
    let status: String
    let latencyMs: Int
    let checkedAt: String
    let error: String?

    var dictionary: [String: Any] {
        var result: [String: Any] = ["model": model, "status": status, "latencyMs": latencyMs, "checkedAt": checkedAt]
        if let error { result["error"] = error }
        return result
    }
}

private struct GeminiBundle {
    let candidate: GeminiCandidate
    let sources: [[String: Any]]
    let image: [String: Any]?
}

private struct GeminiJobResult {
    let cards: [[String: Any]]
    let outcomes: [[String: Any]]
    let error: String?
}

private final class GeminiClient {
    private let session = URLSession(configuration: .ephemeral)
    private let wikipedia = WikipediaClient()
    private let scheduler = ModelScheduler()

    func reset() async {
        await scheduler.reset()
    }

    private func isoNow() -> String { ISO8601DateFormatter().string(from: Date()) }

    private func requestModel(_ model: String, key: String, prompt: String, schema: [String: Any], timeout: TimeInterval = 45) async throws -> String {
        let endpoint = URL(string: "https://generativelanguage.googleapis.com/v1beta/models/\(model):generateContent")!
        var request = URLRequest(url: endpoint, timeoutInterval: timeout)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(key, forHTTPHeaderField: "x-goog-api-key")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["contents": [["role": "user", "parts": [["text": prompt]]]], "generationConfig": ["temperature": 0.92, "responseMimeType": "application/json", "responseSchema": schema]])
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw NativeError(message: "Gemini returned no HTTP response.") }
        if !(200..<300).contains(http.statusCode) {
            let object = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
            let detail = ((object?["error"] as? [String: Any])?["message"] as? String) ?? "Gemini returned HTTP \(http.statusCode)."
            throw NativeError(message: "Gemini HTTP \(http.statusCode): \(detail)")
        }
        let payload = try JSONDecoder().decode(GeminiTextResponse.self, from: data)
        guard let text = payload.candidates?.first?.content?.parts?.compactMap(\.text).joined(), !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw NativeError(message: "Gemini returned no usable structured answer.") }
        return text.replacingOccurrences(of: "^```json\\s*|^```\\s*|\\s*```$", with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func discoverModels(key: String) async throws -> [GeminiDiscoveredModel] {
        var pageToken = ""
        var found: [GeminiDiscoveredModel] = []
        for _ in 0..<10 {
            var components = URLComponents(string: "https://generativelanguage.googleapis.com/v1beta/models")!
            components.queryItems = [URLQueryItem(name: "pageSize", value: "100")]
            if !pageToken.isEmpty { components.queryItems?.append(URLQueryItem(name: "pageToken", value: pageToken)) }
            var request = URLRequest(url: components.url!, timeoutInterval: 20)
            request.setValue("application/json", forHTTPHeaderField: "Accept")
            request.setValue(key, forHTTPHeaderField: "x-goog-api-key")
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else { throw NativeError(message: "Google model discovery returned no response.") }
            let object = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
            if !(200..<300).contains(http.statusCode) {
                let detail = ((object["error"] as? [String: Any])?["message"] as? String) ?? "Google model discovery returned HTTP \(http.statusCode)."
                throw NativeError(message: "Gemini HTTP \(http.statusCode): \(detail)")
            }
            for item in (object["models"] as? [[String: Any]] ?? []) {
                let rawID = (item["baseModelId"] as? String ?? item["name"] as? String ?? "").replacingOccurrences(of: "^models/", with: "", options: .regularExpression)
                let methods = item["supportedGenerationMethods"] as? [String] ?? []
                if !GeminiModelPolicy.isEligible(id: rawID, methods: methods) { continue }
                found.append(GeminiDiscoveredModel(id: rawID, methods: methods))
            }
            pageToken = object["nextPageToken"] as? String ?? ""
            if pageToken.isEmpty { break }
        }
        let unique = Dictionary(found.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first }).values
        let sorted = GeminiModelPolicy.sort(unique.map(\.id)).compactMap { id in unique.first(where: { $0.id == id }) }
        guard !sorted.isEmpty else { throw NativeError(message: "Google returned no eligible Gemini text models for this key.") }
        await scheduler.update(sorted.map(\.id))
        return sorted
    }

    private func ensureModels(key: String) async throws {
        if !(await scheduler.hasModels()) { _ = try await discoverModels(key: key) }
    }

    private func structured(key: String, prompt: String, schema: [String: Any], stage: String, timeout: TimeInterval = 45) async throws -> (text: String, model: String, outcomes: [[String: Any]]) {
        try await ensureModels(key: key)
        let candidates = await scheduler.nextModels(limit: 3)
        guard !candidates.isEmpty else { throw NativeError(message: "Every eligible Gemini model is cooling down. Try again shortly.") }
        var outcomes: [[String: Any]] = []
        var lastError: Error?
        for model in candidates {
            let started = Date()
            do {
                let text = try await requestModel(model, key: key, prompt: prompt, schema: schema, timeout: timeout)
                guard let object = try? JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any], object.keys.isEmpty == false else { throw NativeError(message: "Gemini returned malformed structured output.") }
                let latency = Int(Date().timeIntervalSince(started) * 1000)
                outcomes.append(["model": model, "stage": stage, "status": "success", "latencyMs": latency])
                await scheduler.markSuccess(model)
                return (text, model, outcomes)
            } catch {
                let message = (error as? NativeError)?.message ?? "Gemini request failed."
                let latency = Int(Date().timeIntervalSince(started) * 1000)
                outcomes.append(["model": model, "stage": stage, "status": message.contains("429") || message.contains("503") ? "cooldown" : "failed", "latencyMs": latency, "error": message])
                await scheduler.markFailure(model, cooldown: message.contains("429") || message.contains("503"))
                lastError = error
                if message.contains("401") || message.contains("403") { break }
            }
        }
        throw lastError ?? NativeError(message: "Gemini did not return a usable result.")
    }

    private func checkModel(key: String, model: String) async -> GeminiModelCheckResult {
        let started = Date()
        do {
            let text = try await requestModel(model, key: key, prompt: "Return exactly the JSON object {\"ok\":true} and nothing else.", schema: ["type": "OBJECT", "properties": ["ok": ["type": "BOOLEAN"]], "required": ["ok"]], timeout: 20)
            let object = try JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any]
            guard object?["ok"] as? Bool == true else { throw NativeError(message: "The model returned invalid structured test output.") }
            await scheduler.markSuccess(model)
            return GeminiModelCheckResult(model: model, status: "working", latencyMs: Int(Date().timeIntervalSince(started) * 1000), checkedAt: isoNow(), error: nil)
        } catch {
            let message = (error as? NativeError)?.message ?? "Model check failed."
            await scheduler.markFailure(model, cooldown: message.contains("429") || message.contains("503"))
            return GeminiModelCheckResult(model: model, status: message.contains("429") || message.contains("503") ? "cooldown" : "failed", latencyMs: Int(Date().timeIntervalSince(started) * 1000), checkedAt: isoNow(), error: message)
        }
    }

    func test(key: String) async -> [String: Any] {
        guard !key.isEmpty else { return ["status": "not-configured", "models": []] }
        do {
            let discovered = try await discoverModels(key: key)
            var checks: [GeminiModelCheckResult] = []
            var offset = 0
            while offset < discovered.count {
                let chunk = Array(discovered[offset..<min(offset + 3, discovered.count)])
                let results = await withTaskGroup(of: GeminiModelCheckResult.self, returning: [GeminiModelCheckResult].self) { group in
                    for model in chunk { group.addTask { await self.checkModel(key: key, model: model.id) } }
                    var next: [GeminiModelCheckResult] = []
                    for await result in group { next.append(result) }
                    return next
                }
                checks.append(contentsOf: results)
                offset += chunk.count
            }
            let dictionaries = checks.map(\.dictionary)
            let working = checks.contains { $0.status == "working" }
            let invalid = checks.first?.error?.contains("401") == true || checks.first?.error?.contains("403") == true
            return ["status": working ? "connected" : invalid ? "invalid" : checks.contains(where: { $0.status == "cooldown" }) ? "rate-limited" : "unavailable", "message": working ? "Gemini connection verified." : "No eligible model passed the structured-output check.", "models": dictionaries, "eligibleModelCount": discovered.count]
        } catch let error as NativeError {
            let invalid = error.message.contains("401") || error.message.contains("403") || error.message.lowercased().contains("api key")
            return ["status": invalid ? "invalid" : "unavailable", "message": invalid ? "Gemini rejected this API key. Check it in Google AI Studio and paste it again." : error.message, "models": []]
        } catch { return ["status": "unavailable", "message": "Gemini could not verify this key.", "models": []] }
    }

    private func candidateSchema() -> [String: Any] { ["type": "OBJECT", "properties": ["facts": ["type": "ARRAY", "items": ["type": "OBJECT", "properties": ["title": ["type": "STRING"], "hook": ["type": "STRING"], "fact": ["type": "STRING"], "topicPath": ["type": "ARRAY", "items": ["type": "STRING"]], "wikipediaSearchTitles": ["type": "ARRAY", "items": ["type": "STRING"]], "difficulty": ["type": "INTEGER"]], "required": ["title", "hook", "topicPath", "wikipediaSearchTitles", "difficulty"]]]], "required": ["facts"]] }

    private func groundedSchema() -> [String: Any] { ["type": "OBJECT", "properties": ["facts": ["type": "ARRAY", "items": ["type": "OBJECT", "properties": ["candidateIndex": ["type": "INTEGER"], "title": ["type": "STRING"], "hook": ["type": "STRING"], "body": ["type": "STRING"], "sourceIndexes": ["type": "ARRAY", "items": ["type": "INTEGER"]], "difficulty": ["type": "INTEGER"]], "required": ["candidateIndex", "title", "hook", "body", "sourceIndexes", "difficulty"]]]], "required": ["facts"]] }

    private func generateJob(key: String, topics: [[String: Any]], settings: [String: Any], avoid: [String], jobIndex: Int) async throws -> GeminiJobResult {
        let topicText = topics.map { "\(($0["path"] as? [String] ?? []).joined(separator: " / ")) (relative weight \($0["weight"] ?? 10))" }.joined(separator: "\n")
        let prompt = """
        Create exactly 5 genuinely obscure, accurate, understandable facts for Learned Media. Do not use common knowledge, famous trivia, textbook definitions, or the first obvious examples. Randomize the order for job \(jobIndex). Preserve complete topic paths. Each candidate needs title, hook (4 to 12 words with no punctuation), topicPath, one to three exact English Wikipedia article titles, and difficulty 1 to 10, where 10 is most obscure. Avoid these titles: \(avoid.suffix(12).joined(separator: " | "))
        Topics and relative weights:
        \(topicText)
        Target difficulty: \(settings["obscurity"] ?? 10)/10.
        Return structured JSON only with a facts array.
        """
        let candidateResult = try await structured(key: key, prompt: prompt, schema: candidateSchema(), stage: "candidate")
        let envelope = try JSONDecoder().decode(GeminiCandidateEnvelope.self, from: Data(candidateResult.text.utf8))
        let candidates = (envelope.facts ?? []).prefix(5).filter { ($0.title?.isEmpty == false) && ($0.topicPath?.isEmpty == false) }
        guard !candidates.isEmpty else { throw NativeError(message: "Gemini returned no complete fact candidates.") }
        let bundles = await withTaskGroup(of: GeminiBundle?.self, returning: [GeminiBundle].self) { group in
            for candidate in candidates {
                group.addTask {
                    let title = candidate.title!.trimmingCharacters(in: .whitespacesAndNewlines)
                    let grounding = await self.wikipedia.resolve(title: title, searchTitles: candidate.wikipediaSearchTitles ?? [])
                    return grounding.sources.isEmpty ? nil : GeminiBundle(candidate: candidate, sources: grounding.sources, image: grounding.image)
                }
            }
            var result: [GeminiBundle] = []
            for await bundle in group { if let bundle { result.append(bundle) } }
            return result
        }
        guard !bundles.isEmpty else { throw NativeError(message: "Wikipedia did not return supporting articles for this job.") }
        let evidence: [[String: Any]] = bundles.enumerated().map { index, bundle in ["candidateIndex": index, "candidateTitle": bundle.candidate.title ?? "", "candidateTopicPath": bundle.candidate.topicPath ?? [], "sources": bundle.sources.enumerated().map { sourceIndex, source in ["index": sourceIndex, "title": source["title"] ?? "Wikipedia", "url": source["url"] ?? "", "extract": source["extract"] ?? ""] }] }
        let evidenceJSON = (try? JSONSerialization.data(withJSONObject: evidence)).flatMap { String(data: $0, encoding: .utf8) } ?? "[]"
        let groundingPrompt = "Turn these candidates into final cards using only their matching Wikipedia evidence. Every claim in body must be supported. Use one to three sourceIndexes, write a 4 to 12 word hook with no punctuation, and reject incomplete cards. Evidence:\n\(evidenceJSON)\nReturn structured JSON only with facts containing candidateIndex, title, hook, body, sourceIndexes, and difficulty."
        let groundedResult = try await structured(key: key, prompt: groundingPrompt, schema: groundedSchema(), stage: "grounding")
        let grounded = try JSONDecoder().decode(GeminiGroundedEnvelope.self, from: Data(groundedResult.text.utf8))
        var cards: [[String: Any]] = []
        for (index, fact) in (grounded.facts ?? []).prefix(5).enumerated() {
            guard let factTitle = fact.title?.trimmingCharacters(in: .whitespacesAndNewlines), !factTitle.isEmpty, let body = fact.body?.trimmingCharacters(in: .whitespacesAndNewlines), !body.isEmpty, let rawHook = fact.hook?.trimmingCharacters(in: .whitespacesAndNewlines), !rawHook.isEmpty else { continue }
            let bundleIndex = fact.candidateIndex ?? index
            guard bundleIndex >= 0 && bundleIndex < bundles.count else { continue }
            let bundle = bundles[bundleIndex]
            let indexes = Array(Set((fact.sourceIndexes ?? []).filter { $0 >= 0 && $0 < bundle.sources.count })).prefix(3)
            let sources = (indexes.isEmpty ? Array(bundle.sources.prefix(1)) : indexes.map { bundle.sources[$0] })
            guard !sources.isEmpty else { continue }
            let hook = rawHook.replacingOccurrences(of: "[.!?]+", with: "", options: .regularExpression).split(whereSeparator: { $0.isWhitespace }).prefix(12).joined(separator: " ")
            let generatedAt = isoNow()
            var card: [String: Any] = ["id": "gemini-\(UUID().uuidString)", "title": factTitle, "hook": hook, "body": body, "topicPath": bundle.candidate.topicPath ?? [], "sources": sources, "difficulty": max(1, min(10, fact.difficulty ?? bundle.candidate.difficulty ?? 10)), "accent": ["blue", "lilac", "mint", "sand", "coral"][index % 5], "createdAt": generatedAt, "provenance": ["provider": "gemini", "model": groundedResult.model, "generatedAt": generatedAt]]
            if let image = bundle.image, (image["url"] as? String)?.isEmpty == false { card["image"] = image }
            cards.append(card)
        }
        guard !cards.isEmpty else { throw NativeError(message: "Gemini returned no complete cards grounded in Wikipedia.") }
        return GeminiJobResult(cards: cards, outcomes: candidateResult.outcomes + groundedResult.outcomes, error: nil)
    }

    func generate(key: String, topics: [[String: Any]], settings: [String: Any], avoid: [String]) async throws -> [String: Any] {
        guard !key.isEmpty else { throw NativeError(message: "Paste your Gemini API key in Settings to generate a fresh batch.") }
        let jobs: [GeminiJobResult] = try await withThrowingTaskGroup(of: [GeminiJobResult].self, returning: [GeminiJobResult].self) { group in
            group.addTask {
                await withTaskGroup(of: GeminiJobResult.self, returning: [GeminiJobResult].self) { jobGroup in
                    for index in 0..<2 {
                        jobGroup.addTask {
                            do { return try await self.generateJob(key: key, topics: topics, settings: settings, avoid: avoid, jobIndex: index) }
                            catch { return GeminiJobResult(cards: [], outcomes: [], error: (error as? NativeError)?.message ?? "Gemini job failed.") }
                        }
                    }
                    var result: [GeminiJobResult] = []
                    for await job in jobGroup { result.append(job) }
                    return result
                }
            }
            group.addTask {
                try await Task.sleep(nanoseconds: 180_000_000_000)
                throw NativeError(message: "The three-minute batch deadline was reached. Retry the batch when you are ready.")
            }
            defer { group.cancelAll() }
            return try await group.next() ?? []
        }
        let cards = jobs.flatMap(\.cards).reduce(into: [[String: Any]]()) { result, card in
            let title = card["title"] as? String ?? ""
            if !result.contains(where: { ($0["title"] as? String)?.caseInsensitiveCompare(title) == .orderedSame }) { result.append(card) }
        }.prefix(10)
        let outcomes = jobs.flatMap(\.outcomes)
        let failed = jobs.filter { $0.cards.isEmpty }.count
        guard !cards.isEmpty else { throw NativeError(message: jobs.compactMap(\.error).first ?? "Gemini could not complete a Wikipedia-grounded batch.") }
        return ["cards": Array(cards), "modelOutcomes": outcomes, "partial": failed > 0 || cards.count < 10, "failedJobs": failed, "retryable": failed > 0 || cards.count < 10, "retryGuidance": failed > 0 || cards.count < 10 ? "Some work failed. Retry to fill the remaining cards." : ""]
    }

    func learn(key: String, action: String, card: [String: Any], question: String?, detailed: Bool, history: [[String: Any]]) async throws -> [String: Any] {
        guard !key.isEmpty else { throw NativeError(message: "Paste your Gemini API key in Settings before using this feature.") }
        let sourceTitles = (card["sources"] as? [[String: Any]] ?? []).prefix(3).compactMap { $0["title"] as? String }
        var sourceArray = await wikipedia.resolve(title: card["title"] as? String ?? "Wikipedia", searchTitles: sourceTitles).sources
        if action == "question", let question, !question.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let additional = await wikipedia.resolve(title: question, searchTitles: []).sources
            for source in additional where sourceArray.count < 3 { if !sourceArray.contains(where: { ($0["url"] as? String) == (source["url"] as? String) }) { sourceArray.append(source) } }
        }
        guard !sourceArray.isEmpty else { throw NativeError(message: "Wikipedia did not return the cited pages for this fact.") }
        let context = sourceArray.prefix(3).enumerated().map { index, source in "\(index). \((source["title"] as? String) ?? "Wikipedia")\nURL: \((source["url"] as? String) ?? "")\nExcerpt: \((source["extract"] as? String) ?? "No extract returned")" }.joined(separator: "\n\n")
        let previous = history.suffix(6).map { "\($0["role"] ?? "user"): \($0["content"] ?? "")" }.joined(separator: "\n")
        let request = action == "learn" ? "Write one 100 to 160 word paragraph that explains the fact in more depth." : "Answer this question: \(question ?? "")"
        let length = detailed ? "Use approximately 150 to 250 words and include helpful context." : "Use 2 to 4 sentences."
        let prompt = "Answer from cited English Wikipedia material. Fact title: \(card["title"] ?? "")\nFact description: \(card["body"] ?? "")\nWikipedia evidence:\n\(context)\nPrevious conversation:\n\(previous)\n\(request) \(length)\nIf the cited material cannot answer a question, say so clearly. Do not invent details. Return JSON with answer and citationIndexes."
        let result = try await structured(key: key, prompt: prompt, schema: ["type": "OBJECT", "properties": ["answer": ["type": "STRING"], "citationIndexes": ["type": "ARRAY", "items": ["type": "INTEGER"]]], "required": ["answer", "citationIndexes"]], stage: "learning")
        let envelope = try JSONDecoder().decode(GeminiAnswerEnvelope.self, from: Data(result.text.utf8))
        guard let answer = envelope.answer?.trimmingCharacters(in: .whitespacesAndNewlines), !answer.isEmpty else { throw NativeError(message: "Gemini returned an empty explanation.") }
        let citations = (envelope.citationIndexes ?? []).filter { $0 >= 0 && $0 < sourceArray.count }.prefix(3).map { sourceArray[$0] }
        return ["answer": answer, "citations": Array(citations.isEmpty ? Array(sourceArray.prefix(1)) : citations), "modelOutcomes": result.outcomes]
    }
}

private final class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler, ASWebAuthenticationPresentationContextProviding {
    private var window: NSWindow!
    private var webView: WKWebView!
    private let gemini = GeminiClient()
    private let keychain = KeychainStore()
    private var geminiKey = ""
    private var authSession: ASWebAuthenticationSession?
    private var authRequestID = ""
    private var authVerifier = ""
    private var authState = ""
    private var config: [String: Any] = [:]
    private var activeTasks: [String: Task<Void, Never>] = [:]

    func applicationDidFinishLaunching(_ notification: Notification) {
        if let configURL = Bundle.main.url(forResource: "Config", withExtension: "plist"),
           let values = NSDictionary(contentsOf: configURL) as? [String: Any] {
            config = values["LearnedMediaConfig"] as? [String: Any] ?? [:]
        }
        let webConfiguration = WKWebViewConfiguration()
        let controller = WKUserContentController()
        controller.add(self, name: "native")
        webConfiguration.userContentController = controller
        webConfiguration.preferences.setValue(true, forKey: "developerExtrasEnabled")
        webView = WKWebView(frame: .zero, configuration: webConfiguration)
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1280, height: 860), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "Learned Media"
        window.minSize = NSSize(width: 920, height: 640)
        window.contentView = webView
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
        if let index = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "frontend") {
            webView.loadFileURL(index, allowingReadAccessTo: index.deletingLastPathComponent())
        }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor { window }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let id = body["id"] as? String, let action = body["action"] as? String else { return }
        let payload = body["payload"] as? [String: Any] ?? [:]
        switch action {
        case "loadState":
            respond(id: id, result: loadState())
        case "saveState":
            do { try saveState(payload["state"]); respond(id: id, result: true) }
            catch { respond(id: id, error: "Learning data could not be saved.") }
        case "setGeminiKey":
            cancelActiveTasks()
            geminiKey = payload["key"] as? String ?? ""
            Task { await gemini.reset() }
            respond(id: id, result: true)
        case "testGemini":
            let task = Task { [weak self] in
                guard let self else { return }
                respond(id: id, result: await gemini.test(key: payload["key"] as? String ?? geminiKey))
                activeTasks[id] = nil
            }
            activeTasks[id] = task
        case "generate":
            let topics = payload["topics"] as? [[String: Any]] ?? []
            let settings = payload["settings"] as? [String: Any] ?? [:]
            let avoid = payload["avoid"] as? [String] ?? []
            let task = Task { [weak self] in
                guard let self else { return }
                do { respond(id: id, result: try await gemini.generate(key: geminiKey, topics: topics, settings: settings, avoid: avoid)) }
                catch { respond(id: id, error: userMessage(error)) }
                activeTasks[id] = nil
            }
            activeTasks[id] = task
        case "learn":
            let card = payload["card"] as? [String: Any] ?? [:]
            let actionName = payload["action"] as? String ?? "learn"
            let question = payload["question"] as? String
            let detailed = payload["detailed"] as? Bool ?? false
            let history = payload["history"] as? [[String: Any]] ?? []
            let task = Task { [weak self] in
                guard let self else { return }
                do { respond(id: id, result: try await gemini.learn(key: geminiKey, action: actionName, card: card, question: question, detailed: detailed, history: history)) }
                catch { respond(id: id, error: userMessage(error)) }
                activeTasks[id] = nil
            }
            activeTasks[id] = task
        case "cancelAll":
            cancelActiveTasks()
            respond(id: id, result: true)
        case "openURL":
            if let raw = payload["url"] as? String, let url = URL(string: raw), allowedExternal(url) { NSWorkspace.shared.open(url) }
            respond(id: id, result: true)
        case "signIn":
            signIn(id: id)
        case "signOut":
            authSession?.cancel()
            authSession = nil
            keychain.deleteSession()
            respond(id: id, result: true)
        default:
            respond(id: id, error: "That application action is not available.")
        }
    }

    private func allowedExternal(_ url: URL) -> Bool {
        guard url.scheme == "https" else { return false }
        let host = url.host ?? ""
        return host == "aistudio.google.com" || host.hasSuffix(".wikipedia.org") || host.hasSuffix(".wikimedia.org") || host.hasSuffix(".supabase.co")
    }

    private func userMessage(_ error: Error) -> String {
        if let error = error as? NativeError { return error.message }
        return "The request could not be completed. Check your key and try again."
    }

    private func cancelActiveTasks() {
        activeTasks.values.forEach { $0.cancel() }
        activeTasks.removeAll()
    }

    private func applicationDataURL() throws -> URL {
        let base = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        let folder = base.appendingPathComponent("Learned Media", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder.appendingPathComponent("learning-state.json")
    }

    private func loadState() -> Any {
        guard let url = try? applicationDataURL(),
              let data = try? Data(contentsOf: url),
              let object = try? JSONSerialization.jsonObject(with: data) else { return NSNull() }
        return object
    }

    private func saveState(_ value: Any?) throws {
        guard let value, !(value is NSNull) else { return }
        let data = try JSONSerialization.data(withJSONObject: value, options: [.prettyPrinted, .sortedKeys])
        try data.write(to: try applicationDataURL(), options: .atomic)
    }

    private func signIn(id: String) {
        guard let rawURL = config["SupabaseURL"] as? String,
              let supabaseURL = URL(string: rawURL),
              let anonKey = config["SupabasePublishableKey"] as? String,
              !anonKey.isEmpty else {
            respond(id: id, error: "Google sign-in is not configured yet. Enable Google in the Learned Media Supabase Auth providers.")
            return
        }
        authRequestID = id
        authVerifier = randomString(length: 64)
        authState = randomString(length: 32)
        let digest = SHA256.hash(data: Data(authVerifier.utf8))
        var components = URLComponents(url: supabaseURL.appendingPathComponent("auth/v1/authorize"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "provider", value: "google"),
            URLQueryItem(name: "redirect_to", value: "learnedmedia://auth/callback"),
            URLQueryItem(name: "code_challenge", value: base64URL(Data(digest))),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "state", value: authState)
        ]
        guard let url = components.url else {
            respond(id: id, error: "Google sign-in could not create its secure callback.")
            return
        }
        authSession = ASWebAuthenticationSession(url: url, callbackURLScheme: "learnedmedia") { [weak self] callback, error in
            guard let self else { return }
            if let error {
                self.respond(id: id, error: error.localizedDescription)
                return
            }
            guard let callback, let callbackComponents = URLComponents(url: callback, resolvingAgainstBaseURL: false),
                  callbackComponents.queryItems?.first(where: { $0.name == "state" })?.value == self.authState,
                  let code = callbackComponents.queryItems?.first(where: { $0.name == "code" })?.value else {
                self.respond(id: id, error: "Google sign-in returned an invalid callback.")
                return
            }
            Task {
                do {
                    let session = try await self.exchangeCode(code, verifier: self.authVerifier, supabaseURL: supabaseURL, anonKey: anonKey)
                    try self.keychain.saveSession(session.sessionData)
                    self.respond(id: id, result: ["account": session.account])
                } catch {
                    self.respond(id: id, error: self.userMessage(error))
                }
                self.authSession = nil
            }
        }
        authSession?.presentationContextProvider = self
        authSession?.prefersEphemeralWebBrowserSession = false
        if authSession?.start() != true {
            respond(id: id, error: "Google sign-in could not open the system browser.")
        }
    }

    private func exchangeCode(_ code: String, verifier: String, supabaseURL: URL, anonKey: String) async throws -> (sessionData: Data, account: [String: Any]) {
        var components = URLComponents(url: supabaseURL.appendingPathComponent("auth/v1/token"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "grant_type", value: "pkce")]
        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["auth_code": code, "code_verifier": verifier])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw NativeError(message: "Google sign-in was not accepted. Enable the Google provider and add the Learned Media callback URL.")
        }
        let payload = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
        guard let accessToken = payload["access_token"] as? String, !accessToken.isEmpty else {
            throw NativeError(message: "Google sign-in did not return a session.")
        }
        var userRequest = URLRequest(url: supabaseURL.appendingPathComponent("auth/v1/user"))
        userRequest.setValue(anonKey, forHTTPHeaderField: "apikey")
        userRequest.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        let (userData, _) = try await URLSession.shared.data(for: userRequest)
        let user = try JSONSerialization.jsonObject(with: userData) as? [String: Any] ?? [:]
        let metadata = user["user_metadata"] as? [String: Any] ?? [:]
        let account: [String: Any] = [
            "name": metadata["full_name"] as? String ?? metadata["name"] as? String ?? user["email"] as? String ?? "Google learner",
            "email": user["email"] as? String ?? ""
        ]
        return (data, account)
    }

    private func randomString(length: Int) -> String {
        let alphabet = Array("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
        return String((0..<length).compactMap { _ in alphabet.randomElement() })
    }

    private func base64URL(_ data: Data) -> String {
        data.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }

    private func respond(id: String, result: Any) {
        DispatchQueue.main.async {
            guard let data = try? JSONSerialization.data(withJSONObject: ["id": id, "ok": true, "result": result]), let json = String(data: data, encoding: .utf8) else { return }
            self.webView.evaluateJavaScript("window.__nativeResolve(\(json));")
        }
    }

    private func respond(id: String, error: String) {
        DispatchQueue.main.async {
            guard let data = try? JSONSerialization.data(withJSONObject: ["id": id, "ok": false, "error": error]), let json = String(data: data, encoding: .utf8) else { return }
            self.webView.evaluateJavaScript("window.__nativeResolve(\(json));")
        }
    }
}

let application = NSApplication.shared
private let delegate = AppDelegate()
application.delegate = delegate
application.run()
