import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { Card } from '$lib/types';
import { DeviceStore, type DownloadedDeck } from './deviceStore';
import { reviewScheduleOf } from './cardReviewSchedule';

/** Where the held Decks are stored. Overridable so a test can use a database of its own. */
export interface DownloadedDecksOptions {
	databaseName?: string;
}

/**
 * The Decks held on the device, as the Library and a Study session see them.
 *
 * A Deck becomes held the first time it is studied: every Card in it is written
 * with the Review schedule it carries, so the whole Deck can be read with no
 * connection. Removing a Deck releases it from the store and from this view in
 * one step, so the Library tells the truth without waiting for a reload.
 */
export class DownloadedDecks {
	readonly #store: Promise<DeviceStore | null>;
	readonly #ready: Promise<void>;
	readonly #held = $state(new SvelteSet<number>());

	constructor(options: DownloadedDecksOptions = {}) {
		if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
			this.#store = Promise.resolve(null);
			this.#ready = Promise.resolve();
			return;
		}

		this.#store = DeviceStore.open(options.databaseName).catch((error) => {
			console.error('[DownloadedDecks] Failed to open the device store:', error);
			return null;
		});
		this.#ready = this.#hydrate();
	}

	/** Resolves once the held Decks have been read from the device store. */
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
	 * Holds every Card of a Deck and the Review schedule each Card carries, then
	 * marks the Deck held. It is called when the Deck is first studied.
	 */
	async download(deckId: number, cards: readonly Card[]): Promise<void> {
		await this.#ready;
		const store = await this.#store;
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
	async contents(deckId: number): Promise<DownloadedDeck> {
		await this.#ready;
		const store = await this.#store;
		if (!store) return { cards: [], schedules: new SvelteMap() };
		return store.readDeck(deckId);
	}

	/**
	 * Releases a Deck from the device. The Deck stops being held as soon as the
	 * caller asks, so the Library reflects the removal immediately; if the store
	 * refuses, it is put back rather than claiming something untrue.
	 */
	async remove(deckId: number): Promise<void> {
		await this.#ready;
		this.#held.delete(deckId);
		const store = await this.#store;
		if (!store) return;

		try {
			await store.releaseDeck(deckId);
		} catch (error) {
			this.#held.add(deckId);
			throw error;
		}
	}

	/** Closes the device store, ending this view's use of it. */
	async close(): Promise<void> {
		await this.#ready;
		(await this.#store)?.close();
	}

	async #hydrate(): Promise<void> {
		const store = await this.#store;
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
}

export const downloadedDecks = new DownloadedDecks();
