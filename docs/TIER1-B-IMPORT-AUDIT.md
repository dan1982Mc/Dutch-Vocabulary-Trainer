# V2.3 Tier 1 — B: Import validation/merge

## Implemented
- Validates that an import is a Word Pack object and contains vocabulary.
- Enforces 10 MB file and 10,000-word limits.
- Validates every imported word object and requires Dutch + English content.
- Rejects duplicate explicit word IDs within the same import.
- Enforces the per-word exercise limit.
- Parses malformed JSON and rejects non-JSON files.
- Normalizes imported vocabulary to schema version 3.
- Detects an already-installed pack by content signature, pack ID, or matching name/word count.
- Prevents duplicate pack installation.
- Detects matching existing vocabulary by ID or pack-local Dutch/English signature.
- Preserves existing mastery, scheduling, stats, history, and creation timestamp when a matching word is updated.
- Uses `saveWords()` so the vocabulary batch is written as one IndexedDB transaction.
- Returns added/updated/skipped counts.
- Keeps imported-pack selection behavior.

## Remaining verification
- Browser-level tests should verify import/merge behavior against real IndexedDB data.
- Failure/rollback behavior should be covered by automated tests; pack metadata and vocabulary writes are separate IndexedDB operations and therefore are not one atomic cross-store transaction.
- Backup/restore compatibility should be regression-tested with imported words carrying mastery/history.

## Acceptance target
B is implementation-complete for validation/merge logic, but should not be considered fully verified until automated tests cover the above cases.
