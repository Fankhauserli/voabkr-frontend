/** Marks the browser-tab home-screen nudge as dismissed on this device. */
export const INSTALL_PROMPT_DISMISSED_KEY = 'voabkr_install_prompt_dismissed';

/** The slice of Storage the dismissal needs; injectable for tests. */
export interface PromptStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

/** The browser's storage, or null where it is unavailable (e.g. SSR). */
export function browserStorage(): PromptStorage | null {
	try {
		return typeof localStorage !== 'undefined' ? localStorage : null;
	} catch {
		return null;
	}
}

export function isInstallPromptDismissed(storage: PromptStorage | null): boolean {
	if (!storage) return false;
	try {
		return storage.getItem(INSTALL_PROMPT_DISMISSED_KEY) === 'true';
	} catch {
		return false;
	}
}

/**
 * Remembers that the learner dismissed the nudge. Storage can be unavailable
 * or full; the prompt is a courtesy, so failing to persist the dismissal must
 * not break the page.
 */
export function dismissInstallPrompt(storage: PromptStorage | null): void {
	if (!storage) return;
	try {
		storage.setItem(INSTALL_PROMPT_DISMISSED_KEY, 'true');
	} catch {
		// Nothing to do: the prompt will simply be shown on the next visit.
	}
}
