import { DeviceStore } from '$lib/device/deviceStore';
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

/** The Study session's view of the device store, opened lazily on first use. */
class DeviceStudySource implements StudyDeviceSource {
	readonly #store: Promise<DeviceStore | null>;

	constructor() {
		if (typeof indexedDB === 'undefined') {
			this.#store = Promise.resolve(null);
			return;
		}
		this.#store = DeviceStore.open().catch((error) => {
			console.error('[DeviceStudySource] Failed to open the device store:', error);
			return null;
		});
	}

	async readDecks(deckId?: number): Promise<DeckContents[]> {
		const store = await this.#store;
		if (!store) return [];

		// listHeldDecks returns Deck ids in order, and readDeck returns each
		// Deck's Cards in the order the Deck holds them.
		const held = await store.listHeldDecks();
		const deckIds = deckId === undefined ? held : held.filter((id) => id === deckId);

		return Promise.all(deckIds.map(async (id) => ({ deckId: id, ...(await store.readDeck(id)) })));
	}

	async readNewCardsIntroduced(dayStart: Date): Promise<number> {
		const store = await this.#store;
		return store ? store.readNewCardsIntroduced(dayStart) : 0;
	}

	async recordNewCardIntroduced(dayStart: Date, cardId: number): Promise<void> {
		const store = await this.#store;
		if (store) await store.recordNewCardIntroduced(dayStart, cardId);
	}

	async writeSchedule(cardId: number, schedule: ReviewSchedule): Promise<void> {
		const store = await this.#store;
		if (store) await store.writeSchedule(cardId, schedule);
	}
}

export const deviceStudySource = new DeviceStudySource();
