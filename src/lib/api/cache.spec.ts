import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clientCache } from './cache';

describe('ClientCache', () => {
	beforeEach(() => {
		clientCache.clear();
		vi.restoreAllMocks();
	});

	it('stores and retrieves items from cache', () => {
		clientCache.set('test:key', { name: 'Korean Vocab' }, 10000);
		expect(clientCache.has('test:key')).toBe(true);
		expect(clientCache.get('test:key')).toEqual({ name: 'Korean Vocab' });
	});

	it('returns null for nonexistent keys', () => {
		expect(clientCache.has('nonexistent')).toBe(false);
		expect(clientCache.get('nonexistent')).toBeNull();
	});

	it('deduplicates concurrent in-flight requests', async () => {
		let callCount = 0;
		const mockFetcher = async () => {
			callCount++;
			return [{ id: 1, name: 'Deck 1' }];
		};

		const [res1, res2] = await Promise.all([
			clientCache.getWithCache('decks:dedup', mockFetcher),
			clientCache.getWithCache('decks:dedup', mockFetcher)
		]);

		expect(res1).toEqual(res2);
		expect(callCount).toBe(1);
	});

	it('returns fresh cached data immediately without invoking fetcher', async () => {
		clientCache.set('decks:fresh', [{ id: 1 }], 50000);

		const mockFetcher = vi.fn().mockResolvedValue([{ id: 2 }]);
		const result = await clientCache.getWithCache('decks:fresh', mockFetcher, { ttl: 50000 });

		expect(result).toEqual([{ id: 1 }]);
		expect(mockFetcher).not.toHaveBeenCalled();
	});

	it('triggers onRevalidate when cached item is stale', async () => {
		// Store an expired item (simulate by setting timestamp in the past)
		clientCache.set('decks:stale', [{ id: 1 }], 10); // 10ms TTL

		// Wait 15ms so it is stale
		await new Promise((resolve) => setTimeout(resolve, 15));

		const onRevalidate = vi.fn();
		const mockFetcher = vi.fn().mockResolvedValue([{ id: 1, name: 'Updated' }]);

		const immediate = await clientCache.getWithCache('decks:stale', mockFetcher, {
			ttl: 10,
			onRevalidate
		});

		// Immediate return is the stale item
		expect(immediate).toEqual([{ id: 1 }]);

		// Wait briefly for background revalidation
		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(mockFetcher).toHaveBeenCalledTimes(1);
		expect(onRevalidate).toHaveBeenCalledWith([{ id: 1, name: 'Updated' }]);
	});

	it('invalidates decks, cards, and reviews properly', () => {
		clientCache.set('decks:list', [{ id: 1 }]);
		clientCache.set('decks:item:1', { id: 1 });
		clientCache.set('cards:deck:1', [{ id: 101 }]);
		clientCache.set('reviews:due:all', [{ id: 101 }]);

		// Invalidate cards
		clientCache.invalidateCards(1);
		expect(clientCache.has('cards:deck:1')).toBe(false);
		expect(clientCache.has('reviews:due:all')).toBe(false);
		expect(clientCache.has('decks:list')).toBe(false);

		// Re-set and test clear
		clientCache.set('decks:list', [{ id: 1 }]);
		clientCache.clear();
		expect(clientCache.has('decks:list')).toBe(false);
	});
});
