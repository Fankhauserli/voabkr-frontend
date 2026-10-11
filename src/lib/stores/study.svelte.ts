import type { Card, SM2Rating, StudySessionSummary, StudyDirection } from '$lib/types';
import { reviewApi } from '$lib/api/reviews';
import { authApi } from '$lib/api/auth';
import { auth } from './auth.svelte';
import { reviewSync } from './syncQueue.svelte';
import { hapticFeedback } from '$lib/utils/haptics';
import { SvelteDate, SvelteSet, SvelteMap } from 'svelte/reactivity';

/**
 * Intelligent spaced repetition study session store using Svelte 5 runes.
 * Implements Anki/SuperMemo-style in-session relearning queues:
 * - Cards rated "Again" (< 1 min) are immediately scheduled ~3 cards later.
 * - Cards rated "Hard" (< 6 min) while in relearning are scheduled ~6 cards later.
 * - Study sessions are divided into focused, manageable batches (default 20 cards)
 *   so learners never have to wade through 1000 cards before seeing a missed card again.
 */
function getStoredValue(key: string): string | null {
	try {
		if (typeof window !== 'undefined' && typeof window.localStorage?.getItem === 'function') {
			return window.localStorage.getItem(key);
		}
	} catch {
		// Ignore storage errors in non-browser environments
	}
	return null;
}

function setStoredValue(key: string, value: string): void {
	try {
		if (typeof window !== 'undefined' && typeof window.localStorage?.setItem === 'function') {
			window.localStorage.setItem(key, value);
		}
	} catch {
		// Ignore storage errors in non-browser environments
	}
}

class StudySessionStore {
	/** Active queue of cards to review in the current batch (includes relearning repetitions) */
	cards = $state<Card[]>([]);

	/** Pointer to the current card in this.cards */
	currentIndex = $state<number>(0);

	/** Whether card answer is revealed */
	isFlipped = $state<boolean>(false);

	/** Loading indicator for queue fetching */
	isLoading = $state<boolean>(false);

	/** Error message if loading failed */
	error = $state<string | null>(null);

	/** Full history of ratings submitted in this session (including retries) */
	ratingsRecorded = $state<{ cardId: number; ease: SM2Rating }[]>([]);

	/** First attempt rating per card in this session (used to compute authentic retention rate) */
	firstAttemptRatings = $state<Map<number, SM2Rating>>(new SvelteMap());

	/** Set of card IDs currently in active relearning */
	relearningCardIds = $state<Set<number>>(new SvelteSet());

	/** Set of distinct initial card IDs in this batch */
	initialBatchCardIds = $state<Set<number>>(new SvelteSet());

	/** Total number of relearning repetitions executed */
	relearningRepeats = $state<number>(0);

	/** Summary of completed session */
	lastSessionSummary = $state<StudySessionSummary | null>(null);

	/** Study direction preference */
	studyDirection = $state<StudyDirection>('koreanToEnglish');

	/** Apple Pencil scratch pad toggle */
	scratchPadEnabled = $state<boolean>(false);

	/** Revision counter to clear scratch pad canvas */
	scratchPadRevision = $state<number>(0);

	/** Batch size for focused study (default 20) */
	batchSize = $state<number>(20);

	/** Remaining cards in the current deck for subsequent batches */
	remainingDeckCards = $state<Card[]>([]);

	/** Total cards count in the deck */
	totalDeckCardsCount = $state<number>(0);

	/** Current batch number in this deck session */
	batchNumber = $state<number>(1);

	/** Current deck ID (null if global due queue) */
	sessionDeckId = $state<number | null>(null);

	constructor() {
		const saved = getStoredValue('voabkr_study_direction') as StudyDirection | null;
		if (saved === 'koreanToEnglish' || saved === 'englishToKorean') {
			this.studyDirection = saved;
		}
		const savedPad = getStoredValue('voabkr_scratch_pad_enabled');
		if (savedPad !== null) {
			this.scratchPadEnabled = savedPad === 'true';
		}
	}

	// ── Runes-based Derived State ──────────────────────────────────────────

	/** Total cards in active queue */
	totalCards = $derived(this.cards.length);

	/** The active card being reviewed */
	currentCard = $derived(this.cards[this.currentIndex] ?? null);

	/** Whether the active card is a relearning repetition of a previously missed card */
	isCurrentCardRelearning = $derived(
		this.currentCard ? this.relearningCardIds.has(this.currentCard.id) : false
	);

	/** Number of distinct cards in the current batch */
	totalDistinctCards = $derived(this.initialBatchCardIds.size);

	/** Overall progress percentage in active queue */
	progressPercentage = $derived(
		this.totalCards > 0 ? Math.min(100, Math.round((this.currentIndex / this.totalCards) * 100)) : 0
	);

	/** True when all cards (including all relearning repetitions) have graduated */
	isSessionFinished = $derived(this.totalCards > 0 && this.currentIndex >= this.totalCards);

