import { SvelteDate, SvelteMap, SvelteSet } from 'svelte/reactivity';
import { syncApi } from '$lib/api/sync';
import type { DeviceStore, QueuedGrade } from '$lib/device/deviceStore';
import {
	DeviceStoreConnection,
	type DeviceStoreConnectionOptions
} from '$lib/device/deviceStoreConnection';
import type { ReviewSchedule } from '$lib/scheduling/reviewSchedule';
import {
	toSchedulePayload,
	type GradeBatchEntry,
	type GradePushEndpoint,
	type GradePushOutcome
} from '$lib/sync/contract';
import type { SM2Rating } from '$lib/types';

/** The queue's store and endpoint, overridable so a test can supply its own. */
export interface ReviewSyncQueueOptions extends DeviceStoreConnectionOptions {
	pushEndpoint?: GradePushEndpoint;
}

/** What one Grade did. `synced` means it is no longer waiting on the device. */
export interface AddReviewResult {
	synced: boolean;
}

/**
 * The Grade queue: Grades the backend has not accepted yet, kept in the device
 * store so they are durable across a reload and never share a bucket with cache.
 *
 * Each Queued Grade belongs to the learner who gave it, so it survives a
 * sign-out and uploads only when that same learner signs back in. Every Grade
 * goes through the batch route, online with a batch of one. A Grade the backend
 * refuses is parked: it leaves the active queue, stays on the device, and is
 * offered again on later Syncs. One refusal never stops the Grades that were
 * sent with it.
 */
class ReviewSyncQueue {
	readonly #connection: DeviceStoreConnection | null;
	#ready: Promise<void>;
	readonly #pushEndpoint: GradePushEndpoint;
	#queue = $state<QueuedGrade[]>([]);
	#parked = $state<QueuedGrade[]>([]);
	#fallbackId = 0;
	#learnerId = $state<number | null>(null);
	#sessionConfirmed = false;
	#pushChain: Promise<void> = Promise.resolve();
	public isSyncing = $state<boolean>(false);
	public isOnline = $state<boolean>(true);

	constructor(options: ReviewSyncQueueOptions = {}) {
		this.#pushEndpoint = options.pushEndpoint ?? syncApi;

		if (typeof window === 'undefined') {
			this.#connection = null;
			this.#ready = Promise.resolve();
			return;
		}

		this.isOnline = navigator.onLine;
		this.#connection = new DeviceStoreConnection(options);
		this.#ready = this.#hydrate();
		// A blocked open must not surface as an unhandled rejection while no
		// Sync or Study session is reading the queue.
		this.#ready.catch(() => {});
	}

	/**
	 * Resolves once the queue has been read from the device store. It rejects
	 * with DeviceStoreBlockedError while another tab or window holds an older
	 * version, so a caller can offer a Retry rather than an empty queue.
	 */
	public get ready(): Promise<void> {
		return this.#ready;
	}

	/** The device store this queue reads and writes, once it has opened. */
	public async device(): Promise<DeviceStore | null> {
		await this.#ready;
		return this.#connection ? this.#connection.current() : null;
	}

	/**
	 * Re-attempts the store open and re-reads the Grade queue, as the Study
	 * stage's Retry does once the other tab or window is closed. Throws
	 * DeviceStoreBlockedError when the store is still in the way.
	 */
	public async reopen(): Promise<void> {
		if (!this.#connection) return;
		this.#ready = this.#connection.reopen().then((store) => this.#readQueue(store));
		this.#ready.catch(() => {});
		await this.#ready;
	}

	/** Grades waiting for the backend; parked Grades are not counted. */
	public get pendingCount(): number {
		return this.#queue.length;
	}

	/** Grades the backend refused, kept for a later Sync. */
	public get parkedCount(): number {
		return this.#parked.length;
	}

	/** The active queue, in the order the Grades were given. */
	public get items(): QueuedGrade[] {
		return this.#queue;
	}

	/** The parked Grades, in the order the Grades were given. */
	public get parkedItems(): QueuedGrade[] {
		return this.#parked;
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
		}
	}

