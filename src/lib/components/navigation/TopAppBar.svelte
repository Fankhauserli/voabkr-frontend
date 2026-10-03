<script lang="ts">
	import type { Snippet } from 'svelte';
	import { selectionClick } from '$lib/utils/haptics';

	interface Props {
		title?: string;
		subtitle?: string;
		showBack?: boolean;
		onBack?: () => void;
		rightAction?: Snippet;
	}

	let { title, subtitle, showBack = false, onBack, rightAction }: Props = $props();

	function handleBack() {
		selectionClick();
		if (onBack) {
			onBack();
		} else if (typeof window !== 'undefined') {
			window.history.back();
		}
	}
</script>

<header
	class="sticky top-0 z-30 w-full border-b border-border-subtle bg-surface"
	style="padding-top: var(--safe-top);"
>
	<div class="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
		<div class="flex items-center gap-2">
			{#if showBack}
				<button
					type="button"
					onclick={handleBack}
					class="flex h-11 w-11 items-center justify-center rounded-lg border border-border-subtle bg-canvas text-ink-primary transition active:scale-95"
					aria-label="Go back"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
					</svg>
				</button>
			{/if}
			<div>
				{#if title}
					<h1 class="text-lg font-bold tracking-tight text-ink-primary">{title}</h1>
				{/if}
				{#if subtitle}
					<p class="text-xs text-ink-secondary">{subtitle}</p>
				{/if}
			</div>
		</div>

		{#if rightAction}
			<div class="flex items-center">
				{@render rightAction()}
			</div>
		{/if}
	</div>
</header>
