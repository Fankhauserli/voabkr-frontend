import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Card, CardReviewSchedule } from '$lib/types';
import { DownloadedDecks } from './downloadedDecks.svelte';

/** A Card belonging to a Deck, carrying the Review schedule the backend serves. */
const card = (
	id: number,
	deckId: number,
	reviewSchedule: CardReviewSchedule | null = null
): Card => ({
	id,
	deckId,
	koreanWord: `단어 ${id}`,
	englishWord: `Word ${id}`,
	context: '',
	example: '',
	reviewSchedule
});

/** A Review schedule as the wire carries it, due on the given October day. */
const wireSchedule = (day: number): CardReviewSchedule => ({
	interval: 6,
	efactor: 2.5,
	repetitions: 2,
	nextReviewAt: new Date(Date.UTC(2026, 9, day, 9, 0)).toISOString()
});

/** The same schedule as the device holds it. */
const heldSchedule = (day: number) => ({
	interval: 6,
	efactor: 2.5,
	repetitions: 2,
	nextReviewAt: new Date(Date.UTC(2026, 9, day, 9, 0))
});

/** Deletes a test database once the store has closed it. */
const deleteDatabase = (name: string): Promise<void> =>
	new Promise((resolve, reject) => {
		const request = indexedDB.deleteDatabase(name);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
		request.onblocked = () => reject(new Error(`Deleting ${name} was blocked`));
	});

describe('DownloadedDecks', () => {
	let name: string;
	let decks: DownloadedDecks;

	beforeEach(() => {
		localStorage.clear();
		name = `voabkr-downloaded-decks-test-${crypto.randomUUID()}`;
		decks = new DownloadedDecks({ databaseName: name });
	});

	afterEach(async () => {
		await decks.close();
		await deleteDatabase(name);
		localStorage.clear();
	});

	it('holds every Card of a studied Deck, each with the Review schedule it carried', async () => {
		await decks.download(10, [card(1, 10, wireSchedule(23)), card(2, 10)]);

		expect(decks.isHeld(10)).toBe(true);
		expect(decks.heldDeckIds.has(10)).toBe(true);

		const contents = await decks.readDeck(10);
		expect(contents.cards.map((held) => held.id)).toEqual([1, 2]);
		// The studied Card carries its schedule; the New Card has none yet.
		expect(contents.schedules.get(1)).toEqual(heldSchedule(23));
		expect(contents.schedules.has(2)).toBe(false);
	});

	it('keeps a held Deck across a reload', async () => {
		await decks.download(10, [card(1, 10, wireSchedule(23))]);

		await decks.close();
		decks = new DownloadedDecks({ databaseName: name });
		await decks.ready;

		expect(decks.isHeld(10)).toBe(true);
		expect((await decks.readDeck(10)).cards.map((held) => held.id)).toEqual([1]);
	});

	it('removes a Deck from the device at once, leaving every other held Deck alone', async () => {
		await decks.download(10, [card(1, 10, wireSchedule(23))]);
		await decks.download(20, [card(3, 20, wireSchedule(24))]);

		await decks.remove(10);

		expect(decks.isHeld(10)).toBe(false);
		expect(decks.isHeld(20)).toBe(true);
		expect(await decks.readDeck(10)).toEqual({ cards: [], schedules: new Map() });
		expect((await decks.readDeck(20)).cards.map((held) => held.id)).toEqual([3]);

		// The removal is durable, not only a change to the view.
		await decks.close();
		decks = new DownloadedDecks({ databaseName: name });
		await decks.ready;
		expect(decks.isHeld(10)).toBe(false);
		expect(decks.isHeld(20)).toBe(true);
	});
});
