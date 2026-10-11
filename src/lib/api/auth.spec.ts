import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authApi } from './auth';

describe('authApi resendVerification', () => {
	const mockFetch = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		globalThis.fetch = mockFetch;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('calls /resend-verification with POST and credentials: include for session-based resend', async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ message: 'Verification link sent successfully.' }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);

		const result = await authApi.resendVerification();

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const [url, init] = mockFetch.mock.calls[0];

		expect(url).toContain('/resend-verification');
		expect(init.method).toBe('POST');
		expect(init.credentials).toBe('include');
		expect(init.body).toBeUndefined();
		expect(result).toEqual({ message: 'Verification link sent successfully.' });
	});

	it('calls /resend-verification with email in body when email is provided', async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ message: 'Verification link sent successfully.' }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);

		const result = await authApi.resendVerification('user@example.com');

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const [url, init] = mockFetch.mock.calls[0];

		expect(url).toContain('/resend-verification');
		expect(init.method).toBe('POST');
		expect(init.credentials).toBe('include');
		expect(init.headers['Content-Type']).toBe('application/json');
		expect(JSON.parse(init.body)).toEqual({ email: 'user@example.com' });
		expect(result).toEqual({ message: 'Verification link sent successfully.' });
	});

	it('calls /user with DELETE for self-service account deletion', async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ message: 'Account deleted successfully.' }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);

		const result = await authApi.deleteAccount();

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toContain('/user');
		expect(init.method).toBe('DELETE');
		expect(result).toEqual({ message: 'Account deleted successfully.' });
	});

	it('calls /forgot-password with email in POST body', async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ message: 'Password reset link sent.' }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);

		const result = await authApi.forgotPassword('learner@example.com');

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toContain('/forgot-password');
		expect(init.method).toBe('POST');
		expect(JSON.parse(init.body)).toEqual({ email: 'learner@example.com' });
		expect(result).toEqual({ message: 'Password reset link sent.' });
	});

	it('calls /reset-password/:token with new password in POST body', async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ message: 'Password updated successfully.' }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);

		const result = await authApi.resetPassword('sec_tok_123', 'newSecretPassword123');

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toContain('/reset-password/sec_tok_123');
		expect(init.method).toBe('POST');
		expect(JSON.parse(init.body)).toEqual({ password: 'newSecretPassword123' });
		expect(result).toEqual({ message: 'Password updated successfully.' });
	});
});
