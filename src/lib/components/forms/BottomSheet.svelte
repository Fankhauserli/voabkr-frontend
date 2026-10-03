<script lang="ts">
	import type { Snippet } from 'svelte';
	import { registerModalDismiss } from '$lib/utils/backButton';
	import { selectionClick } from '$lib/utils/haptics';

	interface Props {
		isOpen: boolean;
		title?: string;
		onClose: () => void;
		children?: Snippet;
	}

	let { isOpen, title, onClose, children }: Props = $props();

	$effect(() => {
		if (isOpen) {
			const unregister = registerModalDismiss('bottom-sheet', () => {
				onClose();
				return true;
			});
			return () => unregister();
		}
	});

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			selectionClick();
			onClose();
		}
	}
</script>

{#if isOpen}
	<div
		class="fixed inset-0 z-40 flex flex-col justify-end bg-black/40 backdrop-blur-xs transition-opacity"
		onclick={handleBackdropClick}
		onkeydown={(e) => {
			if (e.key === 'Escape') onClose();
		}}
		tabindex="-1"
		role="dialog"
		aria-modal="true"
		aria-label={title || 'Modal Dialog'}
	>
		<div
			class="relative mx-auto flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl border-t border-border-subtle bg-surface px-4 pt-3 shadow-2xl"
			style="padding-bottom: calc(var(--safe-bottom) + 16px);"
		>
			<!-- Android native drag handle indicator -->
			<div class="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border-strong"></div>

			{#if title}
				<div class="mb-4 flex items-center justify-between border-b border-border-subtle pb-3">
					<h2 class="text-lg font-bold text-ink-primary">{title}</h2>
					<button
						type="button"
						onclick={() => {
							selectionClick();
							onClose();
						}}
						class="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:text-ink-primary"
						aria-label="Close dialog"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>
			{/if}

			<div class="overflow-y-auto overscroll-contain">
				{#if children}
					{@render children()}
				{/if}
			</div>
		</div>
	</div>
{/if}
