import { apiFetch } from './client';
import { clientCache, type CacheOptions } from './cache';
import type { ApiResponse, Card } from '$lib/types';

export const reviewApi = {
	getDueCards: (deckId?: number, options?: CacheOptions<Card[]>) => {
		const cacheKey = deckId !== undefined ? `reviews:due:${deckId}` : 'reviews:due:all';
		const qs = deckId ? `?deck_id=${deckId}&deckId=${deckId}` : '';
		return clientCache.getWithCache(cacheKey, () => apiFetch<Card[]>(`/reviews/${qs}`), {
			ttl: 45 * 1000,
			...options
		});
	},

	getCardsSince: (timestamp: string, deckId?: number) => {
		const qs = deckId ? `?deck_id=${deckId}&deckId=${deckId}` : '';
		return apiFetch<Card[]>(`/reviews/since/${encodeURIComponent(timestamp)}${qs}`);
	},

	addCardToReviews: async (cardID: number) => {
		const res = await apiFetch<ApiResponse>('/reviews/', {
			method: 'POST',
			body: JSON.stringify({ cardID })
		});
		clientCache.invalidateReviews();
		return res;
	}
};
