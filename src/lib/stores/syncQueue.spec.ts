import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReviewSyncQueue } from './syncQueue.svelte';
import { reviewApi } from '$lib/api/reviews';

describe('ReviewSyncQueue Store', () => {
	let queue: ReviewSyncQueue;
	const STORAGE_KEY = 'voabkr_review_queue';
	let mockStorage: Record<string, string> = {};

	beforeEach(() => {
		mockStorage = {};
		globalThis.localStorage = {
			getItem: (key: string) => mockStorage[key] ?? null,
			setItem: (key: string, val: string) => {
				mockStorage[key] = val;
			},
			removeItem: (key: string) => {
				delete mockStorage[key];
			},
			clear: () => {
				mockStorage = {};
			},
			key: () => null,
			length: 0
		};
		Object.defineProperty(globalThis, 'navigator', {
			value: { onLine: true },
			writable: true,
			configurable: true
		});
		vi.clearAllMocks();
		queue = new ReviewSyncQueue();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('submits review immediately when online and API succeeds', async () => {
		const submitSpy = vi
			.spyOn(reviewApi, 'submitReviewScore')
			.mockResolvedValueOnce({ message: 'Success' });

		const result = await queue.addReview(101, 4);

		expect(result).toEqual({ synced: true });
		expect(submitSpy).toHaveBeenCalledWith(101, 4);
		expect(queue.pendingCount).toBe(0);
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
	});

	it('buffers review in queue and localStorage when offline', async () => {
		Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
		const submitSpy = vi.spyOn(reviewApi, 'submitReviewScore');

		const result = await queue.addReview(202, 1);

		expect(result).toEqual({ synced: false });
		expect(submitSpy).not.toHaveBeenCalled();
		expect(queue.pendingCount).toBe(1);
		expect(queue.items[0].cardId).toBe(202);
		expect(queue.items[0].ease).toBe(1);

		const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
		expect(stored).toHaveLength(1);
		expect(stored[0].cardId).toBe(202);

		Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
	});

	it('buffers review into queue if online API call rejects with error', async () => {
		Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
		vi.spyOn(reviewApi, 'submitReviewScore').mockRejectedValueOnce(new Error('Network error'));

		const result = await queue.addReview(303, 5);

		expect(result).toEqual({ synced: false });
		expect(queue.pendingCount).toBe(1);
		expect(queue.items[0].cardId).toBe(303);
	});

	it('flushes queued reviews in FIFO sequence when flushQueue is executed', async () => {
		Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
		await queue.addReview(1, 0);
		await queue.addReview(2, 3);
		await queue.addReview(3, 5);
		expect(queue.pendingCount).toBe(3);

		Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
		const submitSpy = vi.spyOn(reviewApi, 'submitReviewScore').mockResolvedValue({ message: 'OK' });

		await queue.flushQueue();

		expect(submitSpy).toHaveBeenCalledTimes(3);
		expect(submitSpy).toHaveBeenNthCalledWith(1, 1, 0);
		expect(submitSpy).toHaveBeenNthCalledWith(2, 2, 3);
		expect(submitSpy).toHaveBeenNthCalledWith(3, 3, 5);
		expect(queue.pendingCount).toBe(0);
	});

	it('clears queue and resets localStorage on clear()', async () => {
		Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
		await queue.addReview(99, 3);
		expect(queue.pendingCount).toBe(1);

		queue.clear();
		expect(queue.pendingCount).toBe(0);
		expect(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')).toEqual([]);
	});
});
