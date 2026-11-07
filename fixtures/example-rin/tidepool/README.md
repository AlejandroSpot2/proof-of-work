# Tidepool (EXAMPLE)

Offline-first sync for small field teams. Every edit is written to a local event log first, and the timeline you see is rebuilt by replaying that log.

EXAMPLE project: synthetic, created for a demo. Not a real product.

## How it works

- Edits are events in an append-only local log, stamped with a hybrid logical clock.
- Concurrent edits are resolved per field with last-writer-wins, ordered by the clock, so two people editing different fields of the same note both keep their change.
- The storage adapter writes the log to IndexedDB in the browser and to SQLite on desktop.

## Status

Tested only on a synthetic benchmark. Never run in production.
