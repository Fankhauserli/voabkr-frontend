import type { Card } from '$lib/types';
import type { ReviewSchedule } from '$lib/scheduling/reviewSchedule';

/**
 * The Review schedule a Card response carries, as the device stores it.
 *
 * A New Card carries none. A moment that cannot be read is treated the same way
 * rather than storing a Review that can never come Due: the Card is still held,
 * and its schedule is fetched again by the next Sync.
 */
export function reviewScheduleOf(card: Card): ReviewSchedule | null {
	const carried = card.reviewSchedule;
	if (!carried) return null;

	const nextReviewAt = new Date(carried.nextReviewAt);
	if (Number.isNaN(nextReviewAt.getTime())) return null;

	return {
		interval: carried.interval,
		efactor: carried.efactor,
		repetitions: carried.repetitions,
		nextReviewAt
	};
}
