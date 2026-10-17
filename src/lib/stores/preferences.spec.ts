import { describe, it, expect, vi } from 'vitest';
import type { UpdateSettingsRequest, UserSettings } from '$lib/types';
import {
	DEFAULT_DAILY_GOAL,
	DEFAULT_SCRATCH_PAD_ENABLED,
	DEFAULT_STUDY_DIRECTION,
	PreferencesStore,
	SCRATCH_PAD_KEY,
	STUDY_DIRECTION_KEY,
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

const accountSettings = (overrides: Partial<UserSettings> = {}): UserSettings => ({
	cardsPerDay: 20,
	studyDirection: 'koreanToEnglish',
	scratchPadEnabled: false,
	...overrides
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

		store.applyAccountSettings(accountSettings({ cardsPerDay: 40 }));

		expect(store.dailyGoal).toBe(40);
		expect(new PreferencesStore({ storage, endpoint }).dailyGoal).toBe(40);
	});

	it('ignores a Daily goal the account would refuse', () => {
		const { endpoint } = fakeEndpoint();
		const store = new PreferencesStore({ storage: memoryStorage(), endpoint });

		store.applyAccountSettings(accountSettings({ cardsPerDay: 0 }));
		store.applyAccountSettings(accountSettings({ cardsPerDay: -10 }));
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
		nextLaunch.applyAccountSettings(accountSettings({ cardsPerDay: 20 }));

		expect(nextLaunch.dailyGoal).toBe(30);
	});

	it('lets the account change a value this device did save, so another device can set the goal', async () => {
		const storage = memoryStorage();
		const { endpoint } = fakeEndpoint();
		const store = new PreferencesStore({ storage, endpoint });

		await store.setDailyGoal(30);
		store.applyAccountSettings(accountSettings({ cardsPerDay: 40 }));

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

describe('PreferencesStore — Study direction', () => {
	it('falls back to the one default when no Study direction was ever set', () => {
		const { endpoint } = fakeEndpoint();
		const store = new PreferencesStore({ storage: memoryStorage(), endpoint });

		expect(store.studyDirection).toBe(DEFAULT_STUDY_DIRECTION);
		expect(DEFAULT_STUDY_DIRECTION).toBe('koreanToEnglish');
		expect(endpoint.updateSettings).not.toHaveBeenCalled();
	});

	it('uses the new direction immediately and keeps it on the device before saving it', async () => {
		const storage = memoryStorage();
		let directionWhenSaved: string | null = null;
		let directionOnDeviceWhenSaved: string | null = null;
		const { endpoint, saved } = fakeEndpoint();
		const store = new PreferencesStore({ storage, endpoint });
		endpoint.updateSettings = vi.fn(async (update: UpdateSettingsRequest) => {
			saved.push(update);
			// The save sees the new direction already in use and already on the device.
			directionWhenSaved = store.studyDirection;
			directionOnDeviceWhenSaved = new PreferencesStore({
				storage,
				endpoint: fakeEndpoint().endpoint
			}).studyDirection;
			return {};
		});

		await store.setStudyDirection('englishToKorean');

		expect(store.studyDirection).toBe('englishToKorean');
		expect(directionWhenSaved).toBe('englishToKorean');
		expect(directionOnDeviceWhenSaved).toBe('englishToKorean');
		expect(saved).toEqual([{ studyDirection: 'englishToKorean' }]);
	});

	it('survives a reload: a new module over the same device storage reads the direction', async () => {
		const storage = memoryStorage();
		const { endpoint } = fakeEndpoint();
		const store = new PreferencesStore({ storage, endpoint });

		await store.setStudyDirection('englishToKorean');

		expect(new PreferencesStore({ storage, endpoint }).studyDirection).toBe('englishToKorean');
	});

	it('keeps the new direction on the device and reports the failure when the save fails', async () => {
		const storage = memoryStorage();
		const endpoint: PreferencesEndpoint = {
			updateSettings: vi.fn().mockRejectedValue(new Error('Failed to fetch'))
		};
		const store = new PreferencesStore({ storage, endpoint });

		await expect(store.setStudyDirection('englishToKorean')).rejects.toThrow('Failed to fetch');

		expect(store.studyDirection).toBe('englishToKorean');
		expect(new PreferencesStore({ storage, endpoint }).studyDirection).toBe('englishToKorean');
	});

	it('toggles the direction and saves the new one', async () => {
		const { endpoint, saved } = fakeEndpoint();
		const store = new PreferencesStore({ storage: memoryStorage(), endpoint });

		await store.toggleStudyDirection();

		expect(store.studyDirection).toBe('englishToKorean');
		expect(saved).toEqual([{ studyDirection: 'englishToKorean' }]);
	});

	it('adopts the account Study direction on a device that holds none', () => {
		const storage = memoryStorage();
		const { endpoint } = fakeEndpoint();
		const store = new PreferencesStore({ storage, endpoint });

		store.applyAccountSettings(accountSettings({ studyDirection: 'englishToKorean' }));

		expect(store.studyDirection).toBe('englishToKorean');
		expect(new PreferencesStore({ storage, endpoint }).studyDirection).toBe('englishToKorean');
	});

	it('ignores a Study direction the account cannot mean', () => {
		const { endpoint } = fakeEndpoint();
		const store = new PreferencesStore({ storage: memoryStorage(), endpoint });

		store.applyAccountSettings({
			...accountSettings(),
			studyDirection: 'sideways'
		} as unknown as UserSettings);
		store.applyAccountSettings({
			...accountSettings(),
			studyDirection: undefined
		});

		expect(store.studyDirection).toBe(DEFAULT_STUDY_DIRECTION);
	});

	it('does not replace a direction this device could not save, so the failed save is not undone on launch', async () => {
		const storage = memoryStorage();
		const failing: PreferencesEndpoint = {
			updateSettings: vi.fn().mockRejectedValue(new Error('offline'))
		};
		const store = new PreferencesStore({ storage, endpoint: failing });

		await expect(store.setStudyDirection('englishToKorean')).rejects.toThrow('offline');

		const nextLaunch = new PreferencesStore({ storage, endpoint: fakeEndpoint().endpoint });
		nextLaunch.applyAccountSettings(accountSettings({ studyDirection: 'koreanToEnglish' }));

		expect(nextLaunch.studyDirection).toBe('englishToKorean');
	});

	it('lets the account change a direction this device did save, so another device can set it', async () => {
		const storage = memoryStorage();
		const { endpoint } = fakeEndpoint();
		const store = new PreferencesStore({ storage, endpoint });

		await store.setStudyDirection('englishToKorean');
		store.applyAccountSettings(accountSettings({ studyDirection: 'koreanToEnglish' }));

		expect(store.studyDirection).toBe('koreanToEnglish');
		expect(new PreferencesStore({ storage, endpoint }).studyDirection).toBe('koreanToEnglish');
	});

	it('reads a Study direction stored by the current version of the app', () => {
		const { endpoint } = fakeEndpoint();
		const store = new PreferencesStore({
			storage: memoryStorage({ [STUDY_DIRECTION_KEY]: 'englishToKorean' }),
			endpoint
		});

		expect(store.studyDirection).toBe('englishToKorean');
	});
});

describe('PreferencesStore — the scratch pad', () => {
	it('falls back to the one default when the scratch pad was never set', () => {
		const { endpoint } = fakeEndpoint();
		const store = new PreferencesStore({ storage: memoryStorage(), endpoint });

		expect(store.scratchPadEnabled).toBe(DEFAULT_SCRATCH_PAD_ENABLED);
		expect(DEFAULT_SCRATCH_PAD_ENABLED).toBe(false);
	});

	it('uses the new value immediately and keeps it on the device before saving it', async () => {
		const storage = memoryStorage();
		let valueWhenSaved: boolean | null = null;
		let valueOnDeviceWhenSaved: boolean | null = null;
		const { endpoint, saved } = fakeEndpoint();
		const store = new PreferencesStore({ storage, endpoint });
		endpoint.updateSettings = vi.fn(async (update: UpdateSettingsRequest) => {
			saved.push(update);
			valueWhenSaved = store.scratchPadEnabled;
			valueOnDeviceWhenSaved = new PreferencesStore({
				storage,
				endpoint: fakeEndpoint().endpoint
			}).scratchPadEnabled;
			return {};
		});

		await store.setScratchPadEnabled(true);

		expect(store.scratchPadEnabled).toBe(true);
		expect(valueWhenSaved).toBe(true);
		expect(valueOnDeviceWhenSaved).toBe(true);
		expect(saved).toEqual([{ scratchPadEnabled: true }]);
	});

	it('survives a reload: a new module over the same device storage reads the value', async () => {
		const storage = memoryStorage();
		const { endpoint } = fakeEndpoint();
		const store = new PreferencesStore({ storage, endpoint });

		await store.setScratchPadEnabled(true);

		expect(new PreferencesStore({ storage, endpoint }).scratchPadEnabled).toBe(true);
	});

	it('keeps the new value on the device and reports the failure when the save fails', async () => {
		const storage = memoryStorage();
		const endpoint: PreferencesEndpoint = {
			updateSettings: vi.fn().mockRejectedValue(new Error('Failed to fetch'))
		};
		const store = new PreferencesStore({ storage, endpoint });

		await expect(store.setScratchPadEnabled(true)).rejects.toThrow('Failed to fetch');

		expect(store.scratchPadEnabled).toBe(true);
		expect(new PreferencesStore({ storage, endpoint }).scratchPadEnabled).toBe(true);
	});

	it('toggles the scratch pad and saves the new value', async () => {
		const { endpoint, saved } = fakeEndpoint();
		const store = new PreferencesStore({ storage: memoryStorage(), endpoint });

		await expect(store.toggleScratchPad()).resolves.toBe(true);

		expect(store.scratchPadEnabled).toBe(true);
		expect(saved).toEqual([{ scratchPadEnabled: true }]);
	});

	it('adopts the account scratch pad setting on a device that holds none', () => {
		const storage = memoryStorage();
		const { endpoint } = fakeEndpoint();
		const store = new PreferencesStore({ storage, endpoint });

		store.applyAccountSettings(accountSettings({ scratchPadEnabled: true }));

		expect(store.scratchPadEnabled).toBe(true);
		expect(new PreferencesStore({ storage, endpoint }).scratchPadEnabled).toBe(true);
	});

	it('ignores a scratch pad value that is not a boolean', () => {
		const { endpoint } = fakeEndpoint();
		const store = new PreferencesStore({ storage: memoryStorage(), endpoint });

		store.applyAccountSettings({
			...accountSettings(),
			scratchPadEnabled: 'yes'
		} as unknown as UserSettings);

		expect(store.scratchPadEnabled).toBe(DEFAULT_SCRATCH_PAD_ENABLED);
	});

	it('does not replace a value this device could not save, so the failed save is not undone on launch', async () => {
		const storage = memoryStorage();
		const failing: PreferencesEndpoint = {
			updateSettings: vi.fn().mockRejectedValue(new Error('offline'))
		};
		const store = new PreferencesStore({ storage, endpoint: failing });

		await expect(store.setScratchPadEnabled(true)).rejects.toThrow('offline');

		const nextLaunch = new PreferencesStore({ storage, endpoint: fakeEndpoint().endpoint });
		nextLaunch.applyAccountSettings(accountSettings({ scratchPadEnabled: false }));

		expect(nextLaunch.scratchPadEnabled).toBe(true);
	});

	it('lets the account change a value this device did save, so another device can set it', async () => {
		const storage = memoryStorage();
		const { endpoint } = fakeEndpoint();
		const store = new PreferencesStore({ storage, endpoint });

		await store.setScratchPadEnabled(true);
		store.applyAccountSettings(accountSettings({ scratchPadEnabled: false }));

		expect(store.scratchPadEnabled).toBe(false);
		expect(new PreferencesStore({ storage, endpoint }).scratchPadEnabled).toBe(false);
	});

	it('reads a scratch pad value stored by the current version of the app', () => {
		const { endpoint } = fakeEndpoint();
		const store = new PreferencesStore({
			storage: memoryStorage({ [SCRATCH_PAD_KEY]: 'true' }),
			endpoint
		});

		expect(store.scratchPadEnabled).toBe(true);
	});
});
