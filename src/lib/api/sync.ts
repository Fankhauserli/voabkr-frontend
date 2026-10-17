import { apiFetch } from './client';
import { cardApi } from './cards';
import { deckApi } from './decks';
import type { Card } from '$lib/types';
import type { DownloadedDeck } from '$lib/device/deviceStore';
import { reviewScheduleOf } from '$lib/device/cardReviewSchedule';
import type { ReviewSchedule } from '$lib/scheduling/reviewSchedule';
import { type GradeBatchResult, type SyncEndpoint } from '$lib/sync/contract';

/**
 * The HTTP implementation of the Sync contract. The shapes are documented in
 * `$lib/sync/contract` and are a proposed backend change: the batch Grade route
 * and the Review schedule on Card responses do not exist in this repository.
 * Pulls bypass the client cache because a pull exists to replace stale local
 * state with what the backend holds now; taking the Library and each Deck's
 * Cards through their API clients also replaces the copies the app reads.
 */

/** The batch route's answer, as documented in `$lib/sync/contract`. */
type GradeBatchResponse = { results: GradeBatchResult[] };

export const syncApi: SyncEndpoint = {
	async pushGrades(grades) {
		const body = await apiFetch<GradeBatchResponse>('/reviews/batch', {
			method: 'POST',
			body: JSON.stringify({ grades })
		});
		return body.results;
	},

	pullLibrary: () => deckApi.getDecks({ bypassCache: true }),

	async pullDeck(deckId: number): Promise<DownloadedDeck> {
		const cards = await cardApi.getCards(deckId, { bypassCache: true });

		const schedules = new Map<number, ReviewSchedule>();
		const plainCards: Card[] = [];
		for (const card of cards) {
			// The device stores a Card and its schedule separately, so the pulled
			// Card keeps no second copy that could drift from the schedule.
			const plain = { ...card };
			delete plain.reviewSchedule;
			plainCards.push(plain);

			const schedule = reviewScheduleOf(card);
			if (schedule) {
				schedules.set(card.id, schedule);
			}
		}

		return { cards: plainCards, schedules };
	}
};
