import { describe, it, expect, beforeEach } from 'vitest';
import { StudySessionStore } from './study.svelte';
import type { Card, SM2Rating } from '$lib/types';

describe('StudySessionStore - Batching, hand-off, and the Session summary', () => {
	let store: StudySessionStore;

	const createMockCards = (count: number): Card[] => {
		return Array.from({ length: count }, (_, i) => ({
			id: i + 1,
			deckId: 10,
			koreanWord: `단어 ${i + 1}`,
			englishWord: `Word ${i + 1}`,
			context: 'noun',
			example: `예문 ${i + 1}`
		}));
	};

	const createInMemoryReviews = () => {
		const submitted: { cardId: number; grade: SM2Rating }[] = [];
		return {
			submitted,
			async addReview(cardId: number, grade: SM2Rating) {
				submitted.push({ cardId, grade });
				return { synced: true };
			}
		};
	};

	const createNoopHaptics = () => ({ cardFlip() {}, sm2Rating() {} });

	/** Answers every remaining Card Good, returning how many Grades that took. */
	const answerGoodUntilFinished = async (session: StudySessionStore): Promise<number> => {
		let grades = 0;
		while (!session.isSessionFinished) {
			if (grades >= 100) throw new Error('Study session never finished');
			await session.rateCurrentCard(3);
			grades += 1;
		}
		return grades;
	};

	let reviews: ReturnType<typeof createInMemoryReviews>;

	beforeEach(() => {
		reviews = createInMemoryReviews();
		store = new StudySessionStore({ reviews, haptics: createNoopHaptics() });
	});

	it('finishes a Study session driven only through its injected collaborators', async () => {
		await store.startDeckSession(createMockCards(5), 10, 5);
		expect(store.isActive).toBe(true);

		await store.rateCurrentCard(1); // Card 1 -> Again, so it must come back before the session ends
		const gradesGiven = 1 + (await answerGoodUntilFinished(store));

		expect(store.isSessionFinished).toBe(true);
		expect(store.sessionSummary?.distinctCardsCount).toBe(5);
		expect(gradesGiven).toBe(6); // one Grade more than distinct Cards: the failed Card returned
		expect(reviews.submitted).toHaveLength(gradesGiven); // every Grade reached the injected sync queue
	});

	it('reports every Grade to the offline sync queue, whatever the Session queue decides', async () => {
		await store.startDeckSession(createMockCards(4), 10, 4);

		await store.rateCurrentCard(2); // Card 1 Hard, outside a Relearning step: the queue does not bring it back
		await store.rateCurrentCard(1); // Card 2 Again: the queue does bring it back
		const gradesGiven = 2 + (await answerGoodUntilFinished(store));

		expect(gradesGiven).toBe(5);
		expect(reviews.submitted.map((r) => r.cardId)).toEqual([1, 2, 3, 4, 2]);
		expect(reviews.submitted.map((r) => r.grade)).toEqual([2, 1, 3, 3, 3]);
	});

	it('marks a Card that comes back as relearning, until it is answered Good', async () => {
		await store.startDeckSession(createMockCards(4), 10, 4);

		await store.rateCurrentCard(1); // Card 1 Again: it returns three Cards later
		expect(store.isCurrentCardRelearning).toBe(false);

		await store.rateCurrentCard(3); // Card 2
		await store.rateCurrentCard(3); // Card 3
		await store.rateCurrentCard(3); // Card 4

		expect(store.currentCard?.id).toBe(1);
		expect(store.isCurrentCardRelearning).toBe(true);

		await store.rateCurrentCard(3); // Card 1 Good
		expect(store.isSessionFinished).toBe(true);
	});

	it('does not finish a Study session while a Card is in a Relearning step', async () => {
		await store.startDeckSession(createMockCards(2), 10, 2);

		await store.rateCurrentCard(3); // Card 1 Good
		await store.rateCurrentCard(1); // Card 2 Again, with nothing behind it

		expect(store.isActive).toBe(true);
		expect(store.isSessionFinished).toBe(false);
		expect(store.currentCard?.id).toBe(2);
		expect(store.isCurrentCardRelearning).toBe(true);
	});

	it('smartly batches large 1000-card decks into 20-card batches and allows continuing', async () => {
		const largeDeck = createMockCards(100);
		// Start session with batch size 20
		await store.startDeckSession(largeDeck, 10, 20);

		// Active session only contains 20 cards
		expect(store.totalCards).toBe(20);
		expect(store.remainingDeckCards.length).toBe(80);
		expect(store.hasMoreCardsInDeck).toBe(true);
		expect(store.batchNumber).toBe(1);

		// Complete batch 1
		await answerGoodUntilFinished(store);

		expect(store.isSessionFinished).toBe(true);
		expect(store.sessionSummary?.batchNumber).toBe(1);
		expect(store.sessionSummary?.remainingInDeck).toBe(80);

		// Start Next Batch
		const startedNext = store.startNextBatch();
		expect(startedNext).toBe(true);
		expect(store.batchNumber).toBe(2);
		expect(store.totalCards).toBe(20);
		expect(store.currentCard?.id).toBe(21);
		expect(store.answeredCount).toBe(0);
		expect(store.remainingDeckCards.length).toBe(60);
	});

	it('presents due/reviewed cards before new cards', async () => {
		const mixedCards: Card[] = [
			{
				id: 1,
				deckId: 1,
				koreanWord: 'A',
				englishWord: 'a',
				context: '',
				example: '',
				isReviewed: false
			},
			{
				id: 2,
				deckId: 1,
				koreanWord: 'B',
				englishWord: 'b',
				context: '',
				example: '',
				isReviewed: true
			},
			{
				id: 3,
				deckId: 1,
				koreanWord: 'C',
				englishWord: 'c',
				context: '',
				example: '',
				isReviewed: false
			},
			{
				id: 4,
				deckId: 1,
				koreanWord: 'D',
				englishWord: 'd',
				context: '',
				example: '',
				isReviewed: true
			}
		];

		await store.startDeckSession(mixedCards, 1, 10);

		// Reviewed cards (2 and 4) come first, followed by the unreviewed (1 and 3)
		const presented: number[] = [];
		for (let i = 0; i < 4; i++) {
			presented.push(store.currentCard?.id ?? 0);
			await store.rateCurrentCard(3);
		}

		expect(presented).toEqual([2, 4, 1, 3]);
	});

	it('derives the Session summary from the Session queue record, mixing first attempts and returns', async () => {
		const cards = createMockCards(4);
		await store.startDeckSession(cards, 10, 4);

		expect(store.sessionSummary).toBeNull(); // no Study session has finished yet

		// Card 1: Again — not retained
		await store.rateCurrentCard(1);
		// Card 2: Good — retained
		await store.rateCurrentCard(3);
		// Card 3: Easy — retained
		await store.rateCurrentCard(4);
		// Card 4: Again — not retained
		await store.rateCurrentCard(1);

		expect(store.sessionSummary).toBeNull(); // Cards 1 and 4 are still in Relearning steps

		// Card 1 returns from its Relearning step -> Good
		await store.rateCurrentCard(3);
		// Card 4 returns from its Relearning step -> Good
		await store.rateCurrentCard(3);

		expect(store.isSessionFinished).toBe(true);
		expect(store.sessionSummary).toMatchObject({
			// four distinct Cards studied, but six Grades given: the returns are counted separately
			distinctCardsCount: 4,
			totalReviewed: 6,
			// two Cards came back from a Relearning step
			relearningRepeats: 2,
			// only first Grades count: 2 of 4 Cards were answered correctly first time
			retentionRate: 50
		});
	});
});
