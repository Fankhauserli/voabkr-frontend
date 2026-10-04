<script lang="ts">
	interface Props {
		current: number;
		total: number;
	}

	let { current, total }: Props = $props();

	let percentage = $derived(total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0);
</script>

<div
	class="w-full"
	role="progressbar"
	aria-valuenow={current}
	aria-valuemin={0}
	aria-valuemax={total}
	aria-label="Session progress"
>
	<div class="mb-1 flex items-center justify-between text-xs text-ink-secondary">
		<span class="font-semibold">Card {current} of {total}</span>
		<span>{percentage}%</span>
	</div>
	<div class="h-1.5 w-full overflow-hidden rounded-full bg-border-subtle">
		<div
			class="h-full bg-primary transition-all duration-300 ease-out"
			style="width: {percentage}%;"
		></div>
	</div>
</div>
