<script lang="ts">
	import type { DeckType } from '$lib/types';

	interface Props {
		type: DeckType;
	}

	let { type }: Props = $props();

	let isVocab = $derived(type === 'vocabulary');
</script>

<span
	class="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold tracking-wider uppercase {isVocab
		? 'border-navy/30 bg-navy/10 text-navy'
		: 'border-celadon/30 bg-celadon/10 text-celadon'}"
>
	{isVocab ? 'Vocabulary' : 'Grammar'}
</span>
