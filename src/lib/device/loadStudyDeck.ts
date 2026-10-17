import type { Card } from '$lib/types';

/**
 * The collaborators a Study session needs to ensure a Deck is on the device.
 * The page supplies the network, the device store, and the browser's connection
 * state.
 */
export interface StudyDeckDependencies {
	isOnline(): boolean;
	isDeckHeld(deckId: number): Promise<boolean>;
	fetchAllCards(deckId: number): Promise<Card[]>;
	downloadDeck(deckId: number, cards: readonly Card[]): Promise<void>;
}

/** Whether the Deck can be studied, or why it cannot be started. */
export type StudyDeckLoad = { kind: 'ready' } | { kind: 'needs-connection' };

/**
 * Makes a Deck studyable by ensuring every Card in it is held on the device.
 *
 * Online, the first study of a Deck pulls every Card in it — not only today's
 * Due Cards — and holds them on the device together with their Review
 * schedules. Later studies make no fetch: the Session queue is assembled from
 * the device's copy.
 *
 * With no connection, only a Deck already held can be studied. A Deck that is
 * not held answers that it needs a connection rather than surfacing whatever
 * the failed fetch threw. If the connection drops while the first download is
 * in flight, the same rule applies. Any other failure is the caller's to
 * report.
 */
export async function loadStudyDeck(
	deckId: number,
	deps: StudyDeckDependencies
): Promise<StudyDeckLoad> {
	const held = await deps.isDeckHeld(deckId);

	if (!deps.isOnline() || held) {
		return held ? { kind: 'ready' } : { kind: 'needs-connection' };
	}

	try {
		await deps.downloadDeck(deckId, await deps.fetchAllCards(deckId));
	} catch (error) {
		// The connection can drop between the check and the download. Only then is
		// "needs a connection" the truth; any other failure belongs to the caller.
		if (!deps.isOnline()) return { kind: 'needs-connection' };
		throw error;
	}

	return { kind: 'ready' };
}
