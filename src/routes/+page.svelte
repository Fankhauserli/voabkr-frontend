<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { reviewApi } from '$lib/api/reviews';
	import { deckApi } from '$lib/api/decks';
	import { modal } from '$lib/stores/modal.svelte';
	import type { Card, Deck } from '$lib/types';
	import BottomNavBar from '$lib/components/navigation/BottomNavBar.svelte';
	import VerificationBanner from '$lib/components/feedback/VerificationBanner.svelte';
	import DeckCard from '$lib/components/decks/DeckCard.svelte';
	import TactileButton from '$lib/components/forms/TactileButton.svelte';

	let dueCards = $state<Card[]>([]);
	let decks = $state<Deck[]>([]);
	let isLoading = $state(true);

	onMount(async () => {
		await loadDashboardData();
	});

	async function loadDashboardData() {
		isLoading = true;
		try {
			const [cardsResult, decksResult] = await Promise.allSettled([
				reviewApi.getDueCards(),
				deckApi.getDecks()
			]);

			if (cardsResult.status === 'fulfilled') {
				dueCards = cardsResult.value;
			}
			if (decksResult.status === 'fulfilled') {
				decks = decksResult.value;
			}
		} finally {
			isLoading = false;
		}
	}

	let dueCount = $derived(dueCards.length);
	let targetGoal = $derived(auth.cardsPerDay || 20);
	let completedToday = $derived(Math.max(0, targetGoal - dueCount));
	let goalPercentage = $derived(
		targetGoal > 0 ? Math.min(100, Math.round((completedToday / targetGoal) * 100)) : 0
	);

	let vocabDue = $derived(
		dueCards.filter(
			(c) => c.context.toLowerCase().includes('noun') || !c.context.toLowerCase().includes('ending')
		).length
	);
	let grammarDue = $derived(dueCards.length - vocabDue);

	let userInitial = $derived(auth.userName ? auth.userName[0].toUpperCase() : 'V');
</script>

<svelte:head>
	<title>voabkr — Today's Dashboard</title>
</svelte:head>

<div
	class="flex flex-1 flex-col px-4 pt-4 pb-28"
	style="padding-top: calc(var(--safe-top) + 16px);"
>
	<!-- 1. Top Bar -->
	<header class="mb-5 flex items-center justify-between">
		<div class="flex items-center gap-3">
			<a
				href="/settings"
				class="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-border-strong bg-surface font-bold text-ink-primary shadow-xs transition hover:border-terracotta"
				aria-label="User profile settings"
			>
				<span>{userInitial}</span>
				{#if !auth.isVerified}
					<span
						class="absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-surface bg-amber"
						title="Unverified email"
					></span>
				{/if}
			</a>
			<div>
				<p class="text-xs font-semibold text-ink-secondary">오늘의 복습</p>
				<h1 class="text-lg font-bold text-ink-primary">
					{auth.userName ? `Hello, ${auth.userName}` : 'Hello, Learner'}
				</h1>
			</div>
		</div>

		<!-- Daily Streak Pill -->
		<div
			class="flex items-center gap-1.5 rounded-full border border-terracotta/30 bg-terracotta/10 px-3 py-1 text-xs font-bold text-terracotta select-none"
		>
			<span>🔥</span>
			<span>7 Days</span>
		</div>
	</header>

	<!-- Email Verification Banner (if unverified) -->
	<VerificationBanner />

	<!-- 2. Daily Target Card (The Anchor) -->
	<section
		class="mb-5 rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs select-none"
		aria-label="Daily Goal"
	>
		<div class="flex items-center justify-between">
			<div>
				<span class="text-xs font-bold tracking-wider text-ink-muted uppercase">Daily Target</span>
				<h2 class="mt-0.5 text-base font-bold text-ink-primary">Today's Goal</h2>
			</div>
			<span class="text-xs font-bold text-terracotta">{goalPercentage}% Complete</span>
		</div>

		<div class="my-4 flex items-baseline gap-1.5">
			<span class="text-3xl font-extrabold text-ink-primary">{completedToday}</span>
			<span class="text-sm font-semibold text-ink-secondary">/ {targetGoal} Cards Completed</span>
		</div>

		<!-- Segmented Bar -->
		<div class="h-2.5 w-full overflow-hidden rounded-full bg-border-subtle">
			<div
				class="h-full bg-terracotta transition-all duration-500 ease-out"
				style="width: {goalPercentage}%;"
			></div>
		</div>
	</section>

	<!-- 3. Due Review Trigger Banner (Hero CTA) -->
	<section class="mb-6" aria-label="Review Queue">
		{#if dueCount > 0}
			<div
				class="rounded-2xl border border-terracotta/40 bg-surface p-5 text-ink-primary shadow-xs"
			>
				<div class="flex items-start justify-between">
					<div>
						<span
							class="inline-block rounded-md border border-terracotta/40 bg-terracotta/10 px-2 py-0.5 text-[11px] font-bold tracking-wider text-terracotta uppercase"
						>
							Due For Review
						</span>
						<h2 class="mt-2 text-2xl font-black text-ink-primary">
							{dueCount} Cards Due
						</h2>
						<p class="mt-0.5 text-xs text-ink-secondary">
							{vocabDue} Vocabulary · {grammarDue} Grammar
						</p>
					</div>

					<div
						class="flex h-12 w-12 items-center justify-center rounded-2xl bg-terracotta text-xl font-bold text-white shadow-xs"
					>
						📖
					</div>
				</div>

				<div class="mt-5">
					<a href="/study" class="block">
						<TactileButton variant="primary" size="lg" fullWidth>
							Start Review Session ➔
						</TactileButton>
					</a>
				</div>
			</div>
		{:else}
			<div class="rounded-2xl border border-celadon/40 bg-surface p-5 text-center shadow-xs">
				<div
					class="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-celadon/10 text-xl font-bold text-celadon"
				>
					✓
				</div>
				<h2 class="text-lg font-bold text-ink-primary">All caught up for now!</h2>
				<p class="mt-1 text-xs leading-relaxed text-ink-secondary">
					No cards are currently due for review. Great job maintaining your retention streak!
				</p>
				<div class="mt-4">
					<a href="/study" class="block">
						<TactileButton variant="secondary" fullWidth>Practice Extra Cards</TactileButton>
					</a>
				</div>
			</div>
		{/if}
	</section>

	<!-- 4. Recent Decks Section -->
	<section class="mb-4" aria-label="Your Decks">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-base font-bold text-ink-primary">Your Study Decks</h2>
			<a href="/decks" class="text-xs font-semibold text-terracotta hover:underline">
				View All ➔
			</a>
		</div>

		{#if decks.length === 0 && !isLoading}
			<div class="rounded-2xl border border-dashed border-border-strong bg-surface p-6 text-center">
				<p class="text-sm font-semibold text-ink-primary">No Decks Yet</p>
				<p class="mt-1 text-xs text-ink-secondary">
					Create your first vocabulary or grammar deck to start adding cards.
				</p>
				<div class="mt-4 inline-block">
					<TactileButton variant="primary" size="sm" onclick={() => modal.openDeckCreator()}>
						+ Create Deck
					</TactileButton>
				</div>
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				{#each decks.slice(0, 4) as deck (deck.id)}
					<DeckCard {deck} />
				{/each}
			</div>
		{/if}
	</section>
</div>

<!-- Bottom Navigation Bar (Fixed 64dp) -->
<BottomNavBar activeRoute="/" dueReviewCount={dueCount} />
