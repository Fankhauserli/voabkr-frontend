<script lang="ts">
	import BottomSheet from './BottomSheet.svelte';
	import TactileInput from './TactileInput.svelte';
	import TactileButton from './TactileButton.svelte';
	import { modal } from '$lib/stores/modal.svelte';
	import { deckApi } from '$lib/api/decks';
	import { toast } from '$lib/stores/toast.svelte';
	import { selectionClick } from '$lib/utils/haptics';
	import type { Deck } from '$lib/types';

	interface Props {
		onShareUpdated?: () => void;
	}

	let { onShareUpdated }: Props = $props();

	let inviteEmail = $state('');
	let permission = $state<'view' | 'edit'>('view');
	let isInviting = $state(false);
	let isGeneratingLink = $state(false);
	let inviteSuccess = $state(false);
	let error = $state<string | null>(null);
	let activeShareToken = $state<string | null>(null);

	let currentDeck = $derived<Deck | null>(modal.deckShareData?.deck ?? null);

	$effect(() => {
		if (modal.isDeckShareOpen && modal.deckShareData?.deck) {
			const deck = modal.deckShareData.deck;
			activeShareToken = deck.shareToken ?? deck.share_token ?? null;
			inviteEmail = '';
			permission = 'view';
			inviteSuccess = false;
			error = null;
		}
	});

	let shareUrl = $derived.by(() => {
		if (!activeShareToken) return '';
		const origin =
			typeof window !== 'undefined' ? window.location.origin : 'https://vocabkr.voyagera.ch';
		return `${origin}/decks/join?token=${activeShareToken}`;
	});

	async function handleGenerateOrCopyLink() {
		selectionClick();
		if (!currentDeck) return;

		if (!activeShareToken) {
			isGeneratingLink = true;
			error = null;
			try {
				const res = await deckApi.shareDeck(currentDeck.id);
				activeShareToken = res.shareToken ?? res.share_token ?? null;
				if (currentDeck) {
					currentDeck.shareToken = activeShareToken ?? undefined;
				}
				onShareUpdated?.();
			} catch (err: unknown) {
				error = err instanceof Error ? err.message : 'Failed to generate share link';
				isGeneratingLink = false;
				return;
			} finally {
				isGeneratingLink = false;
			}
		}

		if (shareUrl) {
			try {
				await navigator.clipboard.writeText(shareUrl);
				toast.success('Share link copied to clipboard!');
			} catch {
				toast.info('Please copy the share link below');
			}
		}
	}

	async function handleDirectInvite() {
		if (!currentDeck) return;
		if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
			error = 'Please enter a valid email address.';
			return;
		}

		isInviting = true;
		error = null;
		inviteSuccess = false;

		try {
			await deckApi.shareDeck(currentDeck.id, {
				email: inviteEmail.trim(),
				permission
			});
			inviteSuccess = true;
			toast.success(`Invite sent to ${inviteEmail.trim()}`);
			inviteEmail = '';
			onShareUpdated?.();
		} catch (err: unknown) {
			error = err instanceof Error ? err.message : 'Failed to send invite';
		} finally {
			isInviting = false;
		}
	}
</script>

<BottomSheet
	isOpen={modal.isDeckShareOpen}
	title={currentDeck ? `Share “${currentDeck.name}”` : 'Share Deck'}
	onClose={() => modal.close()}
>
	<div class="flex flex-col gap-5 py-1">
		{#if error}
			<div class="rounded-xl border border-crimson/40 bg-crimson/10 p-2.5 text-xs text-crimson">
				{error}
			</div>
		{/if}

		{#if inviteSuccess}
			<div class="rounded-xl border border-celadon/40 bg-celadon/10 p-2.5 text-xs text-celadon">
				Invitation sent successfully! The learner can now access this deck.
			</div>
		{/if}

		<!-- 1. Shareable Link Section -->
		<section class="rounded-2xl border border-border-subtle bg-canvas p-3.5">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-1.5">
					<svg
						class="h-4 w-4 text-primary"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
						<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
					</svg>
					<span class="text-xs font-bold text-ink-primary">Shareable Link</span>
				</div>
				<span class="text-[11px] text-ink-muted">Anyone with link can join</span>
			</div>

			<p class="mt-1 text-[11px] leading-relaxed text-ink-secondary">
				Anyone with this unique link can preview and add this deck to their personal study library.
			</p>

			<div class="mt-3 flex items-center gap-2">
				<input
					type="text"
					readonly
					value={shareUrl || 'Click generate to create an access link'}
					class="min-h-[40px] flex-1 rounded-xl border border-border-strong bg-surface px-3 text-xs text-ink-secondary select-all focus:outline-none"
				/>
				<TactileButton
					type="button"
					variant="primary"
					size="sm"
					onclick={handleGenerateOrCopyLink}
					loading={isGeneratingLink}
				>
					{activeShareToken ? 'Copy Link' : 'Generate'}
				</TactileButton>
			</div>
		</section>

		<!-- 2. Direct Invite Section -->
		<section class="flex flex-col gap-3">
			<div class="flex items-center gap-1.5">
				<svg
					class="h-4 w-4 text-ink-primary"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
					></path>
					<polyline points="22,6 12,13 2,6"></polyline>
				</svg>
				<h3 class="text-xs font-bold text-ink-primary">Invite Collaborator by Email</h3>
			</div>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleDirectInvite();
				}}
				class="flex flex-col gap-3"
			>
				<TactileInput
					id="invite-email"
					label="Learner's Email"
					type="email"
					bind:value={inviteEmail}
					placeholder="friend@example.com"
					required
				/>

				<!-- Permission Segmented Switcher -->
				<div class="flex flex-col gap-1.5">
					<span class="text-xs font-semibold text-ink-secondary">Access Level</span>
					<div class="grid grid-cols-2 gap-2">
						<button
							type="button"
							onclick={() => {
								selectionClick();
								permission = 'view';
							}}
							class="flex min-h-[44px] flex-col items-start rounded-xl border p-2 text-left transition active:scale-95 {permission ===
							'view'
								? 'border-primary bg-primary/10 text-primary'
								: 'border-border-subtle bg-surface text-ink-secondary'}"
						>
							<span class="text-xs font-bold">Can View & Study</span>
							<span class="text-[10px] text-ink-muted">Spaced repetition only</span>
						</button>

						<button
							type="button"
							onclick={() => {
								selectionClick();
								permission = 'edit';
							}}
							class="flex min-h-[44px] flex-col items-start rounded-xl border p-2 text-left transition active:scale-95 {permission ===
							'edit'
								? 'border-primary bg-primary/10 text-primary'
								: 'border-border-subtle bg-surface text-ink-secondary'}"
						>
							<span class="text-xs font-bold">Can Edit Cards</span>
							<span class="text-[10px] text-ink-muted">Collaborative authoring</span>
						</button>
					</div>
				</div>

				<div class="mt-1">
					<TactileButton type="submit" variant="secondary" fullWidth loading={isInviting}>
						Send Direct Invitation
					</TactileButton>
				</div>
			</form>
		</section>

		<!-- Close Button -->
		<div class="border-t border-border-subtle pt-3">
			<TactileButton type="button" variant="secondary" fullWidth onclick={() => modal.close()}>
				Done
			</TactileButton>
		</div>
	</div>
</BottomSheet>
