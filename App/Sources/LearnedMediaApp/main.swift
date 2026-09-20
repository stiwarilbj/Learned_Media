import AppKit
import AuthenticationServices
import Cocoa
import CryptoKit
import Foundation
import WebKit
import LearnedMediaCore

private struct NativeError: Error {
    let message: String
    let retryable: Bool

    init(message: String, retryable: Bool = true) {
        self.message = message
        self.retryable = retryable
    }
}

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
    let modelVersion: String?
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

private actor WikipediaRequestLimiter {
    private var permits = 4
    private var waiters: [CheckedContinuation<Void, Never>] = []

    func acquire() async {
        if permits > 0 {
            permits -= 1
            return
        }
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            waiters.append(continuation)
        }
    }

    func release() {
        if let waiter = waiters.first {
            waiters.removeFirst()
            waiter.resume()
        } else {
            permits += 1
        }
    }
}

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

private final class LocalWorkspaceStore {
    private let fileManager = FileManager.default

    private func urls() throws -> (primary: URL, backup: URL) {
        let base = try fileManager.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        let folder = base.appendingPathComponent("Learned Media", isDirectory: true)
        try fileManager.createDirectory(at: folder, withIntermediateDirectories: true)
        let primary = folder.appendingPathComponent("learning-state.json")
        return (primary, primary.appendingPathExtension("backup"))
    }

    private func readObject(at url: URL) -> Any? {
        guard let data = try? Data(contentsOf: url),
              let object = try? JSONSerialization.jsonObject(with: data) else { return nil }
        return object
    }

    func load() -> Any {
        guard let locations = try? urls() else { return NSNull() }
        return readObject(at: locations.primary) ?? readObject(at: locations.backup) ?? NSNull()
    }

    func save(_ value: Any?) throws {
        guard let value, !(value is NSNull) else { return }
        guard JSONSerialization.isValidJSONObject(value) else { throw NativeError(message: "The local workspace contained unsupported data.", retryable: false) }
        let data = try JSONSerialization.data(withJSONObject: value, options: [.prettyPrinted, .sortedKeys])
        let locations = try urls()
        if fileManager.fileExists(atPath: locations.primary.path) {
            try? fileManager.removeItem(at: locations.backup)
            try? fileManager.copyItem(at: locations.primary, to: locations.backup)
        }
        try data.write(to: locations.primary, options: [.atomic])
    }
}

private final class WikipediaClient {
    private let session = URLSession(configuration: .ephemeral)
    private let limiter = WikipediaRequestLimiter()
    private func request<T: Decodable>(_ url: URL) async throws -> T {
        var request = URLRequest(url: url, timeoutInterval: 20)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("LearnedMedia/1.0 (knowledge-feed)", forHTTPHeaderField: "User-Agent")
        await limiter.acquire()
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            await limiter.release()
            throw error
        }
        await limiter.release()
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
    private var resolvedByRequested: [String: String] = [:]
    private var inFlight = Set<String>()
    private var inFlightResolved = Set<String>()
    private var cursor = 0
    private var outageCooldownUntil: Date?

    func update(_ next: [String]) {
        models = GeminiModelPolicy.sort(next)
        healthy = healthy.intersection(Set(models))
        cooldowns = cooldowns.filter { models.contains($0.key) }
        resolvedByRequested = resolvedByRequested.filter { models.contains($0.key) }
        cursor = cursor % max(models.count, 1)
    }

    func hasModels() -> Bool { !models.isEmpty }
    func hasHealthyModels() -> Bool { !availableModels().isEmpty }
    func reset() {
        models = []
        healthy.removeAll()
        cooldowns.removeAll()
        resolvedByRequested.removeAll()
        inFlight.removeAll()
        inFlightResolved.removeAll()
        outageCooldownUntil = nil
        cursor = 0
    }

    func reserve(tried: Set<String>) -> String? {
        guard inFlight.count < 5 else { return nil }
        let available = availableModels()
        guard !available.isEmpty else { return nil }
        for offset in 0..<models.count {
            let index = (cursor + offset) % models.count
            let model = models[index]
            guard available.contains(model), !tried.contains(model), !inFlight.contains(model) else { continue }
            if let resolved = resolvedByRequested[model], inFlightResolved.contains(resolved) { continue }
            inFlight.insert(model)
            if let resolved = resolvedByRequested[model] { inFlightResolved.insert(resolved) }
            cursor = (index + 1) % models.count
            return model
        }
        return nil
    }

