/**
 * The Deck Study page (`+page.svelte` in this directory). The spec is named
 * without the leading `+`, which SvelteKit reserves for route files.
 */
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import StudyDeckPage from './+page.svelte';
import { cardApi } from '$lib/api/cards';
import { reviewApi } from '$lib/api/reviews';
import { deckApi } from '$lib/api/decks';
import { downloadedDecks } from '$lib/device/downloadedDecks.svelte';
import { studySession } from '$lib/stores/study.svelte';
import { toast } from '$lib/stores/toast.svelte';
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
vi.mock('$lib/api/reviews', () => ({ reviewApi: { getDueCards: vi.fn(async () => []) } }));
vi.mock('$lib/device/downloadedDecks.svelte', () => ({
	downloadedDecks: {
		ready: Promise.resolve(),
		isHeld: vi.fn(() => false),
		download: vi.fn(async () => {}),
		readDeck: vi.fn(async () => ({ cards: [], schedules: new Map() }))
	}
}));
vi.mock('$lib/stores/toast.svelte', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/** A Card belonging to the Deck under study. */
const card = (id: number): Card => ({
	id,
	deckId: 10,
	koreanWord: `단어 ${id}`,
	englishWord: `Word ${id}`,
	context: '',
	example: ''
});

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
	vi.mocked(reviewApi.getDueCards).mockResolvedValue([]);
	vi.mocked(downloadedDecks.isHeld).mockReturnValue(false);
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
});

test('downloads every Card in the Deck when it is first studied, then offers the Due ones', async () => {
	const allCards = [card(1), card(2), card(3)];
	const dueCards = [card(2)];
	vi.mocked(cardApi.getCards).mockResolvedValue(allCards);
	vi.mocked(reviewApi.getDueCards).mockResolvedValue(dueCards);

	render(StudyDeckPage);

	await vi.waitFor(() => {
		expect(downloadedDecks.download).toHaveBeenCalledWith(10, allCards);
	});
	expect(cardApi.getCards).toHaveBeenCalledWith(10, { bypassCache: true });
	await vi.waitFor(() => {
		expect(studySession.totalCards).toBe(1);
	});
	expect(studySession.currentCard?.id).toBe(2);
});

test('studies a Deck already held on the device when there is no connection', async () => {
	setOnline(false);
	vi.mocked(downloadedDecks.isHeld).mockReturnValue(true);
	vi.mocked(downloadedDecks.readDeck).mockResolvedValue({
		cards: [card(5), card(6)],
		schedules: new Map()
	});

	render(StudyDeckPage);

	await vi.waitFor(() => {
		expect(studySession.totalCards).toBe(2);
	});
	expect(cardApi.getCards).not.toHaveBeenCalled();
});

test('reports an online Deck that fails to load instead of claiming it needs a connection', async () => {
	vi.mocked(reviewApi.getDueCards).mockRejectedValue(new Error('Server error'));

	const screen = render(StudyDeckPage);

	await expect.element(screen.getByText('Could not load this Deck')).toBeVisible();
	await expect.element(screen.getByText('Server error')).toBeVisible();
	expect(screen.getByText('This Deck needs a connection').elements()).toHaveLength(0);
	expect(cardApi.getCards).not.toHaveBeenCalled();
});

test('says a Deck could not be downloaded, then studies the Due Cards anyway', async () => {
	const dueCards = [card(2)];
	vi.mocked(cardApi.getCards).mockRejectedValue(new Error('Storage full'));
	vi.mocked(reviewApi.getDueCards).mockResolvedValue(dueCards);

	render(StudyDeckPage);

	await vi.waitFor(() => {
		expect(toast.error).toHaveBeenCalledWith('Could not download this Deck to the device');
	});
	await vi.waitFor(() => {
		expect(studySession.totalCards).toBe(1);
	});
	expect(studySession.currentCard?.id).toBe(2);
});
