import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { App } from '@capacitor/app';

export type BackButtonHandler = () => boolean | Promise<boolean>;

export interface BackButtonHandlerRegistration {
	priority: number;
	id: string;
	handler: BackButtonHandler;
}

let handlers: BackButtonHandlerRegistration[] = [];
let listenerHandle: PluginListenerHandle | null = null;
let lastBackPressTime = 0;
const DOUBLE_TAP_EXIT_INTERVAL_MS = 2000;

export function registerBackButtonAction(
	id: string,
	priority: number,
	handler: BackButtonHandler
): () => void {
	handlers = handlers.filter((h) => h.id !== id);
	handlers.push({ id, priority, handler });
	handlers.sort((a, b) => b.priority - a.priority);

	return () => {
		handlers = handlers.filter((h) => h.id !== id);
	};
}

export function registerModalDismiss(id: string, handler: BackButtonHandler): () => void {
	return registerBackButtonAction(id, 100, handler);
}

export function registerStudySessionGuard(id: string, handler: BackButtonHandler): () => void {
	return registerBackButtonAction(id, 50, handler);
}

export async function initializeBackButton(options?: {
	onRootExitPrompt?: () => void;
}): Promise<() => void> {
	if (typeof window === 'undefined' || !Capacitor.isPluginAvailable('App')) {
		return () => {};
	}

	if (listenerHandle) {
		await listenerHandle.remove();
		listenerHandle = null;
	}

	try {
		listenerHandle = await App.addListener('backButton', async ({ canGoBack }) => {
			// 1. Run through priority handlers
			for (const item of [...handlers]) {
				try {
					const handled = await item.handler();
					if (handled) return;
				} catch (err) {
					console.error(`[BackButton] Error executing handler '${item.id}':`, err);
				}
			}

			// 2. Fall back to standard browser history
			if (canGoBack && window.history.length > 1) {
				window.history.back();
				return;
			}

			// 3. Double-tap to exit or background when on root view
			const now = Date.now();
			if (now - lastBackPressTime < DOUBLE_TAP_EXIT_INTERVAL_MS) {
				await App.exitApp();
			} else {
				lastBackPressTime = now;
				if (options?.onRootExitPrompt) {
					options.onRootExitPrompt();
				}
			}
		});
	} catch (err) {
		console.warn('[BackButton] Failed to attach App.addListener:', err);
	}

	return async () => {
		if (listenerHandle) {
			await listenerHandle.remove();
			listenerHandle = null;
		}
	};
}
