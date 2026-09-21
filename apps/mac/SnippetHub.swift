import SwiftUI
import AppKit
import JavaScriptCore

struct Snippet: Identifiable, Decodable {
    let id: String
    let title: String
    let description: String
    let category: String
    let code: String
    let tags: [String]
    let dependencies: [String]
}

struct SearchResult: Decodable {
    let snippet: Snippet
    let score: Double
}

@MainActor
final class Library: ObservableObject {
    @Published var query = "" { didSet { search() } }
    @Published var results: [Snippet] = []
    @Published var selection: String?
    @Published var error: String?
    @Published var copied = false
    private var context: JSContext?
    private var searchFunction: JSValue?
    private var copyReset: Task<Void, Never>?

    var selected: Snippet? { results.first { $0.id == selection } }

    init() {
        do {
            guard let engineURL = Bundle.main.url(forResource: "search", withExtension: "js"),
                  let catalogURL = Bundle.main.url(forResource: "python", withExtension: "json"),
                  let js = JSContext() else {
                throw NSError(domain: "SnippetHub", code: 1, userInfo: [NSLocalizedDescriptionKey: "Missing bundled search engine or catalog. Rebuild the app."])
            }
            context = js
            js.evaluateScript(try String(contentsOf: engineURL, encoding: .utf8))
            js.setObject(try String(contentsOf: catalogURL, encoding: .utf8), forKeyedSubscript: "catalogText" as NSString)
            js.evaluateScript("var engine = new SnippetHub.SearchEngine(JSON.parse(catalogText));")
            searchFunction = js.evaluateScript("(function(query) { return JSON.stringify(engine.search(query, 50)); })")
            if let exception = js.exception { throw NSError(domain: "SnippetHub", code: 2, userInfo: [NSLocalizedDescriptionKey: exception.toString() ?? "Search initialization failed"])}
            search()
        } catch { self.error = error.localizedDescription }
    }

    func search() {
        guard let function = searchFunction else { return }
        do {
            guard let json = function.call(withArguments: [query])?.toString(),
                  let data = json.data(using: .utf8), context?.exception == nil else {
                throw NSError(domain: "SnippetHub", code: 3, userInfo: [NSLocalizedDescriptionKey: "Search failed. Reopen the app to reload the catalog."])
            }
            results = try JSONDecoder().decode([SearchResult].self, from: data).map(\.snippet)
            if !results.contains(where: { $0.id == selection }) { selection = results.first?.id }
            copied = false
            error = nil
        } catch { results = []; selection = nil; self.error = error.localizedDescription }
    }

    func move(_ delta: Int) {
        guard !results.isEmpty else { return }
        let current = results.firstIndex { $0.id == selection } ?? 0
        selection = results[max(0, min(results.count - 1, current + delta))].id
        copied = false
    }

    func copyCode() {
        guard let snippet = selected else { return }
        NSPasteboard.general.clearContents()
        copied = NSPasteboard.general.setString(snippet.code, forType: .string)
        copyReset?.cancel()
        copyReset = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            guard !Task.isCancelled else { return }
            self?.copied = false
        }
    }
}

