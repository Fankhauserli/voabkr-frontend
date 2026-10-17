import { Capacitor } from '@capacitor/core';

/**
 * How the app is being displayed: the native shell, an installed PWA, or a
 * plain browser tab. Offline study is promised only in the first two.
 */
export type AppMode = 'native' | 'installed' | 'browser';

/**
 * The browser signals behind an App mode. They are injectable so the detection
 * can be tested without a real native shell or display mode.
 */
export interface AppModeSignals {
	isNativePlatform: () => boolean;
	matchesDisplayModeStandalone: () => boolean;
	navigatorStandalone: boolean | undefined;
}

function currentSignals(): AppModeSignals {
	return {
		isNativePlatform: () => Capacitor.isNativePlatform(),
		matchesDisplayModeStandalone: () =>
			typeof window !== 'undefined' &&
			typeof window.matchMedia === 'function' &&
			window.matchMedia('(display-mode: standalone)').matches,
		navigatorStandalone:
			typeof navigator !== 'undefined'
				? (navigator as Navigator & { standalone?: boolean }).standalone
				: undefined
	};
}

/**
 * The native shell is checked first: a Capacitor WebView can report a
 * standalone display mode even though it is not an installed PWA. An installed
 * PWA is either Chrome's `display-mode: standalone` or iOS Safari's
 * `navigator.standalone`. Everything else is a plain browser tab.
 */
export function detectAppMode(signals: AppModeSignals = currentSignals()): AppMode {
	if (signals.isNativePlatform()) return 'native';
	if (signals.matchesDisplayModeStandalone() || signals.navigatorStandalone === true) {
		return 'installed';
	}
	return 'browser';
}
