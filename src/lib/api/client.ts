import { Capacitor } from '@capacitor/core';
import type { ApiErrorResponse } from '$lib/types';

export function getApiBaseUrl(): string {
	// Explicit build-time or runtime environment override
	if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
		return import.meta.env.VITE_API_URL;
	}
	// Native Capacitor mobile shell (Android / iOS)
	if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
		return 'https://vocabkr.voyagera.ch/api/v1';
	}
	// Node server-side environment (e.g. SSR inside Kubernetes cluster)
	if (typeof window === 'undefined') {
		const backendUrl =
			(typeof process !== 'undefined' && process.env?.BACKEND_URL) || 'http://localhost:8080';
		return `${backendUrl}/api/v1`;
	}
	// Web browser (both production HTTPS and Vite local dev server with /api proxy)
	return '/api/v1';
}

const API_BASE_URL = getApiBaseUrl();

export class ApiError extends Error {
	constructor(
		public status: number,
		public message: string,
		public details?: string
	) {
		super(message);
		this.name = 'ApiError';
	}
}

/**
 * Base HTTP fetch wrapper for voabkr-backend.
 * Enforces credentials: 'include' for Redis session cookies and dispatches 'session-expired' on 401.
 */
export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
	const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

	const defaultHeaders: Record<string, string> = {
		Accept: 'application/json'
	};

	if (options.body && typeof options.body === 'string') {
		defaultHeaders['Content-Type'] = 'application/json';
	}

	const response = await fetch(url, {
		...options,
		credentials: 'include',
		headers: {
			...defaultHeaders,
			...options.headers
		}
	});

	if (!response.ok) {
		let errorData: ApiErrorResponse = { error: `HTTP ${response.status}: ${response.statusText}` };

		try {
			const parsed = await response.json();
			if (parsed && typeof parsed === 'object') {
				errorData = {
					error: parsed.error || errorData.error,
					details: parsed.details || ''
				};
			}
		} catch {
			// Fallback if response is non-JSON
		}

		if (response.status === 401) {
			if (typeof window !== 'undefined') {
				window.dispatchEvent(new CustomEvent('session-expired'));
			}
		}

		if (import.meta.env?.DEV && errorData.details) {
			console.warn(`[API Error Details] [${response.status}] ${url}:`, errorData.details);
		}

		throw new ApiError(response.status, errorData.error, errorData.details);
	}

	if (response.status === 204) {
		return {} as T;
	}

	return response.json();
}
