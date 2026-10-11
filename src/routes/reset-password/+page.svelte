<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { authApi } from '$lib/api/auth';
	import { toast } from '$lib/stores/toast.svelte';
	import TactileInput from '$lib/components/forms/TactileInput.svelte';
	import TactileButton from '$lib/components/forms/TactileButton.svelte';
	import SEO from '$lib/components/seo/SEO.svelte';

	let token = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let isLoading = $state(false);
	let errorMessage = $state<string | null>(null);

	$effect(() => {
		const paramToken = page.params.token ?? page.url.searchParams.get('token');
		if (paramToken && !token) {
			token = paramToken;
		}
	});

	async function handleResetPassword() {
		if (!token.trim()) {
			errorMessage = 'Missing password reset token.';
			return;
		}

		if (!newPassword || newPassword.length < 8) {
			errorMessage = 'Password must be at least 8 characters.';
			return;
		}

		if (newPassword !== confirmPassword) {
			errorMessage = 'Passwords do not match.';
			return;
		}

		isLoading = true;
		errorMessage = null;

		try {
			await authApi.resetPassword(token.trim(), newPassword);
			toast.success('Password successfully reset! Please log in.');
			goto('/login');
		} catch (err: unknown) {
			errorMessage = err instanceof Error ? err.message : 'Failed to reset password';
		} finally {
			isLoading = false;
		}
	}
</script>

<SEO
	title="Reset Password · voabkr"
	description="Set a new password for your voabkr Korean study companion account."
/>

<div
	class="flex min-h-screen flex-col justify-center px-4 py-8"
	style="padding-top: calc(var(--safe-top) + 24px); padding-bottom: calc(var(--safe-bottom) + 24px);"
>
	<div class="mx-auto w-full max-w-sm">
		<!-- Brand Header -->
		<div class="mb-8 text-center">
			<a href="/" class="inline-flex items-center gap-2.5">
				<div
					class="flex h-12 w-12 items-center justify-center rounded-2xl border border-border-strong bg-surface shadow-xs"
				>
					<span class="font-hangul text-xl font-black text-primary">보</span>
				</div>
				<span class="font-hangul text-2xl font-bold tracking-tight text-ink-primary">voabkr</span>
			</a>
			<p class="mt-2 text-xs text-ink-secondary">Set a new account password</p>
		</div>

		<!-- Card -->
		<div class="rounded-2xl border border-border-subtle bg-surface p-6 shadow-xs">
			{#if errorMessage}
				<div
					class="mb-4 rounded-xl border border-crimson/40 bg-crimson/10 p-3 text-xs text-crimson"
				>
					{errorMessage}
				</div>
			{/if}

			{#if !token}
				<div
					class="mb-4 rounded-xl border border-amber/40 bg-amber/10 p-3 text-xs leading-relaxed text-amber"
				>
					Please provide the reset token sent to your email, or click the full link in the email.
				</div>
			{/if}

			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleResetPassword();
				}}
				class="flex flex-col gap-4"
			>
				{#if !page.url.searchParams.get('token') && !page.params.token}
					<TactileInput
						id="reset-token"
						label="Reset Token"
						bind:value={token}
						placeholder="e.g. sec_token_..."
						required
					/>
				{/if}

				<TactileInput
					id="new-password"
					label="New Password"
					type="password"
					bind:value={newPassword}
					placeholder="Minimum 8 characters"
					required
					autocomplete="new-password"
				/>

				<TactileInput
					id="confirm-password"
					label="Confirm Password"
					type="password"
					bind:value={confirmPassword}
					placeholder="••••••••"
					required
					autocomplete="new-password"
				/>

				<div class="mt-2">
					<TactileButton type="submit" variant="primary" loading={isLoading} fullWidth size="lg">
						Update Password
					</TactileButton>
				</div>
			</form>
		</div>

		<div class="mt-4 text-center">
			<a href="/login" class="text-xs text-ink-secondary hover:text-ink-primary hover:underline">
				← Back to Log In
			</a>
		</div>
	</div>
</div>
