<script lang="ts">
	import BottomSheet from './BottomSheet.svelte';
	import TactileInput from './TactileInput.svelte';
	import TactileButton from './TactileButton.svelte';
	import { modal } from '$lib/stores/modal.svelte';
	import { cardApi } from '$lib/api/cards';
	import { deckApi } from '$lib/api/decks';
	import { toast } from '$lib/stores/toast.svelte';
	import type { Deck } from '$lib/types';

	interface Props {
		onCardSaved?: () => void;
	}

	let { onCardSaved }: Props = $props();

	let decks = $state<Deck[]>([]);
	let selectedDeckId = $state<number>(0);
	let koreanWord = $state('');
	let englishWord = $state('');
	let context = $state('');
	let example = $state('');
	let isSaving = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		if (modal.isCardCreatorOpen) {
			loadDecks();
			if (modal.cardCreatorData?.cardToEdit) {
				const c = modal.cardCreatorData.cardToEdit;
				selectedDeckId = c.deckId;
				koreanWord = c.koreanWord;
				englishWord = c.englishWord;
				context = c.context;
				example = c.example;
			} else {
				selectedDeckId = modal.cardCreatorData?.deckId ?? 0;
				koreanWord = '';
				englishWord = '';
				context = '';
				example = '';
			}
			error = null;
		}
	});

	async function loadDecks() {
		try {
			decks = await deckApi.getDecks();
			if (decks.length > 0 && selectedDeckId === 0) {
				selectedDeckId = decks[0].id;
			}
		} catch {
			decks = [];
		}
	}

	async function handleSave(addAnother = false) {
		if (!koreanWord.trim() || !englishWord.trim()) {
			error = 'Korean word and English translation are required.';
			return;
		}
		if (selectedDeckId === 0 && decks.length > 0) {
			selectedDeckId = decks[0].id;
		}
		if (selectedDeckId === 0) {
			error = 'Please create a deck first before adding cards.';
			return;
		}

		isSaving = true;
		error = null;
		try {
			if (modal.cardCreatorData?.cardToEdit) {
				await cardApi.updateCard(modal.cardCreatorData.cardToEdit.id, {
					deckId: selectedDeckId,
					koreanWord: koreanWord.trim(),
					englishWord: englishWord.trim(),
					context: context.trim(),
					example: example.trim()
				});
				toast.success('Card updated successfully');
				modal.close();
				onCardSaved?.();
			} else {
				await cardApi.createCard({
					deckId: selectedDeckId,
					koreanWord: koreanWord.trim(),
					englishWord: englishWord.trim(),
					context: context.trim(),
					example: example.trim()
				});
				toast.success('Card created successfully');
				onCardSaved?.();

				if (addAnother) {
					koreanWord = '';
					englishWord = '';
					context = '';
					example = '';
				} else {
					modal.close();
				}
			}
		} catch (err: unknown) {
			error = err instanceof Error ? err.message : 'Failed to save card';
		} finally {
			isSaving = false;
		}
	}
</script>

<BottomSheet
	isOpen={modal.isCardCreatorOpen}
	title={modal.cardCreatorData?.cardToEdit ? 'Edit Card' : 'New Flashcard'}
	onClose={() => modal.close()}
>
	<form
		onsubmit={(e) => {
			e.preventDefault();
			handleSave(false);
		}}
		class="flex flex-col gap-3.5 py-1"
	>
		{#if error}
			<div class="rounded-xl border border-crimson/40 bg-crimson/10 p-2.5 text-xs text-crimson">
				{error}
			</div>
		{/if}

		<!-- Deck Selector -->
		<div class="flex flex-col gap-1.5">
			<label for="deck-select" class="text-xs font-semibold text-ink-secondary">Select Deck</label>
			<select
				id="deck-select"
				bind:value={selectedDeckId}
				class="min-h-[48px] rounded-xl border border-border-strong bg-surface px-3 py-2 text-sm text-ink-primary focus:border-terracotta focus:outline-none"
			>
				{#each decks as d (d.id)}
					<option value={d.id}>{d.name} ({d.type})</option>
				{/each}
			</select>
		</div>

		<!-- Korean Word Input -->
		<TactileInput
			id="korean-word"
			label="Korean Word (한국어)"
			bind:value={koreanWord}
			placeholder="e.g. 도서관, 가다, 먹다"
			isKoreanIme={true}
			required
		/>

		<!-- English Meaning Input -->
		<TactileInput
			id="english-word"
			label="English Meaning"
			bind:value={englishWord}
			placeholder="e.g. Library, to go, to eat"
			required
		/>

		<!-- Context / Part of Speech -->
		<TactileInput
			id="card-context"
			label="Context / Part of Speech (Optional)"
			bind:value={context}
			placeholder="e.g. Place / Noun, Formal Verb Ending"
		/>

		<!-- Example Sentence Textarea -->
		<div class="flex flex-col gap-1.5">
			<label for="card-example" class="text-xs font-semibold text-ink-secondary">
				Example Sentence (문장)
			</label>
			<textarea
				id="card-example"
				bind:value={example}
				placeholder="도서관에서 한국어 책을 읽어요. (I read Korean books at the library.)"
				rows="3"
				class="hangul-text w-full rounded-xl border border-border-strong bg-surface p-3 text-sm break-keep text-ink-primary transition placeholder:text-ink-muted focus:border-terracotta focus:outline-none"
			></textarea>
		</div>

		<!-- Live Preview Card -->
		<div class="mt-2 rounded-xl border border-border-subtle bg-surface-elevated p-3">
			<p class="text-[11px] font-bold tracking-wider text-ink-muted uppercase">Live Preview</p>
			<div class="mt-2 rounded-lg border border-border-subtle bg-surface p-3 text-center">
				<p class="text-xs text-ink-secondary">{context || 'Context'}</p>
				<p class="hangul-text my-1 text-2xl font-bold break-keep text-ink-primary">
					{koreanWord || '한국어'}
				</p>
				<p class="text-sm font-medium text-ink-secondary">{englishWord || 'English translation'}</p>
				{#if example}
					<p
						class="hangul-text mt-2 border-t border-border-subtle pt-1 text-xs break-keep text-ink-muted"
					>
						"{example}"
					</p>
				{/if}
			</div>
		</div>

		<!-- Action Buttons -->
		<div class="mt-3 flex items-center gap-2">
			{#if !modal.cardCreatorData?.cardToEdit}
				<TactileButton
					type="button"
					variant="secondary"
					onclick={() => handleSave(true)}
					disabled={isSaving}
					fullWidth
				>
					Save & Add Another
				</TactileButton>
			{/if}
			<TactileButton type="submit" variant="primary" loading={isSaving} fullWidth>
				{modal.cardCreatorData?.cardToEdit ? 'Save Changes' : 'Save Card'}
			</TactileButton>
		</div>
	</form>
</BottomSheet>
