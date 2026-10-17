import type { UpdateSettingsRequest, UserSettings } from '$lib/types';
import { authApi } from '$lib/api/auth';
import { browserStorage, type DeviceStorage } from '$lib/device/browserStorage';

/**
 * The learner's preferences: the values that shape how the app studies. One
 * module owns them, so every screen and the Study session read the same copy
 * and no two places can disagree.
 *
 * A preference is kept on the device first, so it survives a reload and needs
 * no connection; the account is told about a change afterwards. A save that
 * fails leaves the device's value in place and reports the failure to the
 * caller rather than reverting in silence.
 */

/** The Daily goal for a learner who has never set one. */
export const DEFAULT_DAILY_GOAL = 20;

/** Where the Daily goal is kept on the device. */
const DAILY_GOAL_KEY = 'voabkr_daily_goal';

/** The device storage preferences are written to. */
export type PreferencesStorage = DeviceStorage;

/** The part of the user-settings endpoint the Preferences module saves through. */
export interface PreferencesEndpoint {
	updateSettings(data: UpdateSettingsRequest): Promise<unknown>;
}

export interface PreferencesOptions {
	storage?: PreferencesStorage | null;
	endpoint?: PreferencesEndpoint;
}

/** A Daily goal as it is kept on the device, and whether the account accepted it. */
interface StoredDailyGoal {
	value: number;
	saved: boolean;
}

/** Whether the endpoint would accept a Daily goal: a whole number above zero. */
function isAcceptableDailyGoal(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

export class PreferencesStore {
	/** The number of New Cards the app brings into play each Day. */
	#dailyGoal = $state(DEFAULT_DAILY_GOAL);

	readonly #storage: PreferencesStorage | null;
	readonly #endpoint: PreferencesEndpoint;

	/** The device's own Daily goal, kept so an unsaved change survives a reload. */
	#storedDailyGoal: StoredDailyGoal | null = null;

	constructor(options: PreferencesOptions = {}) {
		this.#storage = options.storage === undefined ? browserStorage() : options.storage;
		this.#endpoint = options.endpoint ?? authApi;

		const stored = this.#readDailyGoal();
		if (stored !== null) {
			this.#dailyGoal = stored.value;
			this.#storedDailyGoal = stored;
		}
	}

	get dailyGoal(): number {
		return this.#dailyGoal;
	}

	/**
	 * Adopt the Daily goal from the settings the account returned. A change this
	 * device made but could not save wins, so a failed save is not undone on the
	 * next launch. Otherwise the account is authoritative, so a goal changed on
	 * another device reaches this one.
	 */
	applyAccountSettings(settings: UserSettings | null): void {
		if (this.#storedDailyGoal !== null && !this.#storedDailyGoal.saved) return;

		const accountGoal = settings?.cardsPerDay;
		if (!isAcceptableDailyGoal(accountGoal)) return;

		this.#dailyGoal = accountGoal;
		this.#storeDailyGoal({ value: accountGoal, saved: true });
	}

	/**
	 * Set the Daily goal. The new value is used and kept on the device at once,
	 * then saved to the account. If the account refuses the save, the device's
	 * value stands and the failure reaches the caller.
	 */
	async setDailyGoal(value: number): Promise<void> {
		if (!isAcceptableDailyGoal(value)) {
			throw new Error('The Daily goal must be a whole number greater than zero');
		}

		this.#dailyGoal = value;
		this.#storeDailyGoal({ value, saved: false });

		await this.#endpoint.updateSettings({ cardsPerDay: value });

		// Only this value's own save may mark it saved: a later change is still
		// waiting for its own save.
		if (this.#storedDailyGoal?.value === value) {
			this.#storeDailyGoal({ value, saved: true });
		}
	}

	/** The Daily goal this device holds, or null when it holds none. */
	#readDailyGoal(): StoredDailyGoal | null {
		try {
			const raw = this.#storage?.getItem(DAILY_GOAL_KEY) ?? null;
			if (raw === null) return null;

			const parsed: unknown = JSON.parse(raw);
			if (typeof parsed !== 'object' || parsed === null) return null;
			const { value, saved } = parsed as Partial<StoredDailyGoal>;
			if (!isAcceptableDailyGoal(value) || typeof saved !== 'boolean') return null;

			return { value, saved };
		} catch {
			return null;
		}
	}

	#storeDailyGoal(stored: StoredDailyGoal): void {
		this.#storedDailyGoal = stored;
		try {
			this.#storage?.setItem(DAILY_GOAL_KEY, JSON.stringify(stored));
		} catch {
			// A device that refuses storage still works for this launch.
		}
	}
}

export const preferences = new PreferencesStore();
