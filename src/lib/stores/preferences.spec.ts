import { describe, it, expect, vi } from 'vitest';
import type { UpdateSettingsRequest, UserSettings } from '$lib/types';
import {
	DEFAULT_DAILY_GOAL,
	PreferencesStore,
	type PreferencesEndpoint,
	type PreferencesStorage
} from './preferences.svelte';

/** In-memory stand-in for the device storage. */
function memoryStorage(initial: Record<string, string> = {}): PreferencesStorage & {
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

/** A user-settings endpoint whose answers a test dictates, recording what it was sent. */
function fakeEndpoint(overrides: Partial<PreferencesEndpoint> = {}): {
	endpoint: PreferencesEndpoint;
	saved: UpdateSettingsRequest[];
} {
	const saved: UpdateSettingsRequest[] = [];
	const endpoint: PreferencesEndpoint = {
		updateSettings: vi.fn(async (update: UpdateSettingsRequest) => {
			saved.push(update);
			return {};
		}),
		...overrides
	};
	return { endpoint, saved };
}

const accountSettings = (cardsPerDay: number): UserSettings => ({
	cardsPerDay,
	studyDirection: 'koreanToEnglish',
	scratchPadEnabled: false
});

describe('PreferencesStore — the Daily goal', () => {
	it('falls back to the one default when no Daily goal was ever set', () => {
		const { endpoint } = fakeEndpoint();
		const store = new PreferencesStore({ storage: memoryStorage(), endpoint });

		expect(store.dailyGoal).toBe(DEFAULT_DAILY_GOAL);
		expect(endpoint.updateSettings).not.toHaveBeenCalled();
	});

	it('uses the new value immediately and keeps it on the device before saving it', async () => {
		const storage = memoryStorage();
		let valueWhenSaved: number | null = null;
		let valueOnDeviceWhenSaved: number | null = null;
		const { endpoint, saved } = fakeEndpoint();
		const store = new PreferencesStore({ storage, endpoint });
		endpoint.updateSettings = vi.fn(async (update: UpdateSettingsRequest) => {
			saved.push(update);
			// The save sees the new value already in use and already on the device.
			valueWhenSaved = store.dailyGoal;
			valueOnDeviceWhenSaved = new PreferencesStore({
				storage,
				endpoint: fakeEndpoint().endpoint
			}).dailyGoal;
			return {};
		});

		await store.setDailyGoal(30);

		expect(store.dailyGoal).toBe(30);
		expect(valueWhenSaved).toBe(30);
		expect(valueOnDeviceWhenSaved).toBe(30);
		expect(saved).toEqual([{ cardsPerDay: 30 }]);
	});

	it('survives a reload: a new module over the same device storage reads the value', async () => {
		const storage = memoryStorage();
		const { endpoint } = fakeEndpoint();
		const store = new PreferencesStore({ storage, endpoint });

		await store.setDailyGoal(50);

		const nextLaunch = new PreferencesStore({ storage, endpoint });
		expect(nextLaunch.dailyGoal).toBe(50);
	});

	it('keeps the new value on the device and reports the failure when the save fails', async () => {
		const storage = memoryStorage();
		const endpoint: PreferencesEndpoint = {
			updateSettings: vi.fn().mockRejectedValue(new Error('Failed to fetch'))
		};
		const store = new PreferencesStore({ storage, endpoint });

		await expect(store.setDailyGoal(30)).rejects.toThrow('Failed to fetch');

		expect(store.dailyGoal).toBe(30);
		expect(new PreferencesStore({ storage, endpoint }).dailyGoal).toBe(30);
	});

	it('never sends a Daily goal the account would refuse and keeps the last good value', async () => {
		const storage = memoryStorage();
		const { endpoint, saved } = fakeEndpoint();
		const store = new PreferencesStore({ storage, endpoint });

		await store.setDailyGoal(25);

		for (const refused of [0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
			await expect(store.setDailyGoal(refused)).rejects.toThrow('greater than zero');
		}

		expect(saved).toEqual([{ cardsPerDay: 25 }]);
		expect(store.dailyGoal).toBe(25);
		expect(new PreferencesStore({ storage, endpoint }).dailyGoal).toBe(25);
	});

	it('adopts the account Daily goal on a device that holds none', () => {
		const storage = memoryStorage();
		const { endpoint } = fakeEndpoint();
		const store = new PreferencesStore({ storage, endpoint });

		store.applyAccountSettings(accountSettings(40));

		expect(store.dailyGoal).toBe(40);
		expect(new PreferencesStore({ storage, endpoint }).dailyGoal).toBe(40);
	});

	it('ignores a Daily goal the account would refuse', () => {
		const { endpoint } = fakeEndpoint();
		const store = new PreferencesStore({ storage: memoryStorage(), endpoint });

		store.applyAccountSettings(accountSettings(0));
		store.applyAccountSettings(accountSettings(-10));
		store.applyAccountSettings(null);

		expect(store.dailyGoal).toBe(DEFAULT_DAILY_GOAL);
	});

	it('does not replace a value this device could not save, so the failed save is not undone on launch', async () => {
		const storage = memoryStorage();
		const failing: PreferencesEndpoint = {
			updateSettings: vi.fn().mockRejectedValue(new Error('offline'))
		};
		const store = new PreferencesStore({ storage, endpoint: failing });

		await expect(store.setDailyGoal(30)).rejects.toThrow('offline');

		const nextLaunch = new PreferencesStore({ storage, endpoint: fakeEndpoint().endpoint });
		nextLaunch.applyAccountSettings(accountSettings(20));

		expect(nextLaunch.dailyGoal).toBe(30);
	});

	it('lets the account change a value this device did save, so another device can set the goal', async () => {
		const storage = memoryStorage();
		const { endpoint } = fakeEndpoint();
		const store = new PreferencesStore({ storage, endpoint });

		await store.setDailyGoal(30);
		store.applyAccountSettings(accountSettings(40));

		expect(store.dailyGoal).toBe(40);
		expect(new PreferencesStore({ storage, endpoint }).dailyGoal).toBe(40);
	});

	it('still works for this launch when the device refuses storage', async () => {
		const unavailable: PreferencesStorage = {
			getItem: () => {
				throw new Error('storage blocked');
			},
			setItem: () => {
				throw new Error('storage blocked');
			},
			removeItem: () => {
				throw new Error('storage blocked');
			}
		};
		const { endpoint } = fakeEndpoint();
		const store = new PreferencesStore({ storage: unavailable, endpoint });

		await store.setDailyGoal(30);

		expect(store.dailyGoal).toBe(30);
	});
});
