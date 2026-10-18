import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { Card } from '$lib/types';
import type { DeviceStore, DownloadedDeck } from './deviceStore';
import { DeviceStoreConnection, type DeviceStoreConnectionOptions } from './deviceStoreConnection';
import { reviewScheduleOf } from './cardReviewSchedule';

/** Where the held Decks are stored. Overridable so a test can use a database of its own. */
export type DownloadedDecksOptions = DeviceStoreConnectionOptions;

/**
 * The Decks held on the device, as the Library and a Study session see them.
 *
 * A Deck becomes held the first time it is studied: every Card in it is written
 * with the Review schedule it carries, so the whole Deck can be read with no
 * connection. Removing a Deck releases it from the store and from this view in
 * one step, so the Library tells the truth without waiting for a reload.
 */
export class DownloadedDecks {
	readonly #connection: DeviceStoreConnection | null;
	#ready: Promise<void>;
	readonly #held = $state(new SvelteSet<number>());

	constructor(options: DownloadedDecksOptions = {}) {
		if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
			this.#connection = null;
			this.#ready = Promise.resolve();
			return;
		}

		this.#connection = new DeviceStoreConnection(options);
		this.#ready = this.#hydrate();
		// A route may not wait on `ready` before the store is read, and a blocked
		// open must not surface as an unhandled rejection.
		this.#ready.catch(() => {});
	}

	/**
	 * Resolves once the held Decks have been read from the device store. It
	 * rejects with DeviceStoreBlockedError while another tab or window holds an
	 * older version, so a caller can offer a Retry rather than an empty view.
	 */
	public get ready(): Promise<void> {
		return this.#ready;
	}

	/** The ids of the Decks held on the device, reactive to download and removal. */
	public get heldDeckIds(): ReadonlySet<number> {
		return this.#held;
	}

	public isHeld(deckId: number): boolean {
		return this.#held.has(deckId);
	}

	/**
	 * Stops treating a Deck as held after something else has already released it
	 * from the store — Sync does this when a pull no longer returns the Deck. No
	 * store write happens here, so the app's view catches up without a second
	 * release or a reload.
	 */
	public forget(deckId: number): void {
		this.#held.delete(deckId);
	}

	/**
	 * Holds every Card of a Deck and the Review schedule each Card carries, then
	 * marks the Deck held. It is called when the Deck is first studied.
	 */
	async download(deckId: number, cards: readonly Card[]): Promise<void> {
		const store = await this.#store();
		if (!store) return;

		await store.saveCards(cards);
		for (const card of cards) {
			const schedule = reviewScheduleOf(card);
			if (schedule) {
				await store.writeSchedule(card.id, schedule);
			}
		}
		await store.holdDeck(deckId);
		this.#held.add(deckId);
	}

	/** Reads a Deck held on the device, without a network. */
	async readDeck(deckId: number): Promise<DownloadedDeck> {
		const store = await this.#store();
		if (!store) return { cards: [], schedules: new SvelteMap() };
		return store.readDeck(deckId);
	}

	/**
	 * Releases a Deck from the device. The Deck stops being held as soon as the
	 * caller asks, so the Library reflects the removal immediately; if the store
	 * refuses, it is put back rather than claiming something untrue.
	 */
	async remove(deckId: number): Promise<void> {
		// Read the store first: a blocked store must not change what the view claims.
		const store = await this.#store();
		this.#held.delete(deckId);
		if (!store) return;

		try {
			await store.releaseDeck(deckId);
		} catch (error) {
			this.#held.add(deckId);
			throw error;
		}
	}

	/**
	 * Re-attempts the store open and re-reads the held Decks, as the Study
	 * stage's Retry does once the other tab or window is closed. Throws
	 * DeviceStoreBlockedError when the store is still in the way.
	 */
	async reopen(): Promise<void> {
		if (!this.#connection) return;
		this.#ready = this.#connection.reopen().then((store) => this.#readHeldDecks(store));
		this.#ready.catch(() => {});
		await this.#ready;
	}

	/** Closes the device store, ending this view's use of it. */
	async close(): Promise<void> {
		if (!this.#connection) return;
		await this.#ready.catch(() => {});
		(await this.#connection.current())?.close();
	}

	/** Reads the store's held Decks into the view, replacing what it showed. */
	async #readHeldDecks(store: DeviceStore | null): Promise<void> {
		this.#held.clear();
		if (!store) return;
		try {
			const heldDeckIds = await store.listHeldDecks();
			for (const deckId of heldDeckIds) {
				this.#held.add(deckId);
			}
		} catch (error) {
			console.error('[DownloadedDecks] Failed to read the held Decks:', error);
		}
	}

	async #hydrate(): Promise<void> {
		if (!this.#connection) return;
		await this.#readHeldDecks(await this.#connection.current());
	}

	/** The open store, once hydration has read it; null when it is unavailable. */
	async #store(): Promise<DeviceStore | null> {
		await this.#ready;
		return this.#connection ? this.#connection.current() : null;
	}
}

export const downloadedDecks = new DownloadedDecks();
