import { SvelteDate } from 'svelte/reactivity';
import { reviewApi } from '$lib/api/reviews';
import { DeviceStore, type QueuedGrade } from '$lib/device/deviceStore';
import type { SM2Rating } from '$lib/types';

/** The queue's store, overridable so a test can use a database of its own. */
export interface ReviewSyncQueueOptions {
	databaseName?: string;
}

/**
 * The Grade queue: Grades the backend has not accepted yet, kept in the device
 * store so they are durable across a reload and never share a bucket with cache.
 *
 * It submits immediately when online and otherwise records the Grade. A flush
 * sends the queue in order and stops at the first failure; Sync (#30) replaces
 * that with a batch that parks a refused Grade instead.
 */
class ReviewSyncQueue {
	readonly #store: Promise<DeviceStore | null>;
	readonly #ready: Promise<void>;
	#queue = $state<QueuedGrade[]>([]);
	#fallbackId = 0;
	public isSyncing = $state<boolean>(false);
	public isOnline = $state<boolean>(true);

	constructor(options: ReviewSyncQueueOptions = {}) {
		if (typeof window === 'undefined') {
			this.#store = Promise.resolve(null);
			this.#ready = Promise.resolve();
			return;
		}

		this.isOnline = navigator.onLine;
		this.#store = DeviceStore.open(options.databaseName).catch((error) => {
			console.error('[SyncQueue] Failed to open the device store:', error);
			return null;
		});
		this.#ready = this.#hydrate();

		window.addEventListener('online', () => {
			this.isOnline = true;
			void this.flushQueue();
		});

		window.addEventListener('offline', () => {
			this.isOnline = false;
		});
	}

	/** Resolves once the queue has been read from the device store. */
	public get ready(): Promise<void> {
		return this.#ready;
	}

	public get pendingCount(): number {
		return this.#queue.length;
	}

	public get items(): QueuedGrade[] {
		return this.#queue;
	}

	async addReview(cardId: number, grade: SM2Rating): Promise<{ synced: boolean }> {
		await this.#ready;

		if (this.isOnline) {
			try {
				await reviewApi.submitReviewScore(cardId, grade);
				return { synced: true };
			} catch (err) {
				console.warn(
					`[SyncQueue] Direct submission failed for card ${cardId}. Queueing offline.`,
					err
				);
			}
		}

		const answeredAt = new SvelteDate();
		const store = await this.#store;
		if (store) {
			const queued = await store.appendQueuedGrade({
				cardId,
				grade,
				answeredAt,
				schedule: null
			});
			this.#queue.push(queued);
		} else {
			// The store could not be opened: keep the Grade for this sitting so a
			// connection can still carry it, though a reload would lose it.
			this.#queue.push({ id: --this.#fallbackId, cardId, grade, answeredAt, schedule: null });
		}

		return { synced: false };
	}

	async flushQueue(): Promise<void> {
		await this.#ready;
		if (typeof navigator !== 'undefined' && !navigator.onLine) return;
		if (this.isSyncing || this.#queue.length === 0) return;

		this.isSyncing = true;

		try {
			while (this.#queue.length > 0) {
				const item = this.#queue[0];
				try {
					await reviewApi.submitReviewScore(item.cardId, item.grade);
					const store = await this.#store;
					if (store) {
						await store.removeQueuedGrades([item.id]);
					}
					this.#queue.shift();
				} catch (err) {
					console.warn('[SyncQueue] Flushing stopped due to error:', err);
					break;
				}
			}
		} finally {
			this.isSyncing = false;
		}
	}

	async clear(): Promise<void> {
		await this.#ready;
		const store = await this.#store;
		if (store) {
			await store.removeQueuedGrades(this.#queue.map((item) => item.id));
		}
		this.#queue = [];
	}

	/** Closes the device store, ending this queue's use of it. */
	async close(): Promise<void> {
		await this.#ready;
		(await this.#store)?.close();
	}

	async #hydrate(): Promise<void> {
		const store = await this.#store;
		if (!store) return;
		try {
			this.#queue = await store.readQueuedGrades();
		} catch (error) {
			console.error('[SyncQueue] Failed to read the queue from the device store:', error);
		}
	}
}

export const reviewSync = new ReviewSyncQueue();
export { ReviewSyncQueue };
