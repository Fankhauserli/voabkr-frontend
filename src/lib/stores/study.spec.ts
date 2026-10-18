import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeviceStoreBlockedError } from '$lib/device/deviceStore';
import { StudySessionStore, BATCH_SIZE } from './study.svelte';
import { startOfDay, type DeckContents } from '$lib/study/queueAssembly';
import type { StudyDeviceSource } from '$lib/study/deviceSource';
import { nextReviewSchedule, type ReviewSchedule } from '$lib/scheduling/reviewSchedule';
import type { Card, SM2Rating } from '$lib/types';

/** A Card belonging to a Deck. */
const card = (id: number, deckId = 10): Card => ({
	id,
	deckId,
	koreanWord: `단어 ${id}`,
	englishWord: `Word ${id}`,
	context: 'noun',
	example: `예문 ${id}`
});

/** Distinct Cards numbered `from`..`to` from one Deck. */
const cards = (count: number, deckId = 10): Card[] =>
	Array.from({ length: count }, (_, i) => card(i + 1, deckId));

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
	deckCards: readonly Card[],
	schedules: ReadonlyMap<number, ReviewSchedule> = new Map()
): DeckContents => ({ deckId, cards: deckCards, schedules });

/** A local wall-clock moment, so the Day boundary does not depend on the test's time zone. */
const at = (day: number, hours: number, minutes = 0): Date =>
	new Date(2026, 9, day, hours, minutes);

/** The moment these Sessions begin. */
const NOW = at(17, 12);

/** A Grade reported to the sync queue, with the Review schedule it produced. */
interface SubmittedReview {
	cardId: number;
	grade: SM2Rating;
	answeredAt: Date;
	schedule: ReviewSchedule;
}

/** A stand-in for the offline sync queue that records what it was handed. */
const createInMemoryReviews = () => {
	const submitted: SubmittedReview[] = [];
	return {
		submitted,
		async addReview(cardId: number, grade: SM2Rating, answeredAt: Date, schedule: ReviewSchedule) {
			submitted.push({ cardId, grade, answeredAt, schedule });
			return { synced: true };
		}
	};
};

const createNoopHaptics = () => ({ cardFlip() {}, sm2Rating() {} });

/**
 * A stand-in for the device store. It holds the Decks a sitting reads and the
 * Day's count of introduced New Cards, and records the introductions it is asked
 * to keep.
 */
const createDevice = (decks: DeckContents[], introducedToday = 0) => {
	const introductions: { dayStart: Date; cardId: number }[] = [];
	const schedulesWritten: { cardId: number; schedule: ReviewSchedule }[] = [];
	const readDecks = vi.fn(async (deckId?: number) =>
		deckId === undefined ? decks : decks.filter((contents) => contents.deckId === deckId)
	);
	const readNewCardsIntroduced = vi.fn<(dayStart: Date) => Promise<number>>(
		async () => introducedToday
	);
	const recordNewCardIntroduced = vi.fn(async (dayStart: Date, cardId: number) => {
		introductions.push({ dayStart, cardId });
	});
	const writeSchedule = vi.fn(async (cardId: number, schedule: ReviewSchedule) => {
		schedulesWritten.push({ cardId, schedule });
	});
	const source: StudyDeviceSource = {
		readDecks,
		readNewCardsIntroduced,
		recordNewCardIntroduced,
		writeSchedule
	};
	return {
		source,
		introductions,
		schedulesWritten,
		readDecks,
		readNewCardsIntroduced,
		recordNewCardIntroduced,
		writeSchedule
	};
};

let reviews: ReturnType<typeof createInMemoryReviews>;

/** A Study session over an injected device and clock. */
const createStore = (
	source: StudyDeviceSource,
	options: { dailyGoal?: number; now?: () => Date } = {}
): StudySessionStore => {
	reviews = createInMemoryReviews();
	return new StudySessionStore({
		reviews,
		haptics: createNoopHaptics(),
		device: source,
		dailyGoal: () => options.dailyGoal ?? 20,
		now: options.now ?? (() => new Date(NOW.getTime()))
	});
};

/** Answers every remaining Card Good, returning the Cards in the order they were offered. */
const answerGoodUntilFinished = async (session: StudySessionStore): Promise<number[]> => {
	const presented: number[] = [];
	while (!session.isSessionFinished) {
		if (presented.length >= 200) throw new Error('Study session never finished');
		presented.push(session.currentCard?.id ?? 0);
		await session.rateCurrentCard(3);
	}
	return presented;
};

