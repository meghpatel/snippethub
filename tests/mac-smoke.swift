import Foundation
import AppIntents

private struct SearchCase: Decodable {
    let query: String
    let ids: [String]
    let codes: [String]
}

@main
struct MacSmokeTests {
    @MainActor
    static func main() async throws {
        let store = try SnippetStore.shared.get()
        let fixtureURL = URL(fileURLWithPath: CommandLine.arguments[1])
        let cases = try JSONDecoder().decode([SearchCase].self, from: Data(contentsOf: fixtureURL))
        for test in cases {
            let results = try store.search(test.query)
            precondition(results.map(\.id) == test.ids, "Ranking differs from Node for: \(test.query)")
            precondition(results.map(\.code) == test.codes, "Code changed across bridge for: \(test.query)")
        }
        for snippet in store.snippets {
            let resolved = try store.snippet(id: snippet.id)
            precondition(resolved.code == snippet.code)
        }
        do {
            _ = try store.snippet(id: "missing-recipe")
            fatalError("Missing recipe was accepted")
        } catch { /* Expected: stale IDs must not copy another recipe. */ }

        // Test the actual bundled App Intent independently of Spotlight's UI.
        if #available(macOS 26.0, *) {
            for query in ["json to pandas", "read JON file", "kubernetes ingress", ""] {
                let intent = SearchSnippetsIntent()
                intent.query = query
                let result = try await intent.perform()
                let expected = try store.search(query).first?.code ?? "No results found"
                precondition(result.value == expected)
            }
            // Out-of-range positions and empty results must safely render.
            for (query, position) in [("json", -1), ("json", Int.max), ("kubernetes ingress", 0)] {
                _ = try await SnippetPreviewIntent(query: query, position: position).perform()
            }
            do {
                _ = try await CopySnippetIntent(recipeID: "missing-recipe", query: "json", position: 0).perform()
                fatalError("Invalid copy ID was accepted")
            } catch { /* Rejected before accessing the clipboard. */ }
            print("App Intent output, preview bounds, empty results, and invalid copy ID passed.")
        } else {
            print("Spotlight execution checks skipped: require macOS 26+.")
        }
        let temporary = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: temporary, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: temporary) }
        let invalidCatalog = temporary.appendingPathComponent("invalid.json")
        try Data("[{\"id\":\"broken\"}]".utf8).write(to: invalidCatalog)
        let engine = Bundle.main.url(forResource: "search", withExtension: "js")!
        do {
            _ = try SnippetStore(engineURL: engine, catalogURL: invalidCatalog)
            fatalError("Invalid catalog was accepted")
        } catch { /* Expected initialization failure. */ }
        do {
            _ = try SnippetStore(engineURL: temporary.appendingPathComponent("missing.js"), catalogURL: invalidCatalog)
            fatalError("Missing engine was accepted")
        } catch { /* Expected missing-resource failure. */ }
        print("JavaScriptCore matches Node for \(cases.count) queries; catalog/resource failures passed.")
    }
}
