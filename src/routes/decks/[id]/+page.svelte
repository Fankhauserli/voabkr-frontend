<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { deckApi } from '$lib/api/decks';
	import { cardApi } from '$lib/api/cards';
	import { modal } from '$lib/stores/modal.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import type { Deck, Card } from '$lib/types';
	import DeckTypeBadge from '$lib/components/decks/DeckTypeBadge.svelte';
	import CardListItem from '$lib/components/decks/CardListItem.svelte';
	import TactileButton from '$lib/components/forms/TactileButton.svelte';

	let deck = $state<Deck | null>(null);
	let cards = $state<Card[]>([]);
	let searchQuery = $state('');
	let filterQueueOnly = $state(false);
	let isLoading = $state(true);

	let deckId = $derived(parseInt(page.params.id ?? '0', 10));

	onMount(async () => {
		await loadDeckAndCards();
	});

	async function loadDeckAndCards() {
		isLoading = true;
		try {
			const [deckData, cardsData] = await Promise.all([
				deckApi.getDeckById(deckId),
				cardApi.getCards(deckId)
			]);
			deck = deckData;
			cards = cardsData;
		} catch (err: unknown) {
			toast.error(err instanceof Error ? err.message : 'Failed to load deck');
		} finally {
			isLoading = false;
		}
	}

	async function handleDeleteCard(cardId: number) {
		if (!confirm('Are you sure you want to delete this card?')) return;
		try {
			await cardApi.deleteCard(cardId);
			cards = cards.filter((c) => c.id !== cardId);
			toast.success('Card removed');
		} catch (err: unknown) {
			toast.error(err instanceof Error ? err.message : 'Failed to delete card');
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
</script>

<svelte:head>
	<title>{deck ? `${deck.name} — Cards` : 'Deck Detail'}</title>
</svelte:head>

<div
	class="flex flex-1 flex-col px-4 pt-4 pb-28"
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
				<DeckTypeBadge type={deck.type} />
			{/if}
		</div>

		<div class="flex items-start justify-between gap-3">
			<div>
				<h1 class="font-hangul text-2xl font-bold tracking-tight break-keep text-ink-primary">
					{deck?.name || 'Loading deck...'}
				</h1>
				<p class="mt-0.5 text-xs text-ink-secondary">
					{cards.length}
					{cards.length === 1 ? 'card' : 'cards'} total
				</p>
			</div>

			<a href="/study/{deckId}" class="shrink-0">
				<TactileButton variant="primary" size="sm">Study Deck ➔</TactileButton>
			</a>
		</div>
	</header>

	<!-- Search & Filter Bar -->
	<div class="mb-4 flex flex-col gap-2">
		<div class="relative">
			<input
				type="search"
				bind:value={searchQuery}
				placeholder="Search Korean or English definition..."
				class="min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3.5 py-2 text-sm text-ink-primary placeholder:text-ink-muted focus:border-terracotta focus:outline-none"
			/>
			{#if searchQuery}
				<button
					type="button"
					onclick={() => (searchQuery = '')}
					class="absolute top-3 right-3 text-xs text-ink-muted hover:text-ink-primary"
				>
					✕
				</button>
			{/if}
		</div>

		<div class="flex items-center justify-between text-xs">
			<span class="text-ink-muted">{filteredCards.length} matching cards</span>
			<label class="flex cursor-pointer items-center gap-1.5 text-ink-secondary">
				<input
					type="checkbox"
					bind:checked={filterQueueOnly}
					class="rounded border-border-strong text-terracotta focus:ring-terracotta"
				/>
				<span>In Study Queue Only</span>
			</label>
		</div>
	</div>

	<!-- Card List -->
	<main class="flex-1">
		{#if isLoading}
			<div class="flex flex-col items-center justify-center py-16">
				<div
					class="h-8 w-8 animate-spin rounded-full border-2 border-terracotta border-t-transparent"
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
				<div class="mt-4">
					<TactileButton
						variant="primary"
						size="sm"
						onclick={() => modal.openCardCreator({ deckId })}
					>
						+ Add First Card
					</TactileButton>
				</div>
			</div>
		{:else}
			<div class="flex flex-col gap-2.5">
				{#each filteredCards as card (card.id)}
					<CardListItem
						{card}
						onEdit={(c) => modal.openCardCreator({ deckId, cardToEdit: c })}
						onDelete={handleDeleteCard}
					/>
				{/each}
			</div>
		{/if}
	</main>

	<!-- Fixed Floating Action Button (FAB) for rapid card creation -->
	<div class="fixed right-6 bottom-6 z-30" style="padding-bottom: var(--safe-bottom);">
		<button
			type="button"
			onclick={() => modal.openCardCreator({ deckId })}
			class="flex h-14 w-14 items-center justify-center rounded-2xl border border-terracotta bg-terracotta text-white shadow-lg transition active:scale-95"
			aria-label="Add new flashcard"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-7 w-7"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2.5"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
			</svg>
		</button>
	</div>
</div>