beforeEach(() => {
	reviews = createInMemoryReviews();
});

describe('StudySessionStore — the Session queue assembled on the device', () => {
	it('finishes a Study session driven only through its injected collaborators', async () => {
		const device = createDevice([deck(10, cards(5))]);
		const store = createStore(device.source);

		await store.start({ deckId: 10 });
		expect(store.isActive).toBe(true);
		expect(device.readDecks).toHaveBeenCalledWith(10);

		await store.rateCurrentCard(1); // Card 1 -> Again, so it must come back before the session ends
		const gradesGiven = 1 + (await answerGoodUntilFinished(store)).length;

		expect(store.isSessionFinished).toBe(true);
		expect(store.sessionSummary?.distinctCardsCount).toBe(5);
		expect(gradesGiven).toBe(6); // one Grade more than distinct Cards: the failed Card returned
		expect(reviews.submitted).toHaveLength(gradesGiven); // every Grade reached the injected sync queue
	});

	it('starts a Study session across every held Deck through one command', async () => {
		const decks = [deck(10, [card(1, 10)]), deck(20, [card(21, 20)])];
		const device = createDevice(decks);
		const store = createStore(device.source);

		expect(await store.start()).toBe(true);
		expect(device.readDecks).toHaveBeenCalledWith(undefined);
		expect(store.sessionDeckId).toBeNull();
		expect(store.totalCards).toBe(2);
	});

	it('starts a Study session for one Deck through the same command', async () => {
		const decks = [deck(10, [card(1, 10)]), deck(20, [card(21, 20)])];
		const device = createDevice(decks);
		const store = createStore(device.source);

		expect(await store.start({ deckId: 10 })).toBe(true);
		expect(device.readDecks).toHaveBeenCalledWith(10);
		expect(store.sessionDeckId).toBe(10);
		expect(store.totalCards).toBe(1);
	});

	it('offers Due Cards first, the one owed longest first', async () => {
		const schedules = new Map([
			[1, scheduledAt(at(16, 9))],
			[2, scheduledAt(at(14, 9))], // most overdue
			[3, scheduledAt(at(17, 11))] // due an hour ago
		]);
		const store = createStore(createDevice([deck(10, cards(3), schedules)]).source);

		await store.start({ deckId: 10 });

		expect(await answerGoodUntilFinished(store)).toEqual([2, 1, 3]);
	});

	it('follows the Due Cards with New Cards in Deck order, bounded by the Daily goal', async () => {
		const decks = [
			deck(20, [card(21, 20), card(22, 20), card(23, 20)]),
			deck(10, [card(11, 10), card(12, 10)], new Map([[11, scheduledAt(at(15, 9))]]))
		];
		const store = createStore(createDevice(decks).source, { dailyGoal: 3 });

		await store.start();

		expect(await answerGoodUntilFinished(store)).toEqual([11, 21, 22, 23]);
	});

	it('subtracts the New Cards already introduced in the same Day', async () => {
		const device = createDevice([deck(10, cards(10))], 7);
		const store = createStore(device.source, { dailyGoal: 10 });

		await store.start({ deckId: 10 });

		expect(store.totalCards).toBe(3);
		expect(device.readNewCardsIntroduced).toHaveBeenCalledWith(startOfDay(NOW));
	});

	it('keeps the same Day after midnight, because the Day began at 04:00', async () => {
		const destination = at(17, 23, 30);
		const afterMidnight = at(18, 0, 30);
		let clock = destination;
		const device = createDevice([deck(10, cards(10))], 2);
		const store = createStore(device.source, { dailyGoal: 10, now: () => clock });

		await store.start({ deckId: 10 });
		await answerGoodUntilFinished(store);

		// A new sitting after midnight still belongs to the Day that began at 04:00.
		clock = afterMidnight;
		await store.start({ deckId: 10 });

		const [firstSitting, secondSitting] = device.readNewCardsIntroduced.mock.calls;
		expect(firstSitting[0]).toEqual(at(17, 4));
		expect(secondSitting[0]).toEqual(at(17, 4));
	});

	it("does not bank a missed Day's New Cards", async () => {
		// The device reports no introductions for this Day, so the Daily goal is
		// offered once — not once per Day since the learner last studied.
		const device = createDevice([deck(10, cards(30))], 0);
		const store = createStore(device.source, { dailyGoal: 5 });

		await store.start({ deckId: 10 });

		expect(store.totalCards).toBe(5);
	});

	it("sizes a Batch by the app's own constant, not the Daily goal", async () => {
		// Fifty Due Cards and a Daily goal of 3: every Due Card is offered, and
		// the Batch is still BATCH_SIZE.
		const dueCards = cards(50);
		const schedules = new Map(dueCards.map((c) => [c.id, scheduledAt(at(15, 9))]));
		const store = createStore(createDevice([deck(10, dueCards, schedules)]).source, {
			dailyGoal: 3
		});

		await store.start({ deckId: 10 });

		expect(BATCH_SIZE).toBe(20);
		expect(store.batchSize).toBe(BATCH_SIZE);
		expect(store.totalCards).toBe(BATCH_SIZE);
		expect(store.remainingDeckCards).toHaveLength(30);
	});

	it('splits the assembled queue into Batches and continues without adding more New Cards', async () => {
		const dueCards = cards(100);
		const schedules = new Map(dueCards.map((c) => [c.id, scheduledAt(at(15, 9))]));
		const store = createStore(createDevice([deck(10, dueCards, schedules)]).source);

		await store.start({ deckId: 10 });
		expect(store.totalCards).toBe(BATCH_SIZE);
		expect(store.remainingDeckCards).toHaveLength(80);
		expect(store.hasMoreCardsInDeck).toBe(true);

		const firstBatch = await answerGoodUntilFinished(store);
		expect(firstBatch).toHaveLength(BATCH_SIZE);

		expect(store.startNextBatch()).toBe(true);
		expect(store.batchNumber).toBe(2);
		expect(store.currentCard?.id).toBe(21);
		expect(store.answeredCount).toBe(0);
		expect(store.remainingDeckCards).toHaveLength(60);

		// The second Batch is a slice of the same queue, so it offers no new Cards
		// beyond what the Day's allowance admitted.
		expect(await answerGoodUntilFinished(store)).toHaveLength(BATCH_SIZE);
	});

	it('records a New Card as introduced once, on its first Grade, and not a Card already reviewed', async () => {
		const schedules = new Map([[2, scheduledAt(at(15, 9))]]);
		const device = createDevice([deck(10, [card(1), card(2)], schedules)]);
		const store = createStore(device.source);

		await store.start({ deckId: 10 });

		await store.rateCurrentCard(1); // Card 2, already reviewed: Again
		await store.rateCurrentCard(3); // Card 1, New: its first Grade records the introduction
		await store.rateCurrentCard(3); // Card 2 returns from its Relearning step

		expect(device.introductions).toEqual([{ dayStart: startOfDay(NOW), cardId: 1 }]);
	});
});

