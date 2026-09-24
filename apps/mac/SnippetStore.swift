import Foundation
import JavaScriptCore

struct Snippet: Identifiable, Decodable, Sendable {
    let id: String
    let title: String
    let description: String
    let category: String
    let code: String
    let tags: [String]
    let dependencies: [String]
}

private struct SearchResult: Decodable {
    let snippet: Snippet
    let score: Double
}

/// One bridge for the window and background Spotlight actions. JavaScriptCore
/// stays on the main actor; queries are arguments, never executable source.
@MainActor
final class SnippetStore {
    static let shared: Result<SnippetStore, Error> = Result { try SnippetStore() }

    let snippets: [Snippet]
    private let context: JSContext
    private let searchFunction: JSValue

    convenience init(bundle: Bundle = .main) throws {
        guard let engineURL = bundle.url(forResource: "search", withExtension: "js"),
              let catalogURL = bundle.url(forResource: "python", withExtension: "json") else {
            throw Self.failure("Missing bundled search engine or catalog. Rebuild the app.")
        }
        try self.init(engineURL: engineURL, catalogURL: catalogURL)
    }

    init(engineURL: URL, catalogURL: URL) throws {
        guard let js = JSContext() else { throw Self.failure("Unable to start the search engine.") }
        let catalog = try Data(contentsOf: catalogURL)
        js.evaluateScript(try String(contentsOf: engineURL, encoding: .utf8))
        js.setObject(String(decoding: catalog, as: UTF8.self), forKeyedSubscript: "catalogText" as NSString)
        js.evaluateScript("var engine = new SnippetHub.SearchEngine(JSON.parse(catalogText));")
        guard js.exception == nil,
              let function = js.evaluateScript("(function(query) { return JSON.stringify(engine.search(query, 50)); })"),
              js.exception == nil else {
            throw Self.failure("Unable to load the snippet catalog. Rebuild the app.")
        }
        snippets = try JSONDecoder().decode([Snippet].self, from: catalog)
        context = js
        searchFunction = function
    }

    func search(_ query: String) throws -> [Snippet] {
        context.exception = nil
        guard let json = searchFunction.call(withArguments: [query])?.toString(),
              let data = json.data(using: .utf8), context.exception == nil else {
            throw Self.failure("Search failed. Reopen the app to reload the catalog.")
        }
        return try JSONDecoder().decode([SearchResult].self, from: data).map(\.snippet)
    }

    func snippet(id: String) throws -> Snippet {
        guard let snippet = snippets.first(where: { $0.id == id }) else {
            throw Self.failure("This recipe is no longer available. Search again.")
        }
        return snippet
    }

    private static func failure(_ message: String) -> NSError {
        NSError(domain: "SnippetHub", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }
}
