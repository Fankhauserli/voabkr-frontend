<script lang="ts">
	import type { Card } from '$lib/types';
	import { reviewApi } from '$lib/api/reviews';
	import { toast } from '$lib/stores/toast.svelte';
	import { selectionClick } from '$lib/utils/haptics';

	interface Props {
		card: Card;
		onEdit?: (card: Card) => void;
		onDelete?: (id: number) => void;
	}

	let { card, onEdit, onDelete }: Props = $props();

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

	function handleEditClick() {
		selectionClick();
		onEdit?.(card);
	}
</script>

<div
	role="button"
	tabindex="0"
	onclick={handleEditClick}
	onkeydown={(e) => e.key === 'Enter' && handleEditClick()}
	class="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface p-3.5 text-left shadow-xs transition hover:border-border-strong active:scale-[0.99]"
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
				class="rounded-lg border border-terracotta/40 bg-terracotta/10 px-2 py-1 text-xs font-semibold text-terracotta transition hover:bg-terracotta hover:text-white active:scale-95 disabled:opacity-50"
				aria-label="Add to review queue"
			>
				{isAddingReview ? '...' : '+ Study'}
			</button>
		{:else}
			<span
				class="flex h-6 w-6 items-center justify-center rounded-full bg-celadon/10 text-xs font-bold text-celadon"
				title="In study queue"
			>
				✓
			</span>
		{/if}

		{#if onDelete}
			<button
				type="button"
				onclick={(e) => {
					e.stopPropagation();
					selectionClick();
					onDelete(card.id);
				}}
				class="p-1 text-ink-muted transition hover:text-crimson"
				aria-label="Delete card"
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
