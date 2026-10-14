# The device computes the Review schedule, never the backend

The scheduling rules — Interval growth by Efactor, the Relearning step, the moment a Review is next Due — run on the device, online and offline alike. A Grade leaves the device already carrying the Review schedule it produced and the time it was answered; the backend stores that schedule, answers "what is Due" by comparing the stored moment to now, and never recomputes it. This is what lets a learner answer Cards with no connection at all, and it removes the possibility of the two disagreeing, because only one implementation of the rules exists.

## Considered options

**The backend computes, the device downloads a plan.** The backend precomputes which Cards fall due over the next stretch of days and ships that with the Deck. Correct in principle — the rules stay in one place — but it needs a new plan surface on the backend, and it hands the learner a horizon they can exhaust on a long flight.

**The backend computes, the device recomputes only when offline.** Rejected: two live implementations of the same rules, drifting from the day either is tuned. It is not the cheaper path either — a Grade given offline still has to be reconciled against the schedule the backend holds when the connection returns, which is all of this decision's work plus a second algorithm to carry.

**Both engines live.** Rejected: two authorities that can disagree about whether a Card is Due, with no rule that a learner could be told.

## Consequences

`handlers/review.go` stops being the scheduler and becomes dead code. Its Grade-only `PUT /reviews/:id` is replaced by a batch route that accepts the device's schedule and the time each Grade was given, and Card responses must carry the Review schedule, since the device cannot compute forward from state it never receives. `GLOSSARY.md` no longer describes the backend as holding the Relearning step. The port also fixes the bug where Good never graduated a Card out of relearning: from here the device's rules are the only rules, so a defect in them is a defect everywhere.
