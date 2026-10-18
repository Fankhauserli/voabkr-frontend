<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { deckApi } from '$lib/api/decks';
	import { cardApi } from '$lib/api/cards';
	import { DeviceStoreBlockedError } from '$lib/device/deviceStore';
	import { downloadedDecks } from '$lib/device/downloadedDecks.svelte';
	import { loadStudyDeck } from '$lib/device/loadStudyDeck';
	import { reopenDeviceStores } from '$lib/study/reopenDeviceStores';
	import { studySession } from '$lib/stores/study.svelte';
	import type { Deck } from '$lib/types';
	import StudyStage from '$lib/components/study/StudyStage.svelte';
	import TactileButton from '$lib/components/forms/TactileButton.svelte';

	let deck = $state<Deck | null>(null);
	let needsConnection = $state(false);
	let deckId = $derived(parseInt(page.params.deckId ?? '0', 10));

	onMount(() => {
		void loadDeck();
	});

	async function loadDeck() {
		studySession.isLoading = true;
		needsConnection = false;

		// The Deck's name is a nicety; an offline Deck still studies without it.
		deckApi
			.getDeckById(deckId)
			.then((loaded) => {
				deck = loaded;
			})
			.catch(() => {});

		try {
			const loaded = await loadStudyDeck(deckId, {
				isOnline: () => navigator.onLine,
				isDeckHeld: async () => {
					await downloadedDecks.ready;
					return downloadedDecks.isHeld(deckId);
				},
				fetchAllCards: (id) => cardApi.getCards(id, { bypassCache: true }),
				downloadDeck: (id, cards) => downloadedDecks.download(id, cards)
			});

			if (loaded.kind === 'needs-connection') {
				// This Deck cannot be studied now, so no sitting may remain in hand.
				studySession.reset();
				needsConnection = true;
				return;
			}

			// The Session queue is assembled from the device's copy, online or not.
			await studySession.start({ deckId });
		} catch (err: unknown) {
			studySession.reset();
			if (err instanceof DeviceStoreBlockedError) {
				studySession.storeBlocked = true;
			} else {
				studySession.error = err instanceof Error ? err.message : 'Failed to load deck cards';
			}
		} finally {
			studySession.isLoading = false;
		}
	}

	/** Re-attempts the store open, then the Deck's load, without a page reload. */
	async function retry() {
		// A store that is still blocked reports itself again when the load reads it.
		await reopenDeviceStores().catch(() => {});
		await loadDeck();
	}
</script>

<svelte:head>
	<title>{deck ? `Study: ${deck.name}` : 'Study Session'}</title>
</svelte:head>

{#if needsConnection}
	<div
		class="flex min-h-screen flex-col justify-between px-4 py-3"
		style="padding-top: calc(var(--safe-top) + 8px); padding-bottom: calc(var(--safe-bottom) + 16px);"
	>
		<main class="my-auto flex w-full flex-col items-center justify-center py-4">
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
						<path d="M2 2l20 20" />
						<path d="M8.5 16.4A4.5 4.5 0 0 1 10 7.6" />
						<path d="M5 17a5 5 0 0 1 1.5-9.8" />
						<path d="M9.5 21a4 4 0 0 1 1.2-7.8" />
					</svg>
				</div>
				<h2 class="text-lg font-bold text-ink-primary">This Deck needs a connection</h2>
				<p class="mt-1 text-xs leading-relaxed text-ink-secondary">
					It has not been downloaded to this device yet. Connect to the internet and study it once
					to keep it available offline.
				</p>
				<div class="mt-6 flex flex-col gap-2">
					<a href="/decks" class="block">
						<TactileButton variant="primary" fullWidth>Back to Decks</TactileButton>
					</a>
				</div>
			</div>
		</main>
	</div>
{:else}
	<StudyStage session={studySession} {deckId} onRetry={retry} />
{/if}
