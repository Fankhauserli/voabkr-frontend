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
});
