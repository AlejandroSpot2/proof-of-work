# Design notes: conflict resolution (EXAMPLE)

Author: Rin Okafor (EXAMPLE)

Problem: two inspectors edit the same note while offline. Whole-document last-writer-wins silently drops one of the two edits.

Decision: resolve per field, ordered by hybrid logical clock. A delete beats an edit only when the delete's clock is later.

Rejected: CRDT text merging. Too heavy for short structured notes.

Synthetic benchmark (synthetic, not production): replaying 10,000 queued edits from 3 simulated devices took 180 ms on a laptop.
