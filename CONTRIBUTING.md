# Contributing

## Add a Python snippet

1. Add an object to `catalog/python.json`. Use a stable kebab-case ID, a specific title, `language: "python"`, a category, description, tags, natural-language aliases, dependencies, and literal code ending in a newline. Use `dependencies: []` for the standard library.
2. Write a short original recipe with imports and sample input. State assumptions such as JSON orientation, timezone, hashability, or overwrite behavior. Do not paste third-party examples without compatible licensing and attribution. Never put credentials or personal data into fixtures.
3. Add realistic search queries with the expected first result to `tests/search.test.js`. Prefer aliases for one recipe; add global synonyms to `core/search.js` only when they apply broadly without confusing existing intents.
4. Run `npm test`, `npm run validate`, and `npm run bench`. Rebuild both apps to refresh bundled resources.

The launch catalog deliberately has 10 snippets. When expanding it, update the count assertion, README, and the Mac empty-state text together. Snippets do not require an AI model, embeddings, or remote service.

## Manual checks before release

| Surface | Check |
| --- | --- |
| VS Code | F5; search “import a JSON”, “json to df”, and an unrelated query. Arrow navigation respects engine ranking. |
| Insertion | Insert into a Python file at an indented cursor, selected text, and multiple cursors. Undo restores the document. Literal `$` and backslashes remain intact. |
| Focus | Preview a recipe beside the target editor, then insert. Code still goes to the original editor. Cancel leaves the document alone. |
| Empty editor | Run the command with no editor. Selection creates an unsaved Python document. |
| Mac | Build and open the app; check results, empty state, code scrolling, ⌘F, arrows, Return / copy button, and clipboard paste. |

## Release boundaries

Choose an owned VS Code publisher identity before Marketplace submission. The packaging command pins `@vscode/vsce`; review updates before changing the version. For Mac distribution, build and test each supported architecture, sign with Developer ID, and notarize. No publishing or signing credentials are stored here.
