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
 * Each Queued Grade belongs to the learner who gave it, so it survives a
 * sign-out and uploads only when that same learner signs back in. A flush sends
 * the current learner's Grades in order and stops at the first failure; Sync
 * (#30) replaces that with a batch that parks a refused Grade instead.
 */
class ReviewSyncQueue {
	readonly #store: Promise<DeviceStore | null>;
	readonly #ready: Promise<void>;
	#queue = $state<QueuedGrade[]>([]);
	#fallbackId = 0;
	#flushRequested = false;
	#learnerId = $state<number | null>(null);
	#sessionConfirmed = false;
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

	/** The learner whose Queued Grades are recorded and may be sent. */
	public get learnerId(): number | null {
		return this.#learnerId;
	}

	/**
	 * Tells the queue which learner is signed in.
	 *
	 * `sessionConfirmed` is false while the learner is only remembered from the
	 * last launch. Their new Grades are recorded under them, but nothing uploads
	 * until the backend confirms the session belongs to them; this is what stops
	 * a different session from carrying their Grades.
	 */
	setLearner(learnerId: number | null, sessionConfirmed: boolean): void {
		this.#learnerId = learnerId;
		this.#sessionConfirmed = learnerId !== null && sessionConfirmed;
		if (this.#sessionConfirmed) {
			void this.flushQueue();
		} else {
			// A flush requested for a session that is no longer confirmed must not
			// run once the current one finishes.
			this.#flushRequested = false;
		}
	}

	async addReview(cardId: number, grade: SM2Rating): Promise<{ synced: boolean }> {
		await this.#ready;
		const learnerId = this.#learnerId;

		if (this.#sessionConfirmed && this.isOnline) {
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
				learnerId,
				cardId,
				grade,
				answeredAt,
				schedule: null
			});
			this.#queue.push(queued);
		} else {
			// The store could not be opened: keep the Grade for this sitting so a
			// connection can still carry it, though a reload would lose it.
			this.#queue.push({
				id: --this.#fallbackId,
				learnerId,
				cardId,
				grade,
				answeredAt,
				schedule: null
			});
		}

		return { synced: false };
	}

	async flushQueue(): Promise<void> {
		await this.#ready;
		// Signed out, unconfirmed, or the learner changed while this flush was
		// waiting: nothing here may travel under the current session.
		if (!this.#sessionConfirmed) return;
		const learnerId = this.#learnerId;
		if (learnerId === null) return;
		if (typeof navigator !== 'undefined' && !navigator.onLine) return;
		if (this.isSyncing) {
			this.#flushRequested = true;
			return;
		}

		this.isSyncing = true;

		try {
			while (this.#sessionConfirmed && this.#learnerId === learnerId) {
				const index = this.#queue.findIndex((item) => item.learnerId === learnerId);
				if (index < 0) break;
				const item = this.#queue[index];
				try {
					await reviewApi.submitReviewScore(item.cardId, item.grade);
					const store = await this.#store;
					if (store) {
						await store.removeQueuedGrades([item.id]);
					}
					this.#queue.splice(index, 1);
				} catch (err) {
					console.warn('[SyncQueue] Flushing stopped due to error:', err);
					break;
				}
			}
		} finally {
			this.isSyncing = false;
			if (this.#flushRequested) {
				this.#flushRequested = false;
				void this.flushQueue();
			}
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
