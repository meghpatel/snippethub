# Architecture decisions

Recorded on 2026-09-21 from the existing implementation and project brief. These records explain the implemented baseline; they do not imply that alternatives were benchmarked or that new scope has been approved. Technical details live in [ARCHITECTURE.md](ARCHITECTURE.md).

## ADR-001 — Offline, deliberate reference workflow

**Status:** Accepted and implemented.

**Context:** The project supports developers who are moving away from autocomplete but still need quick access to familiar coding patterns.

**Decision:** Search a curated local library through explicit user actions. Preview, copy, or insert a selected recipe. Use no AI model, remote retrieval, accounts, or telemetry at runtime.

**Rationale:** Local, deterministic retrieval supports fast access without replacing the user's coding decisions or requiring a hosted service.

**Tradeoffs:** Coverage depends on authored recipes and vocabulary. Search cannot understand every paraphrase or generate missing examples. Network access may still be needed to obtain development tooling.

**Revisit when:** The product brief explicitly changes. Additional convenience features should preserve deliberate insertion by default.

## ADR-002 — One JSON catalog with an in-memory inverted index

**Status:** Accepted and implemented.

**Context:** The launch catalog has 10 read-only Python recipes and needs easy open-source contribution alongside efficient lookup.

**Decision:** Keep the canonical content in `catalog/python.json`. Build weighted postings, prefix, and typo indexes once per engine instance. Bundle the source catalog with each app; do not persist the index.

**Rationale:** JSON is easy to review in Git. Derived indexes give fast lookup without database setup, migrations, or duplicated source data. SQLite, a hosted database, and a persisted index were not needed for the current implementation.

**Tradeoffs:** Every app startup rebuilds the index and holds the catalog in memory. There are no incremental updates or user edits. Updating installed content requires replacing the bundle.

**Revisit when:** Measurements with a real larger catalog show startup or memory problems, or editable libraries require transactions and incremental updates. Consider a prebuilt index or SQLite FTS against those requirements; no migration is currently committed.

## ADR-003 — Natural-language-like search through lexical rules

**Status:** Accepted and implemented.

**Context:** Users should be able to ask for “import a JSON” or “converting JSON to pandas DF” without knowing the exact recipe title, while keeping retrieval free of AI.

**Decision:** Combine filler-word removal, curated synonyms, title/tag/alias weights, prefix lookup, one-edit typo tolerance, query coverage, and exact normalized phrase boosts. Exclude code bodies from the search index. Recognize library shorthand (`pd` for pandas, `np` for NumPy) as synonyms across recipes. Allow typo lookup for normalized query terms of at least three characters against vocabulary spellings of at least four characters, including `JON` → `JSON`.

**Rationale:** Authored metadata expresses recipe intent and produces inspectable, repeatable results. Excluding code avoids common imports and variable names dominating ranking. The asymmetric typo length limits recover a missing character in short names while keeping arbitrary one- and two-character queries out of fuzzy matching. Curated shorthand remains an exact synonym match.

**Tradeoffs:** Global synonyms can blur distinct intents. The tokenizer folds diacritics but still emits only ASCII tokens, so non-Latin scripts do not match; negation is unsupported, and a 60% coverage threshold can admit partial matches. Broad terms can still traverse many postings. The custom score does not implement full BM25 document-length normalization.

**Revisit when:** Real query examples expose missed or confusing results. Improve recipe aliases and regression cases first; change global normalization or ranking with competing-result tests and performance measurements.

## ADR-004 — Share JavaScript retrieval across two native integrations

**Status:** Accepted and implemented.

**Context:** Mac and VS Code need consistent retrieval while providing appropriate platform interactions.

**Decision:** Implement the dependency-free core once in JavaScript. Run it in the VS Code extension host and Apple's JavaScriptCore. Use SwiftUI/AppKit for Mac presentation and the VS Code Quick Pick/editor API for the extension.

**Rationale:** A shared implementation prevents ranking drift. The Mac interface can use native controls without bundling a separate browser runtime; the extension uses the editor's existing interaction model.

**Tradeoffs:** Maintainers work in both JavaScript and Swift. Core changes must remain compatible with both runtimes. The Mac bridge serializes results as JSON, and synchronous main-thread search will need reassessment if workloads grow. The current Mac build targets one architecture at a time.

