<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { studySession } from '$lib/stores/study.svelte';
	import TactileButton from '$lib/components/forms/TactileButton.svelte';

	/** The finished Study session's account; null until a Study session has finished. */
	let summary = $derived(studySession.sessionSummary);

	onMount(() => {
		// Arrived without finishing a Study session — by URL, by a refresh, by the back
		// button. There is no Session summary to report, so the learner is sent home
		// rather than shown a session that never happened. Replacing the entry keeps the
		// empty summary out of the history, so Back from home does not land here again.
		if (!summary) goto('/', { replaceState: true });
	});

	function handleStudyNextBatch() {
		const hasNext = studySession.startNextBatch();
		if (hasNext) {
			if (studySession.sessionDeckId) {
				goto(`/study/${studySession.sessionDeckId}`);
			} else {
				goto('/study');
			}
		}
	}
</script>

<svelte:head>
	<title>voabkr — Session Complete</title>
</svelte:head>

{#if summary}
	{@const failCount = (summary.ratingsCount[0] || 0) + (summary.ratingsCount[1] || 0)}
	{@const hardCount = (summary.ratingsCount[2] || 0) + (summary.ratingsCount[3] || 0)}
	{@const goodCount = (summary.ratingsCount[4] || 0) + (summary.ratingsCount[5] || 0)}
	{@const total = summary.totalReviewed || 1}
	{@const failPct = Math.round((failCount / total) * 100)}
	{@const hardPct = Math.round((hardCount / total) * 100)}
	{@const goodPct = Math.round((goodCount / total) * 100)}
	{@const wordsLearned = summary.distinctCardsCount ?? summary.totalReviewed}

	<div
		class="mx-auto flex min-h-screen w-full max-w-md flex-col justify-between px-4 py-6"
		style="padding-top: calc(var(--safe-top) + 16px); padding-bottom: calc(var(--safe-bottom) + 24px);"
	>
		<main class="my-auto flex flex-col items-center text-center">
			<!-- Tactile Stamp / Seal -->
			<div
				class="mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-crimson/50 bg-crimson/10 p-3 shadow-xs"
			>
				<div
					class="flex h-full w-full items-center justify-center rounded-full border border-dashed border-crimson/60 text-crimson"
				>
					<span class="text-xl font-black">참잘함</span>
				</div>
			</div>

			<h1 class="hangul-text text-2xl font-bold tracking-tight break-keep text-ink-primary">
				수고하셨습니다!
			</h1>
			<p class="mt-1 text-sm text-ink-secondary">
				{#if summary.batchNumber && summary.batchNumber > 1}
					Batch {summary.batchNumber} Complete
				{:else}
					Study Session Complete
				{/if}
			</p>

			{#if summary.relearningRepeats && summary.relearningRepeats > 0}
				<p
					class="mt-2 rounded-lg border border-border-subtle bg-surface px-3 py-1 text-xs text-ink-secondary"
				>
					Reinforced {summary.relearningRepeats}
					{summary.relearningRepeats === 1 ? 'missed card' : 'missed cards'} until mastered
				</p>
			{/if}

			{#if studySession.hasMoreCardsInDeck}
				<p class="mt-2 text-xs font-semibold text-primary">
					{studySession.remainingInDeckCount} words remaining in this deck
				</p>
			{/if}

			<!-- 3-Column Stat Grid -->
			<div class="mt-6 grid w-full grid-cols-3 gap-3">
				<div class="rounded-2xl border border-border-subtle bg-surface p-3.5 shadow-xs">
					<p class="text-[11px] font-bold tracking-wider text-ink-muted uppercase">Mastered</p>
					<p class="mt-1 text-2xl font-black text-ink-primary">{wordsLearned}</p>
					<p class="text-[10px] text-ink-secondary">Words</p>
				</div>

				<div class="rounded-2xl border border-border-subtle bg-surface p-3.5 shadow-xs">
					<p class="text-[11px] font-bold tracking-wider text-ink-muted uppercase">Retention</p>
					<p class="mt-1 text-2xl font-black text-celadon">{summary.retentionRate}%</p>
					<p class="text-[10px] text-ink-secondary">1st Attempt</p>
				</div>

				<div class="rounded-2xl border border-border-subtle bg-surface p-3.5 shadow-xs">
					<p class="text-[11px] font-bold tracking-wider text-ink-muted uppercase">Streak</p>
					<p class="mt-1 text-2xl font-black text-amber">{summary.streakDays}d</p>
					<p class="text-[10px] text-ink-secondary">Consistent</p>
				</div>
			</div>

			<!-- Ease Distribution Segmented Bar -->
			<div
				class="mt-6 w-full rounded-2xl border border-border-subtle bg-surface p-4 text-left shadow-xs"
			>
				<div class="mb-2 flex items-center justify-between">
					<span class="text-xs font-bold tracking-wider text-ink-muted uppercase">
						Recall Performance
					</span>
					<span class="text-xs text-ink-secondary">
						{goodCount} Good · {hardCount} Hard · {failCount} Again
					</span>
				</div>

				<!-- Multi-color Segmented Bar -->
				<div class="flex h-3 w-full overflow-hidden rounded-full bg-border-subtle">
					<div class="bg-celadon" style="width: {goodPct}%;" title="Good/Easy: {goodPct}%"></div>
					<div class="bg-amber" style="width: {hardPct}%;" title="Hard: {hardPct}%"></div>
					<div class="bg-crimson" style="width: {failPct}%;" title="Forgotten: {failPct}%"></div>
				</div>

				<div class="mt-2.5 flex items-center justify-between text-[11px] text-ink-muted">
					<span class="flex items-center gap-1">
						<span class="h-2 w-2 rounded-full bg-celadon"></span> Good/Easy ({goodPct}%)
					</span>
					<span class="flex items-center gap-1">
						<span class="h-2 w-2 rounded-full bg-amber"></span> Hard ({hardPct}%)
					</span>
					<span class="flex items-center gap-1">
						<span class="h-2 w-2 rounded-full bg-crimson"></span> Again ({failPct}%)
					</span>
				</div>
			</div>

			<!-- Next Review Forecast -->
			<div class="mt-4 flex items-center gap-1.5 text-xs text-ink-secondary">
				<svg
					class="h-3.5 w-3.5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<circle cx="12" cy="12" r="10"></circle>
					<polyline points="12 6 12 12 16 14"></polyline>
				</svg>
				<span>Spaced intervals scheduled automatically by SM-2.</span>
			</div>
		</main>

		<!-- Action Tray -->
		<footer class="mt-6 flex w-full flex-col gap-2.5">
			{#if studySession.hasMoreCardsInDeck}
				<button type="button" onclick={handleStudyNextBatch} class="w-full">
					<TactileButton variant="primary" size="lg" fullWidth>
						Study Next Batch ({Math.min(studySession.batchSize, studySession.remainingInDeckCount)} Cards)
					</TactileButton>
				</button>
				<a href="/" class="block">
					<TactileButton variant="secondary" size="md" fullWidth>Return Home</TactileButton>
				</a>
				<a href="/decks" class="block">
					<TactileButton variant="secondary" size="sm" fullWidth>Back to Decks</TactileButton>
				</a>
			{:else}
				<a href="/" class="block">
					<TactileButton variant="primary" size="lg" fullWidth>Return Home</TactileButton>
				</a>
				<a href="/decks" class="block">
					<TactileButton variant="secondary" size="md" fullWidth>Review More Decks</TactileButton>
				</a>
			{/if}
		</footer>
	</div>
{/if}
