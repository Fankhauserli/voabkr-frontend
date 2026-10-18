<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { StudySessionStore } from '$lib/stores/study.svelte';
	import { preferences } from '$lib/stores/preferences.svelte';
	import { modal } from '$lib/stores/modal.svelte';
	import {
		toggleScratchPadAndReport,
		toggleStudyDirectionAndReport
	} from '$lib/utils/preferenceActions';
	import { registerStudySessionGuard } from '$lib/utils/backButton';
	import type { SM2Rating } from '$lib/types';
	import FlashCard from '$lib/components/study/FlashCard.svelte';
	import ScratchPad from '$lib/components/study/ScratchPad.svelte';
	import Sm2RatingBar from '$lib/components/study/Sm2RatingBar.svelte';
	import SessionProgressBar from '$lib/components/study/SessionProgressBar.svelte';
	import TactileButton from '$lib/components/forms/TactileButton.svelte';

	interface Props {
		/** The Study session whose sitting this stage renders. */
		session: StudySessionStore;
		/** The Deck the sitting studies, or null for the due queue. */
		deckId: number | null;
		/** Re-attempts the device-store open and the sitting; the route owns both. */
		onRetry?: () => void | Promise<void>;
	}

	let { session, deckId, onRetry }: Props = $props();

	/** Where leaving the sitting goes: back to its Deck, or Home for the due queue. */
	let exitDestination = $derived(deckId === null ? '/' : `/decks/${deckId}`);

	onMount(() => {
		return registerStudySessionGuard('study-session', () => {
			if (!session.isActive) return false;
			handleExitRequest();
			return true;
		});
	});

	function handleExitRequest() {
		modal.openExitStudyConfirm(() => {
			session.reset();
			goto(exitDestination);
		});
	}

	async function handleGrade(grade: SM2Rating) {
		await session.rateCurrentCard(grade);
		if (session.isSessionFinished) {
			goto('/study/summary');
		}
	}
</script>

<div
	class="flex min-h-screen flex-col justify-between px-4 py-3"
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
				onclick={toggleStudyDirectionAndReport}
				class="flex max-w-[220px] items-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-3 py-1.5 text-xs font-bold text-ink-primary transition hover:border-primary active:scale-95"
				title="Switch learning direction"
				aria-label="Toggle learning direction"
			>
				{#if preferences.studyDirection === 'koreanToEnglish'}
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
				onclick={toggleScratchPadAndReport}
				class="flex h-11 w-11 items-center justify-center rounded-xl border transition active:scale-95 {preferences.scratchPadEnabled
					? 'border-primary bg-primary/10 text-primary shadow-xs'
					: 'border-border-subtle bg-surface text-ink-muted hover:text-ink-primary'}"
				title={preferences.scratchPadEnabled
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

		{#if session.totalCards > 0}
			<SessionProgressBar current={session.answeredCount + 1} total={session.totalCards} />
		{/if}
	</header>

	<!-- Middle Stage: Flashcard Display -->
	<main class="my-auto flex w-full flex-col items-center justify-center py-4">
		{#if session.isLoading}
			<div class="flex flex-col items-center justify-center py-16">
				<div
					class="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent"
				></div>
				<p class="mt-4 text-xs font-semibold text-ink-secondary">
					{deckId === null ? 'Loading study cards...' : 'Loading deck cards...'}
				</p>
			</div>
		{:else if session.storeBlocked}
			<!-- Another tab or window holds an older store; closing it and Retrying is the way back. -->
			<div
				class="w-full max-w-sm rounded-2xl border border-amber/40 bg-surface p-6 text-center shadow-xs"
			>
				<div
					class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber/10 text-amber"
				>
					<svg
						class="h-7 w-7"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path
							d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
						/>
						<line x1="12" y1="9" x2="12" y2="13" />
						<line x1="12" y1="17" x2="12.01" y2="17" />
					</svg>
				</div>
				<h2 class="text-lg font-bold text-ink-primary">
					Another voabkr tab or window is in the way
				</h2>
				<p class="mt-1 text-xs leading-relaxed text-ink-secondary">
					voabkr could not open your saved study data because another voabkr tab or window is still
					using an older version. Close the other tab or window, then try again.
				</p>
				<div class="mt-6 flex flex-col gap-2">
					<TactileButton variant="primary" fullWidth onclick={() => void onRetry?.()}>
						Try again
					</TactileButton>
				</div>
			</div>
		{:else if session.error && deckId !== null}
			<!-- The Deck route's ensure step could not load the Deck; the due queue keeps its empty state. -->
			<div
				class="w-full max-w-sm rounded-2xl border border-crimson/40 bg-surface p-6 text-center shadow-xs"
			>
				<div
					class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-crimson/10 text-crimson"
				>
					<svg
						class="h-7 w-7"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<circle cx="12" cy="12" r="10" />
						<line x1="12" y1="8" x2="12" y2="12" />
						<line x1="12" y1="16" x2="12.01" y2="16" />
					</svg>
				</div>
				<h2 class="text-lg font-bold text-ink-primary">Could not load this Deck</h2>
				<p class="mt-1 text-xs leading-relaxed text-ink-secondary">{session.error}</p>
				<div class="mt-6 flex flex-col gap-2">
					<a href="/decks" class="block">
						<TactileButton variant="primary" fullWidth>Back to Decks</TactileButton>
					</a>
				</div>
			</div>
		{:else if session.totalCards === 0}
			{#if deckId === null}
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
						You've completed all scheduled reviews for today! Add more cards or practice custom
						decks.
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
			{:else}
				<div
					class="w-full max-w-sm rounded-2xl border border-border-subtle bg-surface p-6 text-center shadow-xs"
				>
					<h2 class="text-lg font-bold text-ink-primary">This Deck is Empty</h2>
					<p class="mt-1 text-xs leading-relaxed text-ink-secondary">
						Add vocabulary or grammar cards to start practicing.
					</p>
					<div class="mt-6 flex flex-col gap-2">
						<a href="/decks/{deckId}" class="block">
							<TactileButton variant="primary" fullWidth>Return to Deck</TactileButton>
						</a>
						<a href="/decks" class="block">
							<TactileButton variant="secondary" fullWidth>Browse Other Decks</TactileButton>
						</a>
					</div>
				</div>
			{/if}
		{:else if session.currentCard}
			<FlashCard
				koreanWord={session.currentCard.koreanWord}
				englishWord={session.currentCard.englishWord}
				context={session.currentCard.context}
				example={session.currentCard.example}
				isFlipped={session.isFlipped}
				direction={preferences.studyDirection}
				isRelearning={session.isCurrentCardRelearning}
				onFlip={() => session.flipCard()}
			/>

			{#if preferences.scratchPadEnabled}
				<div class="mt-4 w-full max-w-sm">
					<ScratchPad cardId={session.currentCard.id} revision={session.scratchPadRevision} />
				</div>
			{/if}
		{/if}
	</main>

	<!-- Bottom Thumb Zone: SM-2 Rating Keypad -->
	<footer class="w-full pb-1">
		{#if session.totalCards > 0 && session.currentCard}
			{#if session.isFlipped}
				<div class="flex flex-col items-center gap-2">
					<Sm2RatingBar onSelectEase={handleGrade} />
				</div>
			{:else}
				<div class="flex justify-center">
					<TactileButton variant="secondary" size="lg" fullWidth onclick={() => session.flipCard()}>
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
