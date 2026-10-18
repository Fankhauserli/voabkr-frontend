import { downloadedDecks } from '$lib/device/downloadedDecks.svelte';
import { reviewSync } from '$lib/stores/syncQueue.svelte';
import { deviceStudySource } from './deviceSource';

/**
 * Re-attempts the device-store open for every consumer a Study sitting reads —
 * the held Decks, the session's device source, and the Grade queue — and
 * re-hydrates each. The Study stage calls this when the learner presses Retry
 * after closing the other voabkr tab or window.
 *
 * Every consumer is attempted even when one fails, so a Retry never leaves the
 * sitting reading one consumer that has recovered and another still on the old
 * state. The first failure is thrown once all have settled.
 */
export async function reopenDeviceStores(): Promise<void> {
	const results = await Promise.allSettled([
		downloadedDecks.reopen(),
		deviceStudySource.reopen(),
		reviewSync.reopen()
	]);

	for (const result of results) {
		if (result.status === 'rejected') throw result.reason;
	}
}
