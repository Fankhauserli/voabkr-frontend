import type { Card, SM2Rating, StudySessionSummary, StudyDirection } from '$lib/types';
import { reviewApi } from '$lib/api/reviews';
import { authApi } from '$lib/api/auth';
import { reviewSync } from './syncQueue.svelte';
import { hapticFeedback } from '$lib/utils/haptics';
import { SvelteDate, SvelteSet } from 'svelte/reactivity';
class StudySessionStore {
	cards = $state<Card[]>([]);
	currentIndex = $state<number>(0);
	isFlipped = $state<boolean>(false);
	isLoading = $state<boolean>(false);
	error = $state<string | null>(null);
	ratingsRecorded = $state<{ cardId: number; ease: SM2Rating }[]>([]);
	lastSessionSummary = $state<StudySessionSummary | null>(null);
	studyDirection = $state<StudyDirection>('koreanToEnglish');
	scratchPadEnabled = $state<boolean>(false);
	scratchPadRevision = $state<number>(0);

	constructor() {
		if (typeof localStorage !== 'undefined') {
			const saved = localStorage.getItem('voabkr_study_direction') as StudyDirection | null;
			if (saved === 'koreanToEnglish' || saved === 'englishToKorean') {
				this.studyDirection = saved;
			}
			const savedPad = localStorage.getItem('voabkr_scratch_pad_enabled');
			if (savedPad !== null) {
				this.scratchPadEnabled = savedPad === 'true';
			}
		}
	}

	toggleStudyDirection(syncBackend = true): void {
		this.studyDirection =
			this.studyDirection === 'koreanToEnglish' ? 'englishToKorean' : 'koreanToEnglish';
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('voabkr_study_direction', this.studyDirection);
		}
		if (syncBackend) {
			authApi.updateSettings({ studyDirection: this.studyDirection }).catch(() => {});
		}
	}

	setStudyDirection(direction: StudyDirection, syncBackend = false): void {
		this.studyDirection = direction;
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('voabkr_study_direction', direction);
		}
		if (syncBackend) {
			authApi.updateSettings({ studyDirection: direction }).catch(() => {});
		}
	}

	toggleScratchPad(syncBackend = true): void {
		this.setScratchPadEnabled(!this.scratchPadEnabled, syncBackend);
	}

	setScratchPadEnabled(enabled: boolean, syncBackend = false): void {
		this.scratchPadEnabled = enabled;
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('voabkr_scratch_pad_enabled', String(enabled));
		}
		if (syncBackend) {
			authApi.updateSettings({ scratchPadEnabled: enabled }).catch(() => {});
		}
	}

	clearScratchPad(): void {
		this.scratchPadRevision += 1;
	}

	/** ISO timestamp recorded when the session started. Used for /since polling. */
	private sessionStartedAt = $state<string | null>(null);

	/** IDs already seen/queued in this session (prevents double-adding). */
	private seenCardIds = $state<Set<number>>(new SvelteSet());

	/** Whether this is a deck-scoped session (null = global due queue). */
	private sessionDeckId = $state<number | null>(null);

	// Derived state runes
	totalCards = $derived(this.cards.length);
	currentCard = $derived(this.cards[this.currentIndex] ?? null);
	progressPercentage = $derived(
		this.totalCards > 0 ? Math.round((this.currentIndex / this.totalCards) * 100) : 0
	);
	isSessionFinished = $derived(this.totalCards > 0 && this.currentIndex >= this.totalCards);
	isActive = $derived(this.totalCards > 0 && !this.isSessionFinished);

	async startDueSession(deckId?: number): Promise<boolean> {
		this.reset();
		this.isLoading = true;
		this.sessionDeckId = deckId ?? null;
		try {
			const dueCards = await reviewApi.getDueCards(deckId);
			this.sessionStartedAt = new SvelteDate().toISOString();
			const filtered = deckId ? dueCards.filter((c) => c.deckId === deckId) : dueCards;
			filtered.forEach((c) => this.seenCardIds.add(c.id));
			this.cards = filtered;
			return filtered.length > 0;
		} catch (err: unknown) {
			this.error = err instanceof Error ? err.message : 'Failed to fetch due review cards';
			return false;
		} finally {
			this.isLoading = false;
		}
	}

	/** Used by /study/[deckId] which pre-fetches cards in a deck. */
	async startDeckSession(deckCards: Card[], deckId?: number): Promise<void> {
		this.reset();
		this.sessionDeckId = deckId ?? null;
		this.sessionStartedAt = new SvelteDate().toISOString();
		const filtered = deckId ? deckCards.filter((c) => c.deckId === deckId) : deckCards;
		filtered.forEach((c) => this.seenCardIds.add(c.id));
		this.cards = filtered;
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
		this.clearScratchPad();

		// After advancing, check if cards rated "Again" (ease 1) or "Hard" (ease 2)
		// have come back due — Anki re-queues them in the same session.
		// We poll /reviews/since/<sessionStart> to catch cards now due again.
		await this.pollForRequeued();

		if (this.currentIndex >= this.totalCards) {
			this.computeSessionSummary();
		}
	}

	/**
	 * Poll the backend for cards that became due after the session started
	 * (i.e. cards rated "Again" that the backend scheduled 1–10 minutes out).
	 * Appends any cards due again that aren't already pending in the upcoming queue.
	 */
	private async pollForRequeued(): Promise<void> {
		if (!this.sessionStartedAt) return;
		try {
			const fresh = await reviewApi.getCardsSince(
				this.sessionStartedAt,
				this.sessionDeckId ?? undefined
			);
			for (const card of fresh.slice().reverse()) {
				if (this.sessionDeckId !== null && card.deckId !== this.sessionDeckId) {
					continue;
				}
				const isAlreadyPending = this.cards.slice(this.currentIndex).some((c) => c.id === card.id);
				if (!isAlreadyPending) {
					// Append the card to the next position in the queue if it's not already pending
					this.cards = [
						...this.cards.slice(0, this.currentIndex + 1),
						card,
						...this.cards.slice(this.currentIndex + 2)
					];
					console.log(`Card ${card.id} re-queued and added to session queue`);
					console.log(`Current queue: ${this.cards.slice(this.currentIndex + 1, this.currentIndex + 6).map((c) => c.englishWord).join(', ')}`);
				}
			}
		} catch {
			// Silent – polling is best-effort; session should not break on error
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
		this.sessionStartedAt = null;
		this.seenCardIds = new SvelteSet();
		this.sessionDeckId = null;
		this.clearScratchPad();
	}
}

export const studySession = new StudySessionStore();
export { StudySessionStore };
