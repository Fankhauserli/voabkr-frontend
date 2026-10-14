import { describe, it, expect } from 'vitest';
import { SessionQueue } from './sessionQueue.svelte';
import type { Card } from '$lib/types';

/** Distinct Cards numbered 1..count, all from one Deck. */
const cards = (count: number): Card[] =>
	Array.from({ length: count }, (_, i) => ({
		id: i + 1,
		deckId: 10,
		koreanWord: `단어 ${i + 1}`,
		englishWord: `Word ${i + 1}`,
		context: 'noun',
		example: `예문 ${i + 1}`
	}));

/** The instant the Grades in these tests were given; the queue only uses it to stamp its finish. */
const ANSWERED_AT = new Date('2026-10-14T09:00:00Z');

describe('SessionQueue', () => {
	it('answers the Cards it holds in order, one Grade each, and finishes', () => {
		const queue = new SessionQueue(cards(3));

		expect(queue.currentCard?.id).toBe(1);
		expect(queue.isFinished).toBe(false);
		expect(queue.answeredCount).toBe(0);
		expect(queue.totalCount).toBe(3);

		queue.answer(3, ANSWERED_AT);
		expect(queue.currentCard?.id).toBe(2);
		expect(queue.answeredCount).toBe(1);

		queue.answer(3, ANSWERED_AT);
		expect(queue.currentCard?.id).toBe(3);

		queue.answer(3, ANSWERED_AT);
		expect(queue.currentCard).toBeNull();
		expect(queue.isFinished).toBe(true);
		expect(queue.answeredCount).toBe(3);

		expect(queue.grades.map((g) => [g.cardId, g.grade])).toEqual([
			[1, 3],
			[2, 3],
			[3, 3]
		]);
	});

	it('brings a Card answered Again back three Cards later', () => {
		const queue = new SessionQueue(cards(5));

		expect(queue.answer(1, ANSWERED_AT)?.id).toBe(1); // Again: Card 1 must come back
		expect(queue.currentCard?.id).toBe(2); // but not immediately

		queue.answer(3, ANSWERED_AT); // Card 2
		expect(queue.currentCard?.id).toBe(3);

		queue.answer(3, ANSWERED_AT); // Card 3
		expect(queue.currentCard?.id).toBe(4);

		queue.answer(3, ANSWERED_AT); // Card 4
		expect(queue.currentCard?.id).toBe(1);
		expect(queue.isCurrentCardRelearning).toBe(true);
		expect(queue.isFinished).toBe(false);
	});

	it('returns a Card answered Again at the end of the queue when fewer than three Cards remain', () => {
		const queue = new SessionQueue(cards(3));

		queue.answer(1, ANSWERED_AT); // Again: only Cards 2 and 3 remain, so it clamps to the end
		expect(queue.currentCard?.id).toBe(2);

		queue.answer(3, ANSWERED_AT); // Card 2
		expect(queue.currentCard?.id).toBe(3);

		queue.answer(3, ANSWERED_AT); // Card 3
		expect(queue.currentCard?.id).toBe(1);
		expect(queue.isCurrentCardRelearning).toBe(true);
	});

	it('returns a Card answered Again immediately when it was the last Card', () => {
		const queue = new SessionQueue(cards(1));

		queue.answer(1, ANSWERED_AT); // Again, with nothing left behind it

		// The Study session cannot finish while the Card is in a Relearning step.
		expect(queue.isFinished).toBe(false);
		expect(queue.currentCard?.id).toBe(1);
		expect(queue.isCurrentCardRelearning).toBe(true);
	});

	it('brings a Card answered Hard back six Cards later while it is in a Relearning step', () => {
		const queue = new SessionQueue(cards(12));

		queue.answer(1, ANSWERED_AT); // Card 1 Again, so it returns in a Relearning step
		queue.answer(3, ANSWERED_AT); // Card 2
		queue.answer(3, ANSWERED_AT); // Card 3
		queue.answer(3, ANSWERED_AT); // Card 4
		expect(queue.currentCard?.id).toBe(1);

		queue.answer(2, ANSWERED_AT); // Card 1 Hard: further out than Again, but it must return
		expect(queue.currentCard?.id).toBe(5);

		queue.answer(3, ANSWERED_AT); // Card 5
		queue.answer(3, ANSWERED_AT); // Card 6
		queue.answer(3, ANSWERED_AT); // Card 7
		queue.answer(3, ANSWERED_AT); // Card 8
		queue.answer(3, ANSWERED_AT); // Card 9
		expect(queue.currentCard?.id).toBe(10); // five Cards later: not yet

		queue.answer(3, ANSWERED_AT); // Card 10
		expect(queue.currentCard?.id).toBe(1); // six Cards later
		expect(queue.isCurrentCardRelearning).toBe(true);
	});

	it('leaves a Card answered Hard outside a Relearning step in place', () => {
		const queue = new SessionQueue(cards(4));

		queue.answer(2, ANSWERED_AT); // Card 1 Hard, never failed: one difficult recall does not restart it
		expect(queue.currentCard?.id).toBe(2);

		queue.answer(3, ANSWERED_AT); // Card 2
		queue.answer(3, ANSWERED_AT); // Card 3
		queue.answer(3, ANSWERED_AT); // Card 4

		expect(queue.isFinished).toBe(true);
		expect(queue.grades.filter((g) => g.cardId === 1)).toHaveLength(1);
	});

	it('stops bringing a Card back once it is answered Good on its return', () => {
		const queue = new SessionQueue(cards(4));

		queue.answer(1, ANSWERED_AT); // Card 1 Again
		queue.answer(3, ANSWERED_AT); // Card 2
		queue.answer(3, ANSWERED_AT); // Card 3
		queue.answer(3, ANSWERED_AT); // Card 4
		expect(queue.currentCard?.id).toBe(1);

		queue.answer(3, ANSWERED_AT); // Card 1 Good ends its Relearning step

		expect(queue.isFinished).toBe(true);
		expect(queue.grades).toHaveLength(5);
	});

	it('stops bringing a Card back once it is answered Easy on its return', () => {
		const queue = new SessionQueue(cards(4));

		queue.answer(1, ANSWERED_AT); // Card 1 Again
		queue.answer(3, ANSWERED_AT); // Card 2
		queue.answer(3, ANSWERED_AT); // Card 3
		queue.answer(3, ANSWERED_AT); // Card 4
		expect(queue.currentCard?.id).toBe(1);

		queue.answer(4, ANSWERED_AT); // Card 1 Easy ends its Relearning step

		expect(queue.isFinished).toBe(true);
		expect(queue.grades).toHaveLength(5);
	});

	it('keeps every Grade given, and the first Grade each Card was given', () => {
		const queue = new SessionQueue(cards(2));

		queue.answer(1, ANSWERED_AT); // Card 1 Again
		queue.answer(3, ANSWERED_AT); // Card 2 Good
		queue.answer(3, ANSWERED_AT); // Card 1 Good, on its return

		// A return is a Grade like any other, but only the first one counts as the attempt.
		expect(queue.grades.map((g) => g.grade)).toEqual([1, 3, 3]);
		expect([...queue.firstGrades]).toEqual([
			[1, 1],
			[2, 3]
		]);
		expect(queue.distinctCardsAnswered).toBe(2);
		expect(queue.relearningReturns).toBe(1);
	});

	it('records the instant its last Card was answered', () => {
		const started = new Date('2026-10-14T09:00:00Z');
		const finished = new Date('2026-10-14T09:05:00Z');
		const queue = new SessionQueue(cards(2));

		expect(queue.finishedAt).toBeNull();

		queue.answer(3, started);
		expect(queue.finishedAt).toBeNull(); // one Card still to answer

		queue.answer(3, finished);
		expect(queue.finishedAt).toBe(finished);
	});

	it('ignores an answer once every Card has been answered', () => {
		const queue = new SessionQueue(cards(1));
		queue.answer(3, ANSWERED_AT);

		expect(queue.answer(3, ANSWERED_AT)).toBeNull();
		expect(queue.answeredCount).toBe(1);
		expect(queue.grades).toHaveLength(1);
	});

	it('holds no Cards when constructed empty', () => {
		const queue = new SessionQueue();

		expect(queue.currentCard).toBeNull();
		expect(queue.isFinished).toBe(true);
		expect(queue.totalCount).toBe(0);
	});
});
