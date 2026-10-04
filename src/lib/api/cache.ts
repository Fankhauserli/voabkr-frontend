/**
 * Smart Client-Side Cache for voabkr.
 *
 * Features:
 * - Two-tier caching: L1 In-Memory Map (0ms sync access) + L2 LocalStorage (persists across sessions).
 * - Stale-While-Revalidate (SWR): Returns cached data instantly while silently refreshing in the background.
 * - In-flight Promise deduplication: Multiple simultaneous requests share a single network call.
 * - Granular cache invalidation: Specific invalidators for decks, cards, and review queues.
 * - Offline resilient: Provides cached decks and vocabulary even when disconnected.
 */

export interface CacheEntry<T> {
	data: T;
	timestamp: number;
	ttl: number;
}

export interface CacheOptions<T = unknown> {
	ttl?: number;
	bypassCache?: boolean;
	staleWhileRevalidate?: boolean;
	onRevalidate?: (fresh: T) => void;
}

const STORAGE_PREFIX = 'voabkr_cache_';
const DEFAULT_MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function isStorageAvailable(): boolean {
	if (typeof window === 'undefined' || typeof localStorage === 'undefined') return false;
	try {
		return (
			typeof localStorage.getItem === 'function' &&
			typeof localStorage.setItem === 'function' &&
			typeof localStorage.removeItem === 'function'
		);
	} catch {
		return false;
	}
}

class ClientCache {
	private memoryCache = new Map<string, CacheEntry<unknown>>();
	private inFlight = new Map<string, Promise<unknown>>();

	/** Check if an entry exists in memory or localStorage. */
	has(key: string): boolean {
		if (this.memoryCache.has(key)) return true;
		if (!isStorageAvailable()) return false;
		try {
			return localStorage.getItem(STORAGE_PREFIX + key) !== null;
		} catch {
			return false;
		}
	}

	/** Retrieve data from memory or localStorage if not completely expired. */
	get<T>(key: string): T | null {
		// 1. Check L1 Memory
		const mem = this.memoryCache.get(key) as CacheEntry<T> | undefined;
		if (mem) {
			const age = Date.now() - mem.timestamp;
			if (age < DEFAULT_MAX_STALE_MS) {
				return mem.data;
			}
			this.memoryCache.delete(key);
		}

		// 2. Check L2 LocalStorage
		if (!isStorageAvailable()) return null;
		try {
			const raw = localStorage.getItem(STORAGE_PREFIX + key);
			if (!raw) return null;
			const entry = JSON.parse(raw) as CacheEntry<T>;
			const age = Date.now() - entry.timestamp;
			if (age >= DEFAULT_MAX_STALE_MS) {
				localStorage.removeItem(STORAGE_PREFIX + key);
				return null;
			}
			// Promote to L1 Memory
			this.memoryCache.set(key, entry);
			return entry.data;
		} catch {
			return null;
		}
	}

	/** Save an item into L1 Memory and L2 LocalStorage. */
	set<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
		const entry: CacheEntry<T> = {
			data,
			timestamp: Date.now(),
			ttl
		};

		this.memoryCache.set(key, entry);

