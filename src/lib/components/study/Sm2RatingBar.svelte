<script lang="ts">
	import type { SM2Rating } from '$lib/types';
	import { SM2_RATINGS_CONFIG } from '$lib/types';

	interface Props {
		onSelectEase: (ease: SM2Rating) => void;
		disabled?: boolean;
	}

	let { onSelectEase, disabled = false }: Props = $props();

	// Keyboard shortcuts: A=Again, H=Hard, G=Good, E=Easy (or 1-4)
	const keyMap: Record<string, SM2Rating> = {
		'1': 1, a: 1, A: 1,
		'2': 2, h: 2, H: 2,
		'3': 3, g: 3, G: 3,
		'4': 4, e: 4, E: 4
	};

	function handleKey(ev: KeyboardEvent) {
		if (disabled) return;
		// Don't fire when user is typing in an input
		if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return;
		const mapped = keyMap[ev.key];
		if (mapped !== undefined) {
			ev.preventDefault();
			onSelectEase(mapped);
		}
	}
</script>

<svelte:window onkeydown={handleKey} />

<div class="w-full" role="group" aria-label="Rate your recall">
	<div class="grid grid-cols-4 gap-1.5">
		{#each SM2_RATINGS_CONFIG as item (item.ease)}
			<button
				type="button"
				{disabled}
				onclick={() => onSelectEase(item.ease)}
				class="flex min-h-[54px] flex-col items-center justify-center rounded-xl border px-1 py-2 text-ink-primary transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40"
				style="background-color: {item.colorLight.bg}; border-color: {item.colorLight.border};"
				aria-label="{item.label} – next in {item.nextHint}"
			>
				<span class="text-xs font-bold leading-none">{item.label}</span>
				<span class="mt-0.5 text-[10px] leading-tight text-ink-secondary">{item.nextHint}</span>
			</button>
		{/each}
	</div>
</div>
