import { reviewApi } from '$lib/api/reviews';
import type { QueuedReview, SM2Rating } from '$lib/types';

const STORAGE_KEY = 'voabkr_review_queue';

/**
 * Svelte 5 Runes-based offline review queue.
 * Buffers review ratings submitted offline and flushes sequentially on reconnect.
 */
class ReviewSyncQueue {
	private queue = $state<QueuedReview[]>([]);
	public isSyncing = $state<boolean>(false);
	public isOnline = $state<boolean>(true);

	constructor() {
		if (typeof window !== 'undefined') {
			this.isOnline = navigator.onLine;
			this.loadFromStorage();

			window.addEventListener('online', () => {
				this.isOnline = true;
				this.flushQueue();
			});

			window.addEventListener('offline', () => {
				this.isOnline = false;
			});
		}
	}

	public get pendingCount(): number {
		return this.queue.length;
	}

	public get items(): QueuedReview[] {
		return this.queue;
	}

	async addReview(cardId: number, ease: SM2Rating): Promise<{ synced: boolean }> {
		const isCurrentlyOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

		if (isCurrentlyOnline) {
			try {
				await reviewApi.submitReviewScore(cardId, ease);
				return { synced: true };
			} catch (err) {
				console.warn(
					`[SyncQueue] Direct submission failed for card ${cardId}. Queueing offline.`,
					err
				);
			}
		}

		this.queue.push({
			cardId,
			ease,
			timestamp: Date.now()
		});

		this.persistToStorage();
		return { synced: false };
	}

	async flushQueue(): Promise<void> {
		if (typeof navigator !== 'undefined' && !navigator.onLine) return;
		if (this.isSyncing || this.queue.length === 0) return;

		this.isSyncing = true;

		try {
			while (this.queue.length > 0) {
				const item = this.queue[0];
				try {
					await reviewApi.submitReviewScore(item.cardId, item.ease);
					this.queue.shift();
					this.persistToStorage();
				} catch (err) {
					console.warn('[SyncQueue] Flushing stopped due to error:', err);
					break;
				}
			}
		} finally {
			this.isSyncing = false;
		}
	}

	clear(): void {
		this.queue = [];
		this.persistToStorage();
	}

	private loadFromStorage(): void {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) {
				const parsed = JSON.parse(raw);
				if (Array.isArray(parsed)) {
					this.queue = parsed;
				}
			}
		} catch (e) {
			console.error('[SyncQueue] Failed to load queue from localStorage:', e);
			this.queue = [];
		}
	}

	private persistToStorage(): void {
		if (typeof localStorage === 'undefined') return;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
		} catch (e) {
			console.error('[SyncQueue] Failed to persist queue to localStorage:', e);
		}
	}
}

export const reviewSync = new ReviewSyncQueue();
export { ReviewSyncQueue };
