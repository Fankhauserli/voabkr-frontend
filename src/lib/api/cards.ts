import { apiFetch } from './client';
import { clientCache, type CacheOptions } from './cache';
import type { ApiResponse, Card, CreateCardRequest, UpdateCardRequest } from '$lib/types';

export const cardApi = {
	getCards: (deckId?: number, options?: CacheOptions<Card[]>) => {
		const cacheKey = deckId !== undefined ? `cards:deck:${deckId}` : 'cards:all';
		const query =
			deckId !== undefined
				? `?deck_id=${encodeURIComponent(deckId)}&deckId=${encodeURIComponent(deckId)}`
				: '';
		return clientCache.getWithCache(cacheKey, () => apiFetch<Card[]>(`/cards/${query}`), {
			ttl: 15 * 60 * 1000,
			...options
		});
	},

	getCardById: (id: number, options?: CacheOptions<Card>) =>
		clientCache.getWithCache(`cards:item:${id}`, () => apiFetch<Card>(`/cards/${id}`), {
			ttl: 15 * 60 * 1000,
			...options
		}),

	createCard: async (data: CreateCardRequest) => {
		const res = await apiFetch<ApiResponse>('/cards/', {
			method: 'POST',
			body: JSON.stringify(data)
		});
		clientCache.invalidateCards(data.deckId);
		clientCache.invalidateDecks();
		return res;
	},

	updateCard: async (id: number, data: UpdateCardRequest) => {
		const res = await apiFetch<ApiResponse>(`/cards/${id}`, {
			method: 'PUT',
			body: JSON.stringify(data)
		});
		clientCache.invalidateCards(data.deckId);
		return res;
	},

	deleteCard: async (id: number, deckId?: number) => {
		const res = await apiFetch<ApiResponse>(`/cards/${id}`, {
			method: 'DELETE'
		});
		clientCache.invalidateCards(deckId);
		clientCache.invalidateDecks();
		return res;
	}
};
