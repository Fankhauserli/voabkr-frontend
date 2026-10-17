<script lang="ts">
	import { onMount } from 'svelte';
	import { deckApi } from '$lib/api/decks';
	import { clientCache } from '$lib/api/cache';
	import { selectionClick } from '$lib/utils/haptics';
	import { auth } from '$lib/stores/auth.svelte';
	import { modal } from '$lib/stores/modal.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { downloadedDecks } from '$lib/device/downloadedDecks.svelte';
	import type { Deck, DeckType } from '$lib/types';
	import DeckCard from '$lib/components/decks/DeckCard.svelte';
	import BottomNavBar from '$lib/components/navigation/BottomNavBar.svelte';
	import DeckCreatorModal from '$lib/components/forms/DeckCreatorModal.svelte';
	import DeckShareModal from '$lib/components/forms/DeckShareModal.svelte';
	import TactileButton from '$lib/components/forms/TactileButton.svelte';
	import SEO from '$lib/components/seo/SEO.svelte';

	type LibraryTab = 'all' | 'my' | 'shared' | 'public';

	let decks = $state<Deck[]>([]);
	let libraryTab = $state<LibraryTab>('all');
	let typeFilter = $state<'all' | DeckType>('all');
	let isLoading = $state(true);
	let isOnline = $state(typeof navigator === 'undefined' ? true : navigator.onLine);

	onMount(() => {
		void loadDecks();

		const updateConnection = () => {
			isOnline = navigator.onLine;
		};
		window.addEventListener('online', updateConnection);
		window.addEventListener('offline', updateConnection);

		return () => {
			window.removeEventListener('online', updateConnection);
			window.removeEventListener('offline', updateConnection);
		};
	});

	async function removeFromDevice(deck: Deck) {
		try {
			await downloadedDecks.remove(deck.id);
			toast.success(`${deck.name} removed from this device`);
		} catch {
			toast.error(`Could not remove ${deck.name} from this device`);
		}
	}

	async function loadDecks() {
		if (!clientCache.has('decks:list')) {
			isLoading = true;
		}
		try {
			decks = await deckApi.getDecks({
				onRevalidate: (fresh) => {
					decks = fresh;
				}
			});
		} catch {
			decks = [];
		} finally {
			isLoading = false;
		}
	}

	function isMyDeck(d: Deck): boolean {
		const role = d.userAccessRole ?? d.user_access_role;
		if (role === 'owner') return true;
		if (auth.user && (d.ownerId === auth.user.id || d.owner_id === auth.user.id)) return true;
		return false;
	}

	function isSharedDeck(d: Deck): boolean {
		const role = d.userAccessRole ?? d.user_access_role;
		return role === 'view' || role === 'edit';
	}

	function isPublicDeck(d: Deck): boolean {
		const role = d.userAccessRole ?? d.user_access_role;
		if (role === 'public') return true;
		if (d.isPublic === true || d.is_public === true) return true;
		return false;
	}

	function setLibraryTab(tab: LibraryTab) {
		selectionClick();
		libraryTab = tab;
	}

	function setTypeFilter(type: 'all' | DeckType) {
		selectionClick();
		typeFilter = type;
	}

	let myCount = $derived(decks.filter((d) => isMyDeck(d)).length);
	let sharedCount = $derived(decks.filter((d) => isSharedDeck(d)).length);
	let publicCount = $derived(decks.filter((d) => isPublicDeck(d)).length);

	let filteredDecks = $derived(
		decks.filter((d) => {
			if (libraryTab === 'my' && !isMyDeck(d)) return false;
			if (libraryTab === 'shared' && !isSharedDeck(d)) return false;
			if (libraryTab === 'public' && !isPublicDeck(d)) return false;

			if (typeFilter !== 'all' && d.type !== typeFilter) return false;

			return true;
		})
	);
</script>

<SEO
	title="voabkr · 단어장 보관함 | Korean Flashcard Decks"
	description="Browse and organize your Korean vocabulary and grammar card decks. Structured for efficient spaced repetition mastery."
	canonical="https://vocabkr.voyagera.ch/decks"
/>

<div
	class="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pt-4 pb-28 sm:px-6 md:pb-12 lg:px-8"
	style="padding-top: calc(var(--safe-top) + 16px);"
