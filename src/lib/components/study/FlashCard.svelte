<script lang="ts">
	import { cardFlip } from '$lib/utils/haptics';
	import type { StudyDirection } from '$lib/types';

	interface Props {
		koreanWord: string;
		englishWord: string;
		context?: string;
		example?: string;
		isFlipped?: boolean;
		onFlip?: () => void;
		direction?: StudyDirection;
	}

	let {
		koreanWord,
		englishWord,
		context = '',
		example = '',
		isFlipped = false,
		onFlip,
		direction = 'koreanToEnglish'
	}: Props = $props();

	let promptWord = $derived(direction === 'englishToKorean' ? englishWord : koreanWord);
	let answerWord = $derived(direction === 'englishToKorean' ? koreanWord : englishWord);
	let promptLabel = $derived(
		context || (direction === 'englishToKorean' ? 'English Definition' : 'Korean Word')
	);
	let answerSectionTitle = $derived(
		direction === 'englishToKorean' ? 'Korean / 한국어' : 'English Meaning'
	);
	let flipHint = $derived(
		direction === 'englishToKorean' ? '터치하여 한국어 정답 확인' : '터치하여 뒤집기'
	);

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
	aria-label={`Flashcard: ${promptWord}`}
>
	<!-- Screen reader dynamic announcements -->
	<div class="sr-only" aria-live="polite" aria-atomic="true">
		{#if isFlipped}
			Answer revealed: {answerWord}. Example sentence: {example}
		{:else}
			Question: {promptWord}. Tap card or press spacebar to reveal answer.
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
					{promptLabel}
				</span>
				<span class="text-xs text-ink-muted">Tap to flip ↺</span>
			</div>

			<div class="my-auto flex flex-col items-center justify-center text-center">
				{#if direction === 'englishToKorean'}
					<h2 class="text-3xl font-bold tracking-tight break-keep text-ink-primary sm:text-4xl">
						{englishWord}
					</h2>
				{:else}
					<h2
						class="hangul-text text-4xl font-bold tracking-tight break-keep text-ink-primary sm:text-5xl"
					>
						{koreanWord}
					</h2>
				{/if}
			</div>

			<div class="flex items-center justify-center">
				<span class="text-xs text-ink-muted">{flipHint}</span>
			</div>
		</div>

		<!-- BACK FACE (REVEALED ANSWER) -->
		<div
			class="flashcard-face flashcard-back absolute inset-0 flex flex-col justify-between rounded-2xl bg-surface-elevated p-6 text-left"
		>
			<div class="flex items-center justify-between border-b border-border-subtle pb-2.5">
				<span class="text-sm font-semibold break-keep text-ink-secondary">
					{promptWord}
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
					<p class="text-xs font-semibold tracking-wider text-ink-muted uppercase">
						{answerSectionTitle}
					</p>
					{#if direction === 'englishToKorean'}
						<h3 class="hangul-text text-3xl font-bold tracking-tight text-ink-primary">
							{koreanWord}
						</h3>
					{:else}
						<h3 class="text-2xl font-bold tracking-tight text-ink-primary">
							{englishWord}
						</h3>
					{/if}
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
				<span class="text-xs text-ink-muted">Again · Hard · Good · Easy</span>
			</div>
		</div>
	</div>
</div>
