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
	}

	let { onDeckSaved }: Props = $props();

	let name = $state('');
	let type = $state<DeckType>('vocabulary');
	let isSaving = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		if (modal.isDeckCreatorOpen) {
			if (modal.deckCreatorData?.deckToEdit) {
				name = modal.deckCreatorData.deckToEdit.name;
				type = modal.deckCreatorData.deckToEdit.type;
			} else {
				name = '';
				type = 'vocabulary';
			}
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
					type
				});
				toast.success('Deck updated successfully');
			} else {
				await deckApi.createDeck({
					name: name.trim(),
					type
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
</script>

<BottomSheet
	isOpen={modal.isDeckCreatorOpen}
	title={modal.deckCreatorData?.deckToEdit ? 'Edit Deck' : 'Create New Deck'}
	onClose={() => modal.close()}
>
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
					<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
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
					<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M12 20h9" />
						<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
					</svg>
					<span>문법 · Grammar</span>
				</button>
			</div>
		</div>

		<!-- Action Buttons -->
		<div class="mt-2 flex items-center gap-2">
			<TactileButton type="button" variant="secondary" onclick={() => modal.close()} fullWidth>
				Cancel
			</TactileButton>
			<TactileButton type="submit" variant="primary" loading={isSaving} fullWidth>
				{modal.deckCreatorData?.deckToEdit ? 'Save Changes' : 'Create Deck'}
			</TactileButton>
		</div>
	</form>
</BottomSheet>