>
	<!-- Top Bar -->
	<header class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight text-ink-primary">Decks Library</h1>
			<p class="text-xs text-ink-secondary">Vocabulary & Grammar collections</p>
		</div>

		<div class="flex items-center gap-2">
			{#if auth.isAuthenticated}
				<TactileButton variant="primary" size="sm" onclick={() => modal.openDeckCreator()}>
					<svg
						class="h-3.5 w-3.5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<line x1="12" y1="5" x2="12" y2="19"></line>
						<line x1="5" y1="12" x2="19" y2="12"></line>
					</svg>
					<span>New Deck</span>
				</TactileButton>
			{/if}
		</div>
	</header>

	<!-- Section 4.1: Segmented Library Tabs (All, My Decks, Shared with Me, Public Catalog) -->
	<div
		class="mb-3 flex flex-wrap items-center gap-1.5 rounded-xl border border-border-subtle bg-surface p-1 select-none"
	>
		<button
			type="button"
			onclick={() => setLibraryTab('all')}
			class="min-w-[70px] flex-1 rounded-lg py-1.5 text-center text-xs font-bold transition {libraryTab ===
			'all'
				? 'bg-canvas text-ink-primary shadow-xs'
				: 'text-ink-secondary hover:text-ink-primary'}"
		>
			All ({decks.length})
		</button>

		{#if auth.isAuthenticated}
			<button
				type="button"
				onclick={() => setLibraryTab('my')}
				class="min-w-[80px] flex-1 rounded-lg py-1.5 text-center text-xs font-bold transition {libraryTab ===
				'my'
					? 'bg-canvas text-primary shadow-xs'
					: 'text-ink-secondary hover:text-ink-primary'}"
			>
				My Decks ({myCount})
			</button>
			<button
				type="button"
				onclick={() => setLibraryTab('shared')}
				class="min-w-[80px] flex-1 rounded-lg py-1.5 text-center text-xs font-bold transition {libraryTab ===
				'shared'
					? 'bg-canvas text-navy shadow-xs'
					: 'text-ink-secondary hover:text-ink-primary'}"
			>
				Shared ({sharedCount})
			</button>
		{/if}

		<button
			type="button"
			onclick={() => setLibraryTab('public')}
			class="min-w-[80px] flex-1 rounded-lg py-1.5 text-center text-xs font-bold transition {libraryTab ===
			'public'
				? 'bg-canvas text-ink-primary shadow-xs'
				: 'text-ink-secondary hover:text-ink-primary'}"
		>
			Public ({publicCount})
		</button>
	</div>

	<!-- Sub-filter: Category chips (All / Vocab / Grammar) -->
	<div class="mb-5 flex items-center gap-2">
		<span class="text-[11px] font-semibold text-ink-muted">Category:</span>
		<div class="flex items-center gap-1 text-xs">
			<button
				type="button"
				onclick={() => setTypeFilter('all')}
				class="rounded-lg px-2.5 py-1 text-xs font-semibold transition {typeFilter === 'all'
					? 'bg-ink-primary font-bold text-surface'
					: 'text-ink-secondary hover:bg-surface-elevated'}"
			>
				All
			</button>
			<button
				type="button"
				onclick={() => setTypeFilter('vocabulary')}
				class="rounded-lg px-2.5 py-1 text-xs font-semibold transition {typeFilter === 'vocabulary'
					? 'bg-navy font-bold text-white'
					: 'text-ink-secondary hover:bg-surface-elevated'}"
			>
				Vocab
			</button>
			<button
				type="button"
				onclick={() => setTypeFilter('grammar')}
				class="rounded-lg px-2.5 py-1 text-xs font-semibold transition {typeFilter === 'grammar'
					? 'bg-celadon font-bold text-white'
					: 'text-ink-secondary hover:bg-surface-elevated'}"
			>
				Grammar
			</button>
		</div>
	</div>

	<!-- Deck List -->
	<main class="flex-1">
		{#if isLoading}
			<div class="flex flex-col items-center justify-center py-16">
				<div
					class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
				></div>
				<p class="mt-3 text-xs text-ink-secondary">Loading study decks...</p>
			</div>
		{:else if filteredDecks.length === 0}
			<div class="rounded-2xl border border-dashed border-border-strong bg-surface p-8 text-center">
				<div
					class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-border-subtle bg-canvas text-ink-muted shadow-xs"
				>
					<svg
						class="h-7 w-7"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
						<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
						<path d="M8 7h8M8 11h6" />
					</svg>
				</div>
				<h2 class="text-base font-bold text-ink-primary">No Decks Found</h2>
				<p class="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-ink-secondary">
					{#if libraryTab === 'my'}
						You haven't created any custom decks yet. Tap "New Deck" above to make your first deck!
					{:else if libraryTab === 'shared'}
						No peer decks have been shared with you yet.
					{:else}
						No decks match your current filter selections.
					{/if}
				</p>
				{#if auth.isAuthenticated && libraryTab === 'my'}
					<div class="mt-4 flex justify-center">
						<TactileButton variant="primary" size="sm" onclick={() => modal.openDeckCreator()}>
							Create Your First Deck
						</TactileButton>
					</div>
				{/if}
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each filteredDecks as deck (deck.id)}
					<DeckCard
						{deck}
						isDownloaded={downloadedDecks.isHeld(deck.id)}
						isOffline={!isOnline}
						onRemoveFromDevice={removeFromDevice}
					/>
				{/each}
			</div>
		{/if}
	</main>
</div>

<!-- Modals -->
<DeckCreatorModal onDeckSaved={loadDecks} />
<DeckShareModal onShareUpdated={loadDecks} />

<!-- Bottom Navigation Bar -->
<BottomNavBar activeRoute="/decks" />
