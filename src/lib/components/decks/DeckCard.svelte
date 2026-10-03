<script lang="ts">
	import type { Deck } from '$lib/types';
	import DeckTypeBadge from './DeckTypeBadge.svelte';

	interface Props {
		deck: Deck;
	}

	let { deck }: Props = $props();
</script>

<div
	class="group relative flex flex-col justify-between rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs transition hover:border-border-strong active:scale-[0.99]"
>
	<div>
		<div class="flex items-center justify-between gap-2">
			<DeckTypeBadge type={deck.type} />
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
