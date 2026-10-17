import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewSyncQueue } from './syncQueue.svelte';
import { DeviceStore } from '$lib/device/deviceStore';
import type { ReviewSchedule } from '$lib/scheduling/reviewSchedule';
import type { GradeBatchEntry, GradeBatchResult, GradePushEndpoint } from '$lib/sync/contract';

/** Deletes a test database once the queue has closed it. */
const deleteDatabase = (name: string): Promise<void> =>
	new Promise((resolve, reject) => {
		const request = indexedDB.deleteDatabase(name);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
		request.onblocked = () => reject(new Error(`Deleting ${name} was blocked`));
	});

/** A Review schedule next Due the morning after it was written. */
const schedule = (): ReviewSchedule => ({
	interval: 1,
	efactor: 2.5,
	repetitions: 1,
	nextReviewAt: new Date(2026, 9, 18, 9, 0)
});

/** A push endpoint a test drives: it records every batch and answers as told. */
class FakePushEndpoint implements GradePushEndpoint {
	calls: GradeBatchEntry[][] = [];
	results: GradeBatchResult[] = [];
	error: Error | null = null;

	async pushGrades(grades: readonly GradeBatchEntry[]): Promise<readonly GradeBatchResult[]> {
		this.calls.push(grades.map((grade) => ({ ...grade })));
		if (this.error) throw this.error;
		if (this.results.length === grades.length) return this.results;
		return grades.map(() => ({ accepted: true }));
	}

	/** Accepts every Grade in the batch. */
	acceptAll(): void {
		this.error = null;
		this.results = [];
	}

	/** Refuses the Grade at the given index and accepts the rest. */
	refuseOnly(index: number, batchSize: number): void {
		this.error = null;
		this.results = Array.from({ length: batchSize }, (_, i) => ({ accepted: i !== index }));
	}
}

const ANSWERED_AT = new Date(2026, 9, 17, 9, 0);

