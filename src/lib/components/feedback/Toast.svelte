<script lang="ts">
	import { toast } from '$lib/stores/toast.svelte';
</script>

{#if toast.hasToasts}
	<div
		class="pointer-events-none fixed right-0 bottom-20 left-0 z-50 flex flex-col items-center gap-2 px-4"
		style="padding-bottom: var(--safe-bottom);"
		aria-live="polite"
	>
		{#each toast.toasts as item (item.id)}
			<div
				class="pointer-events-auto flex max-w-sm items-center gap-2 rounded-xl border p-3 shadow-md transition-all duration-200 {item.type ===
				'error'
					? 'border-crimson/40 bg-surface text-crimson'
					: item.type === 'success'
						? 'border-celadon/40 bg-surface text-celadon'
						: item.type === 'warning'
							? 'border-amber/40 bg-surface text-amber'
							: 'border-border-strong bg-surface text-ink-primary'}"
				role="status"
			>
				<span class="text-xs leading-snug font-medium">{item.message}</span>
				<button
					type="button"
					onclick={() => toast.dismiss(item.id)}
					class="ml-auto p-1 text-ink-muted hover:text-ink-primary"
					aria-label="Dismiss notification"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-3.5 w-3.5"
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
		{/each}
	</div>
{/if}
