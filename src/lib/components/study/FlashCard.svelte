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
		isRelearning?: boolean;
	}

	let {
		koreanWord,
		englishWord,
		context = '',
		example = '',
		isFlipped = false,
		onFlip,
		direction = 'koreanToEnglish',
		isRelearning = false
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

	/** Whether the revealed note and example show all their text rather than excerpts. */
	let detailsExpanded = $state(false);
	/** Whether the collapsed note or example is taller than its excerpt, so the toggle is needed. */
	let detailsOverflow = $state(false);
	let noteElement = $state<HTMLElement>();
	let exampleElement = $state<HTMLElement>();
	/** Bumped when an excerpt resizes (viewport or font), so the clamp is re-measured. */
	let measureTick = $state(0);

	$effect(() => {
		// Start every Card, and every return to its front, with the details collapsed.
		void context;
		void example;
		void promptWord;
		void isFlipped;
		detailsExpanded = false;
	});

	$effect(() => {
		const note = noteElement;
		const excerpt = exampleElement;
		if (!note && !excerpt) return;
		const observer = new ResizeObserver(() => {
			measureTick += 1;
		});
		if (note) observer.observe(note);
		if (excerpt) observer.observe(excerpt);
		return () => observer.disconnect();
	});

	$effect(() => {
		// Measure the excerpts only while collapsed; expanding is meant to reveal all of it.
		void measureTick;
		void context;
		void example;
		if (detailsExpanded) return;
		detailsOverflow =
			(noteElement ? noteElement.scrollHeight > noteElement.clientHeight + 1 : false) ||
			(exampleElement ? exampleElement.scrollHeight > exampleElement.clientHeight + 1 : false);
	});

	function toggleDetails(event: MouseEvent) {
		event.stopPropagation();
		detailsExpanded = !detailsExpanded;
	}

	function handleFlip() {
		if (typeof window !== 'undefined' && window.getSelection()?.toString()) {
			return;
		}
		cardFlip();
		onFlip?.();
	}
</script>

<div
	class="flashcard-perspective w-full max-w-sm"
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

	<!--
		Interactive 3D Card Surface. Tapping the surface flips the Card, but the
		readable controls (the front's reveal button and the back's Show more
		toggle) are its keyboard-accessible equivalents.
	-->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		onclick={handleFlip}
		class="flashcard-inner grid min-h-[340px] w-full cursor-pointer rounded-2xl border border-border-subtle bg-surface shadow-sm transition active:scale-[0.99] {isFlipped
			? 'is-flipped'
			: ''}"
	>
		<!-- FRONT FACE -->
		<div
			class="flashcard-face col-start-1 row-start-1 flex flex-col justify-between overflow-hidden rounded-2xl bg-surface p-6"
		>
			<div class="flex items-center justify-between gap-2">
				<div class="flex min-w-0 items-center gap-2">
					<span
						class="min-w-0 truncate rounded-md border border-border-subtle bg-canvas px-2.5 py-1 text-[11px] font-semibold tracking-wider text-ink-secondary uppercase"
						title={promptLabel}
					>
						{promptLabel}
					</span>
					{#if isRelearning}
						<span
							class="shrink-0 rounded-md border border-amber/35 bg-amber/15 px-2 py-0.5 text-[10px] font-bold text-amber"
						>
							Review Again · 재학습
						</span>
					{/if}
				</div>
				<button
					type="button"
					onclick={(event) => {
						event.stopPropagation();
						handleFlip();
					}}
					class="inline-flex shrink-0 items-center gap-1 rounded text-xs text-ink-muted transition hover:text-ink-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
				>
					<span>Tap to flip</span>
					<svg
						class="h-3.5 w-3.5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
					</svg>
				</button>
			</div>

			<div class="my-auto flex min-w-0 flex-col items-center justify-center text-center">
				{#if direction === 'englishToKorean'}
					<h2
						class="text-3xl font-bold tracking-tight break-words break-keep text-ink-primary sm:text-4xl"
					>
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
			class="flashcard-face flashcard-back col-start-1 row-start-1 flex flex-col justify-between overflow-hidden rounded-2xl bg-surface-elevated p-6 text-left"
		>
			<div class="border-b border-border-subtle pb-2.5">
				<span class="block truncate text-sm font-semibold break-keep text-ink-secondary">
					{promptWord}
				</span>
				{#if context}
					<p
						bind:this={noteElement}
						class="mt-1 text-[11px] leading-relaxed font-medium text-ink-secondary {detailsExpanded
							? ''
							: 'line-clamp-2'}"
					>
						{context}
					</p>
				{/if}
			</div>

			<div class="my-auto flex min-w-0 flex-col gap-3">
				<div>
					<p class="text-xs font-semibold tracking-wider text-ink-muted uppercase">
						{answerSectionTitle}
					</p>
					{#if direction === 'englishToKorean'}
						<h3 class="hangul-text text-3xl font-bold tracking-tight text-ink-primary">
							{koreanWord}
						</h3>
					{:else}
						<h3 class="text-2xl font-bold tracking-tight break-words text-ink-primary">
							{englishWord}
						</h3>
					{/if}
				</div>

				{#if example}
					<div class="mt-2 rounded-xl border border-border-subtle bg-surface p-3">
						<p class="text-xs font-semibold tracking-wider text-ink-muted uppercase">Example</p>
						<p
							bind:this={exampleElement}
							class="hangul-text mt-1 text-sm leading-relaxed font-medium break-words break-keep whitespace-pre-line text-ink-primary {detailsExpanded
								? ''
								: 'line-clamp-3'}"
						>
							{example}
						</p>
					</div>
				{/if}

				{#if detailsOverflow}
					<button
						type="button"
						aria-expanded={detailsExpanded}
						onclick={toggleDetails}
						class="self-start rounded text-xs font-semibold text-primary transition hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
					>
						{detailsExpanded ? 'Show less' : 'Show more'}
					</button>
				{/if}
			</div>

			<div class="flex items-center justify-between border-t border-border-subtle pt-2">
				<span class="text-xs text-ink-muted">Rate your recall below</span>
				<span class="text-xs text-ink-muted">Again · Hard · Good · Easy</span>
			</div>
		</div>
	</div>
</div>
