# Dutch Vocabulary Trainer — V2.4 Stable Core

## Goal
V2.4 is an architectural simplification release. Preserve the V2.3 user-facing behavior and IndexedDB schema while making the code easy to inspect, test, fix, and extend.

## Rules
1. No artificial file-count limit. Split code when a responsibility becomes independently understandable.
2. Keep source readable; no minification in source files.
3. Aim for roughly 200–250 lines per file as a maintenance warning, not a hard rule.
4. Use one global namespace: `DutchTrainer`.
5. IndexedDB is the single source of truth for persistent application data.
6. No legacy compatibility bridges or duplicate persistence paths.
7. UI code renders and handles interaction; business logic stays outside the UI.
8. Business modules do not manipulate the DOM.
9. Dependencies are one-directional and explicit.
10. Preserve the existing V2.3 database schema unless a real data-model change is required.
11. Every new behavior gets automated tests.
12. Production changes must pass the full test suite before release.
13. Prefer small, independently verifiable commits over large rewrites.

## Target modules
- `app.js` — startup only
- `db.js` — persistence only
- `vocabulary.js` — words, packs, selection and vocabulary operations
- `practice.js` — sessions, exercises, answers and mastery integration
- `history.js` — session history and history statistics
- `scheduler.js` — review scheduling rules
- `ui.js` — rendering, navigation and user interaction

Additional focused files are allowed when they reduce complexity rather than add indirection.

## Compatibility
V2.4 starts from the V2.3 code/data baseline. No vocabulary migration is planned. Existing schema 3 data remains valid.
