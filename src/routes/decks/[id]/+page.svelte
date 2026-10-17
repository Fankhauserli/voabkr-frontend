<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { deckApi } from '$lib/api/decks';
	import { cardApi } from '$lib/api/cards';
	import { clientCache } from '$lib/api/cache';
	import { auth } from '$lib/stores/auth.svelte';
	import { modal } from '$lib/stores/modal.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import type { Deck, Card } from '$lib/types';
	import DeckTypeBadge from '$lib/components/decks/DeckTypeBadge.svelte';
	import DeckVisibilityBadge from '$lib/components/decks/DeckVisibilityBadge.svelte';
	import CardListItem from '$lib/components/decks/CardListItem.svelte';
	import TactileButton from '$lib/components/forms/TactileButton.svelte';
	import DeckCreatorModal from '$lib/components/forms/DeckCreatorModal.svelte';
	import DeckShareModal from '$lib/components/forms/DeckShareModal.svelte';
	import CardCreatorModal from '$lib/components/forms/CardCreatorModal.svelte';

	let deck = $state<Deck | null>(null);
	let cards = $state<Card[]>([]);
	let searchQuery = $state('');
	let filterQueueOnly = $state(false);
	let isLoading = $state(true);

	let deckId = $derived(parseInt(page.params.id ?? '0', 10));

	let isOwner = $derived(
		deck && (deck.userAccessRole === 'owner' || (auth.user && deck.ownerId === auth.user.id))
	);
	let canEdit = $derived(isOwner || deck?.userAccessRole === 'edit');

	onMount(async () => {
		await loadDeckAndCards();
	});

	async function loadDeckAndCards() {
		const hasCache =
			clientCache.has(`decks:item:${deckId}`) && clientCache.has(`cards:deck:${deckId}`);
		if (!hasCache) {
			isLoading = true;
		}
		try {
			const [deckData, cardsData] = await Promise.all([
				deckApi.getDeckById(deckId, {
					onRevalidate: (fresh) => {
						deck = fresh;
					}
				}),
				cardApi.getCards(deckId, {
					onRevalidate: (fresh) => {
						cards = fresh.filter((card) => card.deckId === deckId);
					}
				})
			]);
			deck = deckData;
			cards = cardsData.filter((card) => card.deckId === deckId);
		} catch (err: unknown) {
			toast.error(err instanceof Error ? err.message : 'Failed to load deck');
		} finally {
			isLoading = false;
		}
	}

	let filteredCards = $derived(
		cards.filter((card) => {
			const matchesSearch =
				card.koreanWord.toLowerCase().includes(searchQuery.toLowerCase()) ||
				card.englishWord.toLowerCase().includes(searchQuery.toLowerCase()) ||
				card.context.toLowerCase().includes(searchQuery.toLowerCase());

			if (!matchesSearch) return false;
			if (filterQueueOnly && !card.isReviewed) return false;

			return true;
		})
	);

	const PAGE_SIZE = 30;
	let visibleCount = $state(PAGE_SIZE);
	let loadMoreSentinel = $state<HTMLElement | null>(null);

	$effect(() => {
		// Reset visible card count whenever filters or search query changes
		if (searchQuery !== undefined || filterQueueOnly !== undefined) {
			visibleCount = PAGE_SIZE;
		}
	});

	let visibleCards = $derived(filteredCards.slice(0, visibleCount));
	let hasMore = $derived(visibleCount < filteredCards.length);

	function loadMore() {
		visibleCount = Math.min(visibleCount + PAGE_SIZE, filteredCards.length);
	}

	$effect(() => {
		if (!loadMoreSentinel || typeof IntersectionObserver === 'undefined') return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting && hasMore) {
					loadMore();
				}
			},
			{ rootMargin: '200px' }
		);
		observer.observe(loadMoreSentinel);
		return () => observer.disconnect();
	});
</script>

<svelte:head>
	<title>{deck ? `${deck.name} — Cards` : 'Deck Detail'}</title>
</svelte:head>

<div
	class="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pt-4 pb-28 sm:px-6 md:pb-12 lg:px-8"
	style="padding-top: calc(var(--safe-top) + 12px);"
