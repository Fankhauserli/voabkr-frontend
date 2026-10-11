<script lang="ts">
	import BottomSheet from './BottomSheet.svelte';
	import TactileInput from './TactileInput.svelte';
	import TactileButton from './TactileButton.svelte';
	import { modal } from '$lib/stores/modal.svelte';
	import { deckApi } from '$lib/api/decks';
	import { toast } from '$lib/stores/toast.svelte';
	import type { DeckType } from '$lib/types';
	import { selectionClick } from '$lib/utils/haptics';

	interface Props {
		onDeckSaved?: () => void;
		onDeckDeleted?: (deletedDeckId: number) => void;
	}

	let { onDeckSaved, onDeckDeleted }: Props = $props();

	let name = $state('');
	let type = $state<DeckType>('vocabulary');
	let isPublic = $state(false);
	let isSaving = $state(false);
	let isDeleting = $state(false);
	let showDeleteConfirm = $state(false);
	let error = $state<string | null>(null);

	let isEditing = $derived(!!modal.deckCreatorData?.deckToEdit);

	$effect(() => {
		if (modal.isDeckCreatorOpen) {
			if (modal.deckCreatorData?.deckToEdit) {
				const deck = modal.deckCreatorData.deckToEdit;
				name = deck.name;
				type = deck.type;
				isPublic = deck.isPublic ?? deck.is_public ?? false;
			} else {
				name = '';
				type = 'vocabulary';
				isPublic = false;
			}
			showDeleteConfirm = false;
			error = null;
		}
	});

	async function handleSave() {
		if (!name.trim()) {
			error = 'Deck name is required.';
			return;
		}

		isSaving = true;
		error = null;
		try {
			if (modal.deckCreatorData?.deckToEdit) {
				await deckApi.updateDeck(modal.deckCreatorData.deckToEdit.id, {
					name: name.trim(),
					type,
					isPublic,
					is_public: isPublic
				});
				toast.success('Deck updated successfully');
			} else {
				await deckApi.createDeck({
					name: name.trim(),
					type,
					isPublic,
					is_public: isPublic
				});
				toast.success('Deck created successfully');
			}
			modal.close();
			onDeckSaved?.();
		} catch (err: unknown) {
			error = err instanceof Error ? err.message : 'Failed to save deck';
		} finally {
			isSaving = false;
		}
	}

	async function handleDelete() {
		const deckId = modal.deckCreatorData?.deckToEdit?.id;
		if (!deckId) return;

		isDeleting = true;
		error = null;
		try {
			await deckApi.deleteDeck(deckId);
			toast.success('Deck deleted');
			modal.close();
			onDeckDeleted?.(deckId);
			onDeckSaved?.();
		} catch (err: unknown) {
			error = err instanceof Error ? err.message : 'Failed to delete deck';
		} finally {
			isDeleting = false;
		}
	}
</script>

<BottomSheet
	isOpen={modal.isDeckCreatorOpen}
	title={isEditing ? 'Edit Deck' : 'Create New Deck'}
	onClose={() => modal.close()}
