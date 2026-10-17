<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
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

	onMount(() => {
		void studySession.start({ deckId: scopeDeckId ?? undefined });
	});
</script>

<svelte:head>
	<title>voabkr — Study Session</title>
</svelte:head>

<StudyStage session={studySession} deckId={scopeDeckId} />
