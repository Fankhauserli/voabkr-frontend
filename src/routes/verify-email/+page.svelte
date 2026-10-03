<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { authApi } from '$lib/api/auth';
	import { auth } from '$lib/stores/auth.svelte';
	import TactileButton from '$lib/components/forms/TactileButton.svelte';

	let status = $state<'verifying' | 'success' | 'error'>('verifying');
	let errorMessage = $state<string | null>(null);

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
					class="h-10 w-10 animate-spin rounded-full border-2 border-terracotta border-t-transparent"
				></div>
				<p class="mt-4 text-sm font-semibold text-ink-primary">Verifying your email...</p>
			</div>
		{:else if status === 'success'}
			<div class="my-4">
				<div
					class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-celadon/15 text-2xl font-bold text-celadon"
				>
					✓
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
					<a href="/settings" class="block">
						<TactileButton variant="secondary" fullWidth>Go to Settings to Resend</TactileButton>
					</a>
					<a href="/" class="block">
						<TactileButton variant="ghost" fullWidth>Return Home</TactileButton>
					</a>
				</div>
			</div>
		{/if}
	</div>
</div>