>
	<!-- Navigation & Actions Header -->
	<header class="mb-4">
		<div class="mb-3 flex items-center justify-between">
			<a
				href="/decks"
				class="inline-flex items-center gap-1 text-xs font-semibold text-ink-secondary hover:text-ink-primary"
			>
				← Back to Decks
			</a>

			{#if deck}
				<div class="flex items-center gap-2">
					<DeckTypeBadge type={deck.type} />
					<DeckVisibilityBadge {deck} />
				</div>
			{/if}
		</div>

		<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
			<div>
				<h1 class="font-hangul text-2xl font-bold tracking-tight break-keep text-ink-primary">
					{deck?.name || 'Loading deck...'}
				</h1>
				<p class="mt-0.5 text-xs text-ink-secondary">
					{cards.length}
					{cards.length === 1 ? 'card' : 'cards'} total
				</p>
			</div>

			<div class="flex flex-wrap items-center gap-2">
				{#if isOwner && deck}
					<TactileButton
						variant="secondary"
						size="sm"
						onclick={() => modal.openDeckShare({ deck: deck! })}
					>
						<svg
							class="h-3.5 w-3.5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<circle cx="18" cy="5" r="3"></circle>
							<circle cx="6" cy="12" r="3"></circle>
							<circle cx="18" cy="19" r="3"></circle>
							<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
							<line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
						</svg>
						<span>Share</span>
					</TactileButton>
				{/if}

				{#if canEdit && deck}
					<TactileButton
						variant="secondary"
						size="sm"
						onclick={() => modal.openDeckCreator({ deckToEdit: deck! })}
					>
						<svg
							class="h-3.5 w-3.5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M12 20h9"></path>
							<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
						</svg>
						<span>Edit</span>
					</TactileButton>

					<TactileButton
						variant="secondary"
						size="sm"
						onclick={() => modal.openCardCreator({ deckId })}
					>
						<svg
							class="h-3.5 w-3.5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<line x1="12" y1="5" x2="12" y2="19"></line>
							<line x1="5" y1="12" x2="19" y2="12"></line>
						</svg>
						<span>Add Card</span>
					</TactileButton>
				{/if}

				<a href="/study/{deckId}" class="shrink-0">
					<TactileButton variant="primary" size="sm">
						<span>Study Deck</span>
						<svg
							class="h-3.5 w-3.5"
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
	</header>

	<!-- Search & Filter Bar -->
	<div class="mb-4 flex flex-col gap-2">
		<div class="relative">
			<input
				type="search"
				bind:value={searchQuery}
				placeholder="Search Korean or English definition..."
				class="min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3.5 py-2 text-sm text-ink-primary placeholder:text-ink-muted focus:border-primary focus:outline-none"
			/>
			{#if searchQuery}
				<button
					type="button"
					onclick={() => (searchQuery = '')}
					class="absolute top-3 right-3 text-xs text-ink-muted hover:text-ink-primary"
					aria-label="Clear search"
				>
					<svg
						class="h-4 w-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			{/if}
		</div>

		<div class="flex items-center justify-between text-xs">
			<span class="text-ink-muted">{filteredCards.length} matching cards</span>
			<label class="flex cursor-pointer items-center gap-1.5 text-ink-secondary">
				<input
					type="checkbox"
					bind:checked={filterQueueOnly}
					class="rounded border-border-strong text-primary focus:ring-primary"
				/>
				<span>Due for review only</span>
			</label>
		</div>
	</div>

	<!-- Card List -->
	<main class="flex-1">
		{#if isLoading}
			<div class="flex flex-col items-center justify-center py-16">
				<div
					class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
				></div>
				<p class="mt-3 text-xs text-ink-secondary">Loading cards...</p>
			</div>
		{:else if filteredCards.length === 0}
			<div class="rounded-2xl border border-dashed border-border-strong bg-surface p-8 text-center">
				<p class="text-base font-bold text-ink-primary">No Cards Found</p>
				<p class="mt-1 text-xs text-ink-secondary">
					{searchQuery
						? 'No cards match your search query.'
						: 'This deck currently has no flashcards.'}
				</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
				{#each visibleCards as card (card.id)}
					<CardListItem {card} />
				{/each}
			</div>

			{#if hasMore}
				<div class="mt-4 flex flex-col items-center justify-center gap-2">
					<div bind:this={loadMoreSentinel} class="h-6 w-full"></div>
					<button
						type="button"
						onclick={loadMore}
						class="rounded-xl border border-border-strong bg-surface px-4 py-2 text-xs font-semibold text-ink-secondary transition hover:border-primary hover:text-primary active:scale-95"
					>
						Load more ({visibleCards.length} of {filteredCards.length} cards)
					</button>
				</div>
			{/if}
		{/if}
	</main>
</div>

<!-- Modals -->
<DeckCreatorModal onDeckSaved={loadDeckAndCards} onDeckDeleted={() => goto('/decks')} />
{#if deck}
	<DeckShareModal onShareUpdated={loadDeckAndCards} />
{/if}
<CardCreatorModal onCardSaved={loadDeckAndCards} />
