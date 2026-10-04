<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { reviewApi } from '$lib/api/reviews';
	import { deckApi } from '$lib/api/decks';
	import { clientCache } from '$lib/api/cache';
	import type { Card, Deck } from '$lib/types';
	import BottomNavBar from '$lib/components/navigation/BottomNavBar.svelte';
	import VerificationBanner from '$lib/components/feedback/VerificationBanner.svelte';
	import DeckCard from '$lib/components/decks/DeckCard.svelte';
	import TactileButton from '$lib/components/forms/TactileButton.svelte';
	import SEO from '$lib/components/seo/SEO.svelte';

	let dueCards = $state<Card[]>([]);
	let decks = $state<Deck[]>([]);
	let isLoading = $state(true);

	onMount(async () => {
		await loadDashboardData();
	});

	async function loadDashboardData() {
		const hasCache = clientCache.has('reviews:due:all') || clientCache.has('decks:list');
		if (!hasCache) {
			isLoading = true;
		}
		try {
			const fetchTasks: Promise<unknown>[] = [
				deckApi.getDecks({
					onRevalidate: (fresh) => {
						decks = Array.isArray(fresh) ? fresh : [];
					}
				})
			];

			// Only fetch user's due reviews if authenticated
			if (auth.isAuthenticated) {
				fetchTasks.push(
					reviewApi.getDueCards(undefined, {
						onRevalidate: (fresh) => {
							dueCards = Array.isArray(fresh) ? fresh : [];
						}
					})
				);
			}

			const results = await Promise.allSettled(fetchTasks);

			if (results[0].status === 'fulfilled') {
				decks = Array.isArray(results[0].value) ? (results[0].value as Deck[]) : [];
			}
			if (auth.isAuthenticated && results[1] && results[1].status === 'fulfilled') {
				dueCards = Array.isArray(results[1].value) ? (results[1].value as Card[]) : [];
			}
		} finally {
			isLoading = false;
		}
	}

	let dueCount = $derived(dueCards?.length ?? 0);
	let targetGoal = $derived(auth.cardsPerDay || 20);
	let completedToday = $derived(Math.max(0, targetGoal - dueCount));
	let goalPercentage = $derived(
		targetGoal > 0 ? Math.min(100, Math.round((completedToday / targetGoal) * 100)) : 0
	);

	let vocabDue = $derived(
		(dueCards ?? []).filter(
			(c) =>
				(c.context || '').toLowerCase().includes('noun') ||
				!(c.context || '').toLowerCase().includes('ending')
		).length
	);
	let grammarDue = $derived(Math.max(0, dueCount - vocabDue));

	let userInitial = $derived(auth.userName ? auth.userName[0].toUpperCase() : 'V');
</script>

<SEO
	title="voabkr · 한국어 단어장 | Tactile Korean Spaced Repetition"
	description="Master Korean vocabulary and grammar patterns through the SuperMemo SM-2 spaced repetition algorithm, Apple Pencil handwriting, and bidirectional recall."
	canonical="https://vocabkr.voyagera.ch"
/>

