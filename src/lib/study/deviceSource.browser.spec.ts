import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Card } from '$lib/types';
import { DeviceStore, DeviceStoreBlockedError } from '$lib/device/deviceStore';
import { DeviceStudySource } from './deviceSource';

/** A Card belonging to a Deck. */
const card = (id: number, deckId: number): Card => ({
	id,
	deckId,
	koreanWord: `단어 ${id}`,
	englishWord: `Word ${id}`,
	context: '',
	example: ''
});

/** Deletes a test database once the source has closed it. */
const deleteDatabase = (name: string): Promise<void> =>
	new Promise((resolve, reject) => {
		const request = indexedDB.deleteDatabase(name);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
		request.onblocked = () => reject(new Error(`Deleting ${name} was blocked`));
	});

describe('DeviceStudySource', () => {
	let name: string;
	let source: DeviceStudySource;

	beforeEach(() => {
		localStorage.clear();
		name = `voabkr-device-source-test-${crypto.randomUUID()}`;
	});

	afterEach(async () => {
		await source.close();
		await deleteDatabase(name);
		localStorage.clear();
	});

	it('reopens the store and reads the held Decks after another tab releases it', async () => {
		// A Deck was held by an earlier launch, then another tab blocked this one.
		const seed = await DeviceStore.open(name);
		await seed.saveCards([card(1, 10)]);
		await seed.holdDeck(10);
		seed.close();

		let attempts = 0;
		source = new DeviceStudySource({
			databaseName: name,
			openStore: async () => {
				attempts += 1;
				if (attempts === 1) throw new DeviceStoreBlockedError();
				return DeviceStore.open(name);
			}
		});

		await expect(source.readDecks()).rejects.toBeInstanceOf(DeviceStoreBlockedError);

		await source.reopen();

		const decks = await source.readDecks();
		expect(decks.map((deck) => deck.deckId)).toEqual([10]);
		expect(decks[0].cards.map((held) => held.id)).toEqual([1]);
	});
});
