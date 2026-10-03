import { apiFetch } from './client';
import type { ApiResponse, Card, CreateCardRequest, UpdateCardRequest } from '$lib/types';

export const cardApi = {
	getCards: (deckId?: number) => {
		const query = deckId !== undefined ? `?deckId=${encodeURIComponent(deckId)}` : '';
		return apiFetch<Card[]>(`/cards/${query}`);
	},

	getCardById: (id: number) => apiFetch<Card>(`/cards/${id}`),

	createCard: (data: CreateCardRequest) =>
		apiFetch<ApiResponse>('/cards/', {
			method: 'POST',
			body: JSON.stringify(data)
		}),

	updateCard: (id: number, data: UpdateCardRequest) =>
		apiFetch<ApiResponse>(`/cards/${id}`, {
			method: 'PUT',
			body: JSON.stringify(data)
		}),

	deleteCard: (id: number) =>
		apiFetch<ApiResponse>(`/cards/${id}`, {
			method: 'DELETE'
		})
};