**Revisit when:** Runtime compatibility, measured UI responsiveness, or platform expansion creates a concrete need for a different boundary. Keep a common retrieval contract and regression corpus through any change.

## ADR-005 — Literal code and captured editor targets

**Status:** Accepted and implemented.

**Context:** Fast insertion should be predictable, including when preview changes focus or the editor has multiple selections.

**Decision:** Capture the editor, selections, and document version before showing the picker. Refuse insertion when that document closes or changes. Use `SnippetString.appendText` so recipe text is literal. With no editor, open an unsaved Python document. Mac uses clipboard copy.

**Rationale:** This preserves the user's intended destination and avoids treating Python characters as snippet placeholders. Neither interface executes recipes or installs their dependencies.

**Tradeoffs:** A changed document requires reopening search. Editable placeholders and template expansion are absent. The Mac app requires a separate paste action.

**Revisit when:** Template support has explicit requirements for syntax, escaping, cursor placement, and backward compatibility. Existing literal recipes should remain valid.

## ADR-006 — Python-first scope and local distribution baseline

**Status:** Accepted and implemented for the MVP; public release is not established by the repository.

**Context:** The initial brief asks for Python, 10 recipes, Mac access, and fast insertion through a VS Code extension, with open-source distribution as the goal.

**Decision:** Ship the source under the existing MIT license, include JSON import and JSON-to-pandas recipes, and provide local app/extension build scripts. Keep publisher identity, production signing, and public release work explicit.

**Rationale:** A small catalog establishes the end-to-end reference workflow and makes relevance review manageable before adding domains or content editing.

**Tradeoffs:** Broad computer-science coverage, templates, and project-specific libraries are not available. The extension publisher remains a development placeholder; the Mac artifact is ad-hoc signed. Unit tests mock VS Code, and Python validation checks syntax rather than execution.

**Revisit when:** Release ownership and distribution requirements are settled, or a specific catalog expansion is chosen. Ideas are tracked in [ROADMAP.md](ROADMAP.md) and the original [TODO.md](TODO.md).

## ADR-007 — Spotlight search through a background App Intent

**Status:** Implemented on 2026-09-22. Shortcuts discovery and system execution verified with Apple Development signing; live Spotlight rendering remains a release check.

**Context:** The user wants to type SnippetHub in Spotlight, enter a search phrase, and read the recipe without opening the app window.

**Decision:** Expose a macOS 26+ background App Intent with a required query parameter and an interactive result snippet. Use the same `SnippetStore` JavaScriptCore bridge as the window. Display one ranked recipe at a time with browse and deliberate clipboard-copy actions. Extract App Intents metadata during the command-line build. Require Xcode 26+ to build while retaining macOS 14 support for the window.

**Rationale:** Apple's App Intents and interactive snippets support in-Spotlight input and output without an AI model, backend, duplicated ranking algorithm, or custom global keyboard handler. Returning text also makes the action usable in Shortcuts.

**Tradeoffs:** Results appear after submitting the action, not on each keystroke. Spotlight controls discovery, result ordering, and Tab navigation; the user may need to select **Search SnippetHub** instead of the application launcher. No claim is made that the bare app-name → Tab sequence selects this action on every Mac. App Intents can render in another process, so preview state is passed as parameters. Automated checks cannot establish Spotlight UI behavior; older Macs keep the window workflow.

**Signing follow-up (2026-09-23):** Ad-hoc signing passed build and direct intent tests but failed the actual Shortcuts connection on macOS 27, with a missing team identity in the logs. The build now accepts `SNIPPETHUB_SIGN_IDENTITY` for an existing certificate and retains ad-hoc signing for ordinary window development. Using the owner’s existing Apple Development identity restored system execution. This is a local development fix, not Developer ID distribution or notarization.

**Revisit when:** A public API permits live search in Spotlight using the shared deterministic engine, or real UI testing shows pagination or preview layout needs a different presentation. Core Spotlight indexing would use OS ranking and requires a separate explicit decision.

## Maintaining the record

Add a numbered record for a consequential architectural change with status, context, decision, rationale, tradeoffs, and revisit conditions. Mark superseded records and link to their replacements instead of erasing the previous rationale. Label unimplemented proposals explicitly.
