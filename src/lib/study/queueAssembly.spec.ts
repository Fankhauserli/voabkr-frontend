import { describe, expect, it } from 'vitest';
import type { Card } from '$lib/types';
import type { ReviewSchedule } from '$lib/scheduling/reviewSchedule';
import { assembleSessionQueue, startOfDay, type DeckContents } from './queueAssembly';

/** A Card belonging to a Deck. */
const card = (id: number, deckId = 10): Card => ({
	id,
	deckId,
	koreanWord: `단어 ${id}`,
	englishWord: `Word ${id}`,
	context: '',
	example: ''
});

/** A Review schedule next Due at the given moment. */
const scheduledAt = (nextReviewAt: Date): ReviewSchedule => ({
	interval: 6,
	efactor: 2.5,
	repetitions: 2,
	nextReviewAt
});

/** The Cards and Review schedules of one Deck held on the device. */
const deck = (
	deckId: number,
	cards: readonly Card[],
	schedules: ReadonlyMap<number, ReviewSchedule> = new Map()
): DeckContents => ({ deckId, cards, schedules });

/** A local wall-clock moment, so the Day boundary does not depend on the test's time zone. */
const at = (day: number, hours: number, minutes = 0): Date =>
	new Date(2026, 9, day, hours, minutes);

/** The moment the Sessions in these tests begin. */
const NOON = at(17, 12);

describe('startOfDay', () => {
	it('begins a Day at 04:00 local', () => {
		expect(startOfDay(at(17, 12))).toEqual(at(17, 4));
		expect(startOfDay(at(17, 4))).toEqual(at(17, 4));
	});

	it('keeps a sitting that runs past midnight inside one Day', () => {
		// 23:30 and 00:30 are either side of midnight, but both belong to the Day
		// that began at 04:00 on the 17th.
		expect(startOfDay(at(17, 23, 30))).toEqual(startOfDay(at(18, 0, 30)));
		expect(startOfDay(at(17, 23, 30))).toEqual(at(17, 4));
	});

	it('rolls to the next Day at 04:00 local', () => {
		expect(startOfDay(at(18, 3, 59))).toEqual(at(17, 4));
		expect(startOfDay(at(18, 4))).toEqual(at(18, 4));
	});
});

describe('assembleSessionQueue', () => {
	it('offers every Due Card, the one owed longest first', () => {
		const cards = [card(1), card(2), card(3), card(4)];
		const schedules = new Map([
			[1, scheduledAt(at(16, 9))],
			[2, scheduledAt(at(14, 9))], // most overdue
			[3, scheduledAt(at(17, 11))], // due an hour ago
			[4, scheduledAt(at(17, 13))] // not due yet
		]);

		const plan = assembleSessionQueue([deck(10, cards, schedules)], {
			now: NOON,
			dailyGoal: 20
		});

		expect(plan.dueCards.map((c) => c.id)).toEqual([2, 1, 3]);
		expect(plan.cards.map((c) => c.id)).toEqual([2, 1, 3]);
	});

	it('breaks a tie between equally overdue Cards by Deck order, then Card order', () => {
		const dueAt = at(16, 9);
		const decks = [
			deck(
				20,
				[card(5, 20), card(6, 20)],
				new Map([
					[5, scheduledAt(dueAt)],
					[6, scheduledAt(dueAt)]
				])
			),
			deck(
				10,
				[card(1, 10), card(2, 10)],
				new Map([
					[1, scheduledAt(dueAt)],
					[2, scheduledAt(dueAt)]
				])
			)
		];

		const plan = assembleSessionQueue(decks, { now: NOON, dailyGoal: 20 });

		expect(plan.cards.map((c) => c.id)).toEqual([5, 6, 1, 2]);
	});

	it('follows the Due Cards with New Cards in Deck order', () => {
		const decks = [
			deck(20, [card(21, 20), card(22, 20)]),
			deck(10, [card(11, 10), card(12, 10)], new Map([[11, scheduledAt(at(15, 9))]]))
		];

		const plan = assembleSessionQueue(decks, { now: NOON, dailyGoal: 10 });

		// Card 11 is Due; Cards 21, 22, and 12 have no Review, so they are New.
		expect(plan.cards.map((c) => c.id)).toEqual([11, 21, 22, 12]);
		expect(plan.newCards.map((c) => c.id)).toEqual([21, 22, 12]);
	});

	it('leaves a Card whose Review is not yet Due neither Due nor New', () => {
		const plan = assembleSessionQueue(
			[deck(10, [card(1)], new Map([[1, scheduledAt(at(18, 9))]]))],
			{
				now: NOON,
				dailyGoal: 20
			}
		);

		expect(plan.cards).toEqual([]);
	});

	it('always offers every Due Card but bounds New Cards by the Daily goal', () => {
		const dueCards = Array.from({ length: 5 }, (_, i) => card(i + 1));
		const newCards = Array.from({ length: 5 }, (_, i) => card(i + 10));
		const schedules = new Map(dueCards.map((c) => [c.id, scheduledAt(at(16, 9))]));

		const plan = assembleSessionQueue([deck(10, [...dueCards, ...newCards], schedules)], {
			now: NOON,
			dailyGoal: 3
		});

		expect(plan.dueCards).toHaveLength(5);
		expect(plan.newCards.map((c) => c.id)).toEqual([10, 11, 12]);
		expect(plan.cards).toHaveLength(8);
	});

	it('subtracts the New Cards already introduced in the same Day', () => {
		const newCards = Array.from({ length: 10 }, (_, i) => card(i + 1));

		const plan = assembleSessionQueue([deck(10, newCards)], {
			now: NOON,
			dailyGoal: 4,
			newCardsIntroducedToday: 3
		});

		expect(plan.newCards.map((c) => c.id)).toEqual([1]);
	});

	it("offers no New Cards once the Day's allowance is spent, but still offers Due Cards", () => {
		const schedules = new Map([[1, scheduledAt(at(16, 9))]]);

		const plan = assembleSessionQueue([deck(10, [card(1), card(2)], schedules)], {
			now: NOON,
			dailyGoal: 2,
			newCardsIntroducedToday: 2
		});

		expect(plan.newCards).toEqual([]);
		expect(plan.dueCards.map((c) => c.id)).toEqual([1]);
	});

	it('does not bank the New Cards of a Day that was not studied', () => {
		// There is no count of missed Days to accumulate: a Day offers the Daily
		// goal, no more, however long it has been since the last one.
		const newCards = Array.from({ length: 30 }, (_, i) => card(i + 1));

		const plan = assembleSessionQueue([deck(10, newCards)], {
			now: NOON,
			dailyGoal: 5,
			newCardsIntroducedToday: 0
		});

		expect(plan.newCards).toHaveLength(5);
	});

	it('treats a malformed or exhausted allowance as no New Cards rather than a negative bound', () => {
		const newCards = [card(1), card(2)];

		expect(
			assembleSessionQueue([deck(10, newCards)], {
				now: NOON,
				dailyGoal: -5,
				newCardsIntroducedToday: 0
			}).newCards
		).toEqual([]);
	});
});
