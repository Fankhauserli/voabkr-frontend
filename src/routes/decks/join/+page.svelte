<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { deckApi } from '$lib/api/decks';
	import { auth } from '$lib/stores/auth.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import type { SharedDeckPreview } from '$lib/types';
	import DeckTypeBadge from '$lib/components/decks/DeckTypeBadge.svelte';
	import TactileButton from '$lib/components/forms/TactileButton.svelte';
	import SEO from '$lib/components/seo/SEO.svelte';

	let token = $derived(page.url.searchParams.get('token') ?? '');
	let preview = $state<SharedDeckPreview | null>(null);
	let isLoading = $state(true);
	let isJoining = $state(false);
	let errorMessage = $state<string | null>(null);

	onMount(async () => {
		if (!token) {
			isLoading = false;
			errorMessage = 'No share token provided. Please check the link.';
			return;
		}

		try {
			preview = await deckApi.getSharedDeckByToken(token);
		} catch (err: unknown) {
			errorMessage = err instanceof Error ? err.message : 'Invalid or expired share link.';
		} finally {
			isLoading = false;
		}
	});

	async function handleJoinDeck() {
		if (!token) return;

		isJoining = true;
		try {
			const res = await deckApi.joinSharedDeck(token);
			toast.success('Deck added to your study library!');
			const targetId = res.data?.deckId ?? preview?.id;
			if (targetId) {
				goto(`/decks/${targetId}`);
			} else {
				goto('/decks');
			}
		} catch (err: unknown) {
			toast.error(err instanceof Error ? err.message : 'Failed to join deck');
		} finally {
			isJoining = false;
		}
	}
</script>

<SEO
	title={preview ? `Join “${preview.name}” · voabkr` : 'Join Shared Deck · voabkr'}
	description="Preview and add a shared Korean flashcard deck to your spaced repetition library."
/>

<div
	class="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-8"
	style="padding-top: calc(var(--safe-top) + 24px); padding-bottom: calc(var(--safe-bottom) + 24px);"
>
	<div class="mb-6 text-center">
		<a href="/" class="inline-flex items-center gap-2">
			<div
				class="flex h-10 w-10 items-center justify-center rounded-xl border border-border-strong bg-surface shadow-xs"
			>
				<span class="font-hangul text-lg font-black text-primary">보</span>
			</div>
			<span class="font-hangul text-lg font-bold text-ink-primary">voabkr</span>
		</a>
	</div>

	{#if isLoading}
		<div class="rounded-2xl border border-border-subtle bg-surface p-8 text-center shadow-xs">
			<div
				class="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
			></div>
			<p class="mt-3 text-xs text-ink-secondary">Verifying shared deck link...</p>
		</div>
	{:else if errorMessage || !preview}
		<div class="rounded-2xl border border-border-subtle bg-surface p-8 text-center shadow-xs">
			<div
				class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-crimson/10 text-crimson"
			>
				<svg
					class="h-6 w-6"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<circle cx="12" cy="12" r="10"></circle>
					<line x1="12" y1="8" x2="12" y2="12"></line>
					<line x1="12" y1="16" x2="12.01" y2="16"></line>
				</svg>
			</div>
			<h2 class="text-base font-bold text-ink-primary">Unable to Access Deck</h2>
			<p class="mt-1 text-xs text-ink-secondary">
				{errorMessage || 'This share link is either invalid, revoked, or expired.'}
			</p>
			<div class="mt-5">
				<a href="/decks" class="block">
					<TactileButton variant="secondary" fullWidth>Browse Public Decks</TactileButton>
				</a>
			</div>
		</div>
	{:else}
		<!-- Shared Deck Card Preview -->
		<div class="rounded-2xl border border-border-subtle bg-surface p-6 shadow-xs">
			<div class="mb-4 flex items-center justify-between">
				<DeckTypeBadge type={preview.type} />
				<span
					class="rounded-md border border-navy/20 bg-navy/5 px-2 py-0.5 text-[11px] font-semibold text-navy"
				>
					Shared Invite
				</span>
			</div>

			<h2 class="font-hangul text-2xl font-bold tracking-tight text-ink-primary">
				{preview.name}
			</h2>

			<p class="mt-2 text-xs text-ink-secondary">
				{#if preview.ownerName}
					Created by <span class="font-semibold text-ink-primary">{preview.ownerName}</span> ·
				{/if}
				<span>{preview.cardCount ?? 0} cards available</span>
			</p>

			<div
				class="my-5 rounded-xl border border-border-subtle bg-canvas p-3.5 text-xs leading-relaxed text-ink-secondary"
			>
				<p>
					Add this deck to your library to track your spaced repetition progress, practice
					flashcards with Korean audio & handwriting scratchpad, and master vocabulary.
				</p>
			</div>

			{#if auth.isAuthenticated}
				<TactileButton
					variant="primary"
					size="lg"
					fullWidth
					onclick={handleJoinDeck}
					loading={isJoining}
				>
					<span>Add to My Library</span>
					<svg
						class="h-4 w-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<line x1="12" y1="5" x2="12" y2="19"></line>
						<line x1="5" y1="12" x2="19" y2="12"></line>
					</svg>
				</TactileButton>
			{:else}
				<div class="flex flex-col gap-2">
					<a
						href="/login?redirect={encodeURIComponent(page.url.pathname + page.url.search)}"
						class="block"
					>
						<TactileButton variant="primary" size="lg" fullWidth>Log In to Join Deck</TactileButton>
					</a>
					<p class="text-center text-[11px] text-ink-muted">
						You need an account to track your study sessions and reviews.
					</p>
				</div>
			{/if}
		</div>

		<div class="mt-4 text-center">
			<a href="/decks" class="text-xs text-ink-secondary hover:text-ink-primary hover:underline">
				← Back to Decks Library
			</a>
		</div>
	{/if}
</div>
