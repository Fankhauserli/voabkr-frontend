import type { ReviewSchedule } from '$lib/scheduling/reviewSchedule';
import type { Card } from '$lib/types';

/**
 * How a Study session's queue is assembled on the device.
 *
 * The rule: Due Cards first, the Card owed longest first; then New Cards in
 * Deck order, bounded by the Day's Daily goal. The Daily goal bounds nothing
 * else — every Due Card is always offered — and it does not bank, so a Day
 * offers its allowance and no more.
 *
 * It is pure: no storage, no network, no DOM, and no clock of its own. The
 * Cards, their Review schedules, the moment the Study session starts, and how
 * much of the Day's allowance is already spent are all supplied by the caller.
 */

/** The hour, on the device's clock, at which a Day begins. */
export const DAY_ROLLOVER_HOUR = 4;

/** The Cards and Review schedules of one Deck held on the device. */
export interface DeckContents {
	deckId: number;
	cards: readonly Card[];
	schedules: ReadonlyMap<number, ReviewSchedule>;
}

/** What the caller knows when a Study session starts. */
export interface SessionQueueOptions {
	/** The moment the Study session starts; a Card is Due when its Review has reached it. */
	now: Date;
	/** The number of New Cards the app may bring into play in a Day. */
	dailyGoal: number;
	/** New Cards already introduced earlier in the same Day. */
	newCardsIntroducedToday?: number;
}

/** The ordered Cards a Study session offers, and the Due/New split it was built from. */
export interface SessionQueuePlan {
	/** Due Cards first, most overdue first, then New Cards in Deck order. */
	cards: Card[];
	dueCards: Card[];
	newCards: Card[];
}

/**
 * The instant the Day containing `at` began: 04:00 on the device's clock. A
 * sitting that runs past midnight therefore stays inside the Day it started in.
 */
export function startOfDay(at: Date): Date {
	const start = new Date(at.getTime());
	start.setHours(DAY_ROLLOVER_HOUR, 0, 0, 0);
	if (start.getTime() > at.getTime()) {
		// Before 04:00, the Day that began yesterday is still running.
		start.setDate(start.getDate() - 1);
	}
	return start;
}

/**
 * Assemble the Cards a Study session offers from the Decks held on the device.
 *
 * Every Due Card is offered, ordered by how long it has been owed. New Cards —
 * Cards with no Review — follow in Deck order, and only as many as the Daily
 * goal has left after the New Cards already introduced today.
 */
export function assembleSessionQueue(
	decks: readonly DeckContents[],
	options: SessionQueueOptions
): SessionQueuePlan {
	const due: { card: Card; dueAt: number }[] = [];
	const newCards: Card[] = [];

	const introducedToday = nonNegativeInteger(options.newCardsIntroducedToday ?? 0);
	const allowance = Math.max(0, nonNegativeInteger(options.dailyGoal) - introducedToday);
	const now = options.now.getTime();

	for (const deck of decks) {
		for (const card of deck.cards) {
			const schedule = deck.schedules.get(card.id);
			if (schedule) {
				if (schedule.nextReviewAt.getTime() <= now) {
					due.push({ card, dueAt: schedule.nextReviewAt.getTime() });
				}
			} else if (newCards.length < allowance) {
				newCards.push(card);
			}
		}
	}

	// A stable sort keeps Cards that were Due at the same moment in Deck order,
	// then in the order their Deck holds them.
	due.sort((a, b) => a.dueAt - b.dueAt);

	const dueCards = due.map((entry) => entry.card);
	return { cards: [...dueCards, ...newCards], dueCards, newCards };
}

/** Coerces a supplied count to a whole number no lower than zero. */
function nonNegativeInteger(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Math.floor(value));
}
