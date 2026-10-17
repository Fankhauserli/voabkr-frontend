<script lang="ts">
	import { onMount } from 'svelte';
	import { detectAppMode, type AppMode } from '$lib/pwa/appMode';
	import {
		browserStorage,
		dismissInstallPrompt,
		isInstallPromptDismissed
	} from '$lib/pwa/installPrompt';

	interface Props {
		/** App mode detection; injectable so tests need no real display mode. */
		detectMode?: () => AppMode;
	}

	let { detectMode = detectAppMode }: Props = $props();
	const storage = browserStorage();

	let isVisible = $state(false);

	onMount(() => {
		if (detectMode() !== 'browser') return;
		if (isInstallPromptDismissed(storage)) return;
		isVisible = true;
	});

	function dismiss() {
		isVisible = false;
		dismissInstallPrompt(storage);
	}
</script>

{#if isVisible}
	<div
		class="fixed top-0 right-0 left-0 z-50 mx-auto w-full max-w-lg px-4"
		style="padding-top: calc(var(--safe-top) + 12px);"
		role="dialog"
		aria-labelledby="install-prompt-title"
		aria-describedby="install-prompt-description"
	>
		<div class="rounded-2xl border border-border-strong bg-surface p-4 shadow-lg">
			<div class="flex items-start gap-3">
				<div class="mt-0.5 shrink-0 text-primary" aria-hidden="true">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<rect x="7" y="2" width="10" height="20" rx="2"></rect>
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 18h.01"></path>
					</svg>
				</div>
				<div class="min-w-0 flex-1">
					<p id="install-prompt-title" class="text-sm font-bold text-ink-primary">
						Add the app to your home screen for offline study
					</p>
					<p
						id="install-prompt-description"
						class="mt-1 text-xs leading-relaxed text-ink-secondary"
					>
						A browser tab cannot promise offline study — the browser may clear saved study data.
						Install voabkr to study without a connection.
					</p>
					<button
						type="button"
						onclick={dismiss}
						class="mt-3 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-white transition active:scale-95"
					>
						Got it
					</button>
				</div>
				<button
					type="button"
					onclick={dismiss}
					class="shrink-0 p-1 text-ink-muted transition hover:text-ink-primary"
					aria-label="Dismiss"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path>
					</svg>
				</button>
			</div>
		</div>
	</div>
{/if}
