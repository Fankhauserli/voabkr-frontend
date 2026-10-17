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
		const learnerId = this.#learnerId;

		if (this.#sessionConfirmed && this.isOnline) {
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
				learnerId,
				cardId,
				grade,
				answeredAt,
				schedule
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
				schedule
			});
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
