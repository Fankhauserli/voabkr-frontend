import { syncApi } from '$lib/api/sync';
import type { DeviceStore } from '$lib/device/deviceStore';
import { downloadedDecks } from '$lib/device/downloadedDecks.svelte';
import { reviewSync } from '$lib/stores/syncQueue.svelte';
import type { GradePushEndpoint, GradePushOutcome, SyncEndpoint } from './contract';

export type { GradeBatchEntry, GradeBatchResult, SyncEndpoint } from './contract';

/** What Sync needs from the Grade queue. The device queue is the implementation. */
export interface SyncQueue {
	isOnline: boolean;
	device(): Promise<DeviceStore | null>;
	pushGrades(endpoint: GradePushEndpoint): Promise<GradePushOutcome>;
}

/** The app's view of which Decks are held on the device. */
export interface HeldDeckView {
	/** Stops treating a Deck as held after the pull released it from the store. */
	forget(deckId: number): void;
}

export interface SyncOptions {
	queue: SyncQueue;
	/** The backend endpoint, injected so tests never reach the network. */
	endpoint: SyncEndpoint;
	/** The app's held-Deck view, kept in step when a pull releases a Deck. */
	decks?: HeldDeckView;
}

/** What a pull replaced, refreshed, released, or could not fetch. */
export interface PullReport {
	/** Whether the Library list was replaced with the pull's answer. */
	libraryReplaced: boolean;
	/** Downloaded Decks whose Cards and schedules were replaced. */
	decksRefreshed: number[];
	/** Downloaded Decks the Library no longer returns; they left with their Cards. */
	decksReleased: number[];
	/** Downloaded Decks whose pull failed; their local contents were kept. */
	decksFailed: number[];
}

/** What one Sync did. Errors are reported rather than thrown: Sync is fire-and-forget. */
export interface SyncReport {
	push: GradePushOutcome | null;
	pushError: unknown;
	pull: PullReport | null;
	pullError: unknown;
}

/**
 * Sync: push the Queued Grades, then pull the Library and every Deck held on
 * the device, replacing local state wholesale.
 *
 * It runs on reconnect, on app open, and when a Study session ends. The push
 * comes first so the backend holds the offline work before the pull replaces
 * local state, and a failed pull never blocks the push — the Queued Grades are
 * the only thing here the backend cannot reconstruct.
 */
export class Sync {
	readonly #queue: SyncQueue;
	readonly #endpoint: SyncEndpoint;
	readonly #decks: HeldDeckView | undefined;
	#running: Promise<SyncReport> | null = null;
	#started = false;
	#onOnline: (() => void) | null = null;
	#onOffline: (() => void) | null = null;

	constructor(options: SyncOptions) {
		this.#queue = options.queue;
		this.#endpoint = options.endpoint;
		this.#decks = options.decks;
	}

	/**
	 * Starts Sync for this app: once now, for app open, and again whenever the
	 * connection returns. Returns the first Sync so a caller can await it.
	 */
	start(): Promise<SyncReport> {
		if (typeof window === 'undefined') return this.sync();

		if (!this.#started) {
			this.#started = true;
			this.#onOnline = () => {
				this.#queue.isOnline = true;
				const running = this.#running;
				if (!running) {
					void this.sync();
					return;
				}
				// A Sync already in flight began while offline, so it may have skipped
				// the push. Run again once it settles, now that there is a connection.
				void running.then(() => {
					if (this.#queue.isOnline) void this.sync();
				});
			};
			this.#onOffline = () => {
				this.#queue.isOnline = false;
			};
			window.addEventListener('online', this.#onOnline);
			window.addEventListener('offline', this.#onOffline);
		}

		return this.sync();
	}

	/** Stops listening for connection changes. */
	stop(): void {
		if (typeof window !== 'undefined') {
			if (this.#onOnline) window.removeEventListener('online', this.#onOnline);
			if (this.#onOffline) window.removeEventListener('offline', this.#onOffline);
		}
		this.#onOnline = null;
		this.#onOffline = null;
		this.#started = false;
	}

	/** Pushes, then pulls. Concurrent callers share the Sync already running. */
	sync(): Promise<SyncReport> {
		if (this.#running) return this.#running;
		const running = this.#run().finally(() => {
			if (this.#running === running) this.#running = null;
		});
		this.#running = running;
		return running;
	}

	async #run(): Promise<SyncReport> {
		let push: GradePushOutcome | null = null;
		let pushError: unknown = null;
		try {
			push = await this.#queue.pushGrades(this.#endpoint);
		} catch (error) {
			pushError = error;
		}

		// Deliberately independent of the push: a failed pull must never block the
		// push, and the push above has already happened by the time this runs.
		let pull: PullReport | null = null;
		let pullError: unknown = null;
		try {
			pull = await this.#pull();
		} catch (error) {
			pullError = error;
		}

		return { push, pushError, pull, pullError };
	}

	async #pull(): Promise<PullReport> {
		const report: PullReport = {
			libraryReplaced: false,
			decksRefreshed: [],
			decksReleased: [],
			decksFailed: []
		};

		const store = await this.#queue.device();
		if (!store) return report;

		const library = await this.#endpoint.pullLibrary();
		await store.replaceLibrary(library);
		report.libraryReplaced = true;

		const libraryIds = new Set(library.map((deck) => deck.id));
		for (const deckId of await store.listHeldDecks()) {
			if (!libraryIds.has(deckId)) {
				// Deleted, or its DeckShare revoked: the Deck leaves with its Cards,
				// and the app's view must stop calling it held without a reload.
				await store.releaseDeck(deckId);
				this.#decks?.forget(deckId);
				report.decksReleased.push(deckId);
				continue;
			}

			try {
				const contents = await this.#endpoint.pullDeck(deckId);
				await store.replaceDeck(deckId, contents);
				report.decksRefreshed.push(deckId);
			} catch (error) {
				// A failed fetch is not a deletion: keep what the device already has.
				console.warn(`[Sync] Could not pull Deck ${deckId}; keeping its local contents.`, error);
				report.decksFailed.push(deckId);
			}
		}

		return report;
	}
}

/** The app's Sync: the device queue, the backend's HTTP endpoint, and the held-Deck view. */
export const appSync = new Sync({ queue: reviewSync, endpoint: syncApi, decks: downloadedDecks });
