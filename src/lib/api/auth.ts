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

	getProfile: () => apiFetch<User>('/user/profile'),

	updateProfile: (data: UpdateProfileRequest) =>
		apiFetch<ApiResponse>('/user/profile', {
			method: 'PUT',
			body: JSON.stringify(data)
		}),

	getSettings: () => apiFetch<UserSettings>('/user/settings'),

	updateSettings: (data: UpdateSettingsRequest) =>
		apiFetch<ApiResponse>('/user/settings', {
			method: 'PUT',
			body: JSON.stringify(data)
		})
};
