<script lang="ts">
	import { cardFlip } from '$lib/utils/haptics';

	interface Props {
		koreanWord: string;
		englishWord: string;
		context?: string;
		example?: string;
		isFlipped?: boolean;
		onFlip?: () => void;
	}

	let {
		koreanWord,
		englishWord,
		context = '',
		example = '',
		isFlipped = false,
		onFlip
	}: Props = $props();

	function handleFlip() {
		cardFlip();
		onFlip?.();
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			handleFlip();
		}
	}
</script>

<div
	class="flashcard-perspective w-full max-w-sm select-none"
	role="region"
	aria-roledescription="flashcard"
	aria-label={`Flashcard: ${koreanWord}`}
>
	<!-- Screen reader dynamic announcements -->
	<div class="sr-only" aria-live="polite" aria-atomic="true">
		{#if isFlipped}
			Answer revealed: {englishWord}. Example sentence: {example}
		{:else}
			Question: {koreanWord}. Tap card or press spacebar to reveal translation.
		{/if}
	</div>

	<!-- Interactive 3D Card Surface -->
	<div
		role="button"
		tabindex="0"
		onclick={handleFlip}
		onkeydown={handleKeyDown}
		aria-expanded={isFlipped}
		class="flashcard-inner relative min-h-[340px] w-full cursor-pointer rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm transition active:scale-[0.99] {isFlipped
			? 'is-flipped'
			: ''}"
	>
		<!-- FRONT FACE -->
		<div
			class="flashcard-face absolute inset-0 flex flex-col justify-between rounded-2xl bg-surface p-6"
		>
			<div class="flex items-center justify-between">
				<span
					class="rounded-md border border-border-subtle bg-canvas px-2.5 py-1 text-[11px] font-semibold tracking-wider text-ink-secondary uppercase"
				>
					{context || 'Korean Word'}
				</span>
				<span class="text-xs text-ink-muted">Tap to flip ↺</span>
			</div>

			<div class="my-auto flex flex-col items-center justify-center text-center">
				<h2
					class="hangul-text text-4xl font-bold tracking-tight break-keep text-ink-primary sm:text-5xl"
				>
					{koreanWord}
				</h2>
			</div>

			<div class="flex items-center justify-center">
				<span class="text-xs text-ink-muted">터치하여 뒤집기</span>
			</div>
		</div>

		<!-- BACK FACE (REVEALED ANSWER) -->
		<div
			class="flashcard-face flashcard-back absolute inset-0 flex flex-col justify-between rounded-2xl bg-surface-elevated p-6 text-left"
		>
			<div class="flex items-center justify-between border-b border-border-subtle pb-2.5">
				<span class="text-sm font-semibold break-keep text-ink-secondary">
					{koreanWord}
				</span>
				{#if context}
					<span
						class="rounded-md border border-border-subtle bg-canvas px-2 py-0.5 text-[11px] font-semibold text-ink-secondary"
					>
						{context}
					</span>
				{/if}
			</div>

			<div class="my-auto flex flex-col gap-3">
				<div>
					<p class="text-xs font-semibold tracking-wider text-ink-muted uppercase">Meaning</p>
					<h3 class="text-2xl font-bold tracking-tight text-ink-primary">
						{englishWord}
					</h3>
				</div>

				{#if example}
					<div class="mt-2 rounded-xl border border-border-subtle bg-surface p-3">
						<p class="text-xs font-semibold tracking-wider text-ink-muted uppercase">Example</p>
						<p
							class="hangul-text mt-1 text-sm leading-relaxed font-medium break-keep text-ink-primary"
						>
							{example}
						</p>
					</div>
				{/if}
			</div>

			<div class="flex items-center justify-between border-t border-border-subtle pt-2">
				<span class="text-xs text-ink-muted">Rate your recall below</span>
				<span class="text-xs text-ink-muted">0–5</span>
			</div>
		</div>
	</div>
</div>