	/**
	 * Records a Grade, with the Review schedule the device computed for it.
	 *
	 * The schedule is written to the device store whichever way the Grade
	 * travels, so the next Study session sees the Card's new Due moment rather
	 * than repeating the one just answered. A Grade the backend accepts is not
	 * left queued; one that cannot be sent stays for a later Sync.
	 */
	async addReview(
		cardId: number,
		grade: SM2Rating,
		answeredAt: Date = new SvelteDate(),
		schedule: ReviewSchedule | null = null
	): Promise<AddReviewResult> {
		await this.#ready;
		const learnerId = this.#learnerId;
		const store = await this.#store();
		let queued: QueuedGrade;
		if (store) {
			queued = await store.appendQueuedGrade({ learnerId, cardId, grade, answeredAt, schedule });
		} else {
			// The store could not be opened: keep the Grade for this sitting so a
			// connection can still carry it, though a reload would lose it.
			queued = { id: --this.#fallbackId, learnerId, cardId, grade, answeredAt, schedule };
		}
		this.#queue.push(queued);

		if (!this.#sessionConfirmed || !this.isOnline) return { synced: false };

		try {
			await this.pushGrades(this.#pushEndpoint);
		} catch (error) {
			console.warn('[SyncQueue] Direct submission failed. The Grade stays queued.', error);
			return { synced: false };
		}

		return { synced: !this.#queue.some((item) => item.id === queued.id) };
	}

	/**
	 * Sends every Grade the confirmed learner has on the device — active and
	 * parked — as one batch and applies the result per Grade. Pushes are
	 * serialized so a Grade recorded while a push is in flight cannot be sent
	 * twice.
	 */
	async pushGrades(endpoint: GradePushEndpoint = this.#pushEndpoint): Promise<GradePushOutcome> {
		await this.#ready;
		const run = this.#pushChain.then(() => this.#push(endpoint));
		this.#pushChain = run.then(
			() => undefined,
			() => undefined
		);
		return run;
	}

	/**
	 * Offers the confirmed learner's Grades now. The auth store calls this when
	 * a session is confirmed; Sync calls `pushGrades` as part of every Sync.
	 */
	async flushQueue(): Promise<void> {
		if (!this.#sessionConfirmed) return;
		try {
			await this.pushGrades(this.#pushEndpoint);
		} catch (error) {
			console.warn('[SyncQueue] Flush failed. The Grades stay queued.', error);
		}
	}

	async clear(): Promise<void> {
		await this.#ready;
		const ids = [...this.#queue, ...this.#parked].map((item) => item.id);
		const store = await this.#store();
		if (store) {
			await store.removeQueuedGrades(ids);
		}
		this.#queue = [];
		this.#parked = [];
	}

	/** Closes the device store, ending this queue's use of it. */
	async close(): Promise<void> {
		if (!this.#connection) return;
		await this.#ready.catch(() => {});
		(await this.#connection.current())?.close();
	}

	async #push(endpoint: GradePushEndpoint): Promise<GradePushOutcome> {
		const learnerId = this.#learnerId;
		const active =
			learnerId === null ? [] : this.#queue.filter((grade) => grade.learnerId === learnerId);
		const parked =
			learnerId === null ? [] : this.#parked.filter((grade) => grade.learnerId === learnerId);

		// Signed out, unconfirmed, or offline: the Grades stay on the device.
		if (!this.#sessionConfirmed || !this.isOnline || learnerId === null) {
			return { accepted: 0, parked: 0, remaining: active.length };
		}

		const grades = [...active, ...parked].sort((a, b) => a.id - b.id);
		if (grades.length === 0) {
			return { accepted: 0, parked: 0, remaining: 0 };
		}

		this.isSyncing = true;
		try {
			const results = await endpoint.pushGrades(grades.map(toBatchEntry));
			const accepted = new SvelteSet<number>();
			const refused = new SvelteSet<number>();

			grades.forEach((grade, index) => {
				const result = results[index];
				if (result?.accepted) {
					accepted.add(grade.id);
				} else if (result) {
					refused.add(grade.id);
				}
				// A missing result leaves the Grade active: nothing was decided, so a
				// later Sync asks again rather than losing it or parking it.
			});

			const store = await this.#store();
			if (store) {
				if (accepted.size > 0) {
					await store.removeQueuedGrades([...accepted]);
				}
				if (refused.size > 0) {
					await store.parkQueuedGrades([...refused]);
				}
			}

			const byId = new SvelteMap<number, QueuedGrade>();
			for (const grade of grades) byId.set(grade.id, grade);
			this.#queue = this.#queue.filter(
				(grade) => !accepted.has(grade.id) && !refused.has(grade.id)
			);
			this.#parked = this.#parked.filter((grade) => !accepted.has(grade.id));
			for (const id of refused) {
				if (this.#parked.some((grade) => grade.id === id)) continue;
				const grade = byId.get(id);
				if (grade) this.#parked.push({ ...grade, parked: true });
			}

			return {
				accepted: accepted.size,
				parked: refused.size,
				remaining: this.#queue.filter((grade) => grade.learnerId === learnerId).length
			};
		} finally {
			this.isSyncing = false;
		}
	}

	/** The open store, or null where a store failure only means degraded storage. */
	async #store(): Promise<DeviceStore | null> {
		return this.#connection ? this.#connection.current() : null;
	}

	async #hydrate(): Promise<void> {
		if (!this.#connection) return;
		await this.#readQueue(await this.#connection.current());
	}

	/** Reads the store's Grades into the queue, keeping any this sitting cannot persist. */
	async #readQueue(store: DeviceStore | null): Promise<void> {
		if (!store) return;
		try {
			const grades = await store.readQueuedGrades();
			// A Grade recorded while the store was unavailable has a negative id no
			// stored Grade can carry, and must not be lost by re-hydrating.
			const unpersisted = this.#queue.filter((grade) => grade.id < 0);
			this.#queue = [...grades.filter((grade) => !grade.parked), ...unpersisted];
			this.#parked = grades.filter((grade) => grade.parked);
		} catch (error) {
			console.error('[SyncQueue] Failed to read the queue from the device store:', error);
		}
	}
}

/** One Queued Grade in the wire shape of the batch route. */
function toBatchEntry(grade: QueuedGrade): GradeBatchEntry {
	return {
		cardId: grade.cardId,
		grade: grade.grade,
		answeredAt: grade.answeredAt.toISOString(),
		reviewSchedule: toSchedulePayload(grade.schedule)
	};
}

export const reviewSync = new ReviewSyncQueue();
export { ReviewSyncQueue };
