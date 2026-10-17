import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Card, Deck } from '$lib/types';
import type { DownloadedDeck } from '$lib/device/deviceStore';
import type { ReviewSchedule } from '$lib/scheduling/reviewSchedule';
import { Sync, type GradeBatchEntry, type GradeBatchResult, type SyncEndpoint } from './sync';
import { ReviewSyncQueue } from '$lib/stores/syncQueue.svelte';

/** Deletes a test database once the queue has closed it. */
const deleteDatabase = (name: string): Promise<void> =>
	new Promise((resolve, reject) => {
		const request = indexedDB.deleteDatabase(name);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
		request.onblocked = () => reject(new Error(`Deleting ${name} was blocked`));
	});

/** A Card belonging to a Deck. */
const card = (id: number, deckId: number, englishWord = `Word ${id}`): Card => ({
	id,
	deckId,
	koreanWord: `단어 ${id}`,
	englishWord,
	context: '',
	example: ''
});

/** A Review schedule whose next Due moment is the given October day. */
const schedule = (day: number): ReviewSchedule => ({
	interval: 6,
	efactor: 2.5,
	repetitions: 2,
	nextReviewAt: new Date(2026, 9, day, 9, 0)
});

/** A Deck as the Library pull returns it. */
const deck = (id: number): Deck => ({ id, name: `Deck ${id}`, type: 'vocabulary' });

const ANSWERED_AT = new Date(2026, 9, 17, 9, 0);

/** The backend endpoint, driven by the test: no network, no backend. */
class FakeSyncEndpoint implements SyncEndpoint {
	calls: string[] = [];
	pushes: GradeBatchEntry[][] = [];
	pushResults: GradeBatchResult[] = [];
	pushError: Error | null = null;
	library: Deck[] = [];
	libraryError: Error | null = null;
	/** When set, a Library pull waits for this before answering. */
	libraryGate: Promise<void> | null = null;
	decks = new Map<number, DownloadedDeck>();
	deckErrors = new Set<number>();

	async pushGrades(grades: readonly GradeBatchEntry[]): Promise<readonly GradeBatchResult[]> {
		this.calls.push('push');
		this.pushes.push(grades.map((grade) => ({ ...grade })));
		if (this.pushError) throw this.pushError;
		if (this.pushResults.length === grades.length) return this.pushResults;
		return grades.map(() => ({ accepted: true }));
	}

	async pullLibrary(): Promise<Deck[]> {
		this.calls.push('pullLibrary');
		if (this.libraryGate) await this.libraryGate;
		if (this.libraryError) throw this.libraryError;
		return this.library;
	}

	async pullDeck(deckId: number): Promise<DownloadedDeck> {
		this.calls.push(`pullDeck:${deckId}`);
		if (this.deckErrors.has(deckId)) throw new Error(`Could not pull Deck ${deckId}`);
		return this.decks.get(deckId) ?? { cards: [], schedules: new Map() };
	}
}

