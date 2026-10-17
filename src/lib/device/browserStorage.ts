/**
 * The device's own key-value storage: the browser's localStorage in the app.
 *
 * It is injected into the modules that keep small records on the device, so
 * their tests can stand an in-memory store in for it without a browser.
 */

/** The slice of the browser's Storage the device keeps small records in. */
export interface DeviceStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

/** The browser's storage, or null where it is unavailable (for example during SSR). */
export function browserStorage(): DeviceStorage | null {
	try {
		return typeof localStorage !== 'undefined' ? localStorage : null;
	} catch {
		// Storage can be unavailable, for example when the browser blocks it.
		return null;
	}
}