    func release(_ model: String) {
        inFlight.remove(model)
        if let resolved = resolvedByRequested[model] { inFlightResolved.remove(resolved) }
    }

    func markSuccess(_ model: String, resolvedModel: String?) {
        healthy.insert(model)
        cooldowns[model] = nil
        if let resolvedModel, !resolvedModel.isEmpty { resolvedByRequested[model] = resolvedModel }
        release(model)
        outageCooldownUntil = nil
    }

    func markFailure(_ model: String, retryable: Bool) {
        if retryable {
            healthy.insert(model)
            cooldowns[model] = Date().addingTimeInterval(45)
        } else {
            healthy.remove(model)
            cooldowns[model] = nil
        }
        release(model)
    }

    func availableCount(excluding tried: Set<String>) -> Int {
        availableModels().filter { !tried.contains($0) && !inFlight.contains($0) }.count
    }

    func healthyCount() -> Int {
        var resolved = Set<String>()
        return healthy.reduce(into: 0) { count, model in
            if let version = resolvedByRequested[model] {
                if resolved.insert(version).inserted { count += 1 }
            } else {
                count += 1
            }
        }
    }

    func inFlightCount() -> Int { inFlight.count }

    func beginOutageCooldown() -> Date {
        let until = Date().addingTimeInterval(60)
        outageCooldownUntil = until
        return until
    }

    func nextRetryDate() -> Date? {
        cooldowns.values.filter { $0 > Date() }.min()
    }

    private func availableModels() -> [String] {
        let now = Date()
        var seenResolved = Set<String>()
        return models.filter { model in
            guard healthy.contains(model), (cooldowns[model] ?? .distantPast) <= now else { return false }
            if let resolved = resolvedByRequested[model] {
                guard !seenResolved.contains(resolved) else { return false }
                seenResolved.insert(resolved)
            }
            return true
        }
    }
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
    let resolvedModel: String?

