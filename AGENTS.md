# Working on SnippetHub

## Output style

Always follow the `i-have-adhd` skill: action-first, numbered steps for multi-step work, no preamble or closers, and state restated each turn. Keep updates concise and concrete. When the skill is unavailable, follow these rules directly.

## Project purpose

SnippetHub is an open-source reference tool for developers who want to write code themselves without autocomplete. The current MVP offers fast, offline search over 10 curated Python snippets through a native Mac app and a VS Code extension. JSON import and JSON-to-pandas DataFrame conversion are required launch recipes.

Read [README.md](README.md) for setup, [ARCHITECTURE.md](ARCHITECTURE.md) for implementation, and [DECISIONS.md](DECISIONS.md) for rationale. [ROADMAP.md](ROADMAP.md) distinguishes current scope from future ideas; [TODO.md](TODO.md) preserves the owner's original notes.

## Implementation rules

1. Keep runtime retrieval offline and deterministic. Preserve the no-AI, no-account, no-telemetry design. Do not introduce a backend, embeddings, or autocomplete as an incidental implementation choice.
2. Keep catalog content in `catalog/python.json` and retrieval logic in `core/search.js`. Both apps consume these sources. Do not fork search behavior into Swift or the extension, or edit generated copies under `dist/`.
3. Keep the shared engine usable in both Node and JavaScriptCore. Avoid Node-only APIs, DOM dependencies, and platform-specific imports in `core/search.js`. Platform behavior belongs under `apps/`.
4. Preserve deliberate code insertion. Recipes are literal text: never execute them, automatically install their dependencies, or interpret them as snippet templates. In VS Code, retain the original editor/selection capture and changed-document guard; on Mac, copy through the clipboard.
5. Treat the current catalog as bundled, read-only content. Templates, user snippets, other languages, and new reference domains are proposals until implemented explicitly. Preserve unrelated user work and the original notes in `TODO.md`.

## Making changes

Prefer aliases for a recipe-specific query and synonyms only for equivalences that apply across recipes. Add relevance regressions for search changes, including plausible competing results and unrelated queries. Explain data-shape assumptions and dependencies in new recipes; follow [CONTRIBUTING.md](CONTRIBUTING.md).

The number 10 is the launch size, not a permanent storage limit. When intentionally expanding the catalog, update the count assertions in `tests/search.test.js`, README recipe coverage, and the Mac empty-state copy together. A new catalog field may require changes to validation, Swift decoding, both interfaces, and documentation.

## Verification

Run commands from the repository root. Use Node.js 22+; Python 3 is required for syntax validation. No npm install is needed for core tests or the development builds.

| Change | Relevant checks |
| --- | --- |
| Documentation only | Check accuracy against code, local Markdown links, and `git diff --check`; no app rebuild is needed. |
| Catalog or search | `npm test`, `npm run validate`, `npm run bench`; rebuild affected apps to refresh bundled resources. |
| VS Code adapter | `npm test`, `npm run build:vscode`; use F5 and the manual editor checks in CONTRIBUTING. |
| Mac adapter | `npm run build:mac` on macOS; check search, navigation, copy, and empty/error states in the app. |
| Distribution | `npm run package:vscode` for the VSIX; review publisher identity and Mac signing requirements before publication. |

Tests mock the VS Code API; passing them does not establish live editor behavior. Python AST validation does not execute recipes. The benchmark uses synthetic duplicates at larger sizes; report its conditions rather than promising production latency. State which checks actually ran and any remaining verification gaps.

## Documentation maintenance

Update architecture documentation when behavior or component boundaries change. Record consequential choices in DECISIONS with context, rationale, tradeoffs, and conditions for revisiting them. Keep proposals labeled as proposals, and update ROADMAP when an item is implemented. Do not turn a docs-only request into feature implementation or publication.

The Mac build is ad-hoc signed for local use. Public distribution requires Developer ID signing and notarization. The VS Code publisher is a development placeholder. Do not describe either artifact as publicly released without verifying publication.
