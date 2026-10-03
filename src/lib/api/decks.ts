import { apiFetch } from './client';
import type { ApiResponse, CreateDeckRequest, Deck, UpdateDeckRequest } from '$lib/types';

export const deckApi = {
	getDecks: () => apiFetch<Deck[]>('/decks/'),

	getDeckById: (id: number) => apiFetch<Deck>(`/decks/${id}`),

	createDeck: (data: CreateDeckRequest) =>
		apiFetch<ApiResponse>('/decks/', {
			method: 'POST',
			body: JSON.stringify(data)
		}),

	updateDeck: (id: number, data: UpdateDeckRequest) =>
		apiFetch<ApiResponse>(`/decks/${id}`, {
			method: 'PUT',
			body: JSON.stringify(data)
		}),

	deleteDeck: (id: number) =>
		apiFetch<ApiResponse>(`/decks/${id}`, {
			method: 'DELETE'
		})
};
