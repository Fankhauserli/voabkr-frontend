import { browserStorage, type DeviceStorage } from '$lib/device/browserStorage';

/** Marks the browser-tab home-screen nudge as dismissed on this device. */
export const INSTALL_PROMPT_DISMISSED_KEY = 'voabkr_install_prompt_dismissed';

/** The slice of device storage the dismissal needs; injectable for tests. */
export type PromptStorage = DeviceStorage;

export { browserStorage };

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
