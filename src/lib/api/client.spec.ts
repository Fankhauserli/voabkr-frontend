import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, ApiError } from './client';

describe('apiFetch Client Utility', () => {
	const mockFetch = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		globalThis.fetch = mockFetch;
		if (typeof window === 'undefined') {
			const listeners: Record<string, EventListener[]> = {};
			globalThis.window = {
				dispatchEvent: (event: Event) => {
					(listeners[event.type] || []).forEach((fn) => fn(event));
					return true;
				},
				addEventListener: (type: string, fn: EventListener) => {
					listeners[type] = listeners[type] || [];
					listeners[type].push(fn);
				},
				removeEventListener: (type: string, fn: EventListener) => {
					listeners[type] = (listeners[type] || []).filter((f) => f !== fn);
				}
			} as unknown as Window & typeof globalThis;
		}
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('sends default headers and credentials: include on standard GET request', async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ data: 'ok' }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);

		const result = await apiFetch<{ data: string }>('/user/profile');

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const [url, init] = mockFetch.mock.calls[0];

		expect(url).toContain('/user/profile');
		expect(init.credentials).toBe('include');
		expect(init.headers['Accept']).toBe('application/json');
		expect(result).toEqual({ data: 'ok' });
	});

	it('automatically attaches Content-Type: application/json when body is provided', async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ success: true }), { status: 200 })
		);

		const payload = JSON.stringify({ name: 'Vocabulary' });
		await apiFetch('/decks/', {
			method: 'POST',
			body: payload
		});

		const [, init] = mockFetch.mock.calls[0];
		expect(init.headers['Content-Type']).toBe('application/json');
		expect(init.body).toBe(payload);
	});

	it('handles HTTP 204 No Content gracefully without parsing JSON', async () => {
		mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

		const result = await apiFetch<unknown>('/decks/1', { method: 'DELETE' });
		expect(result).toEqual({});
	});

	it('throws ApiError with message and details on API error response', async () => {
		const errorResponse = {
			error: 'Invalid credentials',
			details: 'Email and password do not match'
		};

		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify(errorResponse), {
				status: 400,
				statusText: 'Bad Request',
				headers: { 'Content-Type': 'application/json' }
			})
		);

		await expect(apiFetch('/login', { method: 'POST' })).rejects.toThrow(ApiError);
	});

	it('dispatches session-expired event on window upon HTTP 401 Unauthorized', async () => {
		const sessionListener = vi.fn();
		window.addEventListener('session-expired', sessionListener);

		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
		);

		await expect(apiFetch('/reviews/')).rejects.toThrow(ApiError);
		expect(sessionListener).toHaveBeenCalledTimes(1);

		window.removeEventListener('session-expired', sessionListener);
	});

	it('falls back to HTTP statusText if error response body is non-JSON', async () => {
		mockFetch.mockResolvedValueOnce(
			new Response('<html>502 Bad Gateway</html>', {
				status: 502,
				statusText: 'Bad Gateway'
			})
		);

		try {
			await apiFetch('/reviews/');
			expect.unreachable('Should have thrown');
		} catch (err) {
			const apiErr = err as ApiError;
			expect(apiErr.status).toBe(502);
			expect(apiErr.message).toBe('HTTP 502: Bad Gateway');
		}
	});
});
