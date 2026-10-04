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
			<h3 class="hangul-text text-base font-bold text-ink-primary transition group-hover:text-primary">
				{deck.name}
			</h3>
		</a>

		<div class="mt-2 flex items-center gap-2 text-xs text-ink-secondary">
			<span>{deck.cardCount ?? 0} cards</span>
			{#if deck.dueCount && deck.dueCount > 0}
				<span>·</span>
				<span class="font-semibold text-primary">{deck.dueCount} due</span>
			{/if}
		</div>
	</div>

	<div class="mt-4 flex items-center justify-between border-t border-border-subtle pt-3">
		<a
			href="/decks/{deck.id}"
			class="inline-flex items-center gap-1 text-xs font-semibold text-ink-secondary hover:text-ink-primary"
		>
			<span>Browse Cards</span>
			<svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<line x1="5" y1="12" x2="19" y2="12" />
				<polyline points="12 5 19 12 12 19" />
			</svg>
		</a>

		<a
			href="/study/{deck.id}"
			class="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary hover:text-white active:scale-95"
		>
			Study
		</a>
	</div>
</div>