		if (isStorageAvailable()) {
			try {
				localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
			} catch (e) {
				console.warn('[ClientCache] Failed to persist entry to localStorage:', e);
			}
		}
	}

	/** Delete specific cache key or matching pattern. */
	delete(pattern: string | RegExp): void {
		const isReg = pattern instanceof RegExp;

		// Clean Memory
		for (const key of Array.from(this.memoryCache.keys())) {
			if (isReg ? pattern.test(key) : key === pattern || key.startsWith(pattern)) {
				this.memoryCache.delete(key);
			}
		}

		// Clean Storage
		if (isStorageAvailable()) {
			try {
				for (let i = localStorage.length - 1; i >= 0; i--) {
					const fullKey = localStorage.key(i);
					if (fullKey && fullKey.startsWith(STORAGE_PREFIX)) {
						const subKey = fullKey.slice(STORAGE_PREFIX.length);
						if (isReg ? pattern.test(subKey) : subKey === pattern || subKey.startsWith(pattern)) {
							localStorage.removeItem(fullKey);
						}
					}
				}
			} catch (e) {
				console.warn('[ClientCache] Failed to delete from localStorage:', e);
			}
		}
	}

	/** Invalidate all deck list and item caches. */
	invalidateDecks(): void {
		this.delete('decks:');
	}

	/** Invalidate cards for a specific deck or all cards. */
	invalidateCards(deckId?: number): void {
		if (deckId !== undefined) {
			this.delete(`cards:deck:${deckId}`);
		} else {
			this.delete('cards:');
		}
		this.invalidateReviews();
	}

	/** Invalidate due reviews and review queues. */
	invalidateReviews(): void {
		this.delete('reviews:');
		// Decks have dueCount, so invalidate decks when reviews change
		this.invalidateDecks();
	}

	/** Clear all cached items completely. */
	clear(): void {
		this.memoryCache.clear();
		this.inFlight.clear();

		if (isStorageAvailable()) {
			try {
				for (let i = localStorage.length - 1; i >= 0; i--) {
					const key = localStorage.key(i);
					if (key && key.startsWith(STORAGE_PREFIX)) {
						localStorage.removeItem(key);
					}
				}
			} catch (e) {
				console.warn('[ClientCache] Failed to clear localStorage cache:', e);
			}
		}
	}

	/**
	 * Smart Stale-While-Revalidate fetcher:
	 * - If cached and within TTL: Returns cached data immediately.
	 * - If cached and expired: Returns cached data immediately AND revalidates in background.
	 * - If no cache: Fetches from network.
	 * - Deduplicates in-flight promises.
	 */
	async getWithCache<T>(
		key: string,
		fetcher: () => Promise<T>,
		options: CacheOptions<T> = {}
	): Promise<T> {
		const {
			ttl = 5 * 60 * 1000,
			bypassCache = false,
			staleWhileRevalidate = true,
			onRevalidate
		} = options;

		// 1. Bypass requested: fetch directly and update cache
		if (bypassCache) {
			return this.fetchAndStore(key, fetcher, ttl);
		}

		// 2. Check cache
		const mem = this.memoryCache.get(key) as CacheEntry<T> | undefined;
		let entry: CacheEntry<T> | null = mem ?? null;

		if (!entry && isStorageAvailable()) {
			try {
				const raw = localStorage.getItem(STORAGE_PREFIX + key);
				if (raw) {
					entry = JSON.parse(raw) as CacheEntry<T>;
					this.memoryCache.set(key, entry);
				}
			} catch {
				entry = null;
			}
		}

		if (entry) {
			const age = Date.now() - entry.timestamp;
			const isFresh = age < (entry.ttl ?? ttl);

			if (isFresh) {
				return entry.data;
			}

			// Stale-While-Revalidate: return stale data immediately, revalidate in background
			if (staleWhileRevalidate && age < DEFAULT_MAX_STALE_MS) {
				// Revalidate in background without blocking
				this.fetchAndStore(key, fetcher, ttl)
					.then((fresh) => {
						if (onRevalidate) {
							onRevalidate(fresh);
						}
					})
					.catch(() => {
						// Silent background fail: stale data remains serving the user
					});

				return entry.data;
			}
		}

		// 3. Cache miss: fetch, store, and return
		return this.fetchAndStore(key, fetcher, ttl);
	}

	/** Deduplicated network fetch and storage. */
	private async fetchAndStore<T>(key: string, fetcher: () => Promise<T>, ttl: number): Promise<T> {
		if (this.inFlight.has(key)) {
			return this.inFlight.get(key) as Promise<T>;
		}

		const promise = fetcher()
			.then((data) => {
				this.set(key, data, ttl);
				return data;
			})
			.finally(() => {
				this.inFlight.delete(key);
			});

		this.inFlight.set(key, promise);
		return promise;
	}
}

export const clientCache = new ClientCache();
