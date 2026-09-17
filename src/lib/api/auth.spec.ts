import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { login, register, logout } from './auth';

describe('auth api client', () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	describe('login', () => {
		it('returns success on valid credentials', async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => ({ message: 'Logged in successfully' })
			} as Response);

			const res = await login({ email: 'test@example.com', password: 'password123' });

			expect(globalThis.fetch).toHaveBeenCalledWith(
				'/api/v1/login',
				expect.objectContaining({
					method: 'POST',
					credentials: 'include',
					body: JSON.stringify({ email: 'test@example.com', password: 'password123' })
				})
			);
			expect(res).toEqual({
				success: true,
				data: { message: 'Logged in successfully' }
			});
		});

		it('returns error when credentials are invalid', async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 401,
				statusText: 'Unauthorized',
				json: async () => ({ error: 'Invalid email or password' })
			} as Response);

			const res = await login({ email: 'test@example.com', password: 'wrong' });

			expect(res).toEqual({
				success: false,
				error: 'Invalid email or password',
				status: 401
			});
		});
	});

	describe('register', () => {
		it('returns success on valid registration data', async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => ({ message: 'Registered successfully' })
			} as Response);

			const res = await register({
				name: 'Test User',
				email: 'test@example.com',
				password: 'password123'
			});

			expect(globalThis.fetch).toHaveBeenCalledWith(
				'/api/v1/register',
				expect.objectContaining({
					method: 'POST',
					credentials: 'include',
					body: JSON.stringify({
						name: 'Test User',
						email: 'test@example.com',
						password: 'password123'
					})
				})
			);
			expect(res).toEqual({
				success: true,
				data: { message: 'Registered successfully' }
			});
		});

		it('handles registration error from backend', async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error',
				json: async () => ({ error: 'Failed to create user' })
			} as Response);

			const res = await register({
				name: 'Test User',
				email: 'test@example.com',
				password: 'password123'
			});

			expect(res).toEqual({
				success: false,
				error: 'Failed to create user',
				status: 500
			});
		});
	});

	describe('logout', () => {
		it('returns success on logout', async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => ({ message: 'Logged out successfully' })
			} as Response);

			const res = await logout();

			expect(globalThis.fetch).toHaveBeenCalledWith(
				'/api/v1/logout',
				expect.objectContaining({
					method: 'POST',
					credentials: 'include'
				})
			);
			expect(res).toEqual({
				success: true,
				data: { message: 'Logged out successfully' }
			});
		});
	});
});
