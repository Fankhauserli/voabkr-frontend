<script lang="ts">
	import type { Card } from '$lib/types';
	import { reviewApi } from '$lib/api/reviews';
	import { toast } from '$lib/stores/toast.svelte';
	import { selectionClick } from '$lib/utils/haptics';

	interface Props {
		card: Card;
	}

	let { card }: Props = $props();

	let isAddingReview = $state(false);
	let isAddedLocally = $state(false);
	let isAddedToReview = $derived(isAddedLocally || (card.isReviewed ?? false));

	async function handleAddToReview(e: MouseEvent) {
		e.stopPropagation();
		selectionClick();
		isAddingReview = true;
		try {
			await reviewApi.addCardToReviews(card.id);
			isAddedLocally = true;
			toast.success(`"${card.koreanWord}" added to your study queue`);
		} catch (err: unknown) {
			toast.error(err instanceof Error ? err.message : 'Failed to add card to study queue');
		} finally {
			isAddingReview = false;
		}
	}
</script>

<div
	class="flex w-full items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface p-3.5 text-left shadow-xs transition hover:border-border-strong"
>
	<div class="min-w-0 flex-1">
		<div class="flex items-baseline gap-2">
			<span class="hangul-text text-base font-bold break-keep text-ink-primary">
				{card.koreanWord}
			</span>
			<span class="truncate text-sm text-ink-secondary">
				{card.englishWord}
			</span>
		</div>

		{#if card.example}
			<p class="hangul-text mt-1 truncate text-xs break-keep text-ink-muted">
				{card.example}
			</p>
		{/if}
	</div>

	<div class="flex shrink-0 items-center gap-2">
		{#if card.context}
			<span
				class="rounded-md border border-border-subtle bg-canvas px-2 py-0.5 text-[11px] font-semibold text-ink-secondary"
			>
				{card.context}
			</span>
		{/if}

		{#if !isAddedToReview}
			<button
				type="button"
				onclick={handleAddToReview}
				disabled={isAddingReview}
				class="rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white active:scale-95 disabled:opacity-50"
				aria-label="Add to review queue"
			>
				{isAddingReview ? '...' : '+ Study'}
			</button>
		{:else}
			<span
				class="flex h-6 w-6 items-center justify-center rounded-full bg-celadon/15 text-celadon"
				title="In study queue"
			>
				<svg
					class="h-3.5 w-3.5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<polyline points="20 6 9 17 4 12" />
				</svg>
			</span>
		{/if}
	</div>
</div>
