import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewSyncQueue } from './syncQueue.svelte';
import { reviewApi } from '$lib/api/reviews';
import { DeviceStore } from '$lib/device/deviceStore';
import type { ReviewSchedule } from '$lib/scheduling/reviewSchedule';
import type { Card } from '$lib/types';

/** A Review schedule next Due the morning after it was written. */
const schedule = (): ReviewSchedule => ({
	interval: 1,
	efactor: 2.5,
	repetitions: 1,
	nextReviewAt: new Date(2026, 9, 18, 9, 0)
});

/** A Card belonging to Deck 10. */
const card = (id: number): Card => ({
	id,
	deckId: 10,
	koreanWord: `단어 ${id}`,
	englishWord: `Word ${id}`,
	context: '',
	example: ''
});

/** Deletes a test database once the queue has closed it. */
const deleteDatabase = (name: string): Promise<void> =>
	new Promise((resolve, reject) => {
		const request = indexedDB.deleteDatabase(name);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
		request.onblocked = () => reject(new Error(`Deleting ${name} was blocked`));
	});

describe('ReviewSyncQueue', () => {
	let name: string;
	let queue: ReviewSyncQueue;

	/** The queue follows the window's online events; a test sets both sides directly. */
	const setOnline = (online: boolean): void => {
		Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });
		queue.isOnline = online;
	};

	beforeEach(() => {
		localStorage.clear();
		Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
		name = `voabkr-queue-test-${crypto.randomUUID()}`;
		queue = new ReviewSyncQueue({ databaseName: name });
		queue.setLearner(7, true);
	});

	afterEach(async () => {
		await queue.close();
		await deleteDatabase(name);
		localStorage.clear();
		vi.restoreAllMocks();
	});

	it('submits a Grade immediately when online and the API succeeds', async () => {
		const submit = vi
			.spyOn(reviewApi, 'submitReviewScore')
			.mockResolvedValueOnce({ message: 'Success' });

		const result = await queue.addReview(101, 4);

		expect(result).toEqual({ synced: true });
		expect(submit).toHaveBeenCalledWith(101, 4);
		expect(queue.pendingCount).toBe(0);
	});

	it('writes a Grade’s Review schedule to the device store even when the backend accepts it', async () => {
		vi.spyOn(reviewApi, 'submitReviewScore').mockResolvedValueOnce({ message: 'Success' });
		const reader = await DeviceStore.open(name);
		await reader.saveCards([card(101)]);
		const produced = schedule();

		const result = await queue.addReview(101, 3, new Date(2026, 9, 17, 9, 0), produced);

		expect(result).toEqual({ synced: true });
		// The next Study session reads this schedule to know the Card is no longer Due.
		expect((await reader.readDeck(10)).schedules.get(101)).toEqual(produced);
		reader.close();
	});

	it('queues the Review schedule with a Grade given offline, across a reload', async () => {
		setOnline(false);
		const produced = schedule();

		await queue.addReview(202, 1, new Date(2026, 9, 17, 9, 0), produced);

		expect(queue.items[0].schedule).toEqual(produced);

		await queue.close();
		queue = new ReviewSyncQueue({ databaseName: name });
		await queue.ready;

		expect(queue.items[0].schedule).toEqual(produced);
	});

	it('keeps a Grade in the device store when offline, and hydrates it after a reload', async () => {
		setOnline(false);
		const submit = vi.spyOn(reviewApi, 'submitReviewScore');

		const result = await queue.addReview(202, 1);

		expect(result).toEqual({ synced: false });
		expect(submit).not.toHaveBeenCalled();
		expect(queue.pendingCount).toBe(1);
		expect(queue.items[0].cardId).toBe(202);
		expect(queue.items[0].grade).toBe(1);
		expect(queue.items[0].learnerId).toBe(7);

		await queue.close();
		queue = new ReviewSyncQueue({ databaseName: name });
		await queue.ready;

		expect(queue.pendingCount).toBe(1);
		expect(queue.items[0].cardId).toBe(202);
		expect(queue.items[0].learnerId).toBe(7);
	});

	it('queues a Grade when the online submission fails', async () => {
		vi.spyOn(reviewApi, 'submitReviewScore').mockRejectedValueOnce(new Error('Network error'));

		const result = await queue.addReview(303, 3);

		expect(result).toEqual({ synced: false });
		expect(queue.pendingCount).toBe(1);
		expect(queue.items[0].learnerId).toBe(7);
	});

	it('flushes Queued Grades in the order they were given', async () => {
		setOnline(false);
		await queue.addReview(1, 1);
		await queue.addReview(2, 3);
		await queue.addReview(3, 5);
		expect(queue.pendingCount).toBe(3);

		setOnline(true);
		const submit = vi.spyOn(reviewApi, 'submitReviewScore').mockResolvedValue({ message: 'OK' });

		await queue.flushQueue();

		expect(submit).toHaveBeenCalledTimes(3);
		expect(submit).toHaveBeenNthCalledWith(1, 1, 1);
		expect(submit).toHaveBeenNthCalledWith(2, 2, 3);
		expect(submit).toHaveBeenNthCalledWith(3, 3, 5);
		expect(queue.pendingCount).toBe(0);

		await queue.close();
		queue = new ReviewSyncQueue({ databaseName: name });
		await queue.ready;
		expect(queue.pendingCount).toBe(0);
	});

	it('uploads the Queued Grades of the learner who signs back in', async () => {
		setOnline(false);
		await queue.addReview(11, 3);
		queue.setLearner(null, false);

		setOnline(true);
		const submit = vi.spyOn(reviewApi, 'submitReviewScore').mockResolvedValue({ message: 'OK' });

		queue.setLearner(7, true);

		await vi.waitFor(() => expect(queue.pendingCount).toBe(0));
		expect(submit).toHaveBeenCalledExactlyOnceWith(11, 3);
	});

	it("does not send another learner's Queued Grades", async () => {
		setOnline(false);
		await queue.addReview(11, 3);
		queue.setLearner(8, true);
		await queue.addReview(22, 4);

		setOnline(true);
		const submit = vi.spyOn(reviewApi, 'submitReviewScore').mockResolvedValue({ message: 'OK' });

		queue.setLearner(8, true);
		await vi.waitFor(() => expect(queue.pendingCount).toBe(1));
		expect(submit).toHaveBeenCalledExactlyOnceWith(22, 4);
		expect(queue.items[0].cardId).toBe(11);

		queue.setLearner(7, true);
		await vi.waitFor(() => expect(queue.pendingCount).toBe(0));
		expect(submit).toHaveBeenLastCalledWith(11, 3);
	});

	it("does not upload a remembered learner's Grades until the backend confirms the session", async () => {
		setOnline(false);
		await queue.addReview(44, 3);
		setOnline(true);
		const submit = vi.spyOn(reviewApi, 'submitReviewScore').mockResolvedValue({ message: 'OK' });

		// A remembered learner only establishes ownership; the session is unconfirmed.
		queue.setLearner(7, false);
		await queue.flushQueue();
		expect(submit).not.toHaveBeenCalled();
		expect(queue.pendingCount).toBe(1);

		// Once the profile request proves the session is theirs, it uploads.
		queue.setLearner(7, true);
		await vi.waitFor(() => expect(queue.pendingCount).toBe(0));
		expect(submit).toHaveBeenCalledExactlyOnceWith(44, 3);
	});

	it('keeps Queued Grades across a sign-out and a reload, still owned by their learner', async () => {
		setOnline(false);
		await queue.addReview(33, 1);
		queue.setLearner(null, false);
		await queue.close();

		queue = new ReviewSyncQueue({ databaseName: name });
		await queue.ready;
		expect(queue.pendingCount).toBe(1);
		expect(queue.items[0].learnerId).toBe(7);

		// Signed out, a flush sends nothing.
		setOnline(true);
		const submit = vi.spyOn(reviewApi, 'submitReviewScore').mockResolvedValue({ message: 'OK' });
		await queue.flushQueue();
		expect(submit).not.toHaveBeenCalled();

		// The owner signing in flushes it.
		queue.setLearner(7, true);
		await vi.waitFor(() => expect(queue.pendingCount).toBe(0));
		expect(submit).toHaveBeenCalledExactlyOnceWith(33, 1);
	});

	it('clears the queue and its stored records', async () => {
		setOnline(false);
		await queue.addReview(99, 3);
		expect(queue.pendingCount).toBe(1);

		await queue.clear();

		expect(queue.pendingCount).toBe(0);

		await queue.close();
		queue = new ReviewSyncQueue({ databaseName: name });
		await queue.ready;
		expect(queue.pendingCount).toBe(0);
	});
});
