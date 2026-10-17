<script lang="ts">
	import type { Deck } from '$lib/types';
	import DeckTypeBadge from './DeckTypeBadge.svelte';
	import DeckVisibilityBadge from './DeckVisibilityBadge.svelte';

	interface Props {
		deck: Deck;
		/** Whether the Deck's Cards and Review schedules are held on the device. */
		isDownloaded?: boolean;
		/** Whether the app has no connection; a Deck not held then needs one to be studied. */
		isOffline?: boolean;
		/** Offered only for a Deck held on the device. */
		onRemoveFromDevice?: (deck: Deck) => void | Promise<void>;
	}

	let { deck, isDownloaded = false, isOffline = false, onRemoveFromDevice }: Props = $props();
</script>

<div
	class="group relative flex flex-col justify-between rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs transition hover:border-border-strong active:scale-[0.99]"
>
	<div>
		<div class="flex items-center justify-between gap-2">
			<DeckTypeBadge type={deck.type} />
			<DeckVisibilityBadge {deck} />
		</div>

		<a href="/decks/{deck.id}" class="mt-3 block">
			<h3
				class="hangul-text text-base font-bold text-ink-primary transition group-hover:text-primary"
			>
				{deck.name}
			</h3>
		</a>

		<div class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-secondary">
			<span>{deck.cardCount ?? 0} cards</span>
			{#if deck.dueCount && deck.dueCount > 0}
				<span>·</span>
				<span class="font-semibold text-primary">{deck.dueCount} due</span>
			{/if}
			{#if isDownloaded}
				<span class="inline-flex items-center gap-1 font-semibold text-celadon">
					<svg
						class="h-3 w-3"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<rect x="2" y="4" width="20" height="16" rx="2" />
						<line x1="6" y1="12" x2="10" y2="12" />
						<line x1="14" y1="12" x2="18" y2="12" />
					</svg>
					On device
				</span>
			{:else if isOffline}
				<span class="inline-flex items-center gap-1 font-semibold text-amber">
					<svg
						class="h-3 w-3"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M2 2l20 20" />
						<path d="M5 17a5 5 0 0 1 1.5-9.8" />
						<path d="M9.5 21a4 4 0 0 1 1.2-7.8" />
					</svg>
					Needs a connection
				</span>
			{/if}
		</div>
	</div>

	<div class="mt-4 flex items-center justify-between border-t border-border-subtle pt-3">
		<a
			href="/decks/{deck.id}"
			class="inline-flex items-center gap-1 text-xs font-semibold text-ink-secondary hover:text-ink-primary"
		>
			<span>Browse Cards</span>
			<svg
				class="h-3 w-3"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<line x1="5" y1="12" x2="19" y2="12" />
				<polyline points="12 5 19 12 12 19" />
			</svg>
		</a>

		<div class="flex items-center gap-2">
			{#if isDownloaded && onRemoveFromDevice}
				<button
					type="button"
					onclick={() => onRemoveFromDevice?.(deck)}
					class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle text-ink-muted transition hover:border-crimson hover:text-crimson active:scale-95"
					title="Remove from device"
					aria-label="Remove {deck.name} from this device"
				>
					<svg
						class="h-3.5 w-3.5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<polyline points="3 6 5 6 21 6" />
						<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
						<path d="M10 11v6M14 11v6" />
						<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
					</svg>
				</button>
			{/if}

			<a
				href="/study/{deck.id}"
				class="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary hover:text-white active:scale-95"
			>
				Study
			</a>
		</div>
	</div>
</div>
