import { apiFetch } from './client';
import { clientCache, type CacheOptions } from './cache';
import type {
	ApiResponse,
	CreateDeckRequest,
	Deck,
	DeckShareResponse,
	ShareDeckRequest,
	SharedDeckPreview,
	UpdateDeckRequest
} from '$lib/types';

export const deckApi = {
	getDecks: (options?: CacheOptions<Deck[]>) =>
		clientCache.getWithCache('decks:list', () => apiFetch<Deck[]>('/decks/'), {
			ttl: 5 * 60 * 1000,
			...options
		}),

	getDeckById: (id: number, options?: CacheOptions<Deck>) =>
		clientCache.getWithCache(`decks:item:${id}`, () => apiFetch<Deck>(`/decks/${id}`), {
			ttl: 5 * 60 * 1000,
			...options
		}),

	createDeck: async (data: CreateDeckRequest) => {
		const res = await apiFetch<ApiResponse>('/decks/', {
			method: 'POST',
			body: JSON.stringify(data)
		});
		clientCache.invalidateDecks();
		return res;
	},

	updateDeck: async (id: number, data: UpdateDeckRequest) => {
		const res = await apiFetch<ApiResponse>(`/decks/${id}`, {
			method: 'PUT',
			body: JSON.stringify(data)
		});
		clientCache.invalidateDecks();
		return res;
	},

	deleteDeck: async (id: number) => {
		const res = await apiFetch<ApiResponse>(`/decks/${id}`, {
			method: 'DELETE'
		});
		clientCache.invalidateDecks();
		return res;
	},

	shareDeck: async (id: number, data?: ShareDeckRequest) => {
		const res = await apiFetch<DeckShareResponse>(`/decks/${id}/share`, {
			method: 'POST',
			body: JSON.stringify(data ?? {})
		});
		clientCache.invalidateDecks();
		return res;
	},

	getSharedDeckByToken: (token: string) =>
		apiFetch<SharedDeckPreview>(`/decks/shared/${encodeURIComponent(token)}`),

	joinSharedDeck: async (token: string) => {
		const res = await apiFetch<ApiResponse<{ deckId: number }>>(
			`/decks/shared/${encodeURIComponent(token)}/join`,
			{
				method: 'POST'
			}
		);
		clientCache.invalidateDecks();
		return res;
	},

	revokeDeckShare: async (deckId: number, userId: number) => {
		const res = await apiFetch<ApiResponse>(`/decks/${deckId}/share/${userId}`, {
			method: 'DELETE'
		});
		clientCache.invalidateDecks();
		return res;
	}
};
