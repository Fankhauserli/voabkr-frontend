<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { reopenDeviceStores } from '$lib/study/reopenDeviceStores';
	import { studySession } from '$lib/stores/study.svelte';
	import StudyStage from '$lib/components/study/StudyStage.svelte';

	/**
	 * The scope this route opened: a Deck named in the query, or the due queue
	 * across every held Deck. A scope that is not a whole Deck id is the due queue.
	 */
	function readScope(): number | null {
		const raw =
			page.url.searchParams.get('deck_id') ||
			page.url.searchParams.get('deckId') ||
			page.url.searchParams.get('deck');
		if (!raw) return null;

		const deckId = Number(raw);
		return Number.isInteger(deckId) && deckId > 0 ? deckId : null;
	}

	const scopeDeckId = readScope();

	function startSitting() {
		return studySession.start({ deckId: scopeDeckId ?? undefined });
	}

	onMount(() => {
		void startSitting();
	});

	/** Re-attempts the store open, then the sitting, without a page reload. */
	async function retry() {
		try {
			await reopenDeviceStores();
		} catch {
			// Still blocked: keep the way back rather than start with a consumer missing.
			studySession.blockedByDeviceStore();
			return;
		}
		await startSitting();
	}
</script>

<svelte:head>
	<title>voabkr — Study Session</title>
</svelte:head>

<StudyStage session={studySession} deckId={scopeDeckId} onRetry={retry} />
