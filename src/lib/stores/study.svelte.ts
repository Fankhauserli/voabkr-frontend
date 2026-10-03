import type { Card, SM2Rating, StudySessionSummary } from '$lib/types';
import { reviewApi } from '$lib/api/reviews';
import { reviewSync } from './syncQueue.svelte';
import { hapticFeedback } from '$lib/utils/haptics';
import { SvelteDate } from 'svelte/reactivity';

class StudySessionStore {
	cards = $state<Card[]>([]);
	currentIndex = $state<number>(0);
	isFlipped = $state<boolean>(false);
	isLoading = $state<boolean>(false);
	error = $state<string | null>(null);
	ratingsRecorded = $state<{ cardId: number; ease: SM2Rating }[]>([]);
	lastSessionSummary = $state<StudySessionSummary | null>(null);

	// Derived state runes
	totalCards = $derived(this.cards.length);
	currentCard = $derived(this.cards[this.currentIndex] ?? null);
	progressPercentage = $derived(
		this.totalCards > 0 ? Math.round((this.currentIndex / this.totalCards) * 100) : 0
	);
	isSessionFinished = $derived(this.totalCards > 0 && this.currentIndex >= this.totalCards);
	isActive = $derived(this.totalCards > 0 && !this.isSessionFinished);

	async startDueSession(): Promise<boolean> {
		this.reset();
		this.isLoading = true;
		try {
			const dueCards = await reviewApi.getDueCards();
			this.cards = dueCards;
			return dueCards.length > 0;
		} catch (err: unknown) {
			this.error = err instanceof Error ? err.message : 'Failed to fetch due review cards';
			return false;
		} finally {
			this.isLoading = false;
		}
	}

	async startDeckSession(deckCards: Card[]): Promise<void> {
		this.reset();
		this.cards = deckCards;
	}

	flipCard(): void {
		this.isFlipped = !this.isFlipped;
		hapticFeedback.cardFlip();
	}

	async rateCurrentCard(ease: SM2Rating): Promise<void> {
		if (!this.currentCard) return;

		const cardId = this.currentCard.id;
		hapticFeedback.sm2Rating(ease);

		this.ratingsRecorded.push({ cardId, ease });

		// Optimistic submission via sync queue
		reviewSync.addReview(cardId, ease);

		// Advance immediately without waiting for network roundtrip
		this.isFlipped = false;
		this.currentIndex += 1;

		if (this.currentIndex >= this.totalCards) {
			this.computeSessionSummary();
		}
	}

	private computeSessionSummary(): void {
		const total = this.ratingsRecorded.length;
		const ratingsCount: Record<SM2Rating, number> = {
			0: 0,
			1: 0,
			2: 0,
			3: 0,
			4: 0,
			5: 0
		};

		let passingCount = 0;
		for (const r of this.ratingsRecorded) {
			ratingsCount[r.ease] += 1;
			if (r.ease >= 3) {
				passingCount += 1;
			}
		}

		const retentionRate = total > 0 ? Math.round((passingCount / total) * 100) : 100;

		this.lastSessionSummary = {
			totalReviewed: total,
			retentionRate,
			ratingsCount,
			streakDays: 7, // Default/current streak
			completedAt: new SvelteDate().toISOString()
		};
	}

	reset(): void {
		this.cards = [];
		this.currentIndex = 0;
		this.isFlipped = false;
		this.isLoading = false;
		this.error = null;
		this.ratingsRecorded = [];
	}
}

export const studySession = new StudySessionStore();
export { StudySessionStore };
