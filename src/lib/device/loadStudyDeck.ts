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
export type StudyDeckLoad =
	{ kind: 'ready'; sessionCards: Card[]; downloadFailed?: boolean } | { kind: 'needs-connection' };

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
 * the failed fetch threw. If the connection drops while the Due Cards are being
 * fetched, the same rule applies. Any other failure is the caller's to report.
 *
 * A failed download does not stop the sitting, but it is marked on the result so
 * the caller can tell the learner the Deck is not available offline.
 */
export async function loadStudyDeck(
	deckId: number,
	deps: StudyDeckDependencies
): Promise<StudyDeckLoad> {
	const held = await deps.isDeckHeld(deckId);

	if (!deps.isOnline()) {
		return heldDeckOrNeedsConnection(deckId, held, deps);
	}

	let dueCards: Card[];
	try {
		dueCards = await deps.fetchDueCards(deckId);
	} catch (error) {
		// The connection can drop between the check and the fetch. Only then is
		// "needs a connection" the truth; any other failure belongs to the caller.
		if (!deps.isOnline()) {
			return heldDeckOrNeedsConnection(deckId, held, deps);
		}
		throw error;
	}

	let downloadFailed = false;
	if (!held) {
		try {
			await deps.downloadDeck(deckId, await deps.fetchAllCards(deckId));
		} catch (error) {
			// The sitting can still go ahead; the next study tries the download again.
			downloadFailed = true;
			console.error('[loadStudyDeck] Failed to download the Deck:', error);
		}
	}

	return {
		kind: 'ready',
		sessionCards: dueCards.filter((card) => card.deckId === deckId),
		...(downloadFailed ? { downloadFailed: true } : {})
	};
}

/**
 * The Cards a held Deck offers with no connection, or the answer that the Deck
 * needs one. Both the offline path and a connection that drops mid-fetch ask
 * this same question.
 */
async function heldDeckOrNeedsConnection(
	deckId: number,
	held: boolean,
	deps: StudyDeckDependencies
): Promise<StudyDeckLoad> {
	if (!held) return { kind: 'needs-connection' };
	return { kind: 'ready', sessionCards: (await deps.readHeldDeck(deckId)).cards };
}
