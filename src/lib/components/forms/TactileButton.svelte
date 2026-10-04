<script lang="ts">
	import type { Snippet } from 'svelte';
	import { selectionClick } from '$lib/utils/haptics';

	interface Props {
		variant?: 'primary' | 'secondary' | 'danger' | 'celadon' | 'ghost';
		size?: 'sm' | 'md' | 'lg';
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		loading?: boolean;
		fullWidth?: boolean;
		onclick?: (e: MouseEvent) => void;
		children?: Snippet;
		ariaLabel?: string;
	}

	let {
		variant = 'primary',
		size = 'md',
		type = 'button',
		disabled = false,
		loading = false,
		fullWidth = false,
		onclick,
		children,
		ariaLabel
	}: Props = $props();

	function handleClick(e: MouseEvent) {
		if (disabled || loading) return;
		selectionClick();
		onclick?.(e);
	}

	let variantClasses = $derived(
		variant === 'primary'
			? 'bg-primary text-white border-primary hover:opacity-95 dark:text-canvas'
			: variant === 'celadon'
				? 'bg-celadon text-white border-celadon hover:opacity-95'
				: variant === 'danger'
					? 'bg-crimson text-white border-crimson hover:opacity-95'
					: variant === 'secondary'
						? 'bg-surface text-ink-primary border-border-strong hover:bg-surface-elevated'
						: 'bg-transparent text-ink-primary border-transparent hover:bg-surface-elevated'
	);

	let sizeClasses = $derived(
		size === 'sm'
			? 'min-h-[40px] px-3 text-xs'
			: size === 'lg'
				? 'min-h-[52px] px-6 text-base font-semibold'
				: 'min-h-[48px] px-4 text-sm font-medium'
	);
</script>

<button
	{type}
	disabled={disabled || loading}
	onclick={handleClick}
	aria-label={ariaLabel}
	class="inline-flex items-center justify-center rounded-xl border font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 {variantClasses} {sizeClasses} {fullWidth
		? 'w-full'
		: ''}"
>
	{#if loading}
		<svg
			class="mr-2 h-4 w-4 animate-spin text-current"
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
		>
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
			></circle>
			<path
				class="opacity-75"
				fill="currentColor"
				d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
			></path>
		</svg>
	{/if}
	{#if children}
		{@render children()}
	{/if}
</button>
