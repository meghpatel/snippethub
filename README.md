# SnippetHub

**Write your own code. Keep a good reference.**

SnippetHub is an offline Python snippet library for developers who are stepping away from autocomplete. Search with everyday phrases, read a small recipe, and insert it deliberately. No AI, accounts, telemetry, server, or network requests at runtime.

The initial MVP includes a native macOS app, a VS Code extension, and 10 curated Python snippets. Both apps run the **same search engine and catalog**.

## Try it

Requires Node.js 22+; Python 3 is needed for catalog syntax validation. No `npm install` is needed for search, tests, or builds.

```sh
npm test
npm run search -- "converting JSON to pandas DF"
```

### VS Code

1. Open this repository in VS Code.
2. Press **F5** and choose **Run SnippetHub Extension**. The build runs automatically.
3. In the Extension Development Host, open a Python file and press **⌘⌥S** on Mac or **Ctrl+Alt+S** elsewhere.
4. Type a phrase, select a result with the arrow keys, and press **Enter** to insert at your original selection(s). Use the row buttons to preview or copy first.

The Command Palette also has **SnippetHub: Search Python Snippets**. Without an active editor, selecting a snippet opens a new, unsaved Python document. Insertion replaces selected text and supports multiple cursors and undo. SnippetHub never runs the code or installs its dependencies.

