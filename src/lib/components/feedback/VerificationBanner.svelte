<script lang="ts">
	import { authApi } from '$lib/api/auth';
	import { auth } from '$lib/stores/auth.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { selectionClick } from '$lib/utils/haptics';

	let isResending = $state(false);

	async function handleResend() {
		selectionClick();
		isResending = true;
		try {
			const res = await authApi.resendVerification();
			toast.info(res.message || 'Verification link resent. Please check your inbox.');
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Failed to resend verification email.';
			toast.error(msg);
		} finally {
			isResending = false;
		}
	}
</script>

{#if auth.isAuthenticated && !auth.isVerified}
	<div
		class="mx-auto mb-4 max-w-lg rounded-xl border border-amber/40 bg-amber/10 p-3 text-ink-primary shadow-xs"
		role="alert"
	>
		<div class="flex items-start gap-3">
			<div class="mt-0.5 text-amber">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					viewBox="0 0 20 20"
					fill="currentColor"
				>
					<path
						fill-rule="evenodd"
						d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
						clip-rule="evenodd"
					/>
				</svg>
			</div>
			<div class="flex-1">
				<p class="text-xs font-semibold text-amber">Email Unverified</p>
				<p class="mt-0.5 text-xs leading-relaxed text-ink-secondary">
					We sent a verification link to your email. Please click the link to confirm your account
					and safeguard your study progress.
				</p>
				<div class="mt-2 flex items-center gap-2">
					<button
						type="button"
						onclick={handleResend}
						disabled={isResending}
						class="rounded-md border border-amber/50 bg-surface px-2.5 py-1 text-xs font-medium text-amber transition active:scale-95 disabled:opacity-50"
					>
						{isResending ? 'Resending...' : 'Resend Link'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
