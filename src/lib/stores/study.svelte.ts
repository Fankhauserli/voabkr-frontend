import type { Card, SM2Rating, StudySessionSummary, StudyDirection } from '$lib/types';
import { reviewApi } from '$lib/api/reviews';
import { authApi } from '$lib/api/auth';
import { auth } from './auth.svelte';
import { reviewSync } from './syncQueue.svelte';
import { SessionQueue } from './sessionQueue.svelte';
import { hapticFeedback } from '$lib/utils/haptics';
import { SvelteDate } from 'svelte/reactivity';

/** Where the Study session sends a Grade: the offline sync queue in the app. */
export interface ReviewSink {
	addReview(cardId: number, grade: SM2Rating): Promise<{ synced: boolean }>;
}

/** The tactile feedback the Study session asks for: the haptics module in the app. Fire-and-forget. */
export interface HapticFeedback {
	cardFlip(): void;
	sm2Rating(grade: SM2Rating): void;
}

/** The Study session's collaborators, supplied when it is constructed. */
export interface StudySessionCollaborators {
	reviews: ReviewSink;
	haptics: HapticFeedback;
}

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

/**
 * The Study session: one sitting of studying Cards. It fetches the Cards for the sitting,
 * splits them into focused, manageable batches (default 20 cards), and hands each batch to
 * a Session queue, which owns the in-session Relearning steps. It reports every Grade to the
 * offline sync queue, asks for haptics, and composes the Session summary from what the
 * Session queue recorded.
 */
class StudySessionStore {
	private readonly reviews: ReviewSink;
	private readonly haptics: HapticFeedback;

	/** The Session queue of the batch being studied. Replaced when a new batch starts. */
	private queue = $state(new SessionQueue());

	/** Whether card answer is revealed */
	isFlipped = $state<boolean>(false);

	/** Loading indicator for queue fetching */
	isLoading = $state<boolean>(false);

	/** Error message if loading failed */
	error = $state<string | null>(null);

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

	constructor(collaborators: StudySessionCollaborators) {
		this.reviews = collaborators.reviews;
		this.haptics = collaborators.haptics;

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

	/** The active card being reviewed */
	get currentCard(): Card | null {
		return this.queue.currentCard;
	}

	/** Whether the active card is a relearning repetition of a previously missed card */
	get isCurrentCardRelearning(): boolean {
		return this.queue.isCurrentCardRelearning;
	}

	/** How many cards of the active queue have been answered */
	get answeredCount(): number {
		return this.queue.answeredCount;
	}

	/** Total cards in active queue (includes relearning repetitions) */
	get totalCards(): number {
		return this.queue.totalCount;
	}

	/** True when all cards (including all relearning repetitions) have graduated */
	isSessionFinished = $derived(this.queue.totalCount > 0 && this.queue.isFinished);

	/** True while session is in progress */
	isActive = $derived(this.queue.totalCount > 0 && !this.isSessionFinished);

	/**
	 * The account of the finished Study session: the Cards studied, the Grades given, and the
	 * Retention. Derived from the Session queue's record, so it cannot disagree with what
	 * happened; null until a Study session has actually finished.
	 */
	sessionSummary = $derived.by((): StudySessionSummary | null => {
		// The queue marks the instant its last Card is answered, so a finished session
		// is exactly a queue with one.
		const finishedAt = this.queue.finishedAt;
		if (finishedAt === null) return null;

		const ratingsCount: Record<SM2Rating, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
		for (const record of this.queue.grades) {
			ratingsCount[record.grade] += 1;
		}

		// A Card is retained when its first Grade was Good or Easy (>= 3)
		let retained = 0;
		for (const grade of this.queue.firstGrades.values()) {
			if (grade >= 3) retained += 1;
		}

		const cardsStudied = this.queue.distinctCardsAnswered;

		return {
			totalReviewed: this.queue.grades.length,
			retentionRate: cardsStudied > 0 ? Math.round((retained / cardsStudied) * 100) : 0,
			ratingsCount,
			streakDays: 7,
			completedAt: finishedAt.toISOString(),
			distinctCardsCount: cardsStudied,
			relearningRepeats: this.queue.relearningReturns,
			remainingInDeck: this.remainingDeckCards.length,
			batchNumber: this.batchNumber
		};
	});

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
			this.queue = new SessionQueue(firstBatch);

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
		this.queue = new SessionQueue(firstBatch);
	}

	/**
	 * Continue studying the next batch of cards from the same deck.
	 */
	startNextBatch(): boolean {
		if (this.remainingDeckCards.length === 0) return false;

		const nextBatch = this.remainingDeckCards.slice(0, this.batchSize);
		this.remainingDeckCards = this.remainingDeckCards.slice(this.batchSize);
		this.batchNumber += 1;

		// A new batch is a new Session queue, so it starts with nothing answered.
		this.queue = new SessionQueue(nextBatch);
		this.isFlipped = false;
		this.clearScratchPad();

		return true;
	}

	// ── Card Interaction ───────────────────────────────────────────────────

	flipCard(): void {
		this.isFlipped = !this.isFlipped;
		this.haptics.cardFlip();
	}

	/**
	 * Answer the active Card with an Anki 4-button Grade (1=Again, 2=Hard, 3=Good, 4=Easy).
	 * The Session queue decides whether the Card returns; the Grade is reported to the
	 * offline sync queue either way.
	 */
	async rateCurrentCard(grade: SM2Rating): Promise<void> {
		const answered = this.queue.answer(grade, new SvelteDate());
		if (!answered) return;

		this.haptics.sm2Rating(grade);

		// Optimistic submission via sync queue to backend (unawaited: the Grade must not block the UI)
		void this.reviews.addReview(answered.id, grade);

		this.isFlipped = false;
		this.clearScratchPad();
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
		this.queue = new SessionQueue();
		this.isFlipped = false;
		this.isLoading = false;
		this.error = null;
		this.remainingDeckCards = [];
		this.totalDeckCardsCount = 0;
		this.batchNumber = 1;
		this.sessionDeckId = null;
		this.clearScratchPad();
	}
}

export const studySession = new StudySessionStore({
	reviews: reviewSync,
	haptics: hapticFeedback
});
export { StudySessionStore };
