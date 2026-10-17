import { describe, expect, it, vi } from 'vitest';
import type { Card } from '$lib/types';
import { loadStudyDeck, type StudyDeckDependencies } from './loadStudyDeck';

/** A Card belonging to a Deck. */
const card = (id: number, deckId = 10): Card => ({
	id,
	deckId,
	koreanWord: `단어 ${id}`,
	englishWord: `Word ${id}`,
	context: '',
	example: ''
});

/** The collaborators a test hands to `loadStudyDeck`, each defaulted and spied. */
const dependencies = (overrides: Partial<StudyDeckDependencies> = {}): StudyDeckDependencies => ({
	isOnline: () => true,
	isDeckHeld: async () => false,
	fetchAllCards: vi.fn(async () => []),
	downloadDeck: vi.fn(async () => {}),
	...overrides
});

describe('loadStudyDeck', () => {
	it('downloads every Card in the Deck, not only the Due ones, when the Deck is first studied online', async () => {
		const allCards = [card(1), card(2), card(3)];
		const deps = dependencies({ fetchAllCards: vi.fn(async () => allCards) });

		expect(await loadStudyDeck(10, deps)).toEqual({ kind: 'ready' });
		expect(deps.fetchAllCards).toHaveBeenCalledWith(10);
		expect(deps.downloadDeck).toHaveBeenCalledWith(10, allCards);
	});

	it('does not download a Deck again when it is already held', async () => {
		const deps = dependencies({ isDeckHeld: async () => true });

		expect(await loadStudyDeck(10, deps)).toEqual({ kind: 'ready' });
		expect(deps.fetchAllCards).not.toHaveBeenCalled();
		expect(deps.downloadDeck).not.toHaveBeenCalled();
	});

	it('makes a Deck already held on the device ready with no connection', async () => {
		const deps = dependencies({ isOnline: () => false, isDeckHeld: async () => true });

		expect(await loadStudyDeck(10, deps)).toEqual({ kind: 'ready' });
		expect(deps.fetchAllCards).not.toHaveBeenCalled();
		expect(deps.downloadDeck).not.toHaveBeenCalled();
	});

	it('says a Deck that is not held needs a connection when there is no connection', async () => {
		const deps = dependencies({ isOnline: () => false, isDeckHeld: async () => false });

		expect(await loadStudyDeck(10, deps)).toEqual({ kind: 'needs-connection' });
		expect(deps.fetchAllCards).not.toHaveBeenCalled();
		expect(deps.downloadDeck).not.toHaveBeenCalled();
	});

	it('says an unheld Deck needs a connection when the connection drops while fetching its Cards', async () => {
		let online = true;
		const deps = dependencies({
			isOnline: () => online,
			isDeckHeld: async () => false,
			fetchAllCards: vi.fn(async () => {
				online = false;
				throw new Error('Network error');
			})
		});

		expect(await loadStudyDeck(10, deps)).toEqual({ kind: 'needs-connection' });
	});

	it('says an unheld Deck needs a connection when the connection drops while downloading it', async () => {
		let online = true;
		const deps = dependencies({
			isOnline: () => online,
			isDeckHeld: async () => false,
			fetchAllCards: vi.fn(async () => [card(1)]),
			downloadDeck: vi.fn(async () => {
				online = false;
				throw new Error('Network error');
			})
		});

		expect(await loadStudyDeck(10, deps)).toEqual({ kind: 'needs-connection' });
	});

	it('reports an online failure to fetch the Cards instead of claiming the Deck needs a connection', async () => {
		const deps = dependencies({
			fetchAllCards: vi.fn(async () => {
				throw new Error('Server error');
			})
		});

		await expect(loadStudyDeck(10, deps)).rejects.toThrow('Server error');
		expect(deps.downloadDeck).not.toHaveBeenCalled();
	});

	it('reports an online failure to download the Cards instead of claiming the Deck needs a connection', async () => {
		const deps = dependencies({
			fetchAllCards: vi.fn(async () => [card(1)]),
			downloadDeck: vi.fn(async () => {
				throw new Error('Storage full');
			})
		});

		await expect(loadStudyDeck(10, deps)).rejects.toThrow('Storage full');
	});
});