Build an installable package with `npm run package:vscode` (downloads Microsoft's `@vscode/vsce` packaging tool through npm). In VS Code choose **Extensions → … → Install from VSIX…**, and select `dist/snippethub-0.1.0.vsix`. The manifest publisher is a placeholder for local development; choose a publisher you own before Marketplace publication.

### Native Mac app

The window runs on macOS 14+. Building requires Xcode 26+ (including its macOS 26+ SDK), selected with `xcode-select` or `DEVELOPER_DIR`. Spotlight actions require macOS 26+.

```sh
npm run build:mac
open dist/SnippetHub.app
```

The build targets your current Mac architecture. Search immediately; **↑ / ↓** move through results while the search field is focused; **Return** copies the selected snippet. **⌘F** focuses search, **Escape** clears the query, and **⌘⇧C** copies the selected recipe. Paste into your editor with **⌘V**. Package requirements appear next to the code.

Builds use ad-hoc signing by default, which is sufficient for the normal window. System App Intent execution needs a developer identity on the tested macOS 27 host; use the signing option below for Spotlight. Public Mac downloads still need a distribution workflow, Developer ID signing, and notarization. The MVP uses a normal application window; a global hotkey and menu-bar launcher are future improvements.

### Search from Spotlight (macOS 26+)

1. Build with an installed Apple Development signing identity (see below). Put `dist/SnippetHub.app` in `/Applications` or `~/Applications` and open it once so macOS can discover its actions.
2. Press **⌘Space**, type **Search SnippetHub**, and select the action with that name. Typing just **snippethub** can also surface the action; select it if the application launcher is first.
3. Press **Tab** to fill **Search phrase**, type `json to pandas`, and press **Return**.
4. Read the recipe directly in Spotlight. **Previous / Next** browse ranked matches; **Copy code** copies the displayed recipe for pasting into your editor.

For a local Spotlight build, list the available signing identities and supply the selected certificate name or SHA-1 hash:

```sh
security find-identity -v -p codesigning
SNIPPETHUB_SIGN_IDENTITY="<identity from the list>" npm run test:mac
```

Quit the installed app before replacing it with the newly signed build, then open it once. The script does not select a developer identity automatically or store signing credentials. If no identity is available, the ordinary window remains usable with `npm run build:mac`.

This is a Spotlight **action**, using Apple's [App Intents](https://developer.apple.com/videos/play/wwdc2025/260/) and [interactive snippets](https://developer.apple.com/videos/play/wwdc2025/275/). It runs the bundled search engine after submission and does not activate the app window. It does not replace Spotlight's app-launcher row or provide live results on every keystroke. macOS controls action ordering, Tab navigation, and indexing; the exact `snippethub → Tab` shortcut depends on which result is selected. You can assign a Spotlight Quick Key to the search action for faster access.

Results include the complete literal code, description, and dependencies. An unrelated query displays **No results found**; searching does not copy anything until you press **Copy code**. The Shortcuts action also returns the first matching recipe's code as text, or **No results found** when there is no match. SnippetHub itself uses no AI or network retrieval.

If Shortcuts reports it cannot communicate with the app, check `codesign -dv --verbose=2 /path/to/SnippetHub.app`: `Signature=adhoc` and `TeamIdentifier=not set` reproduced that failure on macOS 27. Signing with an existing Apple Development identity allowed the system to execute both search and preview intents. Direct smoke tests can pass even while this system connection fails.

If the action is missing, open the installed app, check **System Settings → Spotlight** allows its actions, and search the full action name. Older macOS versions retain the normal SnippetHub window. Automated Mac checks cover metadata and action output; use the [Spotlight checklist](CONTRIBUTING.md#manual-checks-before-release) to verify discovery, rendering, and clipboard behavior on your Mac.

## Included recipes

| Files & JSON | Data & pandas | Collections / dates |
| --- | --- | --- |
| Read / import a JSON file | JSON to pandas DataFrame | Remove duplicates, preserving order |
| Write dictionary to JSON | CSV to pandas DataFrame | Sort dictionaries by a key |
| Parse a JSON string | Flatten nested JSON | Parse a date string |
| List files in a directory | | |

The three pandas recipes require `pandas` in the Python environment where you use them. Other recipes use Python's standard library. Examples state their data-shape assumptions; adapt filenames and values before running them. File-writing recipes overwrite the named output file.

## How retrieval works

1. **Store once.** `catalog/python.json` contains stable IDs, titles, descriptions, tags, natural-language aliases, dependencies, and literal Python code. Builds copy it into each app; editing a recipe means editing one file.
2. **Index once per session.** A weighted inverted index maps normalized terms to snippet IDs. Titles and tags carry more weight than descriptions. Source code is intentionally excluded so common imports and variable names do not overwhelm intent.
3. **Normalize the question.** Fold accents to plain letters, drop apostrophes, remove common filler words, and map curated synonyms such as “import/load/read”, “DF/dataframe”, “pd/pandas”, “np/numpy”, and “folder/directory”. Prefix indexes support incomplete terms; a deletion index retrieves candidates for one-edit spelling mistakes, including adjacent transpositions and `JON` → `JSON`. Typo lookup requires at least three query characters and four characters in the target word.
4. **Rank candidates.** Score weighted field matches using inverse document frequency and saturating weights, then reward query coverage and exact normalized aliases. Return matches covering at least 60% of meaningful query terms. Results are deterministic; unrelated queries show an empty state.

Try `read JON file`, `jon to pd df`, or `import csv into pd`. Library shortcuts match available recipes: `pd` finds the three pandas recipes; `np` is recognized, but the launch catalog has no NumPy recipes.

This is lexical search with authored vocabulary, **not semantic understanding**. It handles phrases covered by tags, synonyms, and aliases; it will not understand arbitrary paraphrases or negation. Queries are capped at 256 characters and 24 distinct meaningful terms. Blank search browses the catalog; filler-only search yields no matches.

JSON is sufficient for a tiny, read-only catalog and keeps contributions reviewable. The in-memory inverted index avoids scanning every recipe on each keystroke. Prefix and typo lookup operate on the vocabulary; ranking visits matching postings and sorts candidate results. Common queries can still touch most snippets. There is no database process or persistent index to migrate. If real catalog growth makes startup or memory expensive, measure first, then consider a prebuilt index or SQLite FTS.

The Mac app hosts `core/search.js` through Apple's [JavaScriptCore](https://developer.apple.com/documentation/javascriptcore); the extension uses the same file in Node and VS Code's [Quick Pick / editor API](https://code.visualstudio.com/api/references/vscode-api).

## Develop and verify

```sh
npm test                 # Search relevance and extension behavior with a mocked VS Code API
npm run validate         # Catalog validation and Python AST parsing; does not execute recipes
npm run bench            # Warm-query latency at 10 / 1,000 / 10,000 synthetic entries
npm run build:vscode     # dist/vscode (loadable development extension)
npm run build:mac        # dist/SnippetHub.app (Xcode 26+; macOS only)
npm run test:mac         # Build, metadata, real JavaScriptCore, and intent smoke checks
```

The benchmark prints index-build time, median, p95, and maximum query latency. Larger catalogs repeat the 10 recipes with unique IDs to stress posting lists; they do not establish real-world retrieval quality. Unit tests mock the VS Code API, so also run the manual checks in [CONTRIBUTING.md](CONTRIBUTING.md) before release.

```text
catalog/python.json       Shared, reviewable recipe source
core/search.js            Dependency-free retrieval and schema validation
apps/vscode/              Command, picker, copy / preview / insertion
apps/mac/                 SwiftUI window, Spotlight actions, and JavaScriptCore bridge
scripts/                  Build, search, validation, benchmark
tests/                    Relevance and editor behavior regression tests
```

## Open source

MIT licensed, including the original recipe catalog. See [CONTRIBUTING.md](CONTRIBUTING.md) for adding snippets and relevance cases. This is a local MVP, not a published Marketplace extension or notarized Mac release.

## Project documentation

| Document | Purpose |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Working instructions, implementation rules, and verification expectations for coding agents. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Components, catalog contract, retrieval algorithm, platform flows, and builds. |
| [DECISIONS.md](DECISIONS.md) | Architecture decisions, rationale, tradeoffs, and conditions for revisiting them. |
| [ROADMAP.md](ROADMAP.md) | Implemented scope, release preparation, and future proposals from the original [TODO.md](TODO.md). |
