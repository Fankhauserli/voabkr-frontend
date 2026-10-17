import { describe, expect, it } from 'vitest';
import { detectAppMode, type AppModeSignals } from './appMode';

/** The signals of a plain browser tab unless a test says otherwise. */
const signals = (overrides: Partial<AppModeSignals> = {}): AppModeSignals => ({
	isNativePlatform: () => false,
	matchesDisplayModeStandalone: () => false,
	navigatorStandalone: undefined,
	...overrides
});

describe('detectAppMode', () => {
	it('reports the native shell even when its WebView also reports a standalone display mode', () => {
		expect(
			detectAppMode(
				signals({
					isNativePlatform: () => true,
					matchesDisplayModeStandalone: () => true,
					navigatorStandalone: true
				})
			)
		).toBe('native');
	});

	it('reports an installed PWA when the display mode is standalone', () => {
		expect(detectAppMode(signals({ matchesDisplayModeStandalone: () => true }))).toBe('installed');
	});

	it('reports an installed PWA when iOS Safari marks the page as standalone', () => {
		expect(detectAppMode(signals({ navigatorStandalone: true }))).toBe('installed');
	});

	it('reports a plain browser tab when neither install signal is present', () => {
		expect(detectAppMode(signals())).toBe('browser');
	});
});
