import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '$lib/api/client';
import type { UserProfile, UserSettings } from '$lib/types';
import {
	AuthStore,
	REMEMBERED_LEARNER_KEY,
	type AuthProfileApi,
	type AuthStorage,
	type AuthStoreOptions
} from './auth.svelte';

const learner = (id = 7): UserProfile => ({
	id,
	name: 'Lena Learner',
	email: 'lena@example.com',
	isActive: true,
	isVerified: true
});

const settings: UserSettings = {
	cardsPerDay: 30,
	studyDirection: 'englishToKorean',
	scratchPadEnabled: true
};

/** In-memory stand-in for the localStorage the app remembers the learner in. */
function memoryStorage(initial: Record<string, string> = {}): AuthStorage & {
	readonly contents: Map<string, string>;
} {
	const contents = new Map(Object.entries(initial));
	return {
		contents,
		getItem: (key) => contents.get(key) ?? null,
		setItem: (key, value) => {
			contents.set(key, value);
		},
		removeItem: (key) => {
			contents.delete(key);
		}
	};
}

/** A profile API whose responses a test dictates. */
function profileApi(overrides: Partial<AuthProfileApi> = {}): AuthProfileApi {
	return {
		getProfile: vi.fn().mockResolvedValue(learner()),
		getSettings: vi.fn().mockResolvedValue(settings),
		...overrides
	};
}

/** A launch with no connection: the fetch rejects the way the browser does. */
const networkFailure = () => Promise.reject(new TypeError('Failed to fetch'));

/** The remembered learner as the store keeps it. */
function remember(storage: AuthStorage, user = learner(), userSettings = settings): void {
	storage.setItem(REMEMBERED_LEARNER_KEY, JSON.stringify({ user, settings: userSettings }));
}

describe('AuthStore remembering the learner', () => {
	let storage: AuthStorage;

	beforeEach(() => {
		storage = memoryStorage();
	});

	/** A store over the test's storage, unless the test supplies its own parts. */
	function makeStore(overrides: Partial<AuthStoreOptions> = {}): AuthStore {
		return new AuthStore({
			api: profileApi(),
			storage,
			onLearnerChange: () => {},
			...overrides
		});
	}

	it('remembers a learner it has signed in, so the next launch starts signed in', async () => {
		const store = makeStore();

		await store.fetchUser();

		expect(store.isAuthenticated).toBe(true);
		expect(storage.getItem(REMEMBERED_LEARNER_KEY)).not.toBeNull();

		const nextLaunch = makeStore({
			api: profileApi({ getProfile: vi.fn(networkFailure) })
		});

		// The learner is there before the first request even settles.
		expect(nextLaunch.user).toEqual(learner());
		expect(nextLaunch.settings).toEqual(settings);

		await nextLaunch.fetchUser();

		expect(nextLaunch.user).toEqual(learner());
		expect(nextLaunch.settings).toEqual(settings);
		expect(nextLaunch.isAuthenticated).toBe(true);
	});

	it('does not sign the learner out when the profile request fails for lack of a connection', async () => {
		remember(storage);
		const store = makeStore({
			api: profileApi({ getProfile: vi.fn(networkFailure) })
		});

		await store.fetchUser();

		expect(store.user).toEqual(learner());
		expect(store.isAuthenticated).toBe(true);
		expect(storage.getItem(REMEMBERED_LEARNER_KEY)).not.toBeNull();
	});

	it('does not sign the learner out when the backend fails with something other than 401', async () => {
		remember(storage);
		const store = makeStore({
			api: profileApi({
				getProfile: vi.fn().mockRejectedValue(new ApiError(500, 'Internal Server Error'))
			})
		});

		await store.fetchUser();

		expect(store.user).toEqual(learner());
		expect(store.isAuthenticated).toBe(true);
		expect(storage.getItem(REMEMBERED_LEARNER_KEY)).not.toBeNull();
	});

	it('signs the learner out on a real 401 and forgets them on the device', async () => {
		remember(storage);
		const onLearnerChange = vi.fn();
		const store = makeStore({
			api: profileApi({
				getProfile: vi.fn().mockRejectedValue(new ApiError(401, 'Unauthorized'))
			}),
			onLearnerChange
		});

		await store.fetchUser();

		expect(store.user).toBeNull();
		expect(store.isAuthenticated).toBe(false);
		expect(storage.getItem(REMEMBERED_LEARNER_KEY)).toBeNull();
		expect(onLearnerChange).toHaveBeenCalledWith(null, false);
	});

	it('leaves a launch with no connection and no remembered learner signed out', async () => {
		const store = makeStore({
			api: profileApi({ getProfile: vi.fn(networkFailure) })
		});

		await store.fetchUser();

		expect(store.user).toBeNull();
		expect(store.isAuthenticated).toBe(false);
	});

	it('keeps the remembered settings when the settings request cannot reach the backend', async () => {
		remember(storage);
		const store = makeStore({
			api: profileApi({ getSettings: vi.fn(networkFailure) })
		});

		await store.fetchUser();

		expect(store.user).toEqual(learner());
		expect(store.settings).toEqual(settings);
	});

	it("does not carry the previous learner's settings to a different confirmed learner", async () => {
		remember(storage);
		const other = { ...learner(8), name: 'Other Learner', email: 'other@example.com' };
		const store = makeStore({
			api: profileApi({
				getProfile: vi.fn().mockResolvedValue(other),
				getSettings: vi.fn(networkFailure)
			})
		});

		await store.fetchUser();

		expect(store.user).toEqual(other);
		expect(store.settings).toEqual({
			cardsPerDay: 20,
			studyDirection: 'koreanToEnglish',
			scratchPadEnabled: false
		});
	});

	it('announces the confirmed learner so their Queued Grades can upload', async () => {
		const onLearnerChange = vi.fn();
		const store = makeStore({ onLearnerChange });

		await store.fetchUser();

		expect(onLearnerChange).toHaveBeenLastCalledWith(learner().id, true);
	});

	it('claims the remembered learner without allowing an upload until the session is confirmed', async () => {
		remember(storage);
		const onLearnerChange = vi.fn();
		const store = makeStore({
			api: profileApi({ getProfile: vi.fn(networkFailure) }),
			onLearnerChange
		});

		// Restoring the learner attributes new Grades to them, but a different
		// cookie could be behind the session, so no queued work may travel yet.
		expect(onLearnerChange).toHaveBeenCalledWith(learner().id, false);
		expect(onLearnerChange).not.toHaveBeenCalledWith(learner().id, true);

		await store.fetchUser();
		expect(onLearnerChange).not.toHaveBeenCalledWith(learner().id, true);
	});

	it('forgets the learner on an explicit logout without touching the Grade queue', async () => {
		const onLearnerChange = vi.fn();
		const store = makeStore({ onLearnerChange });

		await store.fetchUser();
		store.logout();

		expect(store.user).toBeNull();
		expect(store.settings).toBeNull();
		expect(storage.getItem(REMEMBERED_LEARNER_KEY)).toBeNull();
		expect(onLearnerChange).toHaveBeenLastCalledWith(null, false);
	});

	it('tells Preferences the settings the account returned', async () => {
		const onSettings = vi.fn();
		const store = makeStore({ onSettings });

		await store.fetchUser();

		expect(onSettings).toHaveBeenLastCalledWith(settings);
	});

	it('tells Preferences the settings remembered from the last launch before the account answers', () => {
		remember(storage);
		const onSettings = vi.fn();

		makeStore({ onSettings, api: profileApi({ getProfile: vi.fn(networkFailure) }) });

		expect(onSettings).toHaveBeenCalledWith(settings);
	});
});
