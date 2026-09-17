export interface LoginRequestBody {
	email: string;
	password: string;
}

export interface RegisterRequestBody {
	name: string;
	email: string;
	password: string;
}

export interface AuthSuccessResponse {
	message: string;
}

export interface AuthErrorResponse {
	error: string;
}

export type AuthResult<T = AuthSuccessResponse> =
	{ success: true; data: T } | { success: false; error: string; status?: number };

// In dev, Vite proxy forwards /api to http://localhost:8080.
// If VITE_API_URL is configured, it will prepend it; otherwise default to relative path.
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '';

async function handleResponse<T>(response: Response): Promise<AuthResult<T>> {
	let data: unknown;
	try {
		data = await response.json();
	} catch {
		data = null;
	}

	if (!response.ok) {
		const errorMessage =
			data &&
			typeof data === 'object' &&
			'error' in data &&
			typeof (data as Record<string, unknown>).error === 'string'
				? ((data as Record<string, unknown>).error as string)
				: response.statusText || 'An unexpected error occurred';
		return { success: false, error: errorMessage, status: response.status };
	}

	return { success: true, data: data as T };
}

/**
 * Log in with email and password.
 * Backend: POST /api/v1/login
 */
export async function login(body: LoginRequestBody): Promise<AuthResult> {
	try {
		const res = await fetch(`${API_BASE}/api/v1/login`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json'
			},
			credentials: 'include',
			body: JSON.stringify(body)
		});
		return await handleResponse<AuthSuccessResponse>(res);
	} catch (err) {
		const message =
			err instanceof Error ? err.message : 'Unable to connect to the authentication server';
		return { success: false, error: message };
	}
}

/**
 * Register a new user with name, email, and password.
 * Backend: POST /api/v1/register
 */
export async function register(body: RegisterRequestBody): Promise<AuthResult> {
	try {
		const res = await fetch(`${API_BASE}/api/v1/register`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json'
			},
			credentials: 'include',
			body: JSON.stringify(body)
		});
		return await handleResponse<AuthSuccessResponse>(res);
	} catch (err) {
		const message =
			err instanceof Error ? err.message : 'Unable to connect to the authentication server';
		return { success: false, error: message };
	}
}

/**
 * Log out the current session.
 * Backend: POST /api/v1/logout
 */
export async function logout(): Promise<AuthResult> {
	try {
		const res = await fetch(`${API_BASE}/api/v1/logout`, {
			method: 'POST',
			headers: {
				Accept: 'application/json'
			},
			credentials: 'include'
		});
		return await handleResponse<AuthSuccessResponse>(res);
	} catch (err) {
		const message =
			err instanceof Error ? err.message : 'Unable to connect to the authentication server';
		return { success: false, error: message };
	}
}
