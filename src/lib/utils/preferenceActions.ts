import { preferences } from '$lib/stores/preferences.svelte';
import { toast } from '$lib/stores/toast.svelte';

/**
 * Report a preference the account did not accept. The learner's chosen value
 * stays on the device, so the message names the failed account save rather
 * than claiming the change did not happen.
 */
export function reportPreferenceSaveFailure(subject: string, error: unknown): void {
	toast.error(
		error instanceof Error
			? `Could not save your ${subject} to your account: ${error.message}`
			: `Could not save your ${subject} to your account`
	);
}

/** Switch the Study direction, reporting a failed save; the new direction still stands. */
export async function toggleStudyDirectionAndReport(): Promise<void> {
	try {
		await preferences.toggleStudyDirection();
	} catch (error) {
		reportPreferenceSaveFailure('Study direction', error);
	}
}

/** Show or hide the scratch pad, reporting a failed save; the new value still stands. */
export async function toggleScratchPadAndReport(): Promise<void> {
	try {
		await preferences.toggleScratchPad();
	} catch (error) {
		reportPreferenceSaveFailure('scratch pad setting', error);
	}
}
