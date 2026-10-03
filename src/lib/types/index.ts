/**
 * Universal TypeScript interfaces for voabkr-frontend.
 * Strictly aligned with backend Go/Gin models (voabkr-backend/types)
 * and specifications defined in FRONTEND_SPEC.md.
 */

export type DeckType = 'vocabulary' | 'grammar';

export interface Deck {
	id: number;
	name: string;
	type: DeckType;
	cardCount?: number;
	dueCount?: number;
}

export interface DeckRequest {
	name: string;
	type: DeckType;
}

export interface CreateDeckRequest extends DeckRequest {}
export interface UpdateDeckRequest extends DeckRequest {}

export interface Card {
	id: number;
	deckId: number;
	koreanWord: string;
	englishWord: string;
	context: string;
	example: string;
	isReviewed?: boolean;
}

export interface CardRequest {
	deckId: number;
	koreanWord: string;
	englishWord: string;
	context: string;
	example: string;
}

export interface CreateCardRequest extends CardRequest {}
export interface UpdateCardRequest extends CardRequest {}

export interface User {
	id: number;
	name: string;
	email: string;
	isActive: boolean;
	isVerified: boolean;
}

export interface UserProfile extends User {}

export interface UserRequest {
	name?: string;
	email?: string;
}

export interface UpdateProfileRequest extends UserRequest {}

export interface UserSettings {
	cardsPerDay: number;
}

export interface UpdateSettingsRequest {
	cardsPerDay: number;
}

export interface LoginRequestBody {
	email: string;
	password: string;
}

export interface LoginRequest extends LoginRequestBody {}

export interface RegisterRequestBody {
	name: string;
	email: string;
	password: string;
}

export interface RegisterRequest extends RegisterRequestBody {}

/**
 * SuperMemo SM-2 Rating Scale (0 to 5)
 */
export type SM2Rating = 0 | 1 | 2 | 3 | 4 | 5;

export interface SM2RatingMeta {
	ease: SM2Rating;
	label: string;
	shortDescription: string;
	colorLight: {
		bg: string;
		border: string;
	};
	colorDark: {
		bg: string;
		border: string;
	};
	hapticType: 'warning' | 'medium' | 'success';
}

export const SM2_RATINGS_CONFIG: readonly SM2RatingMeta[] = [
	{
		ease: 0,
		label: 'Blackout',
		shortDescription: 'Completely forgotten',
		colorLight: { bg: '#FDF2F2', border: '#E88080' },
		colorDark: { bg: '#331818', border: '#8A2E2E' },
		hapticType: 'warning'
	},
	{
		ease: 1,
		label: 'Wrong',
		shortDescription: 'Remembered on reveal',
		colorLight: { bg: '#FDF5F2', border: '#E8A280' },
		colorDark: { bg: '#332018', border: '#8A4A2E' },
		hapticType: 'warning'
	},
	{
		ease: 2,
		label: 'Hard-Wrong',
		shortDescription: 'Almost recalled',
		colorLight: { bg: '#FEF9EE', border: '#E8CA80' },
		colorDark: { bg: '#332B18', border: '#8A722E' },
		hapticType: 'warning'
	},
	{
		ease: 3,
		label: 'Hard',
		shortDescription: 'Correct, serious difficulty',
		colorLight: { bg: '#FEFCF0', border: '#D6D47A' },
		colorDark: { bg: '#303318', border: '#7D802B' },
		hapticType: 'medium'
	},
	{
		ease: 4,
		label: 'Good',
		shortDescription: 'Correct with hesitation',
		colorLight: { bg: '#F0F8F5', border: '#80CCA8' },
		colorDark: { bg: '#183328', border: '#2E805A' },
		hapticType: 'medium'
	},
	{
		ease: 5,
		label: 'Easy',
		shortDescription: 'Perfect, instant recall',
		colorLight: { bg: '#EBF5F3', border: '#60B69F' },
		colorDark: { bg: '#152B24', border: '#266B59' },
		hapticType: 'success'
	}
] as const;

export interface CreateReviewRequest {
	cardID: number;
}

export interface AddReviewRequest extends CreateReviewRequest {}

export interface UpdateReviewRequest {
	ease: SM2Rating;
}

export interface ReviewScoreRequest extends UpdateReviewRequest {}

export interface ReviewSubmission {
	cardId: number;
	ease: SM2Rating;
}

export interface StudySessionSummary {
	totalReviewed: number;
	retentionRate: number;
	ratingsCount: Record<SM2Rating, number>;
	streakDays: number;
	completedAt: string;
}

export interface ApiResponse<T = unknown> {
	message?: string;
	error?: string;
	details?: string;
	data?: T;
}

export interface ApiErrorResponse {
	error: string;
	details?: string;
}

export interface QueuedReview {
	cardId: number;
	ease: SM2Rating;
	timestamp: number;
}