struct ContentView: View {
    @EnvironmentObject private var library: Library
    @FocusState private var searchFocused: Bool
    private let accent = Color(red: 0.36, green: 0.87, blue: 0.68)

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Image(systemName: "curlybraces").font(.system(size: 24, weight: .bold)).foregroundStyle(accent)
                VStack(alignment: .leading, spacing: 3) {
                    Text("SnippetHub").font(.title2.bold())
                    Text("A reference, at your fingertips.").font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Label("Offline", systemImage: "checkmark.circle.fill").font(.caption).foregroundStyle(accent)
                Text("PYTHON").font(.system(size: 10, weight: .bold, design: .monospaced))
                    .padding(.horizontal, 9).padding(.vertical, 5).background(.white.opacity(0.07), in: Capsule())
            }.padding(24)
            HStack(spacing: 12) {
                Image(systemName: "magnifyingglass").foregroundStyle(accent)
                TextField("Try ‘load JSON into pandas’", text: $library.query)
                    .textFieldStyle(.plain).font(.system(size: 16)).focused($searchFocused)
                    .onSubmit { library.copyCode() }
                    .onKeyPress(.downArrow) { library.move(1); return .handled }
                    .onKeyPress(.upArrow) { library.move(-1); return .handled }
                    .onKeyPress(.escape) { library.query = ""; return .handled }
                if !library.query.isEmpty {
                    Button { library.query = ""; searchFocused = true } label: { Image(systemName: "xmark.circle.fill") }
                        .buttonStyle(.plain).accessibilityLabel("Clear search")
                }
                Text("⌘ F").font(.caption.monospaced()).foregroundStyle(.secondary)
            }.padding(16).background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(.white.opacity(0.1)))
                .padding(.horizontal, 24).padding(.bottom, 20)
            Divider()
            HSplitView {
                VStack(alignment: .leading, spacing: 8) {
                    Text("\(library.results.count) SNIPPETS").font(.system(size: 10, weight: .semibold, design: .monospaced))
                        .foregroundStyle(.secondary).padding(.horizontal, 16).padding(.top, 16)
                    List(selection: $library.selection) {
                        ForEach(library.results) { snippet in
                            VStack(alignment: .leading, spacing: 6) {
                                Text(snippet.title).font(.system(size: 13, weight: .medium))
                                Text(snippet.category).font(.caption).foregroundStyle(.secondary)
                            }.padding(.vertical, 8).tag(snippet.id)
                        }
                    }.listStyle(.sidebar).scrollContentBackground(.hidden)
                }.frame(minWidth: 240, idealWidth: 280, maxWidth: 360)
                detail.frame(minWidth: 410, maxWidth: .infinity, maxHeight: .infinity)
            }
            Divider()
            HStack {
                Text("Write your own code. Keep a good reference.")
                Spacer()
                Text("↑ ↓ Browse   ↵ Copy   ⌘ F Search").monospaced()
            }.font(.system(size: 10)).foregroundStyle(.secondary).padding(.horizontal, 24).padding(.vertical, 12)
        }
        .background(Color(red: 0.075, green: 0.09, blue: 0.105))
        .preferredColorScheme(.dark)
        .frame(minWidth: 800, minHeight: 520)
        .onAppear { searchFocused = true }
        .onChange(of: library.selection) { _, _ in library.copied = false }
        .background(Button("Focus search") { searchFocused = true }.keyboardShortcut("f").hidden())
    }

    @ViewBuilder private var detail: some View {
        if let error = library.error {
            ContentUnavailableView("Unable to load snippets", systemImage: "exclamationmark.triangle", description: Text(error))
        } else if let snippet = library.selected {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text(snippet.category.uppercased()).font(.system(size: 10, weight: .bold, design: .monospaced)).foregroundStyle(accent)
                    Text(snippet.title).font(.system(size: 25, weight: .semibold))
                    Text(snippet.description).font(.system(size: 13)).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                    HStack {
                        Text(snippet.dependencies.isEmpty ? "Standard library · no packages needed" : "Requires: \(snippet.dependencies.joined(separator: ", "))")
                            .font(.caption).foregroundStyle(.secondary)
                        Spacer()
                        Button { library.copyCode() } label: {
                            Label(library.copied ? "Copied" : "Copy code", systemImage: library.copied ? "checkmark" : "doc.on.doc")
                        }.buttonStyle(.borderedProminent).tint(accent).foregroundStyle(.black).keyboardShortcut("c", modifiers: [.command, .shift])
                    }
                    ScrollView(.horizontal) {
                        Text(snippet.code).font(.system(size: 13, design: .monospaced)).lineSpacing(6)
                            .foregroundStyle(Color(red: 0.8, green: 0.9, blue: 0.86)).textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading).padding(18)
                    }.background(.black.opacity(0.25), in: RoundedRectangle(cornerRadius: 12))
                    Text(snippet.tags.joined(separator: "  ·  ")).font(.caption.monospaced()).foregroundStyle(.secondary)
                }.padding(26).frame(maxWidth: .infinity, alignment: .leading)
            }
        } else {
            ContentUnavailableView("No matching snippets", systemImage: "magnifyingglass", description: Text("Try ‘read JSON’, ‘sort dictionaries’, or ‘parse date’. This library starts with 10 Python recipes."))
        }
    }
}

@main
struct SnippetHubApp: App {
    @StateObject private var library = Library()
    var body: some Scene {
        WindowGroup {
            ContentView().environmentObject(library)
        }.defaultSize(width: 980, height: 640)
        .commands { CommandGroup(replacing: .newItem) {} }
    }
}
