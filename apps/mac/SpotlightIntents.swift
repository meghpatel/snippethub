import AppIntents
import AppKit
import SwiftUI

@available(macOS 26.0, *)
struct SearchSnippetsIntent: AppIntent {
    static let title: LocalizedStringResource = "Search SnippetHub"
    static let description = IntentDescription("Find an offline Python recipe and read or copy its code in Spotlight.")
    static let supportedModes: IntentModes = .background

    @Parameter(title: "Search phrase", requestValueDialog: "What Python snippet do you need?")
    var query: String

    static var parameterSummary: some ParameterSummary {
        Summary("Search SnippetHub for \(\.$query)")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ShowsSnippetIntent & ReturnsValue<String> {
        let results = try SnippetStore.shared.get().search(query)
        return .result(value: results.first?.code ?? "No results found", snippetIntent: SnippetPreviewIntent(query: query))
    }
}

@available(macOS 26.0, *)
struct SnippetHubShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: SearchSnippetsIntent(),
            phrases: ["Search \(.applicationName)", "Find Python snippets in \(.applicationName)"],
            shortTitle: "Search SnippetHub",
            systemImageName: "curlybraces"
        )
    }
}

/// The system can recreate this view in a separate process. Pass only search
/// state; resolve all code from the bundled catalog each time.
@available(macOS 26.0, *)
struct SnippetPreviewIntent: SnippetIntent {
    static let title: LocalizedStringResource = "SnippetHub Preview"
    static let isDiscoverable = false
    static let supportedModes: IntentModes = .background

    // Defaults keep a button payload the system rebuilds in another process from
    // trapping on an unset parameter; the search intent stays required on purpose.
    @Parameter(title: "Search phrase", default: "") var query: String
    @Parameter(title: "Result", default: 0) var position: Int
    @Parameter(title: "Copied recipe", default: "") var copiedID: String

    init() {}
    init(query: String, position: Int = 0, copiedID: String = "") {
        self.query = query
        self.position = position
        self.copiedID = copiedID
    }

    @MainActor
    func perform() async throws -> some IntentResult & ShowsSnippetView {
        let results = try SnippetStore.shared.get().search(query)
        let index = max(0, min(position, results.count - 1))
        return .result(view: SpotlightSnippetView(
            query: query, snippet: results.isEmpty ? nil : results[index],
            position: index, count: results.count, copiedID: copiedID
        ))
    }
}

@available(macOS 26.0, *)
struct BrowseSnippetsIntent: AppIntent {
    static let title: LocalizedStringResource = "Browse SnippetHub Results"
    static let isDiscoverable = false
    static let supportedModes: IntentModes = .background

    @Parameter(title: "Search phrase", default: "") var query: String
    @Parameter(title: "Result", default: 0) var position: Int

    init() {}
    init(query: String, position: Int) {
        self.query = query
        self.position = position
    }

    func perform() async throws -> some IntentResult & ShowsSnippetIntent {
        .result(snippetIntent: SnippetPreviewIntent(query: query, position: position))
    }
}

@available(macOS 26.0, *)
struct CopySnippetIntent: AppIntent {
    static let title: LocalizedStringResource = "Copy SnippetHub Code"
    static let isDiscoverable = false
    static let supportedModes: IntentModes = .background

    @Parameter(title: "Recipe ID", default: "") var recipeID: String
    @Parameter(title: "Search phrase", default: "") var query: String
    @Parameter(title: "Result", default: 0) var position: Int

    init() {}
    init(recipeID: String, query: String, position: Int) {
        self.recipeID = recipeID
        self.query = query
        self.position = position
    }

    @MainActor
    func perform() async throws -> some IntentResult & ShowsSnippetIntent {
        let snippet = try SnippetStore.shared.get().snippet(id: recipeID)
        NSPasteboard.general.clearContents()
        guard NSPasteboard.general.setString(snippet.code, forType: .string) else {
            throw NSError(domain: "SnippetHub", code: 4,
                          userInfo: [NSLocalizedDescriptionKey: "Unable to copy code. Try again."])
        }
        return .result(snippetIntent: SnippetPreviewIntent(query: query, position: position, copiedID: recipeID))
    }
}

@available(macOS 26.0, *)
struct SpotlightSnippetView: View {
    let query: String
    let snippet: Snippet?
    let position: Int
    let count: Int
    let copiedID: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let snippet {
                HStack {
                    Text(snippet.title).font(.headline)
                    Spacer()
                    Text("\(position + 1) of \(count)").font(.caption).foregroundStyle(.secondary)
                }
                Text(snippet.description).font(.callout).fixedSize(horizontal: false, vertical: true)
                Text(snippet.dependencies.isEmpty ? "Python · Standard library" : "Python · Requires: \(snippet.dependencies.joined(separator: ", "))")
                    .font(.caption).foregroundStyle(.secondary)
                Text(verbatim: snippet.code)
                    .font(.system(size: 12, design: .monospaced))
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12).background(.quaternary, in: RoundedRectangle(cornerRadius: 8))
                HStack {
                    Button(intent: CopySnippetIntent(recipeID: snippet.id, query: query, position: position)) {
                        Label(copiedID == snippet.id ? "Copied" : "Copy code",
                              systemImage: copiedID == snippet.id ? "checkmark" : "doc.on.doc")
                    }
                    Spacer()
                    if position > 0 {
                        Button("Previous", intent: BrowseSnippetsIntent(query: query, position: position - 1))
                    }
                    if position + 1 < count {
                        Button("Next", intent: BrowseSnippetsIntent(query: query, position: position + 1))
                    }
                }
            } else {
                Label("No results found", systemImage: "magnifyingglass").font(.headline)
                Text("Try ‘read JSON’, ‘json to pandas’, or ‘parse date’.")
                    .foregroundStyle(.secondary)
            }
        }.padding()
    }
}
