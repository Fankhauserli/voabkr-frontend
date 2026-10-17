import type { Card, SM2Rating, StudySessionSummary, StudyDirection } from '$lib/types';
import {
	newCardSchedule,
	nextReviewSchedule,
	type ReviewSchedule
} from '$lib/scheduling/reviewSchedule';
import { authApi } from '$lib/api/auth';
import { preferences } from './preferences.svelte';
import { reviewSync, type AddReviewResult } from './syncQueue.svelte';
import { SessionQueue } from './sessionQueue.svelte';
import { assembleSessionQueue, startOfDay, type DeckContents } from '$lib/study/queueAssembly';
import { deviceStudySource, type StudyDeviceSource } from '$lib/study/deviceSource';
import { hapticFeedback } from '$lib/utils/haptics';
import { SvelteDate, SvelteMap, SvelteSet } from 'svelte/reactivity';
import { appSync } from '$lib/sync/sync';

/** How many Cards one Batch offers. It is the app's own number, not the Daily goal. */
export const BATCH_SIZE = 20;

/** Where the Study session sends a Grade: the offline sync queue in the app. */
export interface ReviewSink {
	addReview(
		cardId: number,
		grade: SM2Rating,
		answeredAt: Date,
		schedule: ReviewSchedule
	): Promise<AddReviewResult>;
}

/** A Sync the Study session asks for when a sitting ends. Fire-and-forget. */
export interface SyncTrigger {
	sync(): Promise<unknown>;
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
	/** Where the Cards and Review schedules are read; the device store in the app. */
	device: StudyDeviceSource;
	/** The Day's Daily goal, read when a Study session starts. */
	dailyGoal?: () => number;
	/** The clock the Study session reads. */
	now?: () => Date;
	/** Sync, asked for once a Study session ends. */
	sync?: SyncTrigger;
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

/** Every Card's Review schedule, gathered from the held Decks. */
function schedulesOf(decks: readonly DeckContents[]): SvelteMap<number, ReviewSchedule> {
	const schedules = new SvelteMap<number, ReviewSchedule>();
	for (const deck of decks) {
		for (const [cardId, schedule] of deck.schedules) {
			schedules.set(cardId, schedule);
		}
	}
	return schedules;
}

/**
 * The Study session: one sitting of studying Cards. It assembles the sitting's
 * queue from the Cards and Review schedules held on the device — Due Cards most
 * overdue first, then New Cards in Deck order up to the Day's Daily goal — and
 * splits the queue into Batches of the app's own size. It hands each Batch to a
 * Session queue, which owns the in-session Relearning steps. It reports every
 * Grade, with the Review schedule it produced, to the offline sync queue, asks
 * for haptics, and composes the Session summary from what the Session queue
 * recorded.
 */
class StudySessionStore {
	private readonly reviews: ReviewSink;
	private readonly haptics: HapticFeedback;
	private readonly device: StudyDeviceSource;
	private readonly dailyGoal: () => number;
	private readonly now: () => Date;
	private readonly sync: SyncTrigger | undefined;

	/** The Session queue of the batch being studied. Replaced when a new batch starts. */
	private queue = $state(new SessionQueue());

	/** The Review schedule each Card in the sitting carries, by Card id. */
	#schedules = new SvelteMap<number, ReviewSchedule>();

	/** New Cards whose introduction the current Day has not recorded yet. */
	#unrecordedNewCards = new SvelteSet<number>();

	/** The Day the sitting belongs to; its allowance was read when the sitting began. */
	#dayStart: Date | null = null;

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

	/** Remaining cards in the current deck for subsequent batches */
	remainingDeckCards = $state<Card[]>([]);

	/** Current batch number in this deck session */
	batchNumber = $state<number>(1);

	/** Current deck ID (null if global due queue) */
	sessionDeckId = $state<number | null>(null);

