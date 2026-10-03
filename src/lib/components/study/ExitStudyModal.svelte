<script lang="ts">
	import BottomSheet from '$lib/components/forms/BottomSheet.svelte';
	import TactileButton from '$lib/components/forms/TactileButton.svelte';
	import { modal } from '$lib/stores/modal.svelte';

	function handleConfirm() {
		const action = modal.exitStudyConfirmData?.onConfirm;
		modal.close();
		action?.();
	}
</script>

<BottomSheet
	isOpen={modal.isExitStudyConfirmOpen}
	title="Exit Study Session?"
	onClose={() => modal.close()}
>
	<div class="flex flex-col gap-4 py-2">
		<p class="text-sm leading-relaxed text-ink-secondary">
			You have an active review session in progress. Your reviewed ratings so far have been saved,
			but the remaining cards will stay due in your queue.
		</p>

		<div class="mt-2 flex items-center gap-2">
			<TactileButton type="button" variant="secondary" onclick={() => modal.close()} fullWidth>
				Continue Studying
			</TactileButton>
			<TactileButton type="button" variant="danger" onclick={handleConfirm} fullWidth>
				Exit Session
			</TactileButton>
		</div>
	</div>
</BottomSheet>
