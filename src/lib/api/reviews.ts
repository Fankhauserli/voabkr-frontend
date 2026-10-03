import { apiFetch } from './client';
import type { ApiResponse, Card, SM2Rating } from '$lib/types';

export const reviewApi = {
	getDueCards: (deckId?: number) => {
		const qs = deckId ? `?deck_id=${deckId}&deckId=${deckId}` : '';
		return apiFetch<Card[]>(`/reviews/${qs}`);
	},

	getCardsSince: (timestamp: string, deckId?: number) => {
		const qs = deckId ? `?deck_id=${deckId}&deckId=${deckId}` : '';
		return apiFetch<Card[]>(`/reviews/since/${encodeURIComponent(timestamp)}${qs}`);
	},

	addCardToReviews: (cardID: number) =>
		apiFetch<ApiResponse>('/reviews/', {
			method: 'POST',
			body: JSON.stringify({ cardID })
		}),

	submitReviewScore: (cardId: number, ease: SM2Rating) =>
		apiFetch<ApiResponse>(`/reviews/${cardId}`, {
			method: 'PUT',
			body: JSON.stringify({ ease })
		})
};
