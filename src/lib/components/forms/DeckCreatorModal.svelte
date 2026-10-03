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
					class="min-h-[48px] rounded-xl border p-2.5 text-xs font-semibold transition active:scale-95 {type ===
					'vocabulary'
						? 'border-navy bg-navy/10 font-bold text-navy'
						: 'border-border-subtle bg-surface text-ink-secondary'}"
				>
					📘 Vocabulary
				</button>

				<button
					type="button"
					onclick={() => {
						selectionClick();
						type = 'grammar';
					}}
					class="min-h-[48px] rounded-xl border p-2.5 text-xs font-semibold transition active:scale-95 {type ===
					'grammar'
						? 'border-celadon bg-celadon/10 font-bold text-celadon'
						: 'border-border-subtle bg-surface text-ink-secondary'}"
				>
					📗 Grammar
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
