# Contributing

Read [ARCHITECTURE.md](ARCHITECTURE.md) and [DECISIONS.md](DECISIONS.md) before changing storage, retrieval, or platform boundaries. Agent-specific working instructions are in [AGENTS.md](AGENTS.md).

## Add a Python snippet

1. Add an object to `catalog/python.json`. Use a stable kebab-case ID, a specific title, `language: "python"`, a category, description, tags, natural-language aliases, dependencies, and literal code ending in a newline. Use `dependencies: []` for the standard library.
2. Write a short original recipe with imports and sample input. State assumptions such as JSON orientation, timezone, hashability, or overwrite behavior. Do not paste third-party examples without compatible licensing and attribution. Never put credentials or personal data into fixtures.
3. Add realistic search queries with the expected first result to `tests/search.test.js`. Prefer aliases for one recipe; add global synonyms to `core/search.js` only when they apply broadly without confusing existing intents.
4. Run `npm test`, `npm run validate`, and `npm run bench`. Rebuild both apps to refresh bundled resources.

The launch catalog deliberately has 10 snippets. When expanding it, update the count assertion, README, and the Mac empty-state text together. Snippets do not require an AI model, embeddings, or remote service.

## Keep the project record current

Update ARCHITECTURE when behavior changes and DECISIONS when a consequential design choice changes. Keep [ROADMAP.md](ROADMAP.md) aligned with implemented scope; proposals remain proposals until implemented. Preserve the owner's original [TODO.md](TODO.md) notes. For documentation-only changes, check source accuracy, relative links, and whitespace; app builds and code tests are unnecessary unless behavior also changes.

## Manual checks before release

| Surface | Check |
| --- | --- |
| VS Code | F5; search “import a JSON”, “json to df”, and an unrelated query. Arrow navigation respects engine ranking. |
| Insertion | Insert into a Python file at an indented cursor, selected text, and multiple cursors. Undo restores the document. Literal `$` and backslashes remain intact. |
| Focus | Preview a recipe beside the target editor, then insert. Code still goes to the original editor. Cancel leaves the document alone. |
| Empty editor | Run the command with no editor. Selection creates an unsaved Python document. |
| Mac | With Xcode 26+, run `npm run test:mac`, then open the app; check results, empty state, code scrolling, ⌘F, arrows, Return / copy button, and clipboard paste. |

### Spotlight checks (macOS 26+)

1. Build with `SNIPPETHUB_SIGN_IDENTITY="<installed Apple Development identity>" npm run test:mac`. Quit the old app before replacing it. Install the rebuilt app in Applications, open it once, close its window, and find **Search SnippetHub** in Spotlight. Confirm typing `snippethub` can find the action; select the action before Tab if the app-launcher row comes first.
2. Tab into **Search phrase**, enter `json to pandas`, and press Return. Confirm code, data-shape description, and pandas dependency appear inside Spotlight without activating the SnippetHub window. Repeat with the app quit to check cold launch.
3. Search `json`, use Previous/Next, and copy a non-first recipe. Paste into a scratch editor and compare with the catalog, including indentation and the trailing newline. Search/preview alone must leave the clipboard untouched.
4. Search `kubernetes ingress` to check the empty state. Check a long recipe in light and dark mode, keyboard access to buttons, and repeat the action after dismissing Spotlight. Return to the normal Mac app and verify selection/copy still work.
5. In Shortcuts, run **Search SnippetHub** and confirm its text output matches the first recipe. On macOS 14/15, verify the normal app launches; Spotlight actions require 26+.

On the tested macOS 27 host, an ad-hoc-signed build was discoverable but failed to execute through Shortcuts; an Apple Development-signed build executed successfully. Use `security find-identity -v -p codesigning` to list available identities. Direct intent smoke tests alone do not catch this connection failure.

`npm run test:mac` checks bundled metadata and real JavaScriptCore against Node results. On macOS 26+, it also invokes search/preview intents directly; it does not establish Spotlight discovery, rendering, valid clipboard writes, or focus behavior.

## Release boundaries

Choose an owned VS Code publisher identity before Marketplace submission. The packaging command pins `@vscode/vsce`; review updates before changing the version. For Mac distribution, build and test each supported architecture, sign with Developer ID, and notarize. No publishing or signing credentials are stored here.
