<script lang="ts">
	import { onMount } from 'svelte';
	import { deckApi } from '$lib/api/decks';
	import { clientCache } from '$lib/api/cache';
	import { selectionClick } from '$lib/utils/haptics';
	import type { Deck, DeckType } from '$lib/types';
	import DeckCard from '$lib/components/decks/DeckCard.svelte';
	import BottomNavBar from '$lib/components/navigation/BottomNavBar.svelte';
	import SEO from '$lib/components/seo/SEO.svelte';

	let decks = $state<Deck[]>([]);
	let activeFilter = $state<'all' | DeckType>('all');
	let isLoading = $state(true);

	onMount(async () => {
		await loadDecks();
	});

	async function loadDecks() {
		if (!clientCache.has('decks:list')) {
			isLoading = true;
		}
		try {
			decks = await deckApi.getDecks({
				onRevalidate: (fresh) => {
					decks = fresh;
				}
			});
		} catch {
			decks = [];
		} finally {
			isLoading = false;
		}
	}

	function setFilter(filter: 'all' | DeckType) {
		selectionClick();
		activeFilter = filter;
	}

	let filteredDecks = $derived(
		activeFilter === 'all' ? decks : decks.filter((d) => d.type === activeFilter)
	);

	let vocabCount = $derived(decks.filter((d) => d.type === 'vocabulary').length);
	let grammarCount = $derived(decks.filter((d) => d.type === 'grammar').length);
</script>

<SEO
	title="voabkr · 단어장 보관함 | Korean Flashcard Decks"
	description="Browse and organize your Korean vocabulary and grammar card decks. Structured for efficient spaced repetition mastery."
	canonical="https://vocabkr.voyagera.ch/decks"
/>

<div
	class="flex flex-1 flex-col px-4 pt-4 pb-28"
	style="padding-top: calc(var(--safe-top) + 16px);"
>
	<!-- Top Bar -->
	<header class="mb-4 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight text-ink-primary">Decks Library</h1>
			<p class="text-xs text-ink-secondary">Vocabulary & Grammar collections</p>
		</div>
	</header>

	<!-- Segmented Filter Bar -->
	<div
		class="mb-4 flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface p-1 select-none"
	>
		<button
			type="button"
			onclick={() => setFilter('all')}
			class="flex-1 rounded-lg py-1.5 text-xs font-bold transition {activeFilter === 'all'
				? 'bg-canvas text-ink-primary shadow-xs'
				: 'text-ink-secondary hover:text-ink-primary'}"
		>
			All ({decks.length})
		</button>
		<button
			type="button"
			onclick={() => setFilter('vocabulary')}
			class="flex-1 rounded-lg py-1.5 text-xs font-bold transition {activeFilter === 'vocabulary'
				? 'bg-canvas text-navy shadow-xs'
				: 'text-ink-secondary hover:text-ink-primary'}"
		>
			Vocab ({vocabCount})
		</button>
		<button
			type="button"
			onclick={() => setFilter('grammar')}
			class="flex-1 rounded-lg py-1.5 text-xs font-bold transition {activeFilter === 'grammar'
				? 'bg-canvas text-celadon shadow-xs'
				: 'text-ink-secondary hover:text-ink-primary'}"
		>
			Grammar ({grammarCount})
		</button>
	</div>

	<!-- Deck List -->
	<main class="flex-1">
		{#if isLoading}
			<div class="flex flex-col items-center justify-center py-16">
				<div
					class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
				></div>
				<p class="mt-3 text-xs text-ink-secondary">Loading study decks...</p>
			</div>
		{:else if filteredDecks.length === 0}
			<div class="rounded-2xl border border-dashed border-border-strong bg-surface p-8 text-center">
				<div
					class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-border-subtle bg-canvas text-ink-muted shadow-xs"
				>
					<svg
						class="h-7 w-7"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
						<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
						<path d="M8 7h8M8 11h6" />
					</svg>
				</div>
				<h2 class="text-base font-bold text-ink-primary">No Decks Found</h2>
				<p class="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-ink-secondary">
					No {activeFilter !== 'all' ? activeFilter : ''} decks available currently.
				</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				{#each filteredDecks as deck (deck.id)}
					<DeckCard {deck} />
				{/each}
			</div>
		{/if}
	</main>
</div>

<!-- Bottom Navigation Bar -->
<BottomNavBar activeRoute="/decks" />
