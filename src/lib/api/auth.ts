import { apiFetch } from './client';
import type {
	ApiResponse,
	LoginRequest,
	RegisterRequest,
	UpdateProfileRequest,
	UpdateSettingsRequest,
	User,
	UserSettings
} from '$lib/types';

export const authApi = {
	login: (data: LoginRequest) =>
		apiFetch<ApiResponse>('/login', {
			method: 'POST',
			body: JSON.stringify(data)
		}),

	register: (data: RegisterRequest) =>
		apiFetch<ApiResponse>('/register', {
			method: 'POST',
			body: JSON.stringify(data)
		}),

	logout: () =>
		apiFetch<ApiResponse>('/logout', {
			method: 'POST'
		}),

	verifyEmail: (token: string) =>
		apiFetch<ApiResponse>(`/verification/${encodeURIComponent(token)}`, {
			method: 'POST'
		}),

	resendVerification: (email?: string) =>
		apiFetch<ApiResponse>('/resend-verification', {
			method: 'POST',
			...(email ? { body: JSON.stringify({ email }) } : {})
		}),

	getProfile: (silent = true) => apiFetch<User>('/user/profile', { silent }),

	updateProfile: (data: UpdateProfileRequest) =>
		apiFetch<ApiResponse>('/user/profile', {
			method: 'PUT',
			body: JSON.stringify(data)
		}),

	getSettings: (silent = true) => apiFetch<UserSettings>('/user/settings', { silent }),

	updateSettings: (data: UpdateSettingsRequest) =>
		apiFetch<ApiResponse>('/user/settings', {
			method: 'PUT',
			body: JSON.stringify(data)
		})
};
