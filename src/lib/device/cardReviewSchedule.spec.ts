import { describe, expect, it } from 'vitest';
import type { Card } from '$lib/types';
import { reviewScheduleOf } from './cardReviewSchedule';

/** A Card as the backend serves it, optionally carrying a Review schedule. */
const card = (reviewSchedule: Card['reviewSchedule'] = null): Card => ({
	id: 7,
	deckId: 10,
	koreanWord: '나무',
	englishWord: 'tree',
	context: 'noun',
	example: '나무가 커요.',
	reviewSchedule
});

describe('reviewScheduleOf', () => {
	it('reads the Review schedule a Card response carries into the device schedule', () => {
		// The backend serves the next Due moment as RFC 3339 and the rest of the
		// schedule as the numbers the device computes.
		expect(
			reviewScheduleOf(
				card({
					interval: 6,
					efactor: 2.5,
					repetitions: 2,
					nextReviewAt: '2026-10-23T00:00:00Z'
				})
			)
		).toEqual({
			interval: 6,
			efactor: 2.5,
			repetitions: 2,
			nextReviewAt: new Date('2026-10-23T00:00:00Z')
		});
	});

	it('gives a New Card no Review schedule', () => {
		expect(reviewScheduleOf(card(null))).toBeNull();
		expect(reviewScheduleOf(card(undefined))).toBeNull();
	});

	it('refuses a schedule whose next Due moment is not a moment', () => {
		expect(
			reviewScheduleOf(
				card({
					interval: 1,
					efactor: 2.5,
					repetitions: 1,
					nextReviewAt: 'not a time'
				})
			)
		).toBeNull();
	});
});
