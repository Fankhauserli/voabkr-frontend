<script lang="ts">
	import { goto } from '$app/navigation';
	import { authApi } from '$lib/api/auth';
	import { auth } from '$lib/stores/auth.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import TactileInput from '$lib/components/forms/TactileInput.svelte';
	import TactileButton from '$lib/components/forms/TactileButton.svelte';
	import { selectionClick } from '$lib/utils/haptics';

	let activeTab = $state<'login' | 'register' | 'forgot'>('login');
	let name = $state('');
	let email = $state('');
	let password = $state('');
	let isLoading = $state(false);
	let errorMessage = $state<string | null>(null);
	let registeredUnverified = $state(false);
	let forgotSubmitted = $state(false);

	function switchTab(tab: 'login' | 'register' | 'forgot') {
		selectionClick();
		activeTab = tab;
		errorMessage = null;
		forgotSubmitted = false;
	}

	async function handleSubmit() {
		if (activeTab === 'forgot') {
			if (!email.trim() || !email.includes('@')) {
				errorMessage = 'Please provide a valid email address.';
				return;
			}
			isLoading = true;
			errorMessage = null;
			try {
				await authApi.forgotPassword(email.trim());
				forgotSubmitted = true;
				toast.success('Password reset instructions sent.');
			} catch (err: unknown) {
				errorMessage = err instanceof Error ? err.message : 'Failed to send reset link';
			} finally {
				isLoading = false;
			}
			return;
		}

		if (!email.trim() || !password) {
			errorMessage = 'Please provide both email and password.';
			return;
		}

		if (activeTab === 'register' && !name.trim()) {
			errorMessage = 'Please enter your name.';
			return;
		}

		isLoading = true;
		errorMessage = null;

		try {
			// Signing in changes who the session belongs to. Forget the previous
			// learner first, so that if the follow-up profile request fails before
			// the new learner is confirmed, the old learner's identity (and their
			// Queued Grades) cannot travel under the new session.
			auth.logout();

			if (activeTab === 'login') {
				await authApi.login({
					email: email.trim(),
					password
				});
				await auth.fetchUser();
				toast.success('Welcome back!');
				goto('/');
			} else {
				await authApi.register({
					name: name.trim(),
					email: email.trim(),
					password
				});
				await auth.fetchUser();
				registeredUnverified = true;
				toast.success('Account created successfully!');
				goto('/');
			}
		} catch (err: unknown) {
			errorMessage = err instanceof Error ? err.message : 'Authentication failed';
		} finally {
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>voabkr — Log In</title>
</svelte:head>

<div
	class="flex min-h-screen flex-col justify-center px-4 py-8"
	style="padding-top: calc(var(--safe-top) + 24px); padding-bottom: calc(var(--safe-bottom) + 24px);"
>
	<div class="mx-auto w-full max-w-sm">
		<!-- Hero Wordmark Section -->
		<div class="mb-8 text-center">
			<div
				class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-border-strong bg-surface shadow-xs"
			>
				<span class="text-2xl font-black text-primary">보</span>
			</div>
			<h1 class="text-3xl font-extrabold tracking-tight text-ink-primary">voabkr</h1>
			<p class="hangul-text mt-1 text-sm font-medium break-keep text-ink-secondary">
				보아봐 — 한국어 학습
			</p>
			<p class="mt-0.5 text-xs text-ink-muted">Tactile Korean Spaced Repetition Notebook</p>
		</div>

		<!-- Auth Card -->
		<div class="rounded-2xl border border-border-subtle bg-surface p-6 shadow-xs">
			<!-- Segmented Pill Switcher -->
			{#if activeTab !== 'forgot'}
				<div class="mb-6 grid grid-cols-2 rounded-xl border border-border-subtle bg-canvas p-1">
					<button
						type="button"
						onclick={() => switchTab('login')}
						class="min-h-[40px] rounded-lg text-xs font-bold transition {activeTab === 'login'
							? 'bg-surface text-ink-primary shadow-xs'
							: 'text-ink-secondary hover:text-ink-primary'}"
					>
						Log In
					</button>
					<button
						type="button"
						onclick={() => switchTab('register')}
						class="min-h-[40px] rounded-lg text-xs font-bold transition {activeTab === 'register'
							? 'bg-surface text-ink-primary shadow-xs'
							: 'text-ink-secondary hover:text-ink-primary'}"
					>
						Create Account
					</button>
				</div>
			{:else}
				<div class="mb-4 flex items-center justify-between border-b border-border-subtle pb-3">
					<div>
						<h2 class="text-base font-bold text-ink-primary">Reset Password</h2>
						<p class="text-xs text-ink-secondary">We'll email you a recovery link</p>
					</div>
					<button
						type="button"
						onclick={() => switchTab('login')}
						class="text-xs font-semibold text-ink-muted hover:text-ink-primary"
					>
						← Back to Log In
					</button>
				</div>
			{/if}

			{#if errorMessage}
				<div
					class="mb-4 rounded-xl border border-crimson/40 bg-crimson/10 p-3 text-xs text-crimson"
				>
					{errorMessage}
				</div>
			{/if}

			{#if registeredUnverified}
				<div class="mb-4 rounded-xl border border-amber/40 bg-amber/10 p-3 text-xs text-amber">
					We sent a verification link to your email. Please check your inbox to confirm your
					account.
				</div>
			{/if}

			{#if forgotSubmitted}
				<div
					class="rounded-xl border border-celadon/40 bg-celadon/10 p-3.5 text-xs leading-relaxed text-celadon"
				>
					<p class="font-bold">Check your inbox</p>
					<p class="mt-1">
						If an account exists for <span class="font-semibold">{email}</span>, a secure password
						reset link has been dispatched.
					</p>
					<div class="mt-4">
						<TactileButton variant="secondary" fullWidth onclick={() => switchTab('login')}>
							Return to Log In
						</TactileButton>
					</div>
				</div>
			{:else}
				<!-- Form Inputs -->
				<form
					onsubmit={(e) => {
						e.preventDefault();
						handleSubmit();
					}}
					class="flex flex-col gap-4"
				>
					{#if activeTab === 'register'}
						<TactileInput
							id="name"
							label="Full Name"
							bind:value={name}
							placeholder="Jane Doe"
							required
							autocomplete="name"
						/>
					{/if}

					<TactileInput
						id="email"
						label="Email Address"
						type="email"
						bind:value={email}
						placeholder="you@example.com"
						required
						autocomplete="email"
					/>

					{#if activeTab !== 'forgot'}
						<div class="flex flex-col gap-1.5">
							<TactileInput
								id="password"
								label="Password"
								type="password"
								bind:value={password}
								placeholder="••••••••"
								required
								autocomplete={activeTab === 'login' ? 'current-password' : 'new-password'}
							/>

							{#if activeTab === 'login'}
								<div class="flex justify-end">
									<button
										type="button"
										onclick={() => switchTab('forgot')}
										class="text-xs font-medium text-ink-muted transition hover:text-primary"
									>
										Forgot password?
									</button>
								</div>
							{/if}
						</div>
					{/if}

					{#if activeTab === 'register'}
						<p class="text-[11px] leading-relaxed text-ink-muted">
							By creating an account, you agree to our
							<a href="/terms" class="text-primary underline" target="_blank">Terms of Service</a>
							and
							<a href="/privacy" class="text-primary underline" target="_blank">Privacy Policy</a>.
						</p>
					{/if}

					<div class="mt-2">
						<TactileButton type="submit" variant="primary" loading={isLoading} fullWidth size="lg">
							{#if activeTab === 'login'}
								Log In
							{:else if activeTab === 'register'}
								Start Learning
							{:else}
								Send Reset Link
							{/if}
						</TactileButton>
					</div>
				</form>
			{/if}
		</div>

		<!-- Footer notice & legal links -->
		<div class="mt-6 flex flex-col items-center gap-2 text-center text-xs text-ink-muted">
			<p>Quiet Korean study companion. Designed for focused, distraction-free practice.</p>
			<div class="flex items-center gap-3 text-[11px]">
				<a href="/privacy" class="hover:text-ink-primary hover:underline">Privacy Policy</a>
				<span>·</span>
				<a href="/terms" class="hover:text-ink-primary hover:underline">Terms of Service</a>
				<span>·</span>
				<a href="/legal" class="hover:text-ink-primary hover:underline">Legal Notice</a>
			</div>
		</div>
	</div>
</div>
