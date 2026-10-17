import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewSyncQueue } from './syncQueue.svelte';
import { reviewApi } from '$lib/api/reviews';

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

	it('keeps a Grade in the device store when offline, and hydrates it after a reload', async () => {
		setOnline(false);
		const submit = vi.spyOn(reviewApi, 'submitReviewScore');

		const result = await queue.addReview(202, 1);

		expect(result).toEqual({ synced: false });
		expect(submit).not.toHaveBeenCalled();
		expect(queue.pendingCount).toBe(1);
		expect(queue.items[0].cardId).toBe(202);
		expect(queue.items[0].grade).toBe(1);

		await queue.close();
		queue = new ReviewSyncQueue({ databaseName: name });
		await queue.ready;

		expect(queue.pendingCount).toBe(1);
		expect(queue.items[0].cardId).toBe(202);
	});

	it('queues a Grade when the online submission fails', async () => {
		vi.spyOn(reviewApi, 'submitReviewScore').mockRejectedValueOnce(new Error('Network error'));

		const result = await queue.addReview(303, 3);

		expect(result).toEqual({ synced: false });
		expect(queue.pendingCount).toBe(1);
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
