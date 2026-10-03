import type { UserProfile, UserSettings } from '$lib/types';
import { authApi } from '$lib/api/auth';

/**
 * Svelte 5 Auth Store using pure runes ($state, $derived).
 */
class AuthStore {
	user = $state<UserProfile | null>(null);
	settings = $state<UserSettings | null>(null);
	isLoading = $state<boolean>(true);
	isInitialized = $state<boolean>(false);
	error = $state<string | null>(null);

	isAuthenticated = $derived(this.user !== null);
	isVerified = $derived(this.user?.isVerified ?? false);
	userId = $derived(this.user?.id ?? null);
	userName = $derived(this.user?.name ?? '');
	userEmail = $derived(this.user?.email ?? '');
	cardsPerDay = $derived(this.settings?.cardsPerDay ?? 20);

	async fetchUser(): Promise<void> {
		this.isLoading = true;
		this.error = null;
		try {
			const profile = await authApi.getProfile();
			this.user = profile;
			try {
				const settings = await authApi.getSettings();
				this.settings = settings;
			} catch {
				this.settings = { cardsPerDay: 20 };
			}
		} catch {
			this.user = null;
			this.settings = null;
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
	}

	updateProfile(data: Partial<UserProfile>) {
		if (this.user) {
			this.user = { ...this.user, ...data };
		}
	}

	setSettings(settings: UserSettings | null) {
		this.settings = settings;
	}

	updateCardsPerDay(cardsPerDay: number) {
		if (this.settings) {
			this.settings.cardsPerDay = cardsPerDay;
		} else {
			this.settings = { cardsPerDay };
		}
	}

	setVerified(verified: boolean) {
		if (this.user) {
			this.user.isVerified = verified;
		}
	}

	setLoading(loading: boolean) {
		this.isLoading = loading;
	}

	setError(error: string | null) {
		this.error = error;
		this.isLoading = false;
	}

	logout() {
		this.user = null;
		this.settings = null;
		this.error = null;
		this.isLoading = false;
		this.isInitialized = true;
	}
}

export const auth = new AuthStore();
export { AuthStore };
