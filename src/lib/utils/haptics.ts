import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

function webVibrate(pattern: number | number[]): void {
	if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
		try {
			navigator.vibrate(pattern);
		} catch {
			// Ignore web vibration policy errors
		}
	}
}

function isHapticsAvailable(): boolean {
	return Capacitor.isPluginAvailable('Haptics') && Capacitor.isNativePlatform();
}

/**
 * Card flip tactile feedback (light impact).
 */
export async function cardFlip(): Promise<void> {
	if (isHapticsAvailable()) {
		try {
			await Haptics.impact({ style: ImpactStyle.Light });
			return;
		} catch {
			/* ignore */
		}
	}
	webVibrate(15);
}

/**
 * SM-2 rating haptic response based on ease score (0 to 5):
 * - 0–2 (Mistake): Warning notification
 * - 3–4 (Good): Medium impact
 * - 5 (Perfect): Success notification
 */
export async function sm2Rating(ease: number): Promise<void> {
	if (isHapticsAvailable()) {
		try {
			if (ease <= 2) {
				await Haptics.notification({ type: NotificationType.Warning });
			} else if (ease <= 4) {
				await Haptics.impact({ style: ImpactStyle.Medium });
			} else {
				await Haptics.notification({ type: NotificationType.Success });
			}
			return;
		} catch {
			/* ignore */
		}
	}

	if (ease <= 2) {
		webVibrate([40, 60, 40]);
	} else if (ease <= 4) {
		webVibrate(25);
	} else {
		webVibrate([15, 30, 20]);
	}
}

/**
 * Subtle selection click for tabs and buttons.
 */
export async function selectionClick(): Promise<void> {
	if (isHapticsAvailable()) {
		try {
			await Haptics.selectionStart();
			return;
		} catch {
			/* ignore */
		}
	}
	webVibrate(10);
}

/**
 * Warning / error notification haptic feedback.
 */
export async function errorWarning(): Promise<void> {
	if (isHapticsAvailable()) {
		try {
			await Haptics.notification({ type: NotificationType.Error });
			return;
		} catch {
			/* ignore */
		}
	}
	webVibrate([50, 50, 50]);
}

export const hapticFeedback = {
	cardFlip,
	sm2Rating,
	selectionClick,
	errorWarning
};
