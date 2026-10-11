import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { deckApi } from './decks';
import { clientCache } from './cache';

describe('deckApi sharing and access methods', () => {
	const mockFetch = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		clientCache.clear();
		globalThis.fetch = mockFetch;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('creates a private or public deck with POST /decks/', async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ message: 'Deck created' }), {
				status: 201,
				headers: { 'Content-Type': 'application/json' }
			})
		);

		const result = await deckApi.createDeck({
			name: 'My Custom Deck',
			type: 'vocabulary',
			isPublic: false
		});

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toContain('/decks/');
		expect(init.method).toBe('POST');
		expect(JSON.parse(init.body)).toEqual({
			name: 'My Custom Deck',
			type: 'vocabulary',
			isPublic: false
		});
		expect(result).toEqual({ message: 'Deck created' });
	});

	it('shares a deck by email and permission with POST /decks/:id/share', async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					shareToken: 'tok_abc123',
					message: 'Invited user'
				}),
				{
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				}
			)
		);

		const result = await deckApi.shareDeck(42, {
			email: 'friend@example.com',
			permission: 'edit'
		});

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toContain('/decks/42/share');
		expect(init.method).toBe('POST');
		expect(JSON.parse(init.body)).toEqual({
			email: 'friend@example.com',
			permission: 'edit'
		});
		expect(result).toEqual({
			shareToken: 'tok_abc123',
			message: 'Invited user'
		});
	});

	it('fetches shared deck preview via token with GET /decks/shared/:token', async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					id: 10,
					name: 'Korean Idioms',
					type: 'vocabulary',
					cardCount: 50,
					ownerName: 'Minho'
				}),
				{
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				}
			)
		);

		const result = await deckApi.getSharedDeckByToken('tok_preview_123');

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toContain('/decks/shared/tok_preview_123');
		expect(init?.method ?? 'GET').toBe('GET');
		expect(result.name).toBe('Korean Idioms');
		expect(result.ownerName).toBe('Minho');
	});

	it('joins a shared deck with POST /decks/shared/:token/join', async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					message: 'Successfully joined deck',
					data: { deckId: 10 }
				}),
				{
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				}
			)
		);

		const result = await deckApi.joinSharedDeck('tok_preview_123');

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toContain('/decks/shared/tok_preview_123/join');
		expect(init.method).toBe('POST');
		expect(result.message).toBe('Successfully joined deck');
	});

	it('revokes deck share with DELETE /decks/:id/share/:userId', async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ message: 'Access revoked' }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);

		const result = await deckApi.revokeDeckShare(10, 99);

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toContain('/decks/10/share/99');
		expect(init.method).toBe('DELETE');
		expect(result).toEqual({ message: 'Access revoked' });
	});
});
