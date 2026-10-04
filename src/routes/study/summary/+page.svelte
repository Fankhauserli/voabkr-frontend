<script lang="ts">
	import { studySession } from '$lib/stores/study.svelte';
	import TactileButton from '$lib/components/forms/TactileButton.svelte';

	let summary = $derived(
		studySession.lastSessionSummary ?? {
			totalReviewed: 10,
			retentionRate: 85,
			ratingsCount: { 0: 0, 1: 1, 2: 0, 3: 2, 4: 4, 5: 3 },
			streakDays: 7,
			completedAt: new Date().toISOString()
		}
	);

	let failCount = $derived((summary.ratingsCount[0] || 0) + (summary.ratingsCount[1] || 0));
	let hardCount = $derived((summary.ratingsCount[2] || 0) + (summary.ratingsCount[3] || 0));
	let goodCount = $derived((summary.ratingsCount[4] || 0) + (summary.ratingsCount[5] || 0));
	let total = $derived(summary.totalReviewed || 1);

	let failPct = $derived(Math.round((failCount / total) * 100));
	let hardPct = $derived(Math.round((hardCount / total) * 100));
	let goodPct = $derived(Math.round((goodCount / total) * 100));
</script>

<svelte:head>
	<title>voabkr — Session Complete</title>
</svelte:head>

<div
	class="flex min-h-screen flex-col justify-between px-4 py-6 select-none"
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
		<p class="mt-1 text-sm text-ink-secondary">Study Session Complete</p>

		<!-- 3-Column Stat Grid -->
		<div class="mt-8 grid w-full grid-cols-3 gap-3">
			<div class="rounded-2xl border border-border-subtle bg-surface p-3.5 shadow-xs">
				<p class="text-[11px] font-bold tracking-wider text-ink-muted uppercase">Reviewed</p>
				<p class="mt-1 text-2xl font-black text-ink-primary">{summary.totalReviewed}</p>
				<p class="text-[10px] text-ink-secondary">Cards</p>
			</div>

			<div class="rounded-2xl border border-border-subtle bg-surface p-3.5 shadow-xs">
				<p class="text-[11px] font-bold tracking-wider text-ink-muted uppercase">Retention</p>
				<p class="mt-1 text-2xl font-black text-celadon">{summary.retentionRate}%</p>
				<p class="text-[10px] text-ink-secondary">Ease ≥ 3</p>
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
					{goodCount} Good · {hardCount} Hard · {failCount} Review
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
					<span class="h-2 w-2 rounded-full bg-crimson"></span> Forgotten ({failPct}%)
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
			<span>Next scheduled review batch due in 4 hours.</span>
		</div>
	</main>

	<!-- Action Tray -->
	<footer class="flex w-full flex-col gap-2.5">
		<a href="/" class="block">
			<TactileButton variant="primary" size="lg" fullWidth>Return Home</TactileButton>
		</a>
		<a href="/decks" class="block">
			<TactileButton variant="secondary" size="md" fullWidth>
				Review More / Extra Practice
			</TactileButton>
		</a>
	</footer>
</div>
