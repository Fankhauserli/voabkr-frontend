import type { StudyDirection, UpdateSettingsRequest, UserSettings } from '$lib/types';
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

/** The Study direction for a learner who has never set one. */
export const DEFAULT_STUDY_DIRECTION: StudyDirection = 'koreanToEnglish';

/** Whether the scratch pad is shown for a learner who has never set it. */
export const DEFAULT_SCRATCH_PAD_ENABLED = false;

/** Where each preference is kept on the device. */
const DAILY_GOAL_KEY = 'voabkr_daily_goal';
/** The name the current app already stores Study direction under: keep it, so no learner is reset. */
export const STUDY_DIRECTION_KEY = 'voabkr_study_direction';
/** The name the current app already stores the scratch pad under: keep it, so no learner is reset. */
export const SCRATCH_PAD_KEY = 'voabkr_scratch_pad_enabled';

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

/** A preference as it is kept on the device, and whether the account accepted it. */
interface StoredPreference<T> {
	value: T;
	saved: boolean;
}

/** Whether the endpoint would accept a Daily goal: a whole number above zero. */
function isAcceptableDailyGoal(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/** Whether a value is one of the two Study directions. */
function isStudyDirection(value: unknown): value is StudyDirection {
	return value === 'koreanToEnglish' || value === 'englishToKorean';
}

/** A Study direction as the current app writes it: a bare value under the same name. */
function readLegacyStudyDirection(raw: string): StudyDirection | null {
	return isStudyDirection(raw) ? raw : null;
}

/** A scratch pad setting as the current app writes it: the string `true` or `false`. */
function readLegacyScratchPad(raw: string): boolean | null {
	if (raw === 'true') return true;
	if (raw === 'false') return false;
	return null;
}

export class PreferencesStore {
	/** The number of New Cards the app brings into play each Day. */
	#dailyGoal = $state(DEFAULT_DAILY_GOAL);

	/** Which side of a Card is the prompt. */
	#studyDirection = $state<StudyDirection>(DEFAULT_STUDY_DIRECTION);

	/** Whether the study screen shows the handwriting scratch pad. */
	#scratchPadEnabled = $state(DEFAULT_SCRATCH_PAD_ENABLED);

	readonly #storage: PreferencesStorage | null;
	readonly #endpoint: PreferencesEndpoint;

	/** The device's own values, kept so an unsaved change survives a reload. */
	#storedDailyGoal: StoredPreference<number> | null = null;
	#storedStudyDirection: StoredPreference<StudyDirection> | null = null;
	#storedScratchPad: StoredPreference<boolean> | null = null;

	constructor(options: PreferencesOptions = {}) {
		this.#storage = options.storage === undefined ? browserStorage() : options.storage;
		this.#endpoint = options.endpoint ?? authApi;

		const dailyGoal = this.#readPreference(DAILY_GOAL_KEY, isAcceptableDailyGoal, () => null);
		if (dailyGoal !== null) {
			this.#dailyGoal = dailyGoal.value;
			this.#storedDailyGoal = dailyGoal;
		}

		const studyDirection = this.#readPreference(
			STUDY_DIRECTION_KEY,
			isStudyDirection,
			readLegacyStudyDirection
		);
		if (studyDirection !== null) {
			this.#studyDirection = studyDirection.value;
			this.#storedStudyDirection = studyDirection;
		}

		const scratchPad = this.#readPreference(
			SCRATCH_PAD_KEY,
			(value): value is boolean => typeof value === 'boolean',
			readLegacyScratchPad
		);
		if (scratchPad !== null) {
			this.#scratchPadEnabled = scratchPad.value;
			this.#storedScratchPad = scratchPad;
		}
	}

	get dailyGoal(): number {
		return this.#dailyGoal;
	}

	get studyDirection(): StudyDirection {
		return this.#studyDirection;
	}

	get scratchPadEnabled(): boolean {
		return this.#scratchPadEnabled;
	}

	/**
	 * Adopt the settings the account returned. A change this device made but
	 * could not save wins, so a failed save is not undone on the next launch.
	 * Otherwise the account is authoritative, so a preference changed on another
	 * device reaches this one. Anything the account omits leaves the device's
	 * value, or the default, in place.
	 */
	applyAccountSettings(settings: UserSettings | null): void {
		this.#applyDailyGoal(settings?.cardsPerDay);
		this.#applyStudyDirection(settings?.studyDirection);
		this.#applyScratchPadEnabled(settings?.scratchPadEnabled);
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

	/**
	 * Set the Study direction. The new direction is used and kept on the device
	 * at once, then saved to the account. A failed save reports to the caller and
	 * leaves the device's direction in place.
	 */
	async setStudyDirection(direction: StudyDirection): Promise<void> {
		this.#studyDirection = direction;
		this.#storeStudyDirection({ value: direction, saved: false });

		await this.#endpoint.updateSettings({ studyDirection: direction });

		if (this.#storedStudyDirection?.value === direction) {
			this.#storeStudyDirection({ value: direction, saved: true });
		}
	}

	/** Switch the prompt to the other side of the Card, saving the new direction. */
	async toggleStudyDirection(): Promise<void> {
		await this.setStudyDirection(
			this.#studyDirection === 'koreanToEnglish' ? 'englishToKorean' : 'koreanToEnglish'
		);
	}

	/**
	 * Show or hide the scratch pad. The new value is used and kept on the device
	 * at once, then saved to the account. A failed save reports to the caller and
	 * leaves the device's value in place.
	 */
	async setScratchPadEnabled(enabled: boolean): Promise<void> {
		this.#scratchPadEnabled = enabled;
		this.#storeScratchPad({ value: enabled, saved: false });

		await this.#endpoint.updateSettings({ scratchPadEnabled: enabled });

		if (this.#storedScratchPad?.value === enabled) {
			this.#storeScratchPad({ value: enabled, saved: true });
		}
	}

	/**
	 * Show the scratch pad when it is hidden, or hide it when it is shown.
	 * Returns the value now in use, so a caller can say what it became.
	 */
	async toggleScratchPad(): Promise<boolean> {
		const enabled = !this.#scratchPadEnabled;
		await this.setScratchPadEnabled(enabled);
		return enabled;
	}

	#applyDailyGoal(accountGoal: unknown): void {
		if (!isAcceptableDailyGoal(accountGoal)) return;
		if (this.#storedDailyGoal !== null && !this.#storedDailyGoal.saved) return;

		this.#dailyGoal = accountGoal;
		this.#storeDailyGoal({ value: accountGoal, saved: true });
	}

	#applyStudyDirection(accountDirection: unknown): void {
		if (!isStudyDirection(accountDirection)) return;
		if (this.#storedStudyDirection !== null && !this.#storedStudyDirection.saved) return;

		this.#studyDirection = accountDirection;
		this.#storeStudyDirection({ value: accountDirection, saved: true });
	}

	#applyScratchPadEnabled(accountValue: unknown): void {
		if (typeof accountValue !== 'boolean') return;
		if (this.#storedScratchPad !== null && !this.#storedScratchPad.saved) return;

		this.#scratchPadEnabled = accountValue;
		this.#storeScratchPad({ value: accountValue, saved: true });
	}

	/**
	 * Read a preference from the device. A value written by this module carries
	 * whether the account accepted it; a bare value written by the current app
	 * predates that record and is read as saved. Anything unrecognizable is
	 * treated as absent, so the default stands.
	 */
	#readPreference<T>(
		key: string,
		accepts: (value: unknown) => value is T,
		readLegacy: (raw: string) => T | null
	): StoredPreference<T> | null {
		try {
			const raw = this.#storage?.getItem(key) ?? null;
			if (raw === null) return null;

			let parsed: unknown = null;
			try {
				parsed = JSON.parse(raw);
			} catch {
				// A bare value from the current app is not JSON: fall through to its reader.
			}

			if (typeof parsed === 'object' && parsed !== null) {
				const { value, saved } = parsed as Partial<StoredPreference<T>>;
				if (accepts(value) && typeof saved === 'boolean') return { value, saved };
			}

			const legacy = readLegacy(raw);
			return legacy === null ? null : { value: legacy, saved: true };
		} catch {
			return null;
		}
	}

	#writePreference<T>(key: string, stored: StoredPreference<T>): void {
		try {
			this.#storage?.setItem(key, JSON.stringify(stored));
		} catch {
			// A device that refuses storage still works for this launch.
		}
	}

	#storeDailyGoal(stored: StoredPreference<number>): void {
		this.#storedDailyGoal = stored;
		this.#writePreference(DAILY_GOAL_KEY, stored);
	}

	#storeStudyDirection(stored: StoredPreference<StudyDirection>): void {
		this.#storedStudyDirection = stored;
		this.#writePreference(STUDY_DIRECTION_KEY, stored);
	}

	#storeScratchPad(stored: StoredPreference<boolean>): void {
		this.#storedScratchPad = stored;
		this.#writePreference(SCRATCH_PAD_KEY, stored);
	}
}

export const preferences = new PreferencesStore();
