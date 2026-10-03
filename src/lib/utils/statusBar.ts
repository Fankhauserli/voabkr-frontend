import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export type AppTheme = 'light' | 'dark';

export const STATUS_BAR_THEMES = {
	light: {
		color: '#F8F6F0',
		style: Style.Light
	},
	dark: {
		color: '#121211',
		style: Style.Dark
	}
} as const;

function updateWebThemeColor(color: string): void {
	if (typeof document === 'undefined') return;

	const metaTags = document.querySelectorAll('meta[name="theme-color"]');
	if (metaTags.length > 0) {
		metaTags.forEach((el) => el.setAttribute('content', color));
	} else {
		const meta = document.createElement('meta');
		meta.name = 'theme-color';
		meta.content = color;
		document.head.appendChild(meta);
	}
}

function isStatusBarAvailable(): boolean {
	return Capacitor.isPluginAvailable('StatusBar') && Capacitor.isNativePlatform();
}

export async function setOverlaysWebView(overlay: boolean = false): Promise<void> {
	if (isStatusBarAvailable()) {
		try {
			await StatusBar.setOverlaysWebView({ overlay });
		} catch (err) {
			console.warn('[StatusBar] setOverlaysWebView failed:', err);
		}
	}
}

export async function setStatusBarTheme(theme: AppTheme): Promise<void> {
	const config = STATUS_BAR_THEMES[theme];
	updateWebThemeColor(config.color);

	if (isStatusBarAvailable()) {
		try {
			await StatusBar.setStyle({ style: config.style });
			await StatusBar.setBackgroundColor({ color: config.color });
		} catch (err) {
			console.warn(`[StatusBar] Failed to apply ${theme} theme:`, err);
		}
	}
}

export async function initializeStatusBar(initialTheme: AppTheme = 'light'): Promise<void> {
	await setOverlaysWebView(false);
	await setStatusBarTheme(initialTheme);
}