	/** True while session is in progress */
	isActive = $derived(this.totalCards > 0 && !this.isSessionFinished);

	/** True if the deck has more cards waiting for the next batch */
	hasMoreCardsInDeck = $derived(this.remainingDeckCards.length > 0);

	/** Count of cards remaining in the deck */
	remainingInDeckCount = $derived(this.remainingDeckCards.length);

	// ── Session Initialization & Smart Batching ───────────────────────────

	/**
	 * Start a review session for cards due today across all decks (or specific deck).
	 */
	async startDueSession(deckId?: number, customBatchSize?: number): Promise<boolean> {
		this.reset();
		this.isLoading = true;
		this.sessionDeckId = deckId ?? null;

		try {
			const dueCards = await reviewApi.getDueCards(deckId);
			const filtered = deckId ? dueCards.filter((c) => c.deckId === deckId) : dueCards;

			// Smart Order: Due cards prioritized by due urgency
			const sorted = [...filtered];

			const targetSize = customBatchSize || auth.cardsPerDay || 20;
			this.batchSize = targetSize;
			this.totalDeckCardsCount = sorted.length;

			// Slice first manageable batch
			const firstBatch = sorted.slice(0, targetSize);
			this.remainingDeckCards = sorted.slice(targetSize);
			this.batchNumber = 1;

			firstBatch.forEach((c) => this.initialBatchCardIds.add(c.id));
			this.cards = firstBatch;

			return firstBatch.length > 0;
		} catch (err: unknown) {
			this.error = err instanceof Error ? err.message : 'Failed to fetch due review cards';
			return false;
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Start a study session for a specific deck.
	 * Intelligently batches cards (e.g. 20 cards at a time) and orders them:
	 * 1. Due review cards first
	 * 2. Unstudied new cards second
	 */
	async startDeckSession(
		deckCards: Card[],
		deckId?: number,
		customBatchSize?: number
	): Promise<void> {
		this.reset();
		this.sessionDeckId = deckId ?? null;

		const targetSize = customBatchSize || auth.cardsPerDay || 20;
		this.batchSize = targetSize;
		this.totalDeckCardsCount = deckCards.length;

		// Smart Order:
		// 1. Cards previously reviewed (isReviewed === true) come first
		// 2. Unstudied/new cards come next
		const dueOrReviewed: Card[] = [];
		const newCards: Card[] = [];

		for (const card of deckCards) {
			if (card.isReviewed) {
				dueOrReviewed.push(card);
			} else {
				newCards.push(card);
			}
		}

		const smartOrdered = [...dueOrReviewed, ...newCards];

		// Take first batch (e.g. 20 cards)
		const firstBatch = smartOrdered.slice(0, targetSize);
		this.remainingDeckCards = smartOrdered.slice(targetSize);
		this.batchNumber = 1;

		firstBatch.forEach((c) => this.initialBatchCardIds.add(c.id));
		this.cards = firstBatch;
	}

	/**
	 * Continue studying the next batch of cards from the same deck.
	 */
	startNextBatch(): boolean {
		if (this.remainingDeckCards.length === 0) return false;

		const nextBatch = this.remainingDeckCards.slice(0, this.batchSize);
		this.remainingDeckCards = this.remainingDeckCards.slice(this.batchSize);
		this.batchNumber += 1;

		this.cards = nextBatch;
		this.currentIndex = 0;
		this.isFlipped = false;
		this.ratingsRecorded = [];
		this.firstAttemptRatings.clear();
		this.relearningCardIds.clear();
		this.initialBatchCardIds.clear();
		this.relearningRepeats = 0;
		this.lastSessionSummary = null;
		this.clearScratchPad();

		nextBatch.forEach((c) => this.initialBatchCardIds.add(c.id));
		return true;
	}

	// ── Card Interaction & SM-2 Relearning Loop ────────────────────────────

	flipCard(): void {
		this.isFlipped = !this.isFlipped;
		hapticFeedback.cardFlip();
	}

	/**
	 * Rate the active card with Anki 4-button ease (1=Again, 2=Hard, 3=Good, 4=Easy).
	 * Implements immediate in-session re-queueing:
	 * - "Again" (1): Re-inserts ~3 cards later.
	 * - "Hard" (2): Re-inserts ~6 cards later if in relearning or new.
	 * - "Good" (3) / "Easy" (4): Graduates from active relearning.
	 */
	async rateCurrentCard(ease: SM2Rating): Promise<void> {
		if (!this.currentCard) return;

		const card = this.currentCard;
		const cardId = card.id;
		hapticFeedback.sm2Rating(ease);

		// Record first attempt rating for accurate retention metrics
		if (!this.firstAttemptRatings.has(cardId)) {
			this.firstAttemptRatings.set(cardId, ease);
		}
		this.ratingsRecorded.push({ cardId, ease });

		// Optimistic submission via sync queue to backend
		reviewSync.addReview(cardId, ease);

		// ── SMART IN-SESSION SPACING ──
		if (ease === 1) {
			// Ease 1 = "Again" (< 1 min)
			// The user forgot this card. It MUST be repeated in this session!
			// Insert 3 cards later (e.g. if current is 0, insert at 4).
			// If fewer than 3 cards remain, append at the end so it comes right back.
			this.relearningCardIds.add(cardId);
			this.relearningRepeats += 1;

			const reinsertOffset = 3;
			const targetIndex = Math.min(this.currentIndex + 1 + reinsertOffset, this.cards.length);
			this.cards.splice(targetIndex, 0, card);
		} else if (ease === 2) {
			// Ease 2 = "Hard" (< 6 min)
			// If currently in relearning, reinforce it ~6 cards later before completing.
			if (this.relearningCardIds.has(cardId)) {
				this.relearningRepeats += 1;
				const reinsertOffset = 6;
				const targetIndex = Math.min(this.currentIndex + 1 + reinsertOffset, this.cards.length);
				this.cards.splice(targetIndex, 0, card);
			}
		} else {
			// Ease 3 ("Good") or 4 ("Easy")
			// The user recalled it correctly! Card graduates from relearning in this session.
			this.relearningCardIds.delete(cardId);
		}

		// Advance to next card
		this.isFlipped = false;
		this.currentIndex += 1;
		this.clearScratchPad();

		// Check if entire batch is complete
		if (this.currentIndex >= this.totalCards) {
			this.computeSessionSummary();
		}
	}

	// ── Session Metrics & Summary ──────────────────────────────────────────

	private computeSessionSummary(): void {
		const totalAttempts = this.ratingsRecorded.length;
		const ratingsCount: Record<SM2Rating, number> = {
			0: 0,
			1: 0,
			2: 0,
			3: 0,
			4: 0,
			5: 0
		};

		for (const r of this.ratingsRecorded) {
			ratingsCount[r.ease] += 1;
		}

		// Retention rate is based on first attempt pass rate (Anki standard: ease >= 3 on first try)
		let firstTryPass = 0;
		for (const [, ease] of this.firstAttemptRatings.entries()) {
			if (ease >= 3) {
				firstTryPass += 1;
			}
		}

		const distinctTotal = this.firstAttemptRatings.size || 1;
		const retentionRate = Math.round((firstTryPass / distinctTotal) * 100);

		this.lastSessionSummary = {
			totalReviewed: totalAttempts,
			retentionRate,
			ratingsCount,
			streakDays: 7,
			completedAt: new SvelteDate().toISOString(),
			distinctCardsCount: this.totalDistinctCards,
			relearningRepeats: this.relearningRepeats,
			remainingInDeck: this.remainingDeckCards.length,
			batchNumber: this.batchNumber
		};
	}

	// ── Helpers & Settings ─────────────────────────────────────────────────

	toggleStudyDirection(syncBackend = true): void {
		this.studyDirection =
			this.studyDirection === 'koreanToEnglish' ? 'englishToKorean' : 'koreanToEnglish';
		setStoredValue('voabkr_study_direction', this.studyDirection);
		if (syncBackend) {
			authApi.updateSettings({ studyDirection: this.studyDirection }).catch(() => {});
		}
	}

	setStudyDirection(direction: StudyDirection, syncBackend = false): void {
		this.studyDirection = direction;
		setStoredValue('voabkr_study_direction', direction);
		if (syncBackend) {
			authApi.updateSettings({ studyDirection: direction }).catch(() => {});
		}
	}

	toggleScratchPad(syncBackend = true): void {
		this.setScratchPadEnabled(!this.scratchPadEnabled, syncBackend);
	}

	setScratchPadEnabled(enabled: boolean, syncBackend = false): void {
		this.scratchPadEnabled = enabled;
		setStoredValue('voabkr_scratch_pad_enabled', String(enabled));
		if (syncBackend) {
			authApi.updateSettings({ scratchPadEnabled: enabled }).catch(() => {});
		}
	}

	clearScratchPad(): void {
		this.scratchPadRevision += 1;
	}

	reset(): void {
		this.cards = [];
		this.currentIndex = 0;
		this.isFlipped = false;
		this.isLoading = false;
		this.error = null;
		this.ratingsRecorded = [];
		this.firstAttemptRatings.clear();
		this.relearningCardIds.clear();
		this.initialBatchCardIds.clear();
		this.relearningRepeats = 0;
		this.remainingDeckCards = [];
		this.totalDeckCardsCount = 0;
		this.batchNumber = 1;
		this.sessionDeckId = null;
		this.lastSessionSummary = null;
		this.clearScratchPad();
	}
}

export const studySession = new StudySessionStore();
export { StudySessionStore };
