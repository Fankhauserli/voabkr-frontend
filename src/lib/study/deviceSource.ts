import type { DeviceStore } from '$lib/device/deviceStore';
import {
	DeviceStoreConnection,
	type DeviceStoreConnectionOptions
} from '$lib/device/deviceStoreConnection';
import type { ReviewSchedule } from '$lib/scheduling/reviewSchedule';
import type { DeckContents } from './queueAssembly';

/**
 * Where a Study session reads the Cards it offers: the device's own store.
 *
 * It makes no network calls. A Deck that is not held on the device is simply
 * absent, so the Session queue can be assembled with no connection at all.
 */
export interface StudyDeviceSource {
	/** The held Decks, in Deck order, or just the one asked for when it is held. */
	readDecks(deckId?: number): Promise<DeckContents[]>;
	/** How many New Cards have been introduced in the Day that began at `dayStart`. */
	readNewCardsIntroduced(dayStart: Date): Promise<number>;
	/** Records a New Card as introduced in that Day. */
	recordNewCardIntroduced(dayStart: Date, cardId: number): Promise<void>;
	/** Writes the Review schedule a Card now carries. */
	writeSchedule(cardId: number, schedule: ReviewSchedule): Promise<void>;
}

/**
 * The Study session's view of the device store, opened lazily on first use.
 *
 * A blocked open is reported to the caller rather than hidden, so the Study
 * stage can say another tab or window is in the way and Retry can re-open the
 * store in place.
 */
export class DeviceStudySource implements StudyDeviceSource {
	readonly #connection: DeviceStoreConnection | null;

	constructor(options: DeviceStoreConnectionOptions = {}) {
		this.#connection = typeof indexedDB === 'undefined' ? null : new DeviceStoreConnection(options);
	}

	async readDecks(deckId?: number): Promise<DeckContents[]> {
		const store = await this.#store();
		if (!store) return [];

		// listHeldDecks returns Deck ids in order, and readDeck returns each
		// Deck's Cards in the order the Deck holds them.
		const held = await store.listHeldDecks();
		const deckIds = deckId === undefined ? held : held.filter((id) => id === deckId);

		return Promise.all(deckIds.map(async (id) => ({ deckId: id, ...(await store.readDeck(id)) })));
	}

	async readNewCardsIntroduced(dayStart: Date): Promise<number> {
		const store = await this.#store();
		return store ? store.readNewCardsIntroduced(dayStart) : 0;
	}

	async recordNewCardIntroduced(dayStart: Date, cardId: number): Promise<void> {
		const store = await this.#store();
		if (store) await store.recordNewCardIntroduced(dayStart, cardId);
	}

	async writeSchedule(cardId: number, schedule: ReviewSchedule): Promise<void> {
		const store = await this.#store();
		if (store) await store.writeSchedule(cardId, schedule);
	}

	/**
	 * Re-attempts the store open, as the Study stage's Retry does once the other
	 * tab or window is closed. Throws DeviceStoreBlockedError when it is still
	 * in the way.
	 */
	async reopen(): Promise<void> {
		if (!this.#connection) return;
		await this.#connection.reopen();
	}

	/** Closes the device store, ending this view's use of it. */
	async close(): Promise<void> {
		await this.#connection?.close();
	}

	async #store(): Promise<DeviceStore | null> {
		return this.#connection ? this.#connection.current() : null;
	}
}

export const deviceStudySource = new DeviceStudySource();