>
	{#if showDeleteConfirm}
		<div class="flex flex-col gap-4 py-2">
			<div class="rounded-xl border border-crimson/40 bg-crimson/10 p-3.5 text-xs text-crimson">
				<p class="font-bold">Delete this deck?</p>
				<p class="mt-1 leading-relaxed">
					This will permanently delete this deck and all of its associated cards and review history.
					This action cannot be undone.
				</p>
			</div>

			<div class="flex items-center gap-2">
				<TactileButton
					type="button"
					variant="secondary"
					onclick={() => (showDeleteConfirm = false)}
					fullWidth
				>
					Cancel
				</TactileButton>
				<TactileButton
					type="button"
					variant="danger"
					onclick={handleDelete}
					loading={isDeleting}
					fullWidth
				>
					Permanently Delete
				</TactileButton>
			</div>
		</div>
	{:else}
		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleSave();
			}}
			class="flex flex-col gap-4 py-1"
		>
			{#if error}
				<div class="rounded-xl border border-crimson/40 bg-crimson/10 p-2.5 text-xs text-crimson">
					{error}
				</div>
			{/if}

			<!-- Deck Name -->
			<TactileInput
				id="deck-name"
				label="Deck Name"
				bind:value={name}
				placeholder="e.g. TOPIK I Vocabulary, Essential Verbs"
				required
			/>

			<!-- Deck Type Selector (Segmented buttons) -->
			<div class="flex flex-col gap-1.5">
				<span class="text-xs font-semibold text-ink-secondary">Deck Category</span>
				<div class="grid grid-cols-2 gap-2">
					<button
						type="button"
						onclick={() => {
							selectionClick();
							type = 'vocabulary';
						}}
						class="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition active:scale-95 {type ===
						'vocabulary'
							? 'border-navy bg-navy/10 font-bold text-navy'
							: 'border-border-subtle bg-surface text-ink-secondary'}"
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
							<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
							<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
						</svg>
						<span>단어 · Vocabulary</span>
					</button>

					<button
						type="button"
						onclick={() => {
							selectionClick();
							type = 'grammar';
						}}
						class="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition active:scale-95 {type ===
						'grammar'
							? 'border-celadon bg-celadon/10 font-bold text-celadon'
							: 'border-border-subtle bg-surface text-ink-secondary'}"
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
							<path d="M12 20h9" />
							<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
						</svg>
						<span>문법 · Grammar</span>
					</button>
				</div>
			</div>

			<!-- Visibility / Privacy Toggle -->
			<div class="flex flex-col gap-1.5">
				<span class="text-xs font-semibold text-ink-secondary">Deck Visibility & Privacy</span>
				<div class="grid grid-cols-2 gap-2">
					<button
						type="button"
						onclick={() => {
							selectionClick();
							isPublic = false;
						}}
						class="flex min-h-[52px] flex-col items-start rounded-xl border p-2.5 text-left transition active:scale-95 {!isPublic
							? 'border-primary bg-primary/10 text-primary'
							: 'border-border-subtle bg-surface text-ink-secondary'}"
					>
						<div class="flex items-center gap-1.5 text-xs font-bold">
							<svg
								class="h-3.5 w-3.5"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
								<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
							</svg>
							<span>Private</span>
						</div>
						<p class="mt-0.5 text-[11px] leading-tight text-ink-muted">
							Only you & invited learners
						</p>
					</button>

					<button
						type="button"
						onclick={() => {
							selectionClick();
							isPublic = true;
						}}
						class="flex min-h-[52px] flex-col items-start rounded-xl border p-2.5 text-left transition active:scale-95 {isPublic
							? 'border-primary bg-primary/10 text-primary'
							: 'border-border-subtle bg-surface text-ink-secondary'}"
					>
						<div class="flex items-center gap-1.5 text-xs font-bold">
							<svg
								class="h-3.5 w-3.5"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<circle cx="12" cy="12" r="10"></circle>
								<line x1="2" y1="12" x2="22" y2="12"></line>
								<path
									d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
								></path>
							</svg>
							<span>Public</span>
						</div>
						<p class="mt-0.5 text-[11px] leading-tight text-ink-muted">
							Discoverable in public catalog
						</p>
					</button>
				</div>
			</div>

			<!-- Action Buttons -->
			<div class="mt-2 flex flex-col gap-2">
				<div class="flex items-center gap-2">
					<TactileButton type="button" variant="secondary" onclick={() => modal.close()} fullWidth>
						Cancel
					</TactileButton>
					<TactileButton type="submit" variant="primary" loading={isSaving} fullWidth>
						{isEditing ? 'Save Changes' : 'Create Deck'}
					</TactileButton>
				</div>

				{#if isEditing}
					<button
						type="button"
						onclick={() => (showDeleteConfirm = true)}
						class="py-1 text-center text-xs font-semibold text-crimson hover:underline"
					>
						Delete this deck
					</button>
				{/if}
			</div>
		</form>
	{/if}
</BottomSheet>