    var dictionary: [String: Any] {
        var result: [String: Any] = ["model": model, "status": status, "latencyMs": latencyMs, "checkedAt": checkedAt]
        if let error { result["error"] = error }
        if let resolvedModel, !resolvedModel.isEmpty { result["resolvedModel"] = resolvedModel }
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

    private func requestModel(_ model: String, key: String, prompt: String, schema: [String: Any], timeout: TimeInterval = 45) async throws -> (text: String, resolvedModel: String?) {
        let endpoint = URL(string: "https://generativelanguage.googleapis.com/v1beta/models/\(model):generateContent")!
        var request = URLRequest(url: endpoint, timeoutInterval: timeout)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(key, forHTTPHeaderField: "x-goog-api-key")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["contents": [["role": "user", "parts": [["text": prompt]]]], "generationConfig": ["temperature": 0.92, "responseMimeType": "application/json", "responseSchema": schema]])
        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: request)
        } catch is CancellationError {
            throw NativeError(message: "Gemini request canceled.", retryable: false)
        } catch {
            throw NativeError(message: "Gemini request timed out or could not reach Google.", retryable: true)
        }
        guard let http = response as? HTTPURLResponse else { throw NativeError(message: "Gemini returned no HTTP response.") }
        if !(200..<300).contains(http.statusCode) {
            let object = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
            let detail = ((object?["error"] as? [String: Any])?["message"] as? String) ?? "Gemini returned HTTP \(http.statusCode)."
            let retryable = [408, 409, 429].contains(http.statusCode) || http.statusCode >= 500
            throw NativeError(message: "Gemini HTTP \(http.statusCode): \(detail)", retryable: retryable)
        }
        let payload: GeminiTextResponse
        do {
            payload = try JSONDecoder().decode(GeminiTextResponse.self, from: data)
        } catch {
            throw NativeError(message: "Gemini returned malformed JSON.", retryable: true)
        }
        guard let text = payload.candidates?.first?.content?.parts?.compactMap(\.text).joined(), !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw NativeError(message: "Gemini returned no usable structured answer.", retryable: true) }
        return (text.replacingOccurrences(of: "^```json\\s*|^```\\s*|\\s*```$", with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines), payload.modelVersion)
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
                if GeminiModelPolicy.allowedModels.contains(GeminiModelPolicy.normalize(rawID)) {
                    found.append(GeminiDiscoveredModel(id: GeminiModelPolicy.normalize(rawID), methods: methods))
                }
            }
            pageToken = object["nextPageToken"] as? String ?? ""
            if pageToken.isEmpty { break }
        }
        let unique = Dictionary(found.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        // Discovery is informative only: the requested endpoints must still be
        // tested when Google omits a preview or alias from /models.
        let requested = GeminiModelPolicy.allowedModels.map { id in
            unique[id] ?? GeminiDiscoveredModel(id: id, methods: ["generateContent"])
        }
        await scheduler.update(requested.map(\.id))
        return requested
    }

    private func ensureModels(key: String) async throws {
        if !(await scheduler.hasModels()) { _ = try await discoverModels(key: key) }
    }

    private func structured(key: String, prompt: String, schema: [String: Any], stage: String, timeout: TimeInterval = 45) async throws -> (text: String, model: String, resolvedModel: String?, outcomes: [[String: Any]]) {
        try await ensureModels(key: key)
        if !(await scheduler.hasHealthyModels()), let retryDate = await scheduler.nextRetryDate() {
            try await Task.sleep(nanoseconds: UInt64(max(0, retryDate.timeIntervalSinceNow) * 1_000_000_000))
        }
        guard await scheduler.hasHealthyModels() else { throw NativeError(message: "No healthy requested Gemini model is available. Recheck the models or retry after the cooldown.", retryable: true) }
        var outcomes: [[String: Any]] = []
        var tried = Set<String>()
        var pass = 0
        var sawRetryableFailure = false
        var lastError: Error?
        while !Task.isCancelled {
            if let model = await scheduler.reserve(tried: tried) {
                tried.insert(model)
                let started = Date()
                do {
                    let result = try await requestModel(model, key: key, prompt: prompt, schema: schema, timeout: timeout)
                    guard let object = try? JSONSerialization.jsonObject(with: Data(result.text.utf8)) as? [String: Any], object.keys.isEmpty == false else { throw NativeError(message: "Gemini returned malformed structured output.", retryable: true) }
                    let latency = Int(Date().timeIntervalSince(started) * 1000)
                    outcomes.append(["model": model, "resolvedModel": result.resolvedModel ?? model, "stage": stage, "status": "success", "latencyMs": latency])
                    await scheduler.markSuccess(model, resolvedModel: result.resolvedModel)
                    return (result.text, model, result.resolvedModel, outcomes)
                } catch {
                    let nativeError = error as? NativeError
                    let message = nativeError?.message ?? "Gemini request failed."
                    let retryable = nativeError?.retryable ?? true
                    let latency = Int(Date().timeIntervalSince(started) * 1000)
                    outcomes.append(["model": model, "stage": stage, "status": retryable ? "cooldown" : "failed", "latencyMs": latency, "error": message])
                    await scheduler.markFailure(model, retryable: retryable)
                    lastError = error
                    sawRetryableFailure = sawRetryableFailure || retryable
                    continue
                }
            }

            if await scheduler.inFlightCount() > 0 {
                try await Task.sleep(nanoseconds: 40_000_000)
                continue
            }
            if await scheduler.availableCount(excluding: tried) > 0 { continue }
            if let retryDate = await scheduler.nextRetryDate() {
                try await Task.sleep(nanoseconds: UInt64(max(0, retryDate.timeIntervalSinceNow) * 1_000_000_000))
                continue
            }
            if tried.isEmpty {
                throw NativeError(message: "Every healthy requested Gemini model is busy or cooling down.", retryable: true)
            }
            if !sawRetryableFailure {
                throw lastError ?? NativeError(message: "Gemini did not return a usable result.", retryable: false)
            }
            if pass < 1 {
                pass += 1
                tried.removeAll()
                continue
            }
            let until = await scheduler.beginOutageCooldown()
            let seconds = max(0, until.timeIntervalSinceNow)
            try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
            pass = 0
            tried.removeAll()
            sawRetryableFailure = false
        }
        throw NativeError(message: "Gemini request canceled.", retryable: false)
    }

    private func checkModel(key: String, model: String, onCheck: @escaping ([String: Any], Int) -> Void) async -> GeminiModelCheckResult {
        let started = Date()
        do {
            let result = try await requestModel(model, key: key, prompt: "Return exactly the JSON object {\"ok\":true} and nothing else.", schema: ["type": "OBJECT", "properties": ["ok": ["type": "BOOLEAN"]], "required": ["ok"]], timeout: 20)
            let object = try JSONSerialization.jsonObject(with: Data(result.text.utf8)) as? [String: Any]
            guard object?["ok"] as? Bool == true else { throw NativeError(message: "The model returned invalid structured test output.") }
            await scheduler.markSuccess(model, resolvedModel: result.resolvedModel)
            let check = GeminiModelCheckResult(model: model, status: "working", latencyMs: Int(Date().timeIntervalSince(started) * 1000), checkedAt: isoNow(), error: nil, resolvedModel: result.resolvedModel)
            onCheck(check.dictionary, await scheduler.healthyCount())
            return check
        } catch {
            let message = (error as? NativeError)?.message ?? "Model check failed."
            let retryable = (error as? NativeError)?.retryable ?? message.contains("429") || message.contains("503")
            await scheduler.markFailure(model, retryable: retryable)
            let check = GeminiModelCheckResult(model: model, status: retryable ? "cooldown" : "failed", latencyMs: Int(Date().timeIntervalSince(started) * 1000), checkedAt: isoNow(), error: message, resolvedModel: nil)
            onCheck(check.dictionary, await scheduler.healthyCount())
            return check
        }
    }

    func test(key: String, onCheck: @escaping ([String: Any], Int) -> Void) async -> [String: Any] {
        guard !key.isEmpty else { return ["status": "not-configured", "models": []] }
        do {
            await scheduler.reset()
            let discovered = try await discoverModels(key: key)
            var checks: [GeminiModelCheckResult] = []
            var offset = 0
            while offset < discovered.count {
                let chunk = Array(discovered[offset..<min(offset + 5, discovered.count)])
                let results = await withTaskGroup(of: GeminiModelCheckResult.self, returning: [GeminiModelCheckResult].self) { group in
                    for model in chunk { group.addTask { await self.checkModel(key: key, model: model.id, onCheck: onCheck) } }
                    var next: [GeminiModelCheckResult] = []
                    for await result in group { next.append(result) }
                    return next
                }
                checks.append(contentsOf: results)
                offset += chunk.count
            }
            checks.sort { left, right in
                let leftIndex = GeminiModelPolicy.allowedModels.firstIndex(of: left.model) ?? Int.max
                let rightIndex = GeminiModelPolicy.allowedModels.firstIndex(of: right.model) ?? Int.max
                return leftIndex < rightIndex
            }
            let dictionaries = checks.map(\.dictionary)
            let workingResolved = Set(checks.filter { $0.status == "working" }.map { $0.resolvedModel ?? $0.model })
            let invalid = checks.contains { $0.error?.contains("401") == true || $0.error?.contains("403") == true }
            let ready = workingResolved.count >= 5
            return ["status": ready ? "connected" : invalid ? "invalid" : checks.contains(where: { $0.status == "cooldown" }) ? "rate-limited" : "unavailable", "message": ready ? "Gemini connection verified with five allowed models." : "Fewer than five distinct allowed models passed the structured-output check.", "models": dictionaries, "eligibleModelCount": GeminiModelPolicy.allowedModels.count, "requiredWorkingModels": 5]
        } catch let error as NativeError {
            let invalid = error.message.contains("401") || error.message.contains("403") || error.message.lowercased().contains("api key")
            return ["status": invalid ? "invalid" : "unavailable", "message": invalid ? "Gemini rejected this API key. Check it in Google AI Studio and paste it again." : error.message, "models": []]
        } catch { return ["status": "unavailable", "message": "Gemini could not verify this key.", "models": []] }
    }

    private func candidateSchema() -> [String: Any] { ["type": "OBJECT", "properties": ["facts": ["type": "ARRAY", "items": ["type": "OBJECT", "properties": ["title": ["type": "STRING"], "hook": ["type": "STRING"], "fact": ["type": "STRING"], "topicPath": ["type": "ARRAY", "items": ["type": "STRING"]], "wikipediaSearchTitles": ["type": "ARRAY", "items": ["type": "STRING"]], "difficulty": ["type": "INTEGER"]], "required": ["title", "hook", "topicPath", "wikipediaSearchTitles", "difficulty"]]]], "required": ["facts"]] }

    private func groundedSchema() -> [String: Any] { ["type": "OBJECT", "properties": ["facts": ["type": "ARRAY", "items": ["type": "OBJECT", "properties": ["candidateIndex": ["type": "INTEGER"], "title": ["type": "STRING"], "hook": ["type": "STRING"], "body": ["type": "STRING"], "sourceIndexes": ["type": "ARRAY", "items": ["type": "INTEGER"]], "difficulty": ["type": "INTEGER"]], "required": ["candidateIndex", "title", "hook", "body", "sourceIndexes", "difficulty"]]]], "required": ["facts"]] }

    private func generateJob(key: String, topics: [[String: Any]], settings: [String: Any], avoid: [String], jobIndex: Int, attempt: Int) async throws -> GeminiJobResult {
        let topicText = topics.map { "\(($0["path"] as? [String] ?? []).joined(separator: " / ")) (relative weight \($0["weight"] ?? 10))" }.joined(separator: "\n")
        let prompt = """
        Create exactly one genuinely obscure, accurate, understandable fact for Learned Media. Do not use common knowledge, famous trivia, textbook definitions, or the first obvious examples. Vary the subject from other concurrent jobs. Preserve the complete topic path. Give it a specific but broadly understandable title of about 3 to 9 words. Make the title and hook fresh and different from the avoided titles, without clickbait or vague wording. The candidate needs a title, hook (4 to 12 words with its first word capitalized and no terminal punctuation), topicPath, one to three exact English Wikipedia article titles, and difficulty 1 to 10, where 10 is most obscure. Avoid these titles: \(avoid.suffix(12).joined(separator: " | "))
        Topics and relative weights:
        \(topicText)
        Target difficulty: \(settings["obscurity"] ?? 10)/10.
        Job \(jobIndex), candidate attempt \(attempt). Return structured JSON only with a facts array containing exactly one candidate.
        """
        let candidateResult = try await structured(key: key, prompt: prompt, schema: candidateSchema(), stage: "candidate")
        let envelope = try JSONDecoder().decode(GeminiCandidateEnvelope.self, from: Data(candidateResult.text.utf8))
        guard let candidate = (envelope.facts ?? []).first(where: { ($0.title?.isEmpty == false) && ($0.topicPath?.isEmpty == false) }) else { throw NativeError(message: "Gemini returned no complete fact candidate.", retryable: true) }
        let title = candidate.title!.trimmingCharacters(in: .whitespacesAndNewlines)
        let grounding = await wikipedia.resolve(title: title, searchTitles: candidate.wikipediaSearchTitles ?? [])
        guard !grounding.sources.isEmpty else { throw NativeError(message: "Wikipedia did not return supporting articles for this fact.", retryable: true) }
        let bundle = GeminiBundle(candidate: candidate, sources: grounding.sources, image: grounding.image)
        let evidence: [[String: Any]] = [["candidateIndex": 0, "candidateTitle": bundle.candidate.title ?? "", "candidateTopicPath": bundle.candidate.topicPath ?? [], "sources": bundle.sources.enumerated().map { sourceIndex, source in ["index": sourceIndex, "title": source["title"] ?? "Wikipedia", "url": source["url"] ?? "", "extract": source["extract"] ?? ""] }]]
        let evidenceJSON = (try? JSONSerialization.data(withJSONObject: evidence)).flatMap { String(data: $0, encoding: .utf8) } ?? "[]"
        let groundingPrompt = "Turn this candidate into one final card using only its matching Wikipedia evidence. Every claim in body must be supported. Keep the title specific but broadly understandable and different from recent cards. Use one to three sourceIndexes, write a 4 to 12 word hook with a capitalized first word and no terminal punctuation, and write the body in two or three short sentences using clear eighth-grade English and common words. Difficulty controls how obscure the fact is, not how hard the writing is. Reject incomplete cards. Evidence:\n\(evidenceJSON)\nReturn structured JSON only with a facts array containing exactly one object with candidateIndex, title, hook, body, sourceIndexes, and difficulty."
        let groundedResult = try await structured(key: key, prompt: groundingPrompt, schema: groundedSchema(), stage: "grounding")
        let grounded = try JSONDecoder().decode(GeminiGroundedEnvelope.self, from: Data(groundedResult.text.utf8))
        var cards: [[String: Any]] = []
        guard let fact = grounded.facts?.first,
              let factTitle = fact.title?.trimmingCharacters(in: .whitespacesAndNewlines), !factTitle.isEmpty,
              let body = fact.body?.trimmingCharacters(in: .whitespacesAndNewlines), !body.isEmpty,
              let rawHook = fact.hook?.trimmingCharacters(in: .whitespacesAndNewlines), !rawHook.isEmpty else { throw NativeError(message: "Gemini returned no complete grounded fact.", retryable: true) }
        let indexes = Array(Set((fact.sourceIndexes ?? []).filter { $0 >= 0 && $0 < bundle.sources.count })).prefix(3)
        let sources = (indexes.isEmpty ? Array(bundle.sources.prefix(1)) : indexes.map { bundle.sources[$0] })
        guard !sources.isEmpty else { throw NativeError(message: "The final fact did not cite a verified Wikipedia page.", retryable: true) }
        let cleanedHook = rawHook.replacingOccurrences(of: "[.!?]+", with: "", options: .regularExpression).split(whereSeparator: { $0.isWhitespace }).prefix(12).joined(separator: " ")
        let hook = cleanedHook.prefix(1).uppercased() + cleanedHook.dropFirst()
        let generatedAt = isoNow()
        var card: [String: Any] = ["id": "gemini-\(UUID().uuidString)", "title": factTitle, "hook": hook, "body": body, "topicPath": bundle.candidate.topicPath ?? [], "sources": sources, "difficulty": max(1, min(10, fact.difficulty ?? bundle.candidate.difficulty ?? 10)), "accent": ["blue", "lilac", "mint", "sand", "coral"][jobIndex % 5], "createdAt": generatedAt, "provenance": ["provider": "gemini", "model": groundedResult.resolvedModel ?? groundedResult.model, "generatedAt": generatedAt]]
        if let image = bundle.image, (image["url"] as? String)?.isEmpty == false { card["image"] = image }
        cards.append(card)
        guard !cards.isEmpty else { throw NativeError(message: "Gemini returned no complete cards grounded in Wikipedia.") }
        return GeminiJobResult(cards: cards, outcomes: candidateResult.outcomes + groundedResult.outcomes, error: nil)
    }

    func generate(key: String, topics: [[String: Any]], settings: [String: Any], avoid: [String], requestedCount: Int = 10, onCard: @escaping ([String: Any], Int, Int) -> Void) async throws -> [String: Any] {
        guard !key.isEmpty else { throw NativeError(message: "Paste your Gemini API key in Settings to generate a fresh batch.") }
        let targetCount = max(1, min(10, requestedCount))
        let jobs: [GeminiJobResult] = await withTaskGroup(of: GeminiJobResult.self, returning: [GeminiJobResult].self) { group in
            var nextIndex = 0
            for _ in 0..<min(5, targetCount) {
                let index = nextIndex
                nextIndex += 1
                group.addTask { await self.runSlot(key: key, topics: topics, settings: settings, avoid: avoid, jobIndex: index) }
            }
            var result: [GeminiJobResult] = []
            var completed = 0
            for await job in group {
                result.append(job)
                if let card = job.cards.first {
                    completed += 1
                    onCard(card, completed, targetCount)
                }
                if nextIndex < targetCount {
                    let index = nextIndex
                    nextIndex += 1
                    group.addTask { await self.runSlot(key: key, topics: topics, settings: settings, avoid: avoid, jobIndex: index) }
                }
            }
            return result
        }
        let cards = jobs.flatMap(\.cards).reduce(into: [[String: Any]]()) { result, card in
            let title = card["title"] as? String ?? ""
            if !result.contains(where: { ($0["title"] as? String)?.caseInsensitiveCompare(title) == .orderedSame }) { result.append(card) }
        }.prefix(targetCount)
        let outcomes = jobs.flatMap(\.outcomes)
        let failed = jobs.filter { $0.cards.isEmpty }.count
        guard !cards.isEmpty else { throw NativeError(message: jobs.compactMap(\.error).first ?? "Gemini could not complete a Wikipedia-grounded batch.") }
        return ["cards": Array(cards), "requestedCount": targetCount, "completedCount": cards.count, "modelOutcomes": outcomes, "partial": failed > 0 || cards.count < targetCount, "failedJobs": failed, "retryable": failed > 0 || cards.count < targetCount, "retryGuidance": failed > 0 || cards.count < targetCount ? "Some work failed. Retry to fill the remaining cards." : ""]
    }

    private func runSlot(key: String, topics: [[String: Any]], settings: [String: Any], avoid: [String], jobIndex: Int) async -> GeminiJobResult {
        var lastError = "This fact slot could not be completed."
        for attempt in 0..<3 where !Task.isCancelled {
            do { return try await generateJob(key: key, topics: topics, settings: settings, avoid: avoid, jobIndex: jobIndex, attempt: attempt) }
            catch {
                lastError = (error as? NativeError)?.message ?? "Gemini fact generation failed."
                if let native = error as? NativeError, !native.retryable { break }
            }
        }
        return GeminiJobResult(cards: [], outcomes: [], error: lastError)
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
    private let workspace = LocalWorkspaceStore()
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
        configureMainMenu()
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

    private func configureMainMenu() {
        let mainMenu = NSMenu()
        let appMenuItem = NSMenuItem()
        let appMenu = NSMenu(title: "Learned Media")
        appMenuItem.submenu = appMenu
        appMenu.addItem(withTitle: "Quit Learned Media", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        mainMenu.addItem(appMenuItem)

        let editMenuItem = NSMenuItem()
        let editMenu = NSMenu(title: "Edit")
        editMenuItem.submenu = editMenu
        editMenu.addItem(withTitle: "Undo", action: #selector(UndoManager.undo), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Redo", action: #selector(UndoManager.redo), keyEquivalent: "Z")
        editMenu.addItem(.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        mainMenu.addItem(editMenuItem)
        NSApp.mainMenu = mainMenu
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
                let token = payload["token"] as? Int ?? 0
                let result = await gemini.test(key: payload["key"] as? String ?? geminiKey) { [weak self] check, readyCount in
                    self?.respondEvent(id: id, payload: ["type": "modelCheck", "token": token, "check": check, "readyCount": readyCount, "requiredWorkingModels": 5])
                }
                respond(id: id, result: result)
                activeTasks[id] = nil
            }
            activeTasks[id] = task
        case "generate":
            let topics = payload["topics"] as? [[String: Any]] ?? []
            let settings = payload["settings"] as? [String: Any] ?? [:]
            let avoid = payload["avoid"] as? [String] ?? []
            let requestedCount = payload["requestedCount"] as? Int ?? 10
            let token = payload["token"] as? Int ?? 0
            let task = Task { [weak self] in
                guard let self else { return }
                do {
                    let result = try await gemini.generate(key: geminiKey, topics: topics, settings: settings, avoid: avoid, requestedCount: requestedCount) { [weak self] card, completed, requested in
                        self?.respondEvent(id: id, payload: ["type": "generationCard", "token": token, "card": card, "completed": completed, "requested": requested])
                    }
                    respond(id: id, result: result)
                }
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

    private func loadState() -> Any {
        workspace.load()
    }

    private func saveState(_ value: Any?) throws {
        try workspace.save(value)
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

    private func respondEvent(id: String, payload: [String: Any]) {
        DispatchQueue.main.async {
            guard let data = try? JSONSerialization.data(withJSONObject: payload), let json = String(data: data, encoding: .utf8) else { return }
            self.webView.evaluateJavaScript("window.__nativeEvent(\(json));")
        }
    }
}

let application = NSApplication.shared
private let delegate = AppDelegate()
application.delegate = delegate
application.run()
