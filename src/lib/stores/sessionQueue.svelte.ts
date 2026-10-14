import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { Card, SM2Rating } from '$lib/types';

/** How many Cards later a Card answered Again returns, clamped to the end of the queue. */
const AGAIN_RETURN_DISTANCE = 3;

/** How many Cards later a Card answered Hard returns, while it is in a Relearning step. */
const HARD_RETURN_DISTANCE = 6;

/** One Grade given in a Study session, in the order the Grades were given. */
export interface GradeRecord {
	cardId: number;
	grade: SM2Rating;
}

/**
 * The Session queue: the Cards still to be answered in a Study session, in order,
 * including Cards returning from a Relearning step.
 *
 * It owns everything that decides re-entry — how far ahead a Card answered Again is
 * placed, whether a Card is in a Relearning step, when it leaves one — and the record
 * of the Grades given. It is pure: no DOM, no storage, no network.
 */
export class SessionQueue {
	/** Cards still to answer, the current Card first. */
	#pending = $state<Card[]>([]);

	/** Every Grade given, in the order given. */
	#grades = $state<GradeRecord[]>([]);

	/** Cards in a Relearning step, by Card id. */
	#relearning = $state(new SvelteSet<number>());

	/** The first Grade each Card was given, by Card id. */
	#firstGrades = $state(new SvelteMap<number, SM2Rating>());

	/** How many returns from Relearning steps have been enacted. */
	#relearningReturns = $state(0);

	/** When the last Card was answered; null until the queue is finished. */
	#finishedAt = $state<Date | null>(null);

	constructor(cards: readonly Card[] = []) {
		this.#pending = [...cards];
	}

	/** The Card to answer now; null once nothing remains. */
	get currentCard(): Card | null {
		return this.#pending[0] ?? null;
	}

	/** Whether every Card has been answered. */
	get isFinished(): boolean {
		return this.#pending.length === 0;
	}

	/** Whether the current Card is a return from a Relearning step. */
	get isCurrentCardRelearning(): boolean {
		const card = this.currentCard;
		return card !== null && this.#relearning.has(card.id);
	}

	/** How many Cards have been answered. */
	get answeredCount(): number {
		return this.#grades.length;
	}

	/** How many Cards this queue will have answered in total, returns included. */
	get totalCount(): number {
		return this.#pending.length + this.#grades.length;
	}

	/** Every Grade given, in the order given. */
	get grades(): readonly GradeRecord[] {
		return this.#grades;
	}

	/** The first Grade each Card was given, by Card id. */
	get firstGrades(): ReadonlyMap<number, SM2Rating> {
		return this.#firstGrades;
	}

	/** How many distinct Cards have been answered. */
	get distinctCardsAnswered(): number {
		return this.#firstGrades.size;
	}

	/** How many returns from Relearning steps have been enacted. */
	get relearningReturns(): number {
		return this.#relearningReturns;
	}

	/** When the last Card was answered; null while any Card is still to answer. */
	get finishedAt(): Date | null {
		return this.#finishedAt;
	}

	/**
	 * Answer the current Card with a Grade, and return the Card it was for.
	 * `answeredAt` is the instant the Grade was given, supplied by the caller: the queue
	 * never reads a clock.
	 */
	answer(grade: SM2Rating, answeredAt: Date): Card | null {
		const card = this.#pending.shift() ?? null;
		if (!card) return null;

		this.#grades.push({ cardId: card.id, grade });
		if (!this.#firstGrades.has(card.id)) {
			this.#firstGrades.set(card.id, grade);
		}

		if (grade === 1) {
			// Again: the Card must come back before the Study session ends.
			this.#relearning.add(card.id);
			this.#reenter(card, AGAIN_RETURN_DISTANCE);
		} else if (grade === 2) {
			// Hard: one difficult recall only reinforces a Card already in a Relearning step.
			if (this.#relearning.has(card.id)) {
				this.#reenter(card, HARD_RETURN_DISTANCE);
			}
		} else {
			// Good and Easy end the Card's Relearning step.
			this.#relearning.delete(card.id);
		}

		if (this.#pending.length === 0) {
			this.#finishedAt = answeredAt;
		}

		return card;
	}

	/** Place an answered Card back in the queue a few Cards later, clamped to the end. */
	#reenter(card: Card, cardsLater: number): void {
		this.#relearningReturns += 1;
		this.#pending.splice(Math.min(cardsLater, this.#pending.length), 0, card);
	}
}