describe('Sync', () => {
	let name: string;
	let queue: ReviewSyncQueue;
	let endpoint: FakeSyncEndpoint;
	let sync: Sync;
	/** Decks the app's held-Deck view was told to forget. */
	let released: number[];

	/** The queue follows the connection state Sync keeps in step with the window. */
	const setOnline = (online: boolean): void => {
		Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });
		queue.isOnline = online;
	};

	beforeEach(() => {
		localStorage.clear();
		Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
		name = `voabkr-sync-test-${crypto.randomUUID()}`;
		endpoint = new FakeSyncEndpoint();
		queue = new ReviewSyncQueue({ databaseName: name, pushEndpoint: endpoint });
		queue.setLearner(7, true);
		released = [];
		sync = new Sync({ queue, endpoint, decks: { forget: (deckId) => released.push(deckId) } });
	});

	afterEach(async () => {
		sync.stop();
		await queue.close();
		await deleteDatabase(name);
		localStorage.clear();
	});

	it('pushes the Queued Grades before pulling the Library', async () => {
		setOnline(false);
		await queue.addReview(1, 3, ANSWERED_AT);
		setOnline(true);

		await sync.sync();

		expect(endpoint.calls[0]).toBe('push');
		expect(endpoint.calls).toContain('pullLibrary');
		expect(queue.pendingCount).toBe(0);
	});

	it('pushes even when the pull fails, because a failed pull must not block the push', async () => {
		setOnline(false);
		await queue.addReview(1, 3, ANSWERED_AT);
		setOnline(true);
		endpoint.libraryError = new Error('Network error');

		const report = await sync.sync();

		expect(queue.pendingCount).toBe(0);
		expect(endpoint.pushes[0].map((grade) => grade.cardId)).toEqual([1]);
		expect(report.pullError).toBeInstanceOf(Error);
	});

	it('parks a refused Grade and still applies the Grades behind it; a later Sync retries it', async () => {
		setOnline(false);
		await queue.addReview(1, 3, ANSWERED_AT);
		await queue.addReview(2, 3, ANSWERED_AT);
		await queue.addReview(3, 4, ANSWERED_AT);
		setOnline(true);
		endpoint.pushResults = [
			{ accepted: true },
			{ accepted: false, error: 'DeckShare revoked' },
			{ accepted: true }
		];

		await sync.sync();

		const store = await queue.device();
		const stored = (await store?.readQueuedGrades()) ?? [];
		expect(stored).toHaveLength(1);
		expect(stored[0]).toMatchObject({ cardId: 2, parked: true });
		expect(queue.pendingCount).toBe(0);
		expect(queue.parkedCount).toBe(1);

		endpoint.pushResults = [];
		await sync.sync();

		expect(endpoint.pushes[1].map((grade) => grade.cardId)).toEqual([2]);
		expect(await store?.readQueuedGrades()).toEqual([]);
		expect(queue.parkedCount).toBe(0);
	});

	it('reflects edited and deleted Cards by replacing a downloaded Deck wholesale', async () => {
		const store = await queue.device();
		await store?.saveCards([card(1, 10), card(2, 10)]);
		await store?.writeSchedule(1, schedule(20));
		await store?.writeSchedule(2, schedule(21));
		await store?.holdDeck(10);

		endpoint.library = [deck(10)];
		endpoint.decks.set(10, {
			cards: [card(1, 10, 'Edited Word 1'), card(3, 10)],
			schedules: new Map([
				[1, schedule(30)],
				[3, schedule(31)]
			])
		});

		await sync.sync();

		const contents = await store?.readDeck(10);
		expect(contents?.cards.map((entry) => entry.id).sort()).toEqual([1, 3]);
		expect(contents?.cards.find((entry) => entry.id === 1)?.englishWord).toBe('Edited Word 1');
		expect(contents?.schedules.get(1)).toEqual(schedule(30));
		expect(contents?.schedules.has(2)).toBe(false);
		expect(contents?.schedules.get(3)).toEqual(schedule(31));
		expect(await store?.readLibrary()).toEqual(endpoint.library);
	});

	it('leaves the device with no trace of a Deck the Library no longer returns', async () => {
		const store = await queue.device();
		await store?.saveCards([card(1, 10), card(2, 20)]);
		await store?.writeSchedule(1, schedule(20));
		await store?.writeSchedule(2, schedule(21));
		await store?.holdDeck(10);
		await store?.holdDeck(20);

		endpoint.library = [deck(10)];
		endpoint.decks.set(10, { cards: [card(1, 10)], schedules: new Map([[1, schedule(20)]]) });

		await sync.sync();

		expect(await store?.listHeldDecks()).toEqual([10]);
		expect(await store?.readDeck(20)).toEqual({ cards: [], schedules: new Map() });
		expect(await store?.readLibrary()).toEqual([deck(10)]);
		// The app's held-Deck view stops calling the released Deck held, without a reload.
		expect(released).toEqual([20]);
	});

	it('keeps a Downloaded Deck when its Cards cannot be pulled, rather than treating a failure as deletion', async () => {
		const store = await queue.device();
		await store?.saveCards([card(1, 10)]);
		await store?.writeSchedule(1, schedule(20));
		await store?.holdDeck(10);

		endpoint.library = [deck(10)];
		endpoint.deckErrors.add(10);

		const report = await sync.sync();

		expect(report.pull?.decksFailed).toEqual([10]);
		expect(await store?.listHeldDecks()).toEqual([10]);
		expect((await store?.readDeck(10))?.cards).toEqual([card(1, 10)]);
		expect(released).toEqual([]);
	});

	it('runs again after reconnecting during a Sync that began offline', async () => {
		setOnline(false);
		await queue.addReview(5, 3, ANSWERED_AT);

		let releaseLibrary!: () => void;
		endpoint.libraryGate = new Promise((resolve) => {
			releaseLibrary = resolve;
		});

		const firstSync = sync.start();
		await vi.waitFor(() => expect(endpoint.calls).toContain('pullLibrary'));

		setOnline(true);
		window.dispatchEvent(new Event('online'));
		releaseLibrary();
		await firstSync;

		// The Sync that began offline skipped its push; the reconnect must not be
		// swallowed by coalescing into it.
		await vi.waitFor(() => expect(queue.pendingCount).toBe(0));
		expect(endpoint.pushes.flat().map((grade) => grade.cardId)).toEqual([5]);
	});

	it('syncs when the app opens and again when the connection returns', async () => {
		await sync.start();
		expect(endpoint.calls.filter((call) => call === 'pullLibrary')).toHaveLength(1);

		setOnline(false);
		await queue.addReview(5, 3, ANSWERED_AT);
		endpoint.calls = [];

		window.dispatchEvent(new Event('online'));
		await sync.sync();

		expect(endpoint.calls[0]).toBe('push');
		expect(endpoint.pushes.flat().map((grade) => grade.cardId)).toEqual([5]);
		expect(queue.pendingCount).toBe(0);
	});
});
