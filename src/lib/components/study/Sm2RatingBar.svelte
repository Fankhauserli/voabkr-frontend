<script lang="ts">
	import type { SM2Rating } from '$lib/types';
	import { SM2_RATINGS_CONFIG } from '$lib/types';

	interface Props {
		onSelectEase: (ease: SM2Rating) => void;
		disabled?: boolean;
	}

	let { onSelectEase, disabled = false }: Props = $props();

	function handleKey(e: KeyboardEvent) {
		if (disabled) return;
		const num = parseInt(e.key, 10);
		if (!isNaN(num) && num >= 0 && num <= 5) {
			onSelectEase(num as SM2Rating);
		}
	}
</script>

<svelte:window onkeydown={handleKey} />

<div class="w-full max-w-sm" role="group" aria-label="SM-2 Recall Rating Scale">
	<div class="grid grid-cols-3 gap-2">
		{#each SM2_RATINGS_CONFIG as item (item.ease)}
			<button
				type="button"
				{disabled}
				onclick={() => onSelectEase(item.ease)}
				class="flex min-h-[50px] flex-col items-center justify-center rounded-xl border p-2 text-ink-primary transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40"
				style="background-color: var(--rating-bg-{item.ease}, {item.colorLight
					.bg}); border-color: var(--rating-border-{item.ease}, {item.colorLight.border});"
				aria-label={`Grade ${item.ease}: ${item.label} - ${item.shortDescription}`}
			>
				<span class="text-xs leading-none font-bold">{item.ease} · {item.label}</span>
				<span class="mt-0.5 line-clamp-1 text-[10px] leading-tight text-ink-secondary">
					{item.shortDescription}
				</span>
			</button>
		{/each}
	</div>
</div>
