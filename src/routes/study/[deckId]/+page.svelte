<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { cardApi } from '$lib/api/cards';
	import { deckApi } from '$lib/api/decks';
	import { studySession } from '$lib/stores/study.svelte';
	import { modal } from '$lib/stores/modal.svelte';
	import { registerStudySessionGuard } from '$lib/utils/backButton';
	import type { Deck } from '$lib/types';
	import FlashCard from '$lib/components/study/FlashCard.svelte';
	import Sm2RatingBar from '$lib/components/study/Sm2RatingBar.svelte';
	import SessionProgressBar from '$lib/components/study/SessionProgressBar.svelte';
	import TactileButton from '$lib/components/forms/TactileButton.svelte';

	let deck = $state<Deck | null>(null);
	let deckId = $derived(parseInt(page.params.deckId ?? '0', 10));

	onMount(() => {
		const unregisterGuard = registerStudySessionGuard('deck-study-session', () => {
			if (studySession.isActive) {
				handleExitRequest();
				return true;
			}
			return false;
		});

		(async () => {
			try {
				studySession.isLoading = true;
				const [deckData, cardsData] = await Promise.all([
					deckApi.getDeckById(deckId),
					cardApi.getCards(deckId)
				]);
				deck = deckData;
				const deckCards = cardsData.filter((card) => card.deckId === deckId);
				await studySession.startDeckSession(deckCards, deckId);
			} catch (err: unknown) {
				studySession.error = err instanceof Error ? err.message : 'Failed to load deck cards';
			} finally {
				studySession.isLoading = false;
			}
		})();

		return () => {
			unregisterGuard();
		};
	});

	function handleExitRequest() {
		modal.openExitStudyConfirm(() => {
			studySession.reset();
			goto(`/decks/${deckId}`);
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
	<title>{deck ? `Study: ${deck.name}` : 'Study Session'}</title>
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
				✕
			</button>

			<button
				type="button"
				onclick={() => studySession.toggleStudyDirection()}
				class="flex max-w-[200px] items-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-3 py-1.5 text-xs font-bold text-ink-primary transition hover:border-terracotta active:scale-95"
				title="Switch learning direction"
				aria-label="Toggle learning direction"
			>
				{#if studySession.studyDirection === 'koreanToEnglish'}
					<span>🇰🇷 한국어 ➔ 🇬🇧 EN</span>
				{:else}
					<span>🇬🇧 EN ➔ 🇰🇷 한국어</span>
				{/if}
			</button>

			<div class="h-11 w-11"></div>
		</div>

		{#if studySession.totalCards > 0}
			<SessionProgressBar current={studySession.currentIndex + 1} total={studySession.totalCards} />
		{/if}
	</header>

	<!-- Main Flashcard Stage -->
	<main class="my-auto flex w-full flex-col items-center justify-center py-4">
		{#if studySession.isLoading}
			<div class="flex flex-col items-center justify-center py-16">
				<div
					class="h-10 w-10 animate-spin rounded-full border-2 border-terracotta border-t-transparent"
				></div>
				<p class="mt-4 text-xs font-semibold text-ink-secondary">Loading deck cards...</p>
			</div>
		{:else if studySession.totalCards === 0}
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
		{/if}
	</main>

	<!-- Rating Bar -->
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
						Reveal Meaning ↺
					</TactileButton>
				</div>
			{/if}
		{/if}
	</footer>
</div>
