import AppKit
import AuthenticationServices
import Cocoa
import CryptoKit
import Foundation
import WebKit

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
        var request = URLRequest(url: url)
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

private final class GeminiClient {
    private let session = URLSession(configuration: .ephemeral)
    private let wikipedia = WikipediaClient()
    private let models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"]

    private func requestModel(_ model: String, key: String, prompt: String, schema: [String: Any]) async throws -> String {
        var components = URLComponents(string: "https://generativelanguage.googleapis.com/v1beta/models/\(model):generateContent")!
        components.queryItems = [URLQueryItem(name: "key", value: key)]
        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "contents": [["role": "user", "parts": [["text": prompt]]]],
            "generationConfig": ["temperature": 0.92, "responseMimeType": "application/json", "responseSchema": schema]
        ])
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw NativeError(message: "Gemini returned HTTP \((response as? HTTPURLResponse)?.statusCode ?? 0).")
        }
        let payload = try JSONDecoder().decode(GeminiTextResponse.self, from: data)
        guard let text = payload.candidates?.first?.content?.parts?.compactMap(\.text).joined(), !text.isEmpty else {
            throw NativeError(message: "Gemini returned no usable answer.")
        }
        return text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func structured(key: String, prompt: String, schema: [String: Any]) async throws -> String {
        var last: Error?
        for model in models {
            do { return try await requestModel(model, key: key, prompt: prompt, schema: schema) }
            catch { last = error }
        }
        throw last ?? NativeError(message: "Gemini did not return a usable result.")
    }

    func test(key: String) async -> [String: Any] {
        guard !key.isEmpty else { return ["status": "not-configured", "message": "Paste your Gemini API key first."] }
        do {
            _ = try await structured(key: key, prompt: "Return a JSON object with ok set to true.", schema: ["type": "OBJECT", "properties": ["ok": ["type": "BOOLEAN"]], "required": ["ok"]])
            return ["status": "connected", "message": "Gemini connection verified."]
        } catch let error as NativeError {
            if error.message.contains("401") || error.message.contains("403") { return ["status": "invalid", "message": "Gemini rejected this API key. Check it in Google AI Studio and paste it again."] }
            if error.message.contains("429") { return ["status": "rate-limited", "message": "Gemini is rate-limited right now. Wait a moment and try again."] }
            return ["status": "unavailable", "message": error.message]
        } catch {
            return ["status": "unavailable", "message": "Gemini could not verify this key."]
        }
    }

    func generate(key: String, topics: [[String: Any]], settings: [String: Any], avoid: [String]) async throws -> [[String: Any]] {
        guard !key.isEmpty else { throw NativeError(message: "Paste your Gemini API key in Settings to generate a fresh batch.") }
        let topicText = topics.map { ($0["path"] as? [String] ?? []).joined(separator: " / ") }.joined(separator: ", ")
        let prompt = """
        Create 10 genuinely obscure but accurate facts for an educational feed.
        Topics: \(topicText.isEmpty ? "surprising knowledge" : topicText)
        Target difficulty: \(settings["obscurity"] ?? 10) out of 10.
        Avoid these titles: \(avoid.joined(separator: " | "))
        Vary the subject and ordering. Do not start with the most obvious examples.
        Return only JSON with a facts array. Each fact has title, hook (4 to 12 words and no periods), fact (2 to 4 normal sentences), topicPath (array), wikipediaSearchTitles (array of 1 to 3 likely English Wikipedia article titles), and difficulty (integer 1 to 10).
        """
        let schema: [String: Any] = [
            "type": "OBJECT",
            "properties": ["facts": ["type": "ARRAY", "items": ["type": "OBJECT", "properties": [
                "title": ["type": "STRING"], "hook": ["type": "STRING"], "fact": ["type": "STRING"],
                "topicPath": ["type": "ARRAY", "items": ["type": "STRING"]],
                "wikipediaSearchTitles": ["type": "ARRAY", "items": ["type": "STRING"]],
                "difficulty": ["type": "INTEGER"]
            ], "required": ["title", "hook", "fact", "topicPath", "wikipediaSearchTitles", "difficulty"]]]],
            "required": ["facts"]
        ]
        let text = try await structured(key: key, prompt: prompt, schema: schema)
        let envelope = try JSONDecoder().decode(GeminiCandidateEnvelope.self, from: Data(text.utf8))
        var bundles: [(candidate: GeminiCandidate, sources: [[String: Any]], image: [String: Any]?)] = []
        for candidate in (envelope.facts ?? []).prefix(10) {
            let title = candidate.title?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "A small fact worth keeping"
            let grounding = await wikipedia.resolve(title: title, searchTitles: candidate.wikipediaSearchTitles ?? [])
            if !grounding.sources.isEmpty {
                bundles.append((candidate: candidate, sources: grounding.sources, image: grounding.image))
            }
        }
        guard !bundles.isEmpty else { throw NativeError(message: "Wikipedia did not return supporting articles for this batch.") }
        let evidence: [[String: Any]] = bundles.enumerated().map { index, bundle in
            [
                "candidateIndex": index,
                "candidateTitle": bundle.candidate.title ?? "",
                "candidateTopicPath": bundle.candidate.topicPath ?? [],
                "sources": bundle.sources.enumerated().map { sourceIndex, source in
                    [
                        "index": sourceIndex,
                        "title": source["title"] ?? "Wikipedia",
                        "url": source["url"] ?? "",
                        "extract": source["extract"] ?? ""
                    ]
                }
            ]
        }
        let evidenceJSON = (try? JSONSerialization.data(withJSONObject: evidence)).flatMap { String(data: $0, encoding: .utf8) } ?? "[]"
        let groundingPrompt = """
        Turn the candidate ideas below into final Learned Media cards using only the supplied English Wikipedia evidence.
        Every sentence in body must be supported by the cited source excerpts.
        Choose one to three sourceIndexes from the matching candidate. Use one when it is enough and add another only when it adds supporting context.
        Write a hook of 4 to 12 words with no periods, exclamation marks, or question marks.
        The body should be two or three clear sentences with normal punctuation.
        Preserve difficulty from 1 to 10, where 10 is the most obscure.
        Do not invent citations or use another candidate's sources.
        Evidence:
        \(evidenceJSON)
        Return only JSON with a facts array containing candidateIndex, title, hook, body, sourceIndexes, and difficulty.
        """
        let groundingSchema: [String: Any] = [
            "type": "OBJECT",
            "properties": ["facts": ["type": "ARRAY", "items": ["type": "OBJECT", "properties": [
                "candidateIndex": ["type": "INTEGER"], "title": ["type": "STRING"], "hook": ["type": "STRING"],
                "body": ["type": "STRING"], "sourceIndexes": ["type": "ARRAY", "items": ["type": "INTEGER"]],
                "difficulty": ["type": "INTEGER"]
            ], "required": ["candidateIndex", "title", "hook", "body", "sourceIndexes", "difficulty"]]]],
            "required": ["facts"]
        ]
        let groundedText = try await structured(key: key, prompt: groundingPrompt, schema: groundingSchema)
        let groundedEnvelope = try JSONDecoder().decode(GeminiGroundedEnvelope.self, from: Data(groundedText.utf8))
        var cards: [[String: Any]] = []
        for (index, fact) in (groundedEnvelope.facts ?? []).prefix(10).enumerated() {
            let bundleIndex = max(0, min(bundles.count - 1, fact.candidateIndex ?? index))
            let bundle = bundles[bundleIndex]
            let chosenIndexes = Array(Set((fact.sourceIndexes ?? []).filter { $0 >= 0 && $0 < bundle.sources.count })).prefix(3)
            let chosenSources = chosenIndexes.isEmpty ? Array(bundle.sources.prefix(1)) : chosenIndexes.map { bundle.sources[$0] }
            guard !chosenSources.isEmpty else { continue }
            let title = fact.title?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false ? fact.title! : (bundle.candidate.title ?? "A small fact worth keeping")
            let hook = (fact.hook ?? bundle.candidate.hook ?? title)
                .replacingOccurrences(of: ".", with: "")
                .replacingOccurrences(of: "!", with: "")
                .replacingOccurrences(of: "?", with: "")
                .split(whereSeparator: { $0.isWhitespace })
                .prefix(12)
                .joined(separator: " ")
            var card: [String: Any] = [
                "id": "gemini-\(UUID().uuidString)", "title": title,
                "hook": hook, "body": fact.body ?? bundle.candidate.fact ?? "The source material contains a useful detail worth exploring.",
                "topicPath": bundle.candidate.topicPath ?? ["Surprise topic"],
                "sources": chosenSources,
                "difficulty": max(1, min(10, fact.difficulty ?? bundle.candidate.difficulty ?? 10)),
                "accent": ["blue", "lilac", "mint", "sand", "coral"][index % 5], "createdAt": "Just now"
            ]
            if let image = bundle.image, let url = image["url"] as? String, !url.isEmpty { card["image"] = image }
            cards.append(card)
        }
        guard !cards.isEmpty else { throw NativeError(message: "Gemini could not ground this batch in Wikipedia.") }
        return cards.shuffled()
    }

    func learn(key: String, action: String, card: [String: Any], question: String?, detailed: Bool, history: [[String: Any]]) async throws -> [String: Any] {
        guard !key.isEmpty else { throw NativeError(message: "Paste your Gemini API key in Settings before using this feature.") }
        let sourceTitles = (card["sources"] as? [[String: Any]] ?? []).prefix(3).compactMap { $0["title"] as? String }
        var sourceArray = await wikipedia.resolve(title: card["title"] as? String ?? "Wikipedia", searchTitles: sourceTitles).sources
        if action == "question", let question, !question.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let additional = await wikipedia.resolve(title: question, searchTitles: []).sources
            for source in additional where sourceArray.count < 3 {
                let url = source["url"] as? String ?? ""
                if !sourceArray.contains(where: { ($0["url"] as? String) == url }) { sourceArray.append(source) }
            }
        }
        guard !sourceArray.isEmpty else { throw NativeError(message: "Wikipedia did not return the cited pages for this fact.") }
        let context = sourceArray.prefix(3).enumerated().map { index, source in
            "\(index). \((source["title"] as? String) ?? "Wikipedia")\nURL: \((source["url"] as? String) ?? "")\nExcerpt: \((source["extract"] as? String) ?? "No extract returned")"
        }.joined(separator: "\n\n")
        let previous = history.suffix(6).map { "\($0["role"] ?? "user"): \($0["content"] ?? "")" }.joined(separator: "\n")
        let request = action == "learn" ? "Write a single 100 to 160 word paragraph that explains the fact in more depth." : "Answer this question: \(question ?? "")"
        let length = detailed ? "Use approximately 150 to 250 words and include helpful context." : "Use 2 to 4 sentences."
        let prompt = """
        Answer from cited English Wikipedia material.
        Fact title: \(card["title"] ?? "")
        Fact description: \(card["body"] ?? "")
        Wikipedia evidence:
        \(context)
        Previous conversation:
        \(previous)
        \(request) \(length)
        If the cited material cannot answer a question, say so clearly. Do not invent details.
        Return JSON with answer and citationIndexes, where citationIndexes contains only indexes of the evidence pages and has at most three values.
        """
        let schema: [String: Any] = [
            "type": "OBJECT",
            "properties": ["answer": ["type": "STRING"], "citationIndexes": ["type": "ARRAY", "items": ["type": "INTEGER"]]],
            "required": ["answer", "citationIndexes"]
        ]
        let text = try await structured(key: key, prompt: prompt, schema: schema)
        let envelope = try JSONDecoder().decode(GeminiAnswerEnvelope.self, from: Data(text.utf8))
        let citations = (envelope.citationIndexes ?? []).filter { $0 >= 0 && $0 < sourceArray.count }.prefix(3).map { sourceArray[$0] }
        return ["answer": envelope.answer ?? "The cited pages did not provide an answer.", "citations": Array(citations)]
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
            geminiKey = payload["key"] as? String ?? ""
            respond(id: id, result: true)
        case "testGemini":
            Task { respond(id: id, result: await gemini.test(key: payload["key"] as? String ?? geminiKey)) }
        case "generate":
            let topics = payload["topics"] as? [[String: Any]] ?? []
            let settings = payload["settings"] as? [String: Any] ?? [:]
            let avoid = payload["avoid"] as? [String] ?? []
            Task {
                do { respond(id: id, result: ["cards": try await gemini.generate(key: geminiKey, topics: topics, settings: settings, avoid: avoid)]) }
                catch { respond(id: id, error: userMessage(error)) }
            }
        case "learn":
            let card = payload["card"] as? [String: Any] ?? [:]
            let actionName = payload["action"] as? String ?? "learn"
            let question = payload["question"] as? String
            let detailed = payload["detailed"] as? Bool ?? false
            let history = payload["history"] as? [[String: Any]] ?? []
            Task {
                do { respond(id: id, result: try await gemini.learn(key: geminiKey, action: actionName, card: card, question: question, detailed: detailed, history: history)) }
                catch { respond(id: id, error: userMessage(error)) }
            }
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
