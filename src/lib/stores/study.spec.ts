import { describe, it, expect, beforeEach } from 'vitest';
import { StudySessionStore } from './study.svelte';
import type { Card, SM2Rating } from '$lib/types';

describe('StudySessionStore - In-Session Relearning Queue & Smart Ordering', () => {
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
		expect(store.lastSessionSummary?.distinctCardsCount).toBe(5);
		expect(gradesGiven).toBe(6); // one Grade more than distinct Cards: the failed Card returned
		expect(reviews.submitted).toHaveLength(gradesGiven); // every Grade reached the injected sync queue
	});

	it('re-inserts card ~3 cards later when rated "Again" (Ease 1)', async () => {
		const cards = createMockCards(10);
		await store.startDeckSession(cards, 10, 10);

		expect(store.totalCards).toBe(10);
		expect(store.currentCard?.id).toBe(1);

		// Rate Card 1 as "Again" (1)
		await store.rateCurrentCard(1);

		// Current card advances to Card 2
		expect(store.currentIndex).toBe(1);
		expect(store.currentCard?.id).toBe(2);

		// Card 1 was re-inserted 3 cards later (at index 4)
		// Expected queue: [Card 1, Card 2, Card 3, Card 4, Card 1, Card 5, Card 6, Card 7, Card 8, Card 9, Card 10]
		expect(store.totalCards).toBe(11);
		expect(store.cards[4].id).toBe(1);
		expect(store.relearningCardIds.has(1)).toBe(true);

		// Advance through Card 2, Card 3, Card 4
		await store.rateCurrentCard(3); // Card 2 -> Good
		await store.rateCurrentCard(3); // Card 3 -> Good
		await store.rateCurrentCard(3); // Card 4 -> Good

		// Now we should be at index 4, which is Card 1 again!
		expect(store.currentIndex).toBe(4);
		expect(store.currentCard?.id).toBe(1);
		expect(store.isCurrentCardRelearning).toBe(true);
	});

	it('graduates card when answered "Good" or "Easy" on retry', async () => {
		const cards = createMockCards(5);
		await store.startDeckSession(cards, 10, 5);

		// Card 1 -> Again (1)
		await store.rateCurrentCard(1);
		expect(store.relearningCardIds.has(1)).toBe(true);

		// Advance to Card 1 retry
		await store.rateCurrentCard(3); // Card 2 -> Good
		await store.rateCurrentCard(3); // Card 3 -> Good
		await store.rateCurrentCard(3); // Card 4 -> Good
		expect(store.currentCard?.id).toBe(1);

		// Now rate Card 1 as "Good" (3)
		await store.rateCurrentCard(3);

		// Card 1 graduates from relearning
		expect(store.relearningCardIds.has(1)).toBe(false);
		expect(store.relearningRepeats).toBe(1);
	});

	it('handles "Again" on the last remaining card by placing it at the end', async () => {
		const cards = createMockCards(2);
		await store.startDeckSession(cards, 10, 2);

		// Card 1 -> Good
		await store.rateCurrentCard(3);
		expect(store.currentCard?.id).toBe(2);

		// Card 2 -> Again (1)
		await store.rateCurrentCard(1);

		// Card 2 is re-inserted and queue has length 3
		expect(store.totalCards).toBe(3);
		expect(store.currentIndex).toBe(2);
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
		expect(store.lastSessionSummary?.batchNumber).toBe(1);
		expect(store.lastSessionSummary?.remainingInDeck).toBe(80);

		// Start Next Batch
		const startedNext = store.startNextBatch();
		expect(startedNext).toBe(true);
		expect(store.batchNumber).toBe(2);
		expect(store.totalCards).toBe(20);
		expect(store.currentCard?.id).toBe(21);
		expect(store.remainingDeckCards.length).toBe(60);
	});

	it('orders cards with due/reviewed cards first before new cards', async () => {
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

		// Reviewed cards (2 and 4) should be first, followed by unreviewed (1 and 3)
		expect(store.cards[0].id).toBe(2);
		expect(store.cards[1].id).toBe(4);
		expect(store.cards[2].id).toBe(1);
		expect(store.cards[3].id).toBe(3);
	});

	it('computes retention rate based on first attempt pass rate', async () => {
		const cards = createMockCards(4);
		await store.startDeckSession(cards, 10, 4);

		// Card 1: Again (fail first try)
		await store.rateCurrentCard(1);
		// Card 2: Good (pass first try)
		await store.rateCurrentCard(3);
		// Card 3: Easy (pass first try)
		await store.rateCurrentCard(4);
		// Card 4: Again (fail first try)
		await store.rateCurrentCard(1);

		// Retrying Card 1 -> Good
		await store.rateCurrentCard(3);
		// Retrying Card 4 -> Good
		await store.rateCurrentCard(3);

		expect(store.isSessionFinished).toBe(true);
		// 2 passed on first attempt out of 4 distinct cards = 50% retention
		expect(store.lastSessionSummary?.retentionRate).toBe(50);
		expect(store.lastSessionSummary?.distinctCardsCount).toBe(4);
		expect(store.lastSessionSummary?.relearningRepeats).toBe(2);
	});
});
