/**
 * The Settings page (`+page.svelte` in this directory). The spec is named
 * without the leading `+`, which SvelteKit reserves for route files.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SettingsPage from './+page.svelte';
import { authApi } from '$lib/api/auth';
import { clientCache } from '$lib/api/cache';
import { preferences, THEME_KEY } from '$lib/stores/preferences.svelte';
import { toast } from '$lib/stores/toast.svelte';
import type { ReviewSyncQueue } from '$lib/stores/syncQueue.svelte';

/**
 * The page uses the app's queue singleton. This stands one queue instance, with
 * a database of its own, in for it so the test can assert what the page did.
 */
const queueHolder = vi.hoisted(() => ({
	queue: null as null | {
		pendingCount: number;
		setLearner(learnerId: number | null, sessionConfirmed: boolean): void;
		clear(): Promise<void>;
	}
}));

vi.mock('$lib/stores/syncQueue.svelte', () => ({
	reviewSync: {
		get pendingCount() {
			return queueHolder.queue?.pendingCount ?? 0;
		},
		setLearner: (learnerId: number | null, sessionConfirmed: boolean) =>
			queueHolder.queue?.setLearner(learnerId, sessionConfirmed),
		clear: () => queueHolder.queue?.clear()
	}
}));

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

// The page reads the signed-in learner's profile and settings; no session is
// needed behind them for these tests.
vi.mock('$lib/stores/auth.svelte', () => ({
	auth: {
		user: { id: 7, name: 'Learner', email: 'learner@example.com', isVerified: true },
		settings: { cardsPerDay: 20, studyDirection: 'koreanToEnglish', scratchPadEnabled: false },
		userName: 'Learner',
		userEmail: 'learner@example.com',
		isVerified: true,
		updateProfile: vi.fn(),
		updateSettings: vi.fn(),
		updateCardsPerDay: vi.fn(),
		logout: vi.fn()
	}
}));

vi.mock('$lib/api/auth', () => ({
	authApi: {
		deleteAccount: vi.fn(async () => ({ message: 'Account deleted' })),
		updateProfile: vi.fn(async () => ({ message: 'Profile updated' })),
		updateSettings: vi.fn(async () => ({ message: 'Settings updated' }))
	}
}));

// The queue module is mocked above, so take the real class from it.
const { ReviewSyncQueue: RealReviewSyncQueue } = await vi.importActual<
	typeof import('$lib/stores/syncQueue.svelte')
>('$lib/stores/syncQueue.svelte');

/** Deletes a test database once the queue has closed it. */
const deleteDatabase = (name: string): Promise<void> =>
	new Promise((resolve, reject) => {
		const request = indexedDB.deleteDatabase(name);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
		request.onblocked = () => reject(new Error(`Deleting ${name} was blocked`));
	});

describe('Settings local data', () => {
	let databaseName: string;
	let queue: ReviewSyncQueue;

	/** Reopens the queue over the same database, as a reload would. */
	const reopenQueue = async (): Promise<void> => {
		await queue.close();
		queue = new RealReviewSyncQueue({ databaseName });
		queueHolder.queue = queue;
		await queue.ready;
	};

	beforeEach(async () => {
		localStorage.clear();
		toast.clear();
		// A Grade given with no connection stays queued rather than being submitted.
		Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
		databaseName = `voabkr-settings-test-${crypto.randomUUID()}`;
		queue = new RealReviewSyncQueue({ databaseName });
		queue.isOnline = false;
		queue.setLearner(7, true);
		queueHolder.queue = queue;
		await queue.ready;
	});

	afterEach(async () => {
		await queue.close();
		queueHolder.queue = null;
		await deleteDatabase(databaseName);
		// The Preferences singleton is shared by every test in this file; return
		// it to the default theme without leaving a choice in storage.
		preferences.setTheme('light');
		localStorage.clear();
		toast.clear();
		vi.clearAllMocks();
		vi.restoreAllMocks();
	});

	it('reports the theme in use and remembers a chosen theme on the device', async () => {
		// The singleton is shared across tests; start from a launch with no stored
		// theme choice, so the control must fall back to its default.
		preferences.setTheme('light');
		localStorage.clear();

		const screen = render(SettingsPage);

		// The control reports the light default rather than an uninitialised value.
		await expect
			.element(screen.getByRole('button', { name: 'Light' }))
			.toHaveAttribute('aria-pressed', 'true');
		await expect
			.element(screen.getByRole('button', { name: 'Dark' }))
			.toHaveAttribute('aria-pressed', 'false');
		expect(document.documentElement.classList.contains('dark')).toBe(false);

		await screen.getByRole('button', { name: 'Dark' }).click();

		// The choice is reported by the control, applied, and kept on the device.
		await expect
			.element(screen.getByRole('button', { name: 'Dark' }))
			.toHaveAttribute('aria-pressed', 'true');
		await expect
			.element(screen.getByRole('button', { name: 'Light' }))
			.toHaveAttribute('aria-pressed', 'false');
		expect(document.documentElement.classList.contains('dark')).toBe(true);
		expect(localStorage.getItem(THEME_KEY)).toBe('dark');
	});

	it('clears cached payloads but leaves a pending Queued Grade on the device', async () => {
		await queue.addReview(101, 4);
		expect(queue.pendingCount).toBe(1);
		const clearQueue = vi.spyOn(queue, 'clear');
		const clearCache = vi.spyOn(clientCache, 'clear');

		const screen = render(SettingsPage);
		await expect.element(screen.getByText('1 queued grade pending sync')).toBeVisible();

		await screen.getByRole('button', { name: 'Clear Cache' }).click();

		// The action still does what its name says.
		expect(clearCache).toHaveBeenCalledOnce();
		expect(clearQueue).not.toHaveBeenCalled();

		// The Queued Grade is not cache: it stays in the queue and on the device.
		expect(queue.pendingCount).toBe(1);
		expect(queue.items[0].cardId).toBe(101);

		await reopenQueue();
		expect(queue.pendingCount).toBe(1);
		expect(queue.items[0].cardId).toBe(101);

		// The confirmation says what was cleared and what was kept.
		expect(toast.latestToast?.message).toBe(
			'Cached data cleared. Queued grades remain on this device.'
		);
	});

	it('clears the Queued Grades when the account is deleted', async () => {
		await queue.addReview(202, 3);
		expect(queue.pendingCount).toBe(1);
		const clearQueue = vi.spyOn(queue, 'clear');

		const screen = render(SettingsPage);

		await screen.getByRole('button', { name: 'Delete Account' }).click();
		await screen.getByRole('button', { name: 'Permanently Delete Account' }).click();

		await vi.waitFor(() => expect(queue.pendingCount).toBe(0));
		expect(clearQueue).toHaveBeenCalledOnce();
		expect(authApi.deleteAccount).toHaveBeenCalledOnce();

		await reopenQueue();
		expect(queue.pendingCount).toBe(0);
	});
});
