/**
 * The Deck Study page (`+page.svelte` in this directory). The spec is named
 * without the leading `+`, which SvelteKit reserves for route files.
 */
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import StudyDeckPage from './+page.svelte';
import { cardApi } from '$lib/api/cards';
import { deckApi } from '$lib/api/decks';
import { downloadedDecks } from '$lib/device/downloadedDecks.svelte';
import { deviceStudySource } from '$lib/study/deviceSource';
import type { DeckContents } from '$lib/study/queueAssembly';
import { studySession } from '$lib/stores/study.svelte';
import type { Card } from '$lib/types';

vi.mock('$app/state', () => ({ page: { params: { deckId: '10' } } }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$lib/utils/backButton', () => ({
	registerStudySessionGuard: vi.fn(() => () => {})
}));
// The page drives the real Study session singleton, whose Grades would otherwise
// be sent over the network; stand in for the offline sync queue.
vi.mock('$lib/stores/syncQueue.svelte', () => ({
	reviewSync: { addReview: vi.fn(async () => ({ synced: true })) }
}));
vi.mock('$lib/api/decks', () => ({
	deckApi: {
		getDeckById: vi.fn(async () => ({ id: 10, name: '한국어 기초', type: 'vocabulary' }))
	}
}));
vi.mock('$lib/api/cards', () => ({ cardApi: { getCards: vi.fn(async () => []) } }));
vi.mock('$lib/device/downloadedDecks.svelte', () => ({
	downloadedDecks: {
		ready: Promise.resolve(),
		isHeld: vi.fn(() => false),
		download: vi.fn(async () => {}),
		readDeck: vi.fn(async () => ({ cards: [], schedules: new Map() }))
	}
}));
// The Session queue is assembled from the device store. Mocking its source lets
// a test say what the device holds without opening IndexedDB; the download mock
// below writes the downloaded Cards into it.
vi.mock('$lib/study/deviceSource', () => ({
	deviceStudySource: {
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

const setOnline = (online: boolean): void => {
	Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });
};

beforeEach(() => {
	vi.clearAllMocks();
	studySession.reset();
	setOnline(true);
	vi.mocked(deckApi.getDeckById).mockResolvedValue({
		id: 10,
		name: '한국어 기초',
		type: 'vocabulary'
	});
	vi.mocked(cardApi.getCards).mockResolvedValue([]);
	vi.mocked(downloadedDecks.isHeld).mockReturnValue(false);
	vi.mocked(deviceStudySource.readDecks).mockResolvedValue([]);
	vi.mocked(deviceStudySource.readNewCardsIntroduced).mockResolvedValue(0);
});

afterEach(() => {
	setOnline(true);
});

test('says a Deck that is not held needs a connection when there is none', async () => {
	setOnline(false);

	const screen = render(StudyDeckPage);

	await expect.element(screen.getByText('This Deck needs a connection')).toBeVisible();
	expect(cardApi.getCards).not.toHaveBeenCalled();
	expect(downloadedDecks.download).not.toHaveBeenCalled();
	expect(deviceStudySource.readDecks).not.toHaveBeenCalled();
});

test('downloads every Card in the Deck when it is first studied, then studies from the device', async () => {
	const allCards = [card(1), card(2), card(3)];
	vi.mocked(cardApi.getCards).mockResolvedValue(allCards);
	// The real download writes the Cards to the device store; do the same here.
	vi.mocked(downloadedDecks.download).mockImplementation(async (_deckId, cards) => {
		vi.mocked(deviceStudySource.readDecks).mockResolvedValue(heldDeck(cards));
	});

	render(StudyDeckPage);

	await vi.waitFor(() => {
		expect(downloadedDecks.download).toHaveBeenCalledWith(10, allCards);
	});
	expect(cardApi.getCards).toHaveBeenCalledWith(10, { bypassCache: true });
	await vi.waitFor(() => {
		expect(studySession.totalCards).toBe(3);
	});
	expect(studySession.currentCard?.id).toBe(1);
});

test('studies a Deck already held on the device when there is no connection', async () => {
	setOnline(false);
	vi.mocked(downloadedDecks.isHeld).mockReturnValue(true);
	vi.mocked(deviceStudySource.readDecks).mockResolvedValue(heldDeck([card(5), card(6)]));

	render(StudyDeckPage);

	await vi.waitFor(() => {
		expect(studySession.totalCards).toBe(2);
	});
	expect(cardApi.getCards).not.toHaveBeenCalled();
});

test('does not download a Deck that is already held', async () => {
	vi.mocked(downloadedDecks.isHeld).mockReturnValue(true);
	vi.mocked(deviceStudySource.readDecks).mockResolvedValue(heldDeck([card(1)]));

	render(StudyDeckPage);

	await vi.waitFor(() => {
		expect(studySession.totalCards).toBe(1);
	});
	expect(cardApi.getCards).not.toHaveBeenCalled();
	expect(downloadedDecks.download).not.toHaveBeenCalled();
});

test('reports an online Deck that fails to load instead of claiming it needs a connection', async () => {
	vi.mocked(cardApi.getCards).mockRejectedValue(new Error('Server error'));

	const screen = render(StudyDeckPage);

	await expect.element(screen.getByText('Could not load this Deck')).toBeVisible();
	await expect.element(screen.getByText('Server error')).toBeVisible();
	expect(screen.getByText('This Deck needs a connection').elements()).toHaveLength(0);
	expect(downloadedDecks.download).not.toHaveBeenCalled();
});

test('resumes the sitting in hand when the same Deck route mounts again', async () => {
	vi.mocked(downloadedDecks.isHeld).mockReturnValue(true);
	vi.mocked(deviceStudySource.readDecks).mockResolvedValue(heldDeck([card(1), card(2)]));

	await studySession.start({ deckId: 10 });
	await studySession.rateCurrentCard(3);
	expect(studySession.currentCard?.id).toBe(2);

	render(StudyDeckPage);

	await vi.waitFor(() => expect(downloadedDecks.isHeld).toHaveBeenCalled());
	await vi.waitFor(() => expect(studySession.isLoading).toBe(false));
	expect(deviceStudySource.readDecks).toHaveBeenCalledTimes(1);
	expect(studySession.answeredCount).toBe(1);
	expect(studySession.currentCard?.id).toBe(2);
});

test('drops the sitting in hand when the requested Deck needs a connection', async () => {
	vi.mocked(downloadedDecks.isHeld).mockReturnValue(true);
	vi.mocked(deviceStudySource.readDecks).mockResolvedValue(heldDeck([card(1)]));
	await studySession.start({ deckId: 10 });
	expect(studySession.isActive).toBe(true);

	vi.mocked(downloadedDecks.isHeld).mockReturnValue(false);
	setOnline(false);

	const screen = render(StudyDeckPage);

	await expect.element(screen.getByText('This Deck needs a connection')).toBeVisible();
	expect(studySession.isActive).toBe(false);
	expect(studySession.currentCard).toBeNull();
});

test('drops the sitting in hand when this Deck fails to load', async () => {
	vi.mocked(downloadedDecks.isHeld).mockReturnValue(true);
	vi.mocked(deviceStudySource.readDecks).mockResolvedValue(heldDeck([card(1)]));
	await studySession.start({ deckId: 10 });
	expect(studySession.isActive).toBe(true);

	vi.mocked(downloadedDecks.isHeld).mockReturnValue(false);
	vi.mocked(cardApi.getCards).mockRejectedValue(new Error('Server error'));

	const screen = render(StudyDeckPage);

	await expect.element(screen.getByText('Could not load this Deck')).toBeVisible();
	expect(studySession.isActive).toBe(false);
	expect(studySession.error).toBe('Server error');
});