	constructor(collaborators: StudySessionCollaborators) {
		this.reviews = collaborators.reviews;
		this.haptics = collaborators.haptics;
		this.device = collaborators.device;
		this.dailyGoal = collaborators.dailyGoal ?? (() => preferences.dailyGoal);
		this.now = collaborators.now ?? (() => new SvelteDate());
		this.sync = collaborators.sync;

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

	/** The size of a Batch: the app's own number, independent of the Daily goal. */
	get batchSize(): number {
		return BATCH_SIZE;
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

	// ── Session Initialization & Batching ─────────────────────────────────

	/**
	 * Start a Study session for the Cards held on the device due today, across
	 * all held Decks or one Deck. It reads the Cards and Review schedules the
	 * device holds, assembles the Session queue, and offers its first Batch. No
	 * network call is made.
	 *
	 * A sitting already in hand for the same scope is resumed: its Batch, its
	 * answers, and its Review schedules survive, and nothing is read from the
	 * device again. This is what lets the Session summary's "Study Next Batch"
	 * keep the Batch it built when the stage route starts the same scope. Any
	 * other scope — including a finished sitting, which is no longer active —
	 * resets and starts fresh.
	 */
	async start({ deckId }: { deckId?: number } = {}): Promise<boolean> {
		const scope = deckId ?? null;
		if (this.isActive && this.sessionDeckId === scope) return true;

		this.reset();
		this.isLoading = true;
		this.sessionDeckId = scope;

		try {
			const now = this.now();
			const dayStart = startOfDay(now);
			const [decks, newCardsIntroducedToday] = await Promise.all([
				this.device.readDecks(deckId),
				this.device.readNewCardsIntroduced(dayStart)
			]);

			const plan = assembleSessionQueue(decks, {
				now,
				dailyGoal: this.dailyGoal(),
				newCardsIntroducedToday
			});

			this.#dayStart = dayStart;
			this.#schedules = schedulesOf(decks);
			this.#unrecordedNewCards = new SvelteSet(plan.newCards.map((card) => card.id));
			this.batchNumber = 1;
			this.queue = new SessionQueue(plan.cards.slice(0, BATCH_SIZE));
			this.remainingDeckCards = plan.cards.slice(BATCH_SIZE);

			return plan.cards.length > 0;
		} catch (err: unknown) {
			this.error = err instanceof Error ? err.message : 'Failed to load the Cards on this device';
			return false;
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Continue studying the next Batch of the sitting's queue. It is a slice of
	 * the queue assembled when the sitting began, so it never introduces more
	 * New Cards than that Day's allowance.
	 */
	startNextBatch(): boolean {
		if (this.remainingDeckCards.length === 0) return false;

		const nextBatch = this.remainingDeckCards.slice(0, BATCH_SIZE);
		this.remainingDeckCards = this.remainingDeckCards.slice(BATCH_SIZE);
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
	 * The Session queue decides whether the Card returns; the Grade, with the Review
	 * schedule it produced, is reported to the offline sync queue either way.
	 */
	async rateCurrentCard(grade: SM2Rating): Promise<void> {
		// The Session queue offers Again–Easy (1–4); 0 and 5 exist only for
		// backward compatibility and have no Review schedule rule.
		if (grade !== 1 && grade !== 2 && grade !== 3 && grade !== 4) return;

		const answeredAt = this.now();
		const answered = this.queue.answer(grade, answeredAt);
		if (!answered) return;

		this.haptics.sm2Rating(grade);

		const schedule = nextReviewSchedule(
			this.#schedules.get(answered.id) ?? newCardSchedule(answeredAt),
			grade,
			answeredAt
		);
		this.#schedules.set(answered.id, schedule);

		// The device is what the next sitting reads, so persist the Card's new Due
		// moment and the Day's introduction before the Grade travels anywhere else.
		await this.#persistGrade(answered.id, schedule);

		// Optimistic submission via sync queue to backend (unawaited: the Grade must not block the UI)
		const reported = this.reviews.addReview(answered.id, grade, answeredAt, schedule);

		this.isFlipped = false;
		this.clearScratchPad();

		// The end of the sitting — the last Batch, not an intermediate one — is one
		// of the three moments Sync runs. Let the last Grade reach the device queue
		// first, so that Sync carries it rather than leaving it for a later Sync.
		if (this.isSessionFinished && this.remainingDeckCards.length === 0) {
			const triggerSync = (): void => {
				void this.sync?.sync();
			};
			void reported.then(triggerSync, triggerSync);
		}
	}

	/**
	 * Writes a Grade's Review schedule to the device and, for a New Card, records
	 * its introduction in the Day. Both are read when the next sitting assembles
	 * its queue, so they must be durable before that sitting can begin.
	 */
	async #persistGrade(cardId: number, schedule: ReviewSchedule): Promise<void> {
		try {
			await this.device.writeSchedule(cardId, schedule);
		} catch (error) {
			console.error('[StudySession] Failed to write the Review schedule:', error);
		}

		// The first Grade of a New Card introduces it into the Day. A return from
		// its Relearning step is the same Card, so it consumes no more allowance.
		if (this.#dayStart === null || !this.#unrecordedNewCards.has(cardId)) return;
		try {
			await this.device.recordNewCardIntroduced(this.#dayStart, cardId);
			this.#unrecordedNewCards.delete(cardId);
		} catch (error) {
			console.error('[StudySession] Failed to record a New Card introduction:', error);
		}
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
		this.batchNumber = 1;
		this.sessionDeckId = null;
		this.#dayStart = null;
		this.#schedules.clear();
		this.#unrecordedNewCards.clear();
		this.clearScratchPad();
	}
}

export const studySession = new StudySessionStore({
	reviews: reviewSync,
	haptics: hapticFeedback,
	device: deviceStudySource,
	sync: appSync
});
export { StudySessionStore };