{#if auth.isAuthenticated}
	<!-- ========================================== -->
	<!-- AUTHENTICATED LEARNER DASHBOARD           -->
	<!-- ========================================== -->
	<div
		class="flex flex-1 flex-col px-4 pt-4 pb-28"
		style="padding-top: calc(var(--safe-top) + 16px);"
	>
		<!-- 1. Header Bar -->
		<header class="mb-5 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<a
					href="/settings"
					class="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-border-strong bg-surface font-bold text-ink-primary shadow-xs transition hover:border-primary"
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
					<p class="text-xs font-semibold text-ink-secondary">오늘의 복습 · Daily Study</p>
					<h1 class="text-lg font-bold text-ink-primary">
						{auth.userName ? `Hello, ${auth.userName}` : 'Hello, Learner'}
					</h1>
				</div>
			</div>

			<!-- Daily Streak Badge -->
			<div
				class="inline-flex items-center gap-1.5 rounded-full border border-amber/30 bg-amber/10 px-3 py-1 text-xs font-bold text-amber"
			>
				<svg class="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24" stroke="none">
					<path d="M12 2l2.4 6.9 7.1.3-5.5 4.6 1.8 7-5.8-4.1-5.8 4.1 1.8-7-5.5-4.6 7.1-.3z" />
				</svg>
				<span>7d streak</span>
			</div>
		</header>

		<!-- Email Verification Banner (if unverified) -->
		<VerificationBanner />

		<!-- 2. Daily Goal Progress -->
		<section
			class="mb-5 rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs"
			aria-label="Daily Goal"
		>
			<div class="flex items-center justify-between">
				<div>
					<span class="text-xs font-bold tracking-wider text-ink-muted uppercase">Daily Target</span
					>
					<h2 class="mt-0.5 text-base font-bold text-ink-primary">Today's Progress</h2>
				</div>
				<span class="text-xs font-bold text-primary">{goalPercentage}% Complete</span>
			</div>

			<div class="my-4 flex items-baseline gap-1.5">
				<span class="text-3xl font-extrabold text-ink-primary">{completedToday}</span>
				<span class="text-sm font-semibold text-ink-secondary">/ {targetGoal} Cards Completed</span>
			</div>

			<!-- Segmented Progress Bar -->
			<div class="h-2.5 w-full overflow-hidden rounded-full bg-border-subtle">
				<div
					class="h-full bg-primary transition-all duration-500 ease-out"
					style="width: {goalPercentage}%;"
				></div>
			</div>
		</section>

		<!-- 3. Due Review Queue Banner -->
		<section class="mb-6" aria-label="Review Queue">
			{#if dueCount > 0}
				<div class="rounded-2xl border border-primary/25 bg-surface p-5 text-ink-primary shadow-xs">
					<div class="flex items-start justify-between">
						<div>
							<span
								class="inline-block rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-bold tracking-wider text-primary uppercase"
							>
								Due For Review
							</span>
							<h2 class="mt-2 text-2xl font-black text-ink-primary">
								{dueCount}
								{dueCount === 1 ? 'Card' : 'Cards'} Due
							</h2>
							<p class="mt-0.5 text-xs text-ink-secondary">
								{vocabDue} Vocabulary · {grammarDue} Grammar
							</p>
						</div>

						<div
							class="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white shadow-xs"
						>
							<svg
								class="h-6 w-6"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
								<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
							</svg>
						</div>
					</div>

					<div class="mt-5">
						<a href="/study" class="block">
							<TactileButton variant="primary" size="lg" fullWidth>
								<span>Start Review Session</span>
								<svg
									class="h-4 w-4"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.5"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<line x1="5" y1="12" x2="19" y2="12"></line>
									<polyline points="12 5 19 12 12 19"></polyline>
								</svg>
							</TactileButton>
						</a>
					</div>
				</div>
			{:else}
				<div class="rounded-2xl border border-celadon/40 bg-surface p-5 text-center shadow-xs">
					<div
						class="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-celadon/10 text-celadon"
					>
						<svg
							class="h-6 w-6"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<polyline points="20 6 9 17 4 12"></polyline>
						</svg>
					</div>
					<h2 class="text-lg font-bold text-ink-primary">All caught up for today!</h2>
					<p class="mt-1 text-xs leading-relaxed text-ink-secondary">
						No cards are currently due for review. Great work keeping your spaced repetition on
						track.
					</p>
					<div class="mt-4">
						<a href="/study" class="block">
							<TactileButton variant="secondary" fullWidth>Practice Extra Cards</TactileButton>
						</a>
					</div>
				</div>
			{/if}
		</section>

		<!-- 4. Study Decks Section -->
		<section class="mb-4" aria-label="Your Decks">
			<div class="mb-3 flex items-center justify-between">
				<h2 class="text-base font-bold text-ink-primary">Your Study Decks</h2>
				<a
					href="/decks"
					class="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
				>
					<span>View All</span>
					<svg
						class="h-3 w-3"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<polyline points="9 18 15 12 9 6"></polyline>
					</svg>
				</a>
			</div>

			{#if decks.length === 0 && !isLoading}
				<div
					class="rounded-2xl border border-dashed border-border-strong bg-surface p-6 text-center"
				>
					<p class="text-sm font-semibold text-ink-primary">No Decks Available</p>
					<p class="mt-1 text-xs text-ink-secondary">Available study decks will appear here.</p>
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

	<!-- Bottom Navigation Bar -->
	<BottomNavBar activeRoute="/" dueReviewCount={dueCount} />
{:else}
	<!-- ========================================== -->
	<!-- PUBLIC LANDING PAGE (UNAUTHENTICATED)     -->
	<!-- ========================================== -->
	<div
		class="flex flex-1 flex-col px-4 pt-4 pb-28 sm:px-8"
		style="padding-top: calc(var(--safe-top) + 16px);"
	>
		<!-- Public Navigation Header -->
		<header
			class="mx-auto flex w-full max-w-4xl items-center justify-between border-b border-border-subtle pb-4"
		>
			<a href="/" class="flex items-center gap-2.5">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-xl border border-border-strong bg-surface shadow-xs"
				>
					<span class="font-hangul text-lg font-black text-primary">보</span>
				</div>
				<div>
					<span class="font-hangul text-lg font-extrabold tracking-tight text-ink-primary"
						>voabkr</span
					>
					<span
						class="ml-1.5 hidden rounded-md bg-border-subtle px-1.5 py-0.5 text-[10px] font-semibold text-ink-secondary sm:inline"
						>단어장</span
					>
				</div>
			</a>

			<div class="flex items-center gap-2">
				<a
					href="/decks"
					class="hidden px-3 py-1.5 text-xs font-semibold text-ink-secondary hover:text-ink-primary sm:inline"
				>
					Explore Decks
				</a>
				<a href="/login">
					<TactileButton variant="secondary" size="sm">Log In</TactileButton>
				</a>
				<a href="/login">
					<TactileButton variant="primary" size="sm">Get Started</TactileButton>
				</a>
			</div>
		</header>

		<!-- Hero Section -->
		<section class="mx-auto my-10 flex max-w-2xl flex-col items-center text-center sm:my-16">
			<div
				class="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface px-3 py-1 text-xs font-semibold text-ink-secondary shadow-xs"
			>
				<span class="h-2 w-2 rounded-full bg-celadon"></span>
				<span>Spaced Repetition for Korean · 간격 반복 학습</span>
			</div>

			<h1
				class="mt-4 font-hangul text-3xl font-extrabold tracking-tight break-keep text-ink-primary sm:text-5xl sm:leading-tight"
			>
				Remember Korean words and grammar for good.
			</h1>

			<p class="mt-4 text-sm leading-relaxed text-ink-secondary sm:text-base">
				A quiet, tactile study notebook built with the SuperMemo SM-2 algorithm. Practice Hangul
				handwriting on your screen, train bidirectional recall, and master vocabulary with
				deliberate practice.
			</p>

			<div class="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
				<a href="/login" class="w-full sm:w-auto">
					<TactileButton variant="primary" size="lg" fullWidth>
						<span>Start Learning Free</span>
						<svg
							class="h-4 w-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<line x1="5" y1="12" x2="19" y2="12"></line>
							<polyline points="12 5 19 12 12 19"></polyline>
						</svg>
					</TactileButton>
				</a>
				<a href="/decks" class="w-full sm:w-auto">
					<TactileButton variant="secondary" size="lg" fullWidth>Browse Public Decks</TactileButton>
				</a>
			</div>
		</section>

		<!-- Core Features Grid -->
		<section class="mx-auto mb-16 max-w-4xl">
			<div class="mb-6 text-center">
				<h2 class="text-xs font-bold tracking-wider text-ink-muted uppercase">
					Purpose-Built Learning
				</h2>
				<p class="mt-1 font-hangul text-xl font-bold text-ink-primary">
					Designed for how you actually retain Korean
				</p>
			</div>

			<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
				<!-- Feature 1: SM-2 Algorithm -->
				<div class="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs">
					<div
						class="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"
					>
						<svg
							class="h-5 w-5"
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
					</div>
					<h3 class="text-sm font-bold text-ink-primary">SM-2 Spaced Repetition</h3>
					<p class="mt-1.5 text-xs leading-relaxed text-ink-secondary">
						Cards are scheduled automatically using proven memory curves. Review words right before
						you forget them, skipping unnecessary repetition.
					</p>
				</div>

				<!-- Feature 2: Apple Pencil Scratch Pad -->
				<div class="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs">
					<div
						class="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"
					>
						<svg
							class="h-5 w-5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M12 19l7-7 3 3-7 7-3-3z"></path>
							<path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
							<path d="M2 2l7.586 7.586"></path>
							<circle cx="11" cy="11" r="2"></circle>
						</svg>
					</div>
					<h3 class="text-sm font-bold text-ink-primary">Stylus Scratch Pad (연습장)</h3>
					<p class="mt-1.5 text-xs leading-relaxed text-ink-secondary">
						Draw or write Korean syllables by hand with Apple Pencil or your finger before revealing
						the card to build physical muscle memory.
					</p>
				</div>

				<!-- Feature 3: Bidirectional Recall -->
				<div class="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs">
					<div
						class="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"
					>
						<svg
							class="h-5 w-5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<polyline points="17 1 21 5 17 9"></polyline>
							<path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
							<polyline points="7 23 3 19 7 15"></polyline>
							<path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
						</svg>
					</div>
					<h3 class="text-sm font-bold text-ink-primary">Bidirectional Recall</h3>
					<p class="mt-1.5 text-xs leading-relaxed text-ink-secondary">
						Choose Korean prompt to test recognition, or English prompt to test active sentence and
						word production.
					</p>
				</div>
			</div>
		</section>

		<!-- Public Decks Preview Section -->
		<section class="mx-auto mb-16 w-full max-w-4xl">
			<div class="mb-4 flex items-center justify-between">
				<div>
					<h2 class="text-xs font-bold tracking-wider text-ink-muted uppercase">
						Curated Material
					</h2>
					<p class="mt-0.5 font-hangul text-lg font-bold text-ink-primary">Available Study Decks</p>
				</div>
				<a
					href="/decks"
					class="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
				>
					<span>Browse all decks</span>
					<svg
						class="h-3 w-3"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<polyline points="9 18 15 12 9 6"></polyline>
					</svg>
				</a>
			</div>

			{#if isLoading}
				<div class="flex flex-col items-center justify-center py-12">
					<div
						class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
					></div>
					<p class="mt-3 text-xs text-ink-secondary">Loading study decks...</p>
				</div>
			{:else if decks.length === 0}
				<div
					class="rounded-2xl border border-dashed border-border-strong bg-surface p-8 text-center"
				>
					<p class="text-sm font-semibold text-ink-primary">No public decks yet</p>
					<p class="mt-1 text-xs text-ink-secondary">Curated study decks will appear here soon.</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
					{#each decks.slice(0, 4) as deck (deck.id)}
						<DeckCard {deck} />
					{/each}
				</div>
			{/if}
		</section>

		<!-- Bottom Call to Action Footer -->
		<footer
			class="mx-auto w-full max-w-4xl rounded-2xl border border-border-subtle bg-surface p-6 text-center shadow-xs"
		>
			<h2 class="font-hangul text-xl font-bold text-ink-primary">
				Ready to start learning Korean?
			</h2>
			<p class="mx-auto mt-2 max-w-md text-xs leading-relaxed text-ink-secondary">
				Create a free account to track your spaced repetition retention, maintain daily streaks, and
				sync your study sessions seamlessly.
			</p>
			<div class="mt-5 flex justify-center gap-3">
				<a href="/login">
					<TactileButton variant="primary" size="md">Get Started Free</TactileButton>
				</a>
				<a href="/login">
					<TactileButton variant="secondary" size="md">Log In</TactileButton>
				</a>
			</div>
			<p class="mt-6 text-[11px] text-ink-muted">
				voabkr · Quiet Korean Spaced Repetition Notebook
			</p>
		</footer>
	</div>

	<!-- Bottom Navigation Bar for Mobile -->
	<BottomNavBar activeRoute="/" />
{/if}
