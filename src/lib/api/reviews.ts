import { apiFetch } from './client';
import type { ApiResponse, Card, SM2Rating } from '$lib/types';

export const reviewApi = {
	getDueCards: () => apiFetch<Card[]>('/reviews/'),

	getCardsSince: (timestamp: string) =>
		apiFetch<Card[]>(`/reviews/since/${encodeURIComponent(timestamp)}`),

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
