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
	fetchDueCards: vi.fn(async () => []),
	downloadDeck: vi.fn(async () => {}),
	readHeldDeck: vi.fn(async () => ({ cards: [] })),
	...overrides
});

describe('loadStudyDeck', () => {
	it('downloads every Card in the Deck, not only the Due ones, when the Deck is studied online', async () => {
		const allCards = [card(1), card(2), card(3)];
		const dueCards = [card(2)];
		const deps = dependencies({
			fetchAllCards: vi.fn(async () => allCards),
			fetchDueCards: vi.fn(async () => dueCards)
		});

		const result = await loadStudyDeck(10, deps);

		expect(deps.downloadDeck).toHaveBeenCalledWith(10, allCards);
		expect(result).toEqual({ kind: 'ready', sessionCards: dueCards });
	});

	it('does not download a Deck again when it is already held', async () => {
		const dueCards = [card(2)];
		const deps = dependencies({
			isDeckHeld: async () => true,
			fetchDueCards: vi.fn(async () => dueCards)
		});

		expect(await loadStudyDeck(10, deps)).toEqual({ kind: 'ready', sessionCards: dueCards });
		expect(deps.fetchAllCards).not.toHaveBeenCalled();
		expect(deps.downloadDeck).not.toHaveBeenCalled();
	});

	it('still offers the Due Cards when the first download fails', async () => {
		const dueCards = [card(2)];
		const deps = dependencies({
			fetchAllCards: vi.fn(async () => {
				throw new Error('Network error');
			}),
			fetchDueCards: vi.fn(async () => dueCards)
		});

		expect(await loadStudyDeck(10, deps)).toEqual({ kind: 'ready', sessionCards: dueCards });
		expect(deps.downloadDeck).not.toHaveBeenCalled();
	});

	it('offers only this Deck of the Due Cards the backend reports', async () => {
		const deps = dependencies({
			fetchAllCards: vi.fn(async () => [card(1)]),
			fetchDueCards: vi.fn(async () => [card(1), card(99, 20)])
		});

		expect(await loadStudyDeck(10, deps)).toEqual({
			kind: 'ready',
			sessionCards: [card(1)]
		});
	});

	it('reads a Deck already held from the device when there is no connection', async () => {
		const heldCards = [card(1), card(2)];
		const deps = dependencies({
			isOnline: () => false,
			isDeckHeld: async () => true,
			readHeldDeck: vi.fn(async () => ({ cards: heldCards }))
		});

		expect(await loadStudyDeck(10, deps)).toEqual({ kind: 'ready', sessionCards: heldCards });
		expect(deps.fetchAllCards).not.toHaveBeenCalled();
		expect(deps.fetchDueCards).not.toHaveBeenCalled();
	});

	it('says a Deck that is not held needs a connection when there is no connection', async () => {
		const deps = dependencies({
			isOnline: () => false,
			isDeckHeld: async () => false
		});

		expect(await loadStudyDeck(10, deps)).toEqual({ kind: 'needs-connection' });
		expect(deps.fetchAllCards).not.toHaveBeenCalled();
		expect(deps.downloadDeck).not.toHaveBeenCalled();
	});

	it('falls back to a held Deck when the network fails rather than refusing to study', async () => {
		const heldCards = [card(4)];
		const deps = dependencies({
			isDeckHeld: async () => true,
			fetchDueCards: vi.fn(async () => {
				throw new Error('Network error');
			}),
			readHeldDeck: vi.fn(async () => ({ cards: heldCards }))
		});

		expect(await loadStudyDeck(10, deps)).toEqual({ kind: 'ready', sessionCards: heldCards });
	});

	it('says a Deck that is not held needs a connection when the network fails', async () => {
		const deps = dependencies({
			isDeckHeld: async () => false,
			fetchDueCards: vi.fn(async () => {
				throw new Error('Network error');
			})
		});

		expect(await loadStudyDeck(10, deps)).toEqual({ kind: 'needs-connection' });
	});
});
