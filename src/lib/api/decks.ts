import { apiFetch } from './client';
import { clientCache, type CacheOptions } from './cache';
import type { ApiResponse, CreateDeckRequest, Deck, UpdateDeckRequest } from '$lib/types';

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
	}
};