describe('ReviewSyncQueue', () => {
	let name: string;
	let queue: ReviewSyncQueue;
	let endpoint: FakePushEndpoint;

	/** The queue follows the connection state Sync keeps in step with the window. */
	const setOnline = (online: boolean): void => {
		Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });
		queue.isOnline = online;
	};

	beforeEach(() => {
		localStorage.clear();
		Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
		name = `voabkr-queue-test-${crypto.randomUUID()}`;
		endpoint = new FakePushEndpoint();
		endpoint.acceptAll();
		queue = new ReviewSyncQueue({ databaseName: name, pushEndpoint: endpoint });
		queue.setLearner(7, true);
	});

	afterEach(async () => {
		await queue.close();
		await deleteDatabase(name);
		localStorage.clear();
	});

	it('sends a Grade through the batch route immediately when online, carrying its Review schedule', async () => {
		const reader = await DeviceStore.open(name);
		const produced = schedule();

		const result = await queue.addReview(101, 4, ANSWERED_AT, produced);

		expect(result).toEqual({ synced: true });
		expect(endpoint.calls).toHaveLength(1);
		expect(endpoint.calls[0]).toEqual([
			{
				cardId: 101,
				grade: 4,
				answeredAt: ANSWERED_AT.toISOString(),
				reviewSchedule: {
					interval: 1,
					efactor: 2.5,
					repetitions: 1,
					nextReviewAt: new Date(2026, 9, 18, 9, 0).toISOString()
				}
			}
		]);
		expect(queue.pendingCount).toBe(0);
		// The next Study session reads this schedule to know the Card is no longer Due.
		expect(await reader.readSchedule(101)).toEqual(produced);
		reader.close();
	});

	it('queues the Review schedule with a Grade given offline, across a reload', async () => {
		setOnline(false);
		const produced = schedule();

		await queue.addReview(202, 1, ANSWERED_AT, produced);

		expect(queue.items[0].schedule).toEqual(produced);

		await queue.close();
		queue = new ReviewSyncQueue({ databaseName: name, pushEndpoint: endpoint });
		await queue.ready;

		expect(queue.items[0].schedule).toEqual(produced);
	});

	it('carries no schedule when the session supplies none', async () => {
		await queue.addReview(404, 3, ANSWERED_AT);

		expect(endpoint.calls[0][0].reviewSchedule).toBeNull();
		expect(queue.pendingCount).toBe(0);
	});

	it('keeps a Grade in the device store when offline, and hydrates it after a reload', async () => {
		setOnline(false);

		const result = await queue.addReview(202, 1, ANSWERED_AT);

		expect(result).toEqual({ synced: false });
		expect(endpoint.calls).toHaveLength(0);
		expect(queue.pendingCount).toBe(1);
		expect(queue.items[0].cardId).toBe(202);
		expect(queue.items[0].grade).toBe(1);
		expect(queue.items[0].learnerId).toBe(7);

		await queue.close();
		queue = new ReviewSyncQueue({ databaseName: name, pushEndpoint: endpoint });
		await queue.ready;

		expect(queue.pendingCount).toBe(1);
		expect(queue.items[0].cardId).toBe(202);
		expect(queue.items[0].learnerId).toBe(7);
		expect(queue.items[0].answeredAt).toEqual(ANSWERED_AT);
		expect(queue.items[0].schedule).toBeNull();
	});

	it('queues a Grade when the online submission fails, and keeps it for the next push', async () => {
		endpoint.error = new Error('Network error');

		const result = await queue.addReview(303, 3, ANSWERED_AT);

		expect(result).toEqual({ synced: false });
		expect(queue.pendingCount).toBe(1);
		expect(queue.items[0].learnerId).toBe(7);
	});

	it('pushes the whole queue as one batch, parking a refused Grade without holding up the rest', async () => {
		setOnline(false);
		await queue.addReview(1, 1, ANSWERED_AT);
		await queue.addReview(2, 3, ANSWERED_AT);
		await queue.addReview(3, 4, ANSWERED_AT);
		expect(queue.pendingCount).toBe(3);

		setOnline(true);
		endpoint.refuseOnly(1, 3);

		await queue.pushGrades(endpoint);

		expect(endpoint.calls).toHaveLength(1);
		expect(endpoint.calls[0].map((grade) => grade.cardId)).toEqual([1, 2, 3]);
		expect(queue.pendingCount).toBe(0);
		expect(queue.parkedCount).toBe(1);
		expect(queue.parkedItems[0].cardId).toBe(2);

		// The parked Grade survives a reload, still out of the active queue.
		await queue.close();
		queue = new ReviewSyncQueue({ databaseName: name, pushEndpoint: endpoint });
		await queue.ready;
		expect(queue.pendingCount).toBe(0);
		expect(queue.parkedCount).toBe(1);
		expect(queue.parkedItems[0].cardId).toBe(2);
	});

	it('offers a parked Grade again on a later push and removes it once accepted', async () => {
		setOnline(false);
		await queue.addReview(1, 1, ANSWERED_AT);
		await queue.addReview(2, 3, ANSWERED_AT);

		setOnline(true);
		endpoint.refuseOnly(0, 2);
		await queue.pushGrades(endpoint);
		expect(queue.parkedCount).toBe(1);

		endpoint.acceptAll();
		await queue.pushGrades(endpoint);

		expect(endpoint.calls[1].map((grade) => grade.cardId)).toEqual([1]);
		expect(queue.parkedCount).toBe(0);
		const store = await queue.device();
		expect(await store?.readQueuedGrades()).toEqual([]);
	});

	it('replays a failed Grade unchanged, so the backend can apply it once', async () => {
		setOnline(false);
		await queue.addReview(7, 3, ANSWERED_AT);
		setOnline(true);

		endpoint.error = new Error('Network error');
		await expect(queue.pushGrades(endpoint)).rejects.toThrow('Network error');
		await expect(queue.pushGrades(endpoint)).rejects.toThrow('Network error');

		expect(endpoint.calls).toHaveLength(2);
		expect(endpoint.calls[1]).toEqual(endpoint.calls[0]);
		expect(queue.pendingCount).toBe(1);

		endpoint.acceptAll();
		await queue.pushGrades(endpoint);
		expect(queue.pendingCount).toBe(0);
	});

	it('uploads the Queued Grades of the learner who signs back in', async () => {
		setOnline(false);
		await queue.addReview(11, 3);
		queue.setLearner(null, false);

		setOnline(true);
		queue.setLearner(7, true);

		await vi.waitFor(() => expect(queue.pendingCount).toBe(0));
		expect(endpoint.calls.at(-1)?.map((grade) => grade.cardId)).toEqual([11]);
	});

	it("does not send another learner's Queued Grades", async () => {
		setOnline(false);
		await queue.addReview(11, 3);
		queue.setLearner(8, true);
		await queue.addReview(22, 4);

		setOnline(true);
		queue.setLearner(8, true);
		await vi.waitFor(() => expect(queue.pendingCount).toBe(1));
		expect(endpoint.calls.at(-1)?.map((grade) => grade.cardId)).toEqual([22]);
		expect(queue.items[0].cardId).toBe(11);

		queue.setLearner(7, true);
		await vi.waitFor(() => expect(queue.pendingCount).toBe(0));
		expect(endpoint.calls.at(-1)?.map((grade) => grade.cardId)).toEqual([11]);
	});

	it("does not upload a remembered learner's Grades until the backend confirms the session", async () => {
		setOnline(false);
		await queue.addReview(44, 3);
		setOnline(true);

		// A remembered learner only establishes ownership; the session is unconfirmed.
		queue.setLearner(7, false);
		await queue.flushQueue();
		expect(endpoint.calls).toHaveLength(0);
		expect(queue.pendingCount).toBe(1);

		// Once the profile request proves the session is theirs, it uploads.
		queue.setLearner(7, true);
		await vi.waitFor(() => expect(queue.pendingCount).toBe(0));
		expect(endpoint.calls.at(-1)?.map((grade) => grade.cardId)).toEqual([44]);
	});

	it('keeps Queued Grades across a sign-out and a reload, still owned by their learner', async () => {
		setOnline(false);
		await queue.addReview(33, 1);
		queue.setLearner(null, false);
		await queue.close();

		queue = new ReviewSyncQueue({ databaseName: name, pushEndpoint: endpoint });
		await queue.ready;
		expect(queue.pendingCount).toBe(1);
		expect(queue.items[0].learnerId).toBe(7);

		// Signed out, a flush sends nothing.
		setOnline(true);
		await queue.flushQueue();
		expect(endpoint.calls).toHaveLength(0);

		// The owner signing in flushes it.
		queue.setLearner(7, true);
		await vi.waitFor(() => expect(queue.pendingCount).toBe(0));
		expect(endpoint.calls.at(-1)?.map((grade) => grade.cardId)).toEqual([33]);
	});

	it('does not push while offline', async () => {
		setOnline(false);
		await queue.addReview(9, 3, ANSWERED_AT);

		await queue.pushGrades(endpoint);

		expect(endpoint.calls).toHaveLength(0);
		expect(queue.pendingCount).toBe(1);
	});

	it('clears the queue, including parked Grades, and its stored records', async () => {
		setOnline(false);
		await queue.addReview(99, 3, ANSWERED_AT);
		await queue.addReview(100, 3, ANSWERED_AT);
		setOnline(true);
		endpoint.refuseOnly(0, 2);
		await queue.pushGrades(endpoint);
		expect(queue.parkedCount).toBe(1);

		await queue.clear();

		expect(queue.pendingCount).toBe(0);
		expect(queue.parkedCount).toBe(0);

		await queue.close();
		queue = new ReviewSyncQueue({ databaseName: name, pushEndpoint: endpoint });
		await queue.ready;
		expect(queue.pendingCount).toBe(0);
		expect(queue.parkedCount).toBe(0);
	});
});
