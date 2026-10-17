import type { Card } from '$lib/types';

/** The Cards the device holds for a Deck. */
export interface HeldDeck {
	cards: Card[];
}

/**
 * The collaborators a Study session needs to load a Deck. The page supplies the
 * network, the device store, and the browser's connection state.
 */
export interface StudyDeckDependencies {
	isOnline(): boolean;
	isDeckHeld(deckId: number): Promise<boolean>;
	fetchAllCards(deckId: number): Promise<Card[]>;
	fetchDueCards(deckId: number): Promise<Card[]>;
	downloadDeck(deckId: number, cards: readonly Card[]): Promise<void>;
	readHeldDeck(deckId: number): Promise<HeldDeck>;
}

/** What a Study session should offer, or why it cannot be started. */
export type StudyDeckLoad = { kind: 'ready'; sessionCards: Card[] } | { kind: 'needs-connection' };

/**
 * Loads the Cards a Study session of one Deck offers.
 *
 * Online, the first study of a Deck pulls every Card in it — not only today's
 * Due Cards — and holds them on the device together with their Review
 * schedules. Later studies, and every study of a Deck already held, offer the
 * Due Cards the backend reports for the sitting.
 *
 * With no connection, only a Deck already held can be studied. A Deck that is
 * not held answers that it needs a connection rather than surfacing whatever
 * the failed fetch threw. A failed fetch for a Deck that is held falls back to
 * what the device has, so a dropped connection does not stop the sitting.
 */
export async function loadStudyDeck(
	deckId: number,
	deps: StudyDeckDependencies
): Promise<StudyDeckLoad> {
	const held = await deps.isDeckHeld(deckId);

	if (!deps.isOnline()) {
		return held
			? { kind: 'ready', sessionCards: (await deps.readHeldDeck(deckId)).cards }
			: { kind: 'needs-connection' };
	}

	let dueCards: Card[];
	try {
		dueCards = await deps.fetchDueCards(deckId);
	} catch {
		return held
			? { kind: 'ready', sessionCards: (await deps.readHeldDeck(deckId)).cards }
			: { kind: 'needs-connection' };
	}

	if (!held) {
		try {
			await deps.downloadDeck(deckId, await deps.fetchAllCards(deckId));
		} catch (error) {
			// The sitting can still go ahead; the next study tries the download again.
			console.error('[loadStudyDeck] Failed to download the Deck:', error);
		}
	}

	return {
		kind: 'ready',
		sessionCards: dueCards.filter((card) => card.deckId === deckId)
	};
}
