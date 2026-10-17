import { SvelteDate } from 'svelte/reactivity';
import { reviewApi } from '$lib/api/reviews';
import { DeviceStore, type QueuedGrade } from '$lib/device/deviceStore';
import type { ReviewSchedule } from '$lib/scheduling/reviewSchedule';
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

	/**
	 * Records a Grade, with the Review schedule the device computed for it.
	 *
	 * The schedule is written to the device store whichever way the Grade
	 * travels, so the next Study session sees the Card's new Due moment rather
	 * than repeating the one just answered. A Grade the backend accepts is not
	 * queued; one that cannot be sent is, so a later flush carries it.
	 */
	async addReview(
		cardId: number,
		grade: SM2Rating,
		answeredAt: Date = new SvelteDate(),
		schedule: ReviewSchedule | null = null
	): Promise<{ synced: boolean }> {
		await this.#ready;

		if (this.isOnline) {
			try {
				// The device owns the Review schedule: write it before the network
				// so a slow or failed submission cannot leave it stale.
				if (schedule) {
					await this.#writeSchedule(cardId, schedule);
				}
				await reviewApi.submitReviewScore(cardId, grade);
				return { synced: true };
			} catch (err) {
				console.warn(
					`[SyncQueue] Direct submission failed for card ${cardId}. Queueing offline.`,
					err
				);
			}
		}

		const store = await this.#store;
		if (store) {
			const queued = await store.appendQueuedGrade({
				cardId,
				grade,
				answeredAt,
				schedule
			});
			this.#queue.push(queued);
		} else {
			// The store could not be opened: keep the Grade for this sitting so a
			// connection can still carry it, though a reload would lose it.
			this.#queue.push({ id: --this.#fallbackId, cardId, grade, answeredAt, schedule });
		}

		return { synced: false };
	}

	/** Writes a Grade's Review schedule to the device store before the Grade is submitted. */
	async #writeSchedule(cardId: number, schedule: ReviewSchedule): Promise<void> {
		const store = await this.#store;
		if (!store) return;
		try {
			await store.writeSchedule(cardId, schedule);
		} catch (error) {
			// A stale local Due moment is repaired by the next Sync's pull.
			console.error('[SyncQueue] Failed to write the Review schedule:', error);
		}
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
