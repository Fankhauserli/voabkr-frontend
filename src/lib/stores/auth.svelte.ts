import type { UserProfile, UserSettings } from '$lib/types';
import { authApi } from '$lib/api/auth';
import { ApiError } from '$lib/api/client';
import { browserStorage } from '$lib/device/browserStorage';
import { reviewSync } from '$lib/stores/syncQueue.svelte';
import { preferences } from './preferences.svelte';

/** Where the learner the device remembers is kept between launches. */
export const REMEMBERED_LEARNER_KEY = 'voabkr_learner';

/** The part of the profile API the Auth store asks for. */
export interface AuthProfileApi {
	getProfile(silent?: boolean): Promise<UserProfile>;
	getSettings(silent?: boolean): Promise<UserSettings>;
}

/** The persistent storage the remembered learner is written to. */
export interface AuthStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

/** What the device remembers about the last learner it signed in. */
interface RememberedLearner {
	user: UserProfile;
}

export interface AuthStoreOptions {
	api?: AuthProfileApi;
	storage?: AuthStorage | null;
	/**
	 * Told which learner is signed in, so the Grade queue records Grades under the
	 * right learner. `sessionConfirmed` is false while the learner is only
	 * remembered from the last launch: their Grades must not upload until the
	 * backend has confirmed that this session really is theirs.
	 */
	onLearnerChange?: (learnerId: number | null, sessionConfirmed: boolean) => void;
	/**
	 * Told the settings the account returned, so the Preferences module can
	 * adopt the values it owns. Never told a value the account did not return.
	 */
	onSettings?: (settings: UserSettings) => void;
}

/** A real 401 is the only answer that means the session was revoked. */
function isUnauthorized(error: unknown): boolean {
	return error instanceof ApiError && error.status === 401;
}

function isUserProfile(value: unknown): value is UserProfile {
	if (typeof value !== 'object' || value === null) return false;
	const candidate = value as Partial<UserProfile>;
	return (
		typeof candidate.id === 'number' &&
		typeof candidate.name === 'string' &&
		typeof candidate.email === 'string'
	);
}

/**
 * Svelte 5 Auth Store using pure runes ($state, $derived).
 *
 * The device remembers the last learner it signed in, so opening the app with no
 * connection still leaves the learner signed in. Only a real 401 from the backend
 * signs them out; a failed request is not a revoked session.
 */
class AuthStore {
	user = $state<UserProfile | null>(null);
	isLoading = $state<boolean>(true);
	isInitialized = $state<boolean>(false);
	error = $state<string | null>(null);

	isAuthenticated = $derived(this.user !== null);
	isVerified = $derived(this.user?.isVerified ?? false);
	userId = $derived(this.user?.id ?? null);
	userName = $derived(this.user?.name ?? '');
	userEmail = $derived(this.user?.email ?? '');
	readonly #api: AuthProfileApi;
	readonly #storage: AuthStorage | null;
	readonly #onLearnerChange: (learnerId: number | null, sessionConfirmed: boolean) => void;
	readonly #onSettings: (settings: UserSettings) => void;

	constructor(options: AuthStoreOptions = {}) {
		this.#api = options.api ?? authApi;
		this.#storage = options.storage === undefined ? browserStorage() : options.storage;
		this.#onLearnerChange = options.onLearnerChange ?? (() => {});
		this.#onSettings = options.onSettings ?? (() => {});
		this.#restore();
	}

	async fetchUser(): Promise<void> {
		this.isLoading = true;
		this.error = null;

		let profile: UserProfile;
		try {
			profile = await this.#api.getProfile();
		} catch (error) {
			// A network failure is not a revoked session: the remembered learner stays
			// signed in. Only a 401 from the backend signs them out.
			if (isUnauthorized(error)) {
				this.logout();
			}
			this.isLoading = false;
			this.isInitialized = true;
			return;
		}

		this.user = profile;
		this.#remember();
		// The backend confirmed this session belongs to this learner, so their
		// Queued Grades may now upload.
		this.#onLearnerChange(profile.id, true);

		try {
			// The account's settings belong to Preferences; the account store keeps
			// only the profile. A failed request leaves the device's preferences,
			// and their defaults, where they are.
			this.#onSettings(await this.#api.getSettings());
		} catch (error) {
			if (isUnauthorized(error)) {
				this.logout();
				return;
			}
		} finally {
			this.isLoading = false;
			this.isInitialized = true;
		}
	}

	setProfile(user: UserProfile | null) {
		this.user = user;
		this.error = null;
		this.isLoading = false;
		this.isInitialized = true;
		if (user) {
			this.#remember();
			this.#onLearnerChange(user.id, true);
		} else {
			this.#forget();
			this.#onLearnerChange(null, false);
		}
	}

	updateProfile(data: Partial<UserProfile>) {
		if (this.user) {
			this.user = { ...this.user, ...data };
			this.#remember();
		}
	}

	setVerified(verified: boolean) {
		if (this.user) {
			this.user.isVerified = verified;
			this.#remember();
		}
	}

	setLoading(loading: boolean) {
		this.isLoading = loading;
	}

	setError(error: string | null) {
		this.error = error;
		this.isLoading = false;
	}

	/** Signs the learner out on this device. Queued Grades are the queue's, not ours. */
	logout() {
		this.user = null;
		this.error = null;
		this.isLoading = false;
		this.isInitialized = true;
		this.#forget();
		this.#onLearnerChange(null, false);
	}

	/** Restores the learner from the last launch, before any request is made. */
	#restore(): void {
		const raw = this.#read();
		if (raw === null) return;

		try {
			const remembered = JSON.parse(raw) as Partial<RememberedLearner>;
			if (!isUserProfile(remembered.user)) {
				this.#forget();
				return;
			}
			this.user = remembered.user;
			// The queue must know the learner even while the profile request is
			// still in flight, so a Grade given in the meantime is owned correctly.
			// It may not upload anything until a profile request confirms the
			// session really belongs to them.
			this.#onLearnerChange(remembered.user.id, false);
		} catch {
			this.#forget();
		}
	}

	#read(): string | null {
		try {
			return this.#storage?.getItem(REMEMBERED_LEARNER_KEY) ?? null;
		} catch {
			return null;
		}
	}

	#remember(): void {
		if (!this.user) return;
		try {
			const remembered: RememberedLearner = { user: this.user };
			this.#storage?.setItem(REMEMBERED_LEARNER_KEY, JSON.stringify(remembered));
		} catch {
			// A device that refuses storage still works for this launch.
		}
	}

	#forget(): void {
		try {
			this.#storage?.removeItem(REMEMBERED_LEARNER_KEY);
		} catch {
			// Nothing more can be done if the device refuses storage.
		}
	}
}

export const auth = new AuthStore({
	onLearnerChange: (learnerId, sessionConfirmed) =>
		reviewSync.setLearner(learnerId, sessionConfirmed),
	onSettings: (settings) => preferences.applyAccountSettings(settings)
});
export { AuthStore };
