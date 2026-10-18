import type { CardReviewSchedule, Deck, SM2Rating } from '$lib/types';
import type { ReviewSchedule } from '$lib/scheduling/reviewSchedule';
import type { DownloadedDeck } from '$lib/device/deviceStore';

/**
 * The wire contract between the device and the backend, chosen here because the
 * backend batch route is a backend change that this repository does not contain.
 * Tests inject these interfaces rather than reaching the network; `syncApi` is
 * the one implementation that speaks HTTP. If the backend chooses a different
 * shape, only `$lib/api/sync` and these types need to move.
 *
 * `POST /reviews/batch`
 *   request:  { grades: GradeBatchEntry[] }
 *   response: { results: GradeBatchResult[] } in the same order as the request.
 * A Grade that the backend refuses comes back with `accepted: false`; every
 * other Grade in the batch still applies. Replaying a Grade is safe because it
 * carries the moment it was answered, and the backend keeps the later answer.
 *
 * `GET /decks/` returns the Library.
 * `GET /cards/?deck_id=<id>&deckId=<id>` returns the Deck's Cards, each with an
 * optional `reviewSchedule`; a Card without one has no Review yet.
 */

/** One Grade as it crosses the wire. */
export interface GradeBatchEntry {
	cardId: number;
	grade: SM2Rating;
	/** The moment the Grade was answered, as an ISO 8601 string. */
	answeredAt: string;
	/**
	 * The Review schedule the Grade produced; null when none is available. The
	 * backend reads it under this name, `schedule`, not `reviewSchedule`.
	 */
	schedule: ReviewSchedulePayload | null;
}

/** A Review schedule as it crosses the wire: the shape Card responses already carry. */
export type ReviewSchedulePayload = CardReviewSchedule;

/** What the backend decided about one Grade, in request order. */
export interface GradeBatchResult {
	accepted: boolean;
	error?: string;
}

/** The one route that carries Grades: a batch, online with a batch of one. */
export interface GradePushEndpoint {
	pushGrades(grades: readonly GradeBatchEntry[]): Promise<readonly GradeBatchResult[]>;
}

/** Everything Sync needs from the backend. Injected so tests avoid the network. */
export interface SyncEndpoint extends GradePushEndpoint {
	/** The Library: every Deck the learner may study, fetched fresh. */
	pullLibrary(): Promise<Deck[]>;
	/** One Downloaded Deck's Cards and their Review schedules, fetched fresh. */
	pullDeck(deckId: number): Promise<DownloadedDeck>;
}

/** What one push did with the Grades it was given. */
export interface GradePushOutcome {
	/** Grades the backend accepted and that are now gone from the device. */
	accepted: number;
	/** Grades the backend refused and that are parked for a later Sync. */
	parked: number;
	/** Grades still waiting in the active queue. */
	remaining: number;
}

/** Turns a Review schedule into its wire form, or null. */
export function toSchedulePayload(schedule: ReviewSchedule | null): ReviewSchedulePayload | null {
	if (!schedule) return null;
	return {
		interval: schedule.interval,
		efactor: schedule.efactor,
		repetitions: schedule.repetitions,
		nextReviewAt: schedule.nextReviewAt.toISOString()
	};
}
