<script lang="ts">
	import type { Deck } from '$lib/types';
	import DeckTypeBadge from './DeckTypeBadge.svelte';
	import { selectionClick } from '$lib/utils/haptics';

	interface Props {
		deck: Deck;
		onDelete?: (id: number) => void;
		onEdit?: (deck: Deck) => void;
	}

	let { deck, onDelete, onEdit }: Props = $props();

	function handleAction(e: MouseEvent) {
		e.stopPropagation();
		selectionClick();
	}
</script>

<div
	class="group relative flex flex-col justify-between rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs transition hover:border-border-strong active:scale-[0.99]"
>
	<div>
		<div class="flex items-center justify-between gap-2">
			<DeckTypeBadge type={deck.type} />
			<div class="flex items-center gap-1">
				{#if onEdit}
					<button
						type="button"
						onclick={(e) => {
							handleAction(e);
							onEdit(deck);
						}}
						class="p-1 text-ink-muted transition hover:text-ink-primary"
						aria-label="Edit deck"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
							/>
						</svg>
					</button>
				{/if}
				{#if onDelete}
					<button
						type="button"
						onclick={(e) => {
							handleAction(e);
							onDelete(deck.id);
						}}
						class="p-1 text-ink-muted transition hover:text-crimson"
						aria-label="Delete deck"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
							/>
						</svg>
					</button>
				{/if}
			</div>
		</div>

		<a href="/decks/{deck.id}" class="mt-3 block">
			<h3 class="hangul-text text-base font-bold text-ink-primary group-hover:text-terracotta">
				{deck.name}
			</h3>
		</a>

		<div class="mt-2 flex items-center gap-2 text-xs text-ink-secondary">
			<span>{deck.cardCount ?? 0} cards</span>
			{#if deck.dueCount && deck.dueCount > 0}
				<span>·</span>
				<span class="font-semibold text-terracotta">{deck.dueCount} due</span>
			{/if}
		</div>
	</div>

	<div class="mt-4 flex items-center justify-between border-t border-border-subtle pt-3">
		<a
			href="/decks/{deck.id}"
			class="text-xs font-semibold text-ink-secondary hover:text-ink-primary"
		>
			Browse Cards ➔
		</a>

		<a
			href="/study/{deck.id}"
			class="rounded-lg bg-terracotta/10 px-3 py-1.5 text-xs font-bold text-terracotta transition hover:bg-terracotta hover:text-white active:scale-95"
		>
			Study
		</a>
	</div>
</div>
