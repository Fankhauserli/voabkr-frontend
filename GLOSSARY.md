# voabkr frontend

The SvelteKit application a learner studies in, on the web and in the native shell. The terms below are the project's language, shared with the backend and meaning the same thing in both — keep them in step. The last group is vocabulary that exists only on the client.

## Language

### Decks and sharing

**Deck**:
A named collection of Cards that a learner studies as a unit.
_Avoid_: list, set, decklist

**System deck**:
A Deck with no owner, maintained by the project rather than by a learner. Readable by anyone when it is public; never edited, shared, or deleted through the application.
_Avoid_: curated deck, official deck, global deck

**Public deck**:
A Deck any learner may study without holding a share. Every System deck that is readable is public; a learner's own Deck is public only if its owner made it so.
_Avoid_: open deck, free deck. Note "shared" is not a synonym: sharing is a DeckShare.

**Deck type**:
Whether a Deck holds vocabulary or grammar Cards.
_Avoid_: category, kind, subject

**DeckShare**:
A grant of access to a Deck, made by its owner to another learner, carrying exactly one Permission.
_Avoid_: invite, collaborator, membership

**Permission**:
What a DeckShare grants: `view`, meaning the holder may study the Deck; or `edit`, meaning the holder may also add and change its Cards.
_Avoid_: access level, right

**Access role**:
A learner's standing on a single Deck: `owner` (created it), `edit` (holds an edit Permission), `view` (holds a view Permission), or `public` (holds no share).
_Avoid_: collaborator, viewer, guest, member

**Deck owner**:
The learner who created a Deck, and the only one who may share it, change its visibility, or delete it.
_Avoid_: author, creator, maintainer

**Library**:
Every Deck a learner may study: those they own, those shared with them, and Public decks. A Deck can qualify by more than one route, so the Library is not the sum of its parts.
_Avoid_: collection, catalogue

### Study and scheduling

**Card**:
A single Korean–English vocabulary item belonging to exactly one Deck, optionally carrying a context sentence and an example.
_Avoid_: flashcard, entry, item

**Due**:
A Card whose Review schedule has reached the date it is next to be studied. Being Due is a property of the Review schedule, not of a Study session — a Card answered Again becomes Due again shortly, and it is the Session queue that brings it back within the current sitting.
_Avoid_: pending, outstanding, upcoming

**New Card**:
A Card the learner has never studied: one with no Review.
_Avoid_: unseen card, fresh card, unstudied card

**Day**:
The unit the Daily goal is measured in. It begins at 04:00 on the device's clock, so a sitting that runs past midnight stays within one Day.
_Avoid_: date, calendar day, today

**Daily goal**:
The number of New Cards the app brings into play each Day. It bounds nothing else — every Due Card is always offered — and it does not bank: a Day not studied does not save up New Cards for a later one.
_Avoid_: target, quota, limit (the request field named `cardsPerDay` carries the Daily goal)

**Review**:
One learner's record of studying one Card: its Review schedule, and the Grade given each time it has been answered.
_Avoid_: study record, attempt, history

**Grade**:
A learner's answer to a Card while studying: Again, Hard, Good, or Easy.
_Avoid_: ease (ambiguous: the request field named `ease` carries the Grade, while the multiplier is the Efactor), rating, score

**Review schedule**:
When a Review is due next, and the state that decides it: its Interval, Efactor, and relearning step. The device computes it; the backend stores it.
_Avoid_: due date, next review

**Relearning step**:
The short return a Card makes after being answered Again, before it resumes its Interval. It is one concept with two enactments: the Review schedule carries it from one sitting to the next, and the Session queue enacts it within a Study session.
_Avoid_: retry, repetition, repeat

**Interval**:
The number of days until a Review is due again.
_Avoid_: gap, delay, spacing

**Efactor**:
The multiplier by which a Review's Interval grows as the learner keeps answering well.
_Avoid_: ease, ease factor

### The study session

**Study session**:
One sitting of studying Cards, from starting to its Session summary.
_Avoid_: session on its own (ambiguous — the backend's session cookie is unrelated)

**Session queue**:
The Cards still to be answered in a Study session, in order, including Cards returning from a Relearning step.
_Avoid_: review queue (a Review is the record of one Card, not a queue of Cards), card list, deck contents

**Batch**:
The set of Cards a Study session offers at once: a slice of the Session queue, the next Batch following the one before. Its size belongs to the app, not to the learner's Daily goal.
_Avoid_: chunk, page, group

**Session summary**:
The account of a finished Study session: the Cards studied, the Grades given, and the Retention.
_Avoid_: results, stats, report

**Retention**:
The share of a Study session's Cards answered correctly on their first Grade. A Card failed and then answered correctly is not retained.
_Avoid_: accuracy, pass rate, success rate

**Study direction**:
Which side of a Card is the prompt: `koreanToEnglish` shows the Korean and asks for the English; `englishToKorean` the reverse.
_Avoid_: mode, orientation, side, order

### Without a connection

**Remembered learner**:
The learner the device last signed in, kept so the app opens signed in with no connection. Only a real 401 from the backend signs them out; a failed request does not. Their Queued Grades outlive a logout.
_Avoid_: cached user, offline user, stored session

**Downloaded Deck**:
A Deck whose Cards and their Review schedules are held on the device, so it can be studied with no connection. The app marks these in the Library.
_Avoid_: offline deck, cached deck, saved deck

**Sync**:
Sending Queued Grades to the backend, then re-fetching the Library and every Downloaded Deck. It runs on reconnect, on app open, and at the end of a Study session.
_Avoid_: refresh, update, upload

**Queued Grade**:
A Grade the device has recorded but the backend has not accepted yet. It belongs to the learner who gave it, and outlives a logout.
_Avoid_: pending review, unsynced answer

**Parked Grade**:
A Queued Grade the backend refused. It stays on the device and is offered again on later Syncs, but never holds up the Grades behind it.
_Avoid_: failed review, rejected grade