describe('StudySessionStore — resuming the sitting in hand', () => {
	it('resumes an active sitting for the same Deck without reading the device again', async () => {
		const device = createDevice([deck(10, cards(4))]);
		const store = createStore(device.source);

		await store.start({ deckId: 10 });
		await store.rateCurrentCard(3);
		const cardInHand = store.currentCard?.id;

		expect(await store.start({ deckId: 10 })).toBe(true);

		expect(device.readDecks).toHaveBeenCalledTimes(1);
		expect(device.readNewCardsIntroduced).toHaveBeenCalledTimes(1);
		expect(store.currentCard?.id).toBe(cardInHand);
		expect(store.answeredCount).toBe(1);
	});

	it('resumes an active due-queue sitting when the due queue is requested again', async () => {
		const device = createDevice([deck(10, cards(2))]);
		const store = createStore(device.source);

		await store.start();
		await store.start();

		expect(device.readDecks).toHaveBeenCalledTimes(1);
		expect(store.sessionDeckId).toBeNull();
	});

	it('keeps the Batch the Session summary built when the same scope starts again', async () => {
		const dueCards = cards(BATCH_SIZE + 1);
		const schedules = new Map(dueCards.map((c) => [c.id, scheduledAt(at(15, 9))]));
		const device = createDevice([deck(10, dueCards, schedules)]);
		const store = createStore(device.source);

		await store.start({ deckId: 10 });
		await answerGoodUntilFinished(store);
		expect(store.startNextBatch()).toBe(true);
		const firstCardOfNextBatch = store.currentCard?.id;

		// The stage route starts the same scope on mount; the Batch built for the
		// Session summary must survive that start.
		expect(await store.start({ deckId: 10 })).toBe(true);

		expect(device.readDecks).toHaveBeenCalledTimes(1);
		expect(store.batchNumber).toBe(2);
		expect(store.currentCard?.id).toBe(firstCardOfNextBatch);
		expect(store.answeredCount).toBe(0);
	});

	it('starts a different scope fresh instead of resuming the sitting in hand', async () => {
		const device = createDevice([deck(10, [card(1, 10)]), deck(20, [card(21, 20)])]);
		const store = createStore(device.source);

		await store.start({ deckId: 10 });
		await store.start({ deckId: 20 });

		expect(device.readDecks).toHaveBeenCalledTimes(2);
		expect(store.sessionDeckId).toBe(20);
		expect(store.currentCard?.id).toBe(21);
	});

	it('starts the due queue fresh after a Deck sitting, because the scope differs', async () => {
		const device = createDevice([deck(10, [card(1, 10)]), deck(20, [card(21, 20)])]);
		const store = createStore(device.source);

		await store.start({ deckId: 10 });
		await store.start();

		expect(device.readDecks).toHaveBeenCalledTimes(2);
		expect(device.readDecks).toHaveBeenLastCalledWith(undefined);
		expect(store.sessionDeckId).toBeNull();
		expect(store.totalCards).toBe(2);
	});

	it('starts a finished sitting for the same scope fresh', async () => {
		const device = createDevice([deck(10, [card(1)])]);
		const store = createStore(device.source);

		await store.start({ deckId: 10 });
		await answerGoodUntilFinished(store);
		expect(store.isSessionFinished).toBe(true);

		expect(await store.start({ deckId: 10 })).toBe(true);

		expect(device.readDecks).toHaveBeenCalledTimes(2);
		expect(store.isSessionFinished).toBe(false);
		expect(store.isActive).toBe(true);
		expect(store.answeredCount).toBe(0);
	});
});

