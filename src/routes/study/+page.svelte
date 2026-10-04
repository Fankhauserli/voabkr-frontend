<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { studySession } from '$lib/stores/study.svelte';
	import { modal } from '$lib/stores/modal.svelte';
	import { registerStudySessionGuard } from '$lib/utils/backButton';
	import FlashCard from '$lib/components/study/FlashCard.svelte';
	import ScratchPad from '$lib/components/study/ScratchPad.svelte';
	import Sm2RatingBar from '$lib/components/study/Sm2RatingBar.svelte';
	import SessionProgressBar from '$lib/components/study/SessionProgressBar.svelte';
	import TactileButton from '$lib/components/forms/TactileButton.svelte';

	import { page } from '$app/state';

	onMount(() => {
		const unregisterGuard = registerStudySessionGuard('study-session', () => {
			if (studySession.isActive) {
				handleExitRequest();
				return true;
			}
			return false;
		});

		const rawDeckId =
			page.url.searchParams.get('deck_id') ||
			page.url.searchParams.get('deckId') ||
			page.url.searchParams.get('deck');
		const targetDeckId = rawDeckId ? parseInt(rawDeckId, 10) : undefined;

		studySession.startDueSession(targetDeckId);

		return () => {
			unregisterGuard();
		};
	});

	function handleExitRequest() {
		modal.openExitStudyConfirm(() => {
			studySession.reset();
			goto('/');
		});
	}

	async function handleRating(ease: import('$lib/types').SM2Rating) {
		await studySession.rateCurrentCard(ease);
		if (studySession.isSessionFinished) {
			goto('/study/summary');
		}
	}
</script>

<svelte:head>
	<title>voabkr — Study Session</title>
</svelte:head>

<div
	class="flex min-h-screen flex-col justify-between px-4 py-3 select-none"
	style="padding-top: calc(var(--safe-top) + 8px); padding-bottom: calc(var(--safe-bottom) + 16px);"
>
	<!-- Top Bar -->
	<header class="w-full">
		<div class="mb-3 flex items-center justify-between">
			<button
				type="button"
				onclick={handleExitRequest}
				class="flex h-11 w-11 items-center justify-center rounded-xl border border-border-subtle bg-surface text-ink-primary transition hover:border-crimson hover:text-crimson active:scale-95"
				aria-label="Exit session"
			>
				<svg
					class="h-4 w-4"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>

			<button
				type="button"
				onclick={() => studySession.toggleStudyDirection()}
				class="flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-3 py-1.5 text-xs font-bold text-ink-primary transition hover:border-primary active:scale-95"
				title="Switch learning direction"
				aria-label="Toggle learning direction"
			>
				{#if studySession.studyDirection === 'koreanToEnglish'}
					<span class="inline-flex items-center gap-1.5 font-medium">
						<span class="font-bold text-ink-primary">한국어</span>
						<svg
							class="h-3 w-3 text-ink-muted"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<line x1="5" y1="12" x2="19" y2="12" />
							<polyline points="12 5 19 12 12 19" />
						</svg>
						<span class="text-ink-secondary">English</span>
					</span>
				{:else}
					<span class="inline-flex items-center gap-1.5 font-medium">
						<span class="text-ink-secondary">English</span>
						<svg
							class="h-3 w-3 text-ink-muted"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<line x1="5" y1="12" x2="19" y2="12" />
							<polyline points="12 5 19 12 12 19" />
						</svg>
						<span class="font-bold text-ink-primary">한국어</span>
					</span>
				{/if}
			</button>

			<button
				type="button"
				onclick={() => studySession.toggleScratchPad()}
				class="flex h-11 w-11 items-center justify-center rounded-xl border transition active:scale-95 {studySession.scratchPadEnabled
					? 'border-primary bg-primary/10 text-primary shadow-xs'
					: 'border-border-subtle bg-surface text-ink-muted hover:text-ink-primary'}"
				title={studySession.scratchPadEnabled
					? 'Hide Scratch Pad'
					: 'Show Scratch Pad (Apple Pencil)'}
				aria-label="Toggle Scratch Pad"
			>
				<svg
					class="h-5 w-5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M12 20h9" />
					<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
				</svg>
			</button>
		</div>

		{#if studySession.totalCards > 0}
			<SessionProgressBar current={studySession.currentIndex + 1} total={studySession.totalCards} />
		{/if}
	</header>

	<!-- Middle Stage: Flashcard Display -->
	<main class="my-auto flex w-full flex-col items-center justify-center py-4">
		{#if studySession.isLoading}
			<div class="flex flex-col items-center justify-center py-16">
				<div
					class="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent"
				></div>
				<p class="mt-4 text-xs font-semibold text-ink-secondary">Loading study cards...</p>
			</div>
		{:else if studySession.totalCards === 0}
			<div
				class="w-full max-w-sm rounded-2xl border border-border-subtle bg-surface p-6 text-center shadow-xs"
			>
				<div
					class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-celadon/15 text-celadon"
				>
					<svg
						class="h-7 w-7"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<polyline points="20 6 9 17 4 12" />
					</svg>
				</div>
				<h2 class="text-lg font-bold text-ink-primary">No Cards Due</h2>
				<p class="mt-1 text-xs leading-relaxed text-ink-secondary">
					You've completed all scheduled reviews for today! Add more cards or practice custom decks.
				</p>
				<div class="mt-6 flex flex-col gap-2">
					<a href="/decks" class="block">
						<TactileButton variant="primary" fullWidth>Browse Decks</TactileButton>
					</a>
					<a href="/" class="block">
						<TactileButton variant="secondary" fullWidth>Return Home</TactileButton>
					</a>
				</div>
			</div>
		{:else if studySession.currentCard}
			<FlashCard
				koreanWord={studySession.currentCard.koreanWord}
				englishWord={studySession.currentCard.englishWord}
				context={studySession.currentCard.context}
				example={studySession.currentCard.example}
				isFlipped={studySession.isFlipped}
				direction={studySession.studyDirection}
				onFlip={() => studySession.flipCard()}
			/>

			{#if studySession.scratchPadEnabled}
				<div class="mt-4 w-full max-w-sm">
					<ScratchPad
						cardId={studySession.currentCard.id}
						revision={studySession.scratchPadRevision}
					/>
				</div>
			{/if}
		{/if}
	</main>

	<!-- Bottom Thumb Zone: SM-2 Rating Keypad -->
	<footer class="w-full pb-1">
		{#if studySession.totalCards > 0 && studySession.currentCard}
			{#if studySession.isFlipped}
				<div class="flex flex-col items-center gap-2">
					<Sm2RatingBar onSelectEase={handleRating} />
				</div>
			{:else}
				<div class="flex justify-center">
					<TactileButton
						variant="secondary"
						size="lg"
						fullWidth
						onclick={() => studySession.flipCard()}
					>
						<span class="inline-flex items-center gap-2">
							<span>Reveal Meaning</span>
							<svg
								class="h-4 w-4"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.19" />
							</svg>
						</span>
					</TactileButton>
				</div>
			{/if}
		{/if}
	</footer>
</div>
