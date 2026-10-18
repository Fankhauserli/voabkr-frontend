/**
 * The due-queue Study page (`+page.svelte` in this directory). The spec is
 * named without the leading `+`, which SvelteKit reserves for route files.
 */
import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import StudyDuePage from './+page.svelte';
import { DeviceStoreBlockedError } from '$lib/device/deviceStore';
import { downloadedDecks } from '$lib/device/downloadedDecks.svelte';
import { deviceStudySource } from '$lib/study/deviceSource';
import type { DeckContents } from '$lib/study/queueAssembly';
import { reviewSync } from '$lib/stores/syncQueue.svelte';
import { studySession } from '$lib/stores/study.svelte';
import type { Card } from '$lib/types';

vi.mock('$app/state', () => ({
	page: { url: { searchParams: { get: () => null } } }
}));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$lib/utils/backButton', () => ({
	registerStudySessionGuard: vi.fn(() => () => {})
}));
// The page drives the real Study session singleton, whose Grades would otherwise
// be sent over the network; stand in for the offline sync queue.
vi.mock('$lib/stores/syncQueue.svelte', () => ({
	reviewSync: {
		addReview: vi.fn(async () => ({ synced: true })),
		reopen: vi.fn(async () => {})
	}
}));
vi.mock('$lib/device/downloadedDecks.svelte', () => ({
	downloadedDecks: { reopen: vi.fn(async () => {}) }
}));
vi.mock('$lib/study/deviceSource', () => ({
	deviceStudySource: {
		reopen: vi.fn(async () => {}),
		readDecks: vi.fn(async () => []),
		readNewCardsIntroduced: vi.fn(async () => 0),
		recordNewCardIntroduced: vi.fn(async () => {}),
		writeSchedule: vi.fn(async () => {})
	}
}));

/** A Card belonging to the Deck under study. */
const card = (id: number): Card => ({
	id,
	deckId: 10,
	koreanWord: `단어 ${id}`,
	englishWord: `Word ${id}`,
	context: '',
	example: ''
});

/** The device's copy of a Deck, holding `cards` in Deck order. */
const heldDeck = (cards: readonly Card[]): DeckContents[] => [
	{ deckId: 10, cards, schedules: new Map() }
];

beforeEach(() => {
	vi.clearAllMocks();
	studySession.reset();
	vi.mocked(deviceStudySource.readDecks).mockResolvedValue([]);
	vi.mocked(deviceStudySource.readNewCardsIntroduced).mockResolvedValue(0);
	vi.mocked(deviceStudySource.reopen).mockResolvedValue(undefined);
	vi.mocked(downloadedDecks.reopen).mockResolvedValue(undefined);
	vi.mocked(reviewSync.reopen).mockResolvedValue(undefined);
});

test('says the device store is blocked and starts the sitting when Retry can open it', async () => {
	vi.mocked(deviceStudySource.readDecks).mockRejectedValueOnce(new DeviceStoreBlockedError());

	const screen = render(StudyDuePage);

	await expect
		.element(screen.getByRole('heading', { name: /other voabkr tab or window/i }))
		.toBeVisible();
	expect(studySession.storeBlocked).toBe(true);
	// The blocked store is not a queue with nothing due.
	expect(screen.getByText('No Cards Due').elements()).toHaveLength(0);

	// The learner closes the other tab; Retry reopens every consumer in place.
	vi.mocked(deviceStudySource.readDecks).mockResolvedValue(heldDeck([card(1)]));

	await screen.getByRole('button', { name: 'Try again' }).click();

	await vi.waitFor(() => expect(studySession.totalCards).toBe(1));
	expect(deviceStudySource.reopen).toHaveBeenCalledOnce();
	expect(downloadedDecks.reopen).toHaveBeenCalledOnce();
	expect(reviewSync.reopen).toHaveBeenCalledOnce();
});

test('keeps the way back when Retry cannot reopen every consumer', async () => {
	vi.mocked(deviceStudySource.readDecks).mockRejectedValueOnce(new DeviceStoreBlockedError());
	vi.mocked(reviewSync.reopen).mockRejectedValue(new DeviceStoreBlockedError());

	const screen = render(StudyDuePage);

	await expect
		.element(screen.getByRole('heading', { name: /other voabkr tab or window/i }))
		.toBeVisible();

	// The device source can open now, but the Grade queue is still blocked.
	vi.mocked(deviceStudySource.readDecks).mockResolvedValue(heldDeck([card(1)]));

	await screen.getByRole('button', { name: 'Try again' }).click();

	await vi.waitFor(() => expect(reviewSync.reopen).toHaveBeenCalledOnce());
	await expect
		.element(screen.getByRole('heading', { name: /other voabkr tab or window/i }))
		.toBeVisible();
	expect(studySession.storeBlocked).toBe(true);
	expect(studySession.totalCards).toBe(0);
	// The sitting never read the device after an incomplete Retry.
	expect(deviceStudySource.readDecks).toHaveBeenCalledOnce();
});