describe('StudySessionStore — Grades and the Session summary', () => {
	it('reports every Grade to the offline sync queue, whatever the Session queue decides', async () => {
		const store = createStore(createDevice([deck(10, cards(4))]).source);

		await store.start({ deckId: 10 });
		await store.rateCurrentCard(2); // Card 1 Hard, outside a Relearning step: the queue does not bring it back
		await store.rateCurrentCard(1); // Card 2 Again: the queue does bring it back
		await answerGoodUntilFinished(store);

		expect(reviews.submitted.map((r) => r.cardId)).toEqual([1, 2, 3, 4, 2]);
		expect(reviews.submitted.map((r) => r.grade)).toEqual([2, 1, 3, 3, 3]);
	});

	it('reports the Review schedule each Grade produced, from the device schedule it started with', async () => {
		const startedWith = { ...scheduledAt(at(16, 9)), interval: 10, efactor: 2.5, repetitions: 4 };
		const store = createStore(
			createDevice([deck(10, [card(1)], new Map([[1, startedWith]]))]).source,
			{ now: () => new Date(NOW.getTime()) }
		);

		await store.start({ deckId: 10 });
		await store.rateCurrentCard(3);

		expect(reviews.submitted[0]).toEqual({
			cardId: 1,
			grade: 3,
			answeredAt: NOW,
			schedule: nextReviewSchedule(startedWith, 3, NOW)
		});
	});

	it('starts a New Card from the beginning of its Review schedule', async () => {
		const store = createStore(createDevice([deck(10, [card(1)])]).source);

		await store.start({ deckId: 10 });
		await store.rateCurrentCard(4);

		expect(reviews.submitted[0].schedule).toEqual(
			nextReviewSchedule({ interval: 0, efactor: 2.5, repetitions: 0, nextReviewAt: NOW }, 4, NOW)
		);
	});

	it('persists the schedule and the introduction before the Grade leaves the session', async () => {
		const device = createDevice([deck(10, [card(1)])]);
		const order: string[] = [];
		device.writeSchedule.mockImplementation(async (cardId, schedule) => {
			order.push(`schedule:${cardId}`);
			device.schedulesWritten.push({ cardId, schedule });
		});
		device.recordNewCardIntroduced.mockImplementation(async (dayStart, cardId) => {
			order.push(`introduced:${cardId}`);
			device.introductions.push({ dayStart, cardId });
		});
		const store = createStore(device.source);

		await store.start({ deckId: 10 });
		await store.rateCurrentCard(3);

		// Awaiting the Grade is enough: a new sitting that starts next reads both.
		expect(order).toEqual(['schedule:1', 'introduced:1']);
		expect(device.schedulesWritten[0].schedule).toEqual(
			nextReviewSchedule({ interval: 0, efactor: 2.5, repetitions: 0, nextReviewAt: NOW }, 3, NOW)
		);
	});

	it('marks a Card that comes back as relearning, until it is answered Good', async () => {
		const store = createStore(createDevice([deck(10, cards(4))]).source);

		await store.start({ deckId: 10 });

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
		const store = createStore(createDevice([deck(10, cards(2))]).source);

		await store.start({ deckId: 10 });

		await store.rateCurrentCard(3); // Card 1 Good
		await store.rateCurrentCard(1); // Card 2 Again, with nothing behind it

		expect(store.isActive).toBe(true);
		expect(store.isSessionFinished).toBe(false);
		expect(store.currentCard?.id).toBe(2);
		expect(store.isCurrentCardRelearning).toBe(true);
	});

	it('derives the Session summary from the Session queue record, mixing first attempts and returns', async () => {
		const store = createStore(createDevice([deck(10, cards(4))]).source);

		await store.start({ deckId: 10 });
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

	it('asks for a Sync when a Study session ends, after the last Grade is recorded', async () => {
		const device = createDevice([deck(10, cards(2))]);
		const sync = {
			sync: vi.fn(async () => {
				// The finished Grade is already with the queue by the time Sync runs.
				expect(reviews.submitted).toHaveLength(2);
				return {};
			})
		};
		const store = new StudySessionStore({
			reviews,
			haptics: createNoopHaptics(),
			device: device.source,
			dailyGoal: () => 20,
			now: () => new Date(NOW.getTime()),
			sync
		});

		await store.start({ deckId: 10 });
		await store.rateCurrentCard(3);
		expect(sync.sync).not.toHaveBeenCalled();

		await store.rateCurrentCard(3);
		expect(store.isSessionFinished).toBe(true);
		await vi.waitFor(() => expect(sync.sync).toHaveBeenCalledTimes(1));
	});

	it('asks for Sync only when the last Batch ends, not at an intermediate Batch boundary', async () => {
		const sync = { sync: vi.fn(async () => ({})) };
		const store = new StudySessionStore({
			reviews,
			haptics: createNoopHaptics(),
			device: createDevice([deck(10, cards(BATCH_SIZE + 1))]).source,
			dailyGoal: () => BATCH_SIZE + 1,
			now: () => new Date(NOW.getTime()),
			sync
		});

		await store.start({ deckId: 10 });
		await answerGoodUntilFinished(store);

		// The first Batch is complete, but the sitting has a Batch left to offer.
		expect(store.isSessionFinished).toBe(true);
		expect(store.remainingDeckCards).toHaveLength(1);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(sync.sync).not.toHaveBeenCalled();

		expect(store.startNextBatch()).toBe(true);
		await answerGoodUntilFinished(store);
		await vi.waitFor(() => expect(sync.sync).toHaveBeenCalledTimes(1));
	});
});

describe('StudySessionStore — a blocked device store', () => {
	it('reports the block to the stage and starts once the store can open', async () => {
		const device = createDevice([deck(10, cards(2))]);
		device.readDecks.mockRejectedValueOnce(new DeviceStoreBlockedError());
		const store = createStore(device.source);

		await store.start({ deckId: 10 });

		expect(store.storeBlocked).toBe(true);
		expect(store.error).toBeNull();
		expect(store.isLoading).toBe(false);
		expect(store.totalCards).toBe(0);

		// The learner closes the other tab; Retry starts the same sitting.
		await store.start({ deckId: 10 });

		expect(store.storeBlocked).toBe(false);
		expect(store.totalCards).toBe(2);
	});

	it('keeps an ordinary device failure distinct from a block', async () => {
		const device = createDevice([]);
		device.readDecks.mockRejectedValueOnce(new Error('IndexedDB is not available on this device'));
		const store = createStore(device.source);

		await store.start();

		expect(store.storeBlocked).toBe(false);
		expect(store.error).toBe('IndexedDB is not available on this device');
	});
});
