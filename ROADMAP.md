# Scope and future work

Snapshot: 2026-09-23. The current repository implements the Python reference MVP. The owner's original ideas remain in [TODO.md](TODO.md); the proposals below have no committed dates or implementation order.

## Implemented baseline

| Area | Current behavior |
| --- | --- |
| Catalog | 10 bundled Python recipes, including JSON import and JSON-to-pandas conversion. |
| Retrieval | Shared offline lexical engine with synonyms (including `pd`/`np` library shorthand), weighted metadata, prefix lookup, and typo tolerance including `JON` → `JSON`. NumPy recipes are not bundled. |
| VS Code | Keyboard search, previews, copy, and deliberate insertion into captured selections. |
| Mac | Native search window, recipe preview, keyboard navigation, and clipboard copy. On macOS 26+, a Spotlight search action provides an interactive code preview with browse/copy controls. Shortcuts discovery/system execution verified with Apple Development signing; Spotlight UI checks remain open. |
| Contributor tooling | MIT license, builds, search regressions, mocked editor tests, syntax validation, benchmark, and build CI. |

## Before public distribution

These are release preparation items, not claims of completed publication.

1. Verify the extension in a live VS Code host, including ranking, preview focus, indented insertion, selected text, multiple cursors, and undo. The current automated adapter tests use mocks.
2. Choose an owned Marketplace publisher identity and prepare the extension's public release metadata and artifact.
3. Define supported Mac architectures, test the packaged app on them, and add Developer ID signing and notarization for public downloads.
4. Check real user queries and document reproducible performance results separately from the synthetic benchmark. The repository has JavaScriptCore and App Intent smoke checks, but no automated Spotlight UI or memory-performance checks. Verify Spotlight discovery, preview, pagination, and copy on macOS 26+.

## Product proposals

The first four rows group ideas already present in TODO; the last row reflects the existing README's Mac convenience ideas. These features are not implemented.

| Proposal | Source / intent | Decisions needed before implementation |
| --- | --- | --- |
| Reusable templates | TODO: store and retrieve templates such as `TODO.md`. | File/document templates versus editable code placeholders; content schema, preview, insertion, and escaping. |
| Personal and project snippets | TODO: custom code or project-related recipes. | Storage location, project scope, editing/import workflow, stable IDs, and precedence against bundled recipes. |
| Pandas reference material | TODO: pandas documentation. | Recipe coverage versus longer documentation; attribution, licensing, versions, and offline packaging. |
| Broader technical subjects | TODO: Git commands, CS topics, databases, cloud, and other CS subjects. | Supported content types and languages, categories, dependencies, and language-specific validation. The current validator only accepts Python. |
| Faster Mac access | README: global hotkey and menu-bar launcher. | Activation behavior, focus restoration, shortcut conflicts, and accessibility. |

## Storage and retrieval triggers

Keep the current bundled JSON design while it meets the workload. A larger or editable catalog may justify a different storage/index lifecycle, but SQLite, persisted indexes, background indexing, synchronization, and a backend are not scheduled features. Measure the relevant constraints and record a decision before changing the architecture.

Use [DECISIONS.md](DECISIONS.md) to record a chosen approach and [ARCHITECTURE.md](ARCHITECTURE.md) to describe it once implemented. Keep TODO available as the original idea list rather than treating every note as an approved specification.
