<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { authApi } from '$lib/api/auth';
	import { auth } from '$lib/stores/auth.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { selectionClick } from '$lib/utils/haptics';
	import TactileButton from '$lib/components/forms/TactileButton.svelte';

	let status = $state<'verifying' | 'success' | 'error'>('verifying');
	let errorMessage = $state<string | null>(null);
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

	onMount(async () => {
		const token = page.url.searchParams.get('token');
		if (!token) {
			status = 'error';
			errorMessage = 'Missing verification token in link.';
			return;
		}

		try {
			await authApi.verifyEmail(token);
			status = 'success';
			auth.setVerified(true);
		} catch (err: unknown) {
			status = 'error';
			errorMessage =
				err instanceof Error ? err.message : 'Verification link is invalid or expired.';
		}
	});
</script>

<svelte:head>
	<title>voabkr — Email Verification</title>
</svelte:head>

<div
	class="flex min-h-screen flex-col items-center justify-center px-4 py-8"
	style="padding-top: calc(var(--safe-top) + 24px); padding-bottom: calc(var(--safe-bottom) + 24px);"
>
	<div
		class="mx-auto w-full max-w-sm rounded-2xl border border-border-subtle bg-surface p-6 text-center shadow-xs"
	>
		{#if status === 'verifying'}
			<div class="my-6 flex flex-col items-center justify-center">
				<div
					class="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent"
				></div>
				<p class="mt-4 text-sm font-semibold text-ink-primary">Verifying your email...</p>
			</div>
		{:else if status === 'success'}
			<div class="my-4">
				<div
					class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-celadon/15 text-celadon"
				>
					<svg
						class="h-7 w-7"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<polyline points="20 6 9 17 4 12"></polyline>
					</svg>
				</div>
				<h2 class="text-xl font-bold text-ink-primary">Email Verified!</h2>
				<p class="mt-2 text-xs leading-relaxed text-ink-secondary">
					Your account is now fully verified. Your spaced-repetition progress and decks are securely
					protected.
				</p>
				<div class="mt-6">
					<a href="/" class="block">
						<TactileButton variant="primary" fullWidth>Continue to Dashboard</TactileButton>
					</a>
				</div>
			</div>
		{:else}
			<div class="my-4">
				<div
					class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-crimson/15 text-2xl font-bold text-crimson"
				>
					!
				</div>
				<h2 class="text-xl font-bold text-ink-primary">Verification Failed</h2>
				<p class="mt-2 text-xs leading-relaxed text-crimson">
					{errorMessage}
				</p>
				<div class="mt-6 flex flex-col gap-2">
					{#if auth.isAuthenticated}
						<TactileButton
							variant="primary"
							fullWidth
							onclick={handleResend}
							disabled={isResending}
						>
							{isResending ? 'Resending...' : 'Resend Verification Link'}
						</TactileButton>
					{:else}
						<a href="/login" class="block">
							<TactileButton variant="primary" fullWidth>Log in to Resend</TactileButton>
						</a>
					{/if}
					<a href="/settings" class="block">
						<TactileButton variant="secondary" fullWidth>Go to Settings</TactileButton>
					</a>
					<a href="/" class="block">
						<TactileButton variant="ghost" fullWidth>Return Home</TactileButton>
					</a>
				</div>
			</div>
		{/if}
	</div>
</div>
