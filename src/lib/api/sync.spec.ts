import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { syncApi } from './sync';
import { deckApi } from './decks';
import { clientCache } from './cache';

describe('syncApi', () => {
	const mockFetch = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		clientCache.clear();
		globalThis.fetch = mockFetch;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('posts a batch of Grades to /reviews/batch and reports a result per Grade', async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					results: [{ accepted: true }, { accepted: false, error: 'DeckShare revoked' }]
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			)
		);
		const grades = [
			{
				cardId: 1,
				grade: 3 as const,
				answeredAt: '2026-10-17T09:00:00.000Z',
				reviewSchedule: {
					interval: 1,
					efactor: 2.5,
					repetitions: 1,
					nextReviewAt: '2026-10-18T09:00:00.000Z'
				}
			},
			{
				cardId: 2,
				grade: 4 as const,
				answeredAt: '2026-10-17T09:05:00.000Z',
				reviewSchedule: null
			}
		];

		const results = await syncApi.pushGrades(grades);

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toContain('/reviews/batch');
		expect(init.method).toBe('POST');
		expect(JSON.parse(init.body)).toEqual({ grades });
		expect(results).toEqual([{ accepted: true }, { accepted: false, error: 'DeckShare revoked' }]);
	});

	it('fetches the Library fresh from /decks/', async () => {
		const library = [{ id: 10, name: 'Korean Basics', type: 'vocabulary' }];
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify(library), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);

		const result = await syncApi.pullLibrary();

		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toContain('/decks/');
		expect(init?.method ?? 'GET').toBe('GET');
		expect(result).toEqual(library);
	});

	it('replaces the Library the app reads, not only the device store copy', async () => {
		const library = [{ id: 10, name: 'Korean Basics', type: 'vocabulary' }];
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify(library), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);

		await syncApi.pullLibrary();
		mockFetch.mockClear();

		// The Library page reads through deckApi's cache; the pull replaced it.
		expect(await deckApi.getDecks()).toEqual(library);
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("fetches a Deck's Cards with their Review schedules and maps them into the device store's shape", async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(
				JSON.stringify([
					{
						id: 1,
						deckId: 10,
						koreanWord: '단어',
						englishWord: 'Word',
						context: '',
						example: '',
						reviewSchedule: {
							interval: 6,
							efactor: 2.5,
							repetitions: 2,
							nextReviewAt: '2026-10-23T09:00:00.000Z'
						}
					},
					{
						id: 2,
						deckId: 10,
						koreanWord: '새 단어',
						englishWord: 'New Word',
						context: '',
						example: '',
						reviewSchedule: null
					}
				]),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			)
		);

		const result = await syncApi.pullDeck(10);

		const [url] = mockFetch.mock.calls[0];
		expect(url).toContain('/cards/');
		expect(url).toContain('deck_id=10');
		expect(result.cards).toEqual([
			{
				id: 1,
				deckId: 10,
				koreanWord: '단어',
				englishWord: 'Word',
				context: '',
				example: ''
			},
			{
				id: 2,
				deckId: 10,
				koreanWord: '새 단어',
				englishWord: 'New Word',
				context: '',
				example: ''
			}
		]);
		expect(result.schedules).toEqual(
			new Map([
				[
					1,
					{
						interval: 6,
						efactor: 2.5,
						repetitions: 2,
						nextReviewAt: new Date('2026-10-23T09:00:00.000Z')
					}
				]
			])
		);
	});
});
