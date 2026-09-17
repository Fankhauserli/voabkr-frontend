<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { login } from '$lib/api/auth';

	let email = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let rememberMe = $state(false);
	let isLoading = $state(false);
	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		errorMessage = null;
		successMessage = null;

		const trimmedEmail = email.trim();
		if (!trimmedEmail) {
			errorMessage = 'Please enter your email address.';
			return;
		}

		if (!password) {
			errorMessage = 'Please enter your password.';
			return;
		}

		isLoading = true;

		try {
			const result = await login({
				email: trimmedEmail,
				password
			});

			if (result.success) {
				successMessage = 'Login successful! Redirecting...';
				setTimeout(() => {
					goto(resolve('/'));
				}, 600);
			} else {
				errorMessage = result.error || 'Failed to sign in. Please check your credentials.';
			}
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
		} finally {
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Sign In · voabkr</title>
</svelte:head>

<div
	class="flex min-h-screen items-center justify-center bg-linear-to-br from-slate-900 via-indigo-950 to-slate-900 px-4 py-12 sm:px-6 lg:px-8"
>
	<div class="w-full max-w-md space-y-8">
		<!-- Header / Logo -->
		<div class="text-center">
			<a
				href={resolve('/')}
				class="inline-flex items-center gap-2 transition-transform hover:scale-105"
			>
				<div
					class="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
						/>
					</svg>
				</div>
				<div class="text-left">
					<span class="block text-2xl font-black tracking-tight text-white">voabkr</span>
					<span class="block text-xs font-semibold tracking-widest text-indigo-400 uppercase"
						>한국어 단어장</span
					>
				</div>
			</a>
			<h1 class="mt-6 text-2xl font-bold tracking-tight text-white sm:text-3xl">Welcome back</h1>
			<p class="mt-2 text-sm text-slate-400">Sign in to resume your Korean vocabulary practice</p>
		</div>

		<!-- Card -->
		<div
			class="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl"
		>
			<!-- Error Alert -->
			{#if errorMessage}
				<div
					class="mb-6 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-300"
					role="alert"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="mt-0.5 h-5 w-5 shrink-0 text-rose-400"
						viewBox="0 0 20 20"
						fill="currentColor"
					>
						<path
							fill-rule="evenodd"
							d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
							clip-rule="evenodd"
						/>
					</svg>
					<div class="text-sm">
						<p class="font-medium text-rose-200">Sign in error</p>
						<p class="mt-0.5">{errorMessage}</p>
					</div>
				</div>
			{/if}

			<!-- Success Alert -->
			{#if successMessage}
				<div
					class="mb-6 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300"
					role="status"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="mt-0.5 h-5 w-5 shrink-0 text-emerald-400"
						viewBox="0 0 20 20"
						fill="currentColor"
					>
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
							clip-rule="evenodd"
						/>
					</svg>
					<div class="text-sm font-medium text-emerald-200">
						{successMessage}
					</div>
				</div>
			{/if}

			<form onsubmit={handleSubmit} class="space-y-5">
				<!-- Email Field -->
				<div>
					<label for="login-email" class="block text-sm font-medium text-slate-200">
						Email address
					</label>
					<div class="relative mt-1.5">
						<div
							class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-5 w-5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="1.75"
									d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
								/>
							</svg>
						</div>
						<input
							id="login-email"
							name="email"
							type="email"
							autocomplete="email"
							required
							bind:value={email}
							placeholder="you@example.com"
							class="block w-full rounded-xl border border-slate-700 bg-slate-800/60 py-2.5 pr-4 pl-10 text-white placeholder-slate-500 transition focus:border-indigo-500 focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:outline-hidden sm:text-sm"
							disabled={isLoading}
						/>
					</div>
				</div>

				<!-- Password Field -->
				<div>
					<div class="flex items-center justify-between">
						<label for="login-password" class="block text-sm font-medium text-slate-200">
							Password
						</label>
					</div>
					<div class="relative mt-1.5">
						<div
							class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-5 w-5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="1.75"
									d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
								/>
							</svg>
						</div>
						<input
							id="login-password"
							name="password"
							type={showPassword ? 'text' : 'password'}
							autocomplete="current-password"
							required
							bind:value={password}
							placeholder="••••••••"
							class="block w-full rounded-xl border border-slate-700 bg-slate-800/60 py-2.5 pr-11 pl-10 text-white placeholder-slate-500 transition focus:border-indigo-500 focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:outline-hidden sm:text-sm"
							disabled={isLoading}
						/>
						<button
							type="button"
							class="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-500 hover:text-slate-300 focus:outline-hidden"
							onclick={() => (showPassword = !showPassword)}
							aria-label={showPassword ? 'Hide password' : 'Show password'}
						>
							{#if showPassword}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-5 w-5"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="1.75"
										d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
									/>
								</svg>
							{:else}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-5 w-5"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="1.75"
										d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
									/>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="1.75"
										d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
									/>
								</svg>
							{/if}
						</button>
					</div>
				</div>

				<!-- Remember me -->
				<div class="flex items-center justify-between">
					<label class="flex items-center gap-2 text-sm text-slate-400">
						<input
							type="checkbox"
							bind:checked={rememberMe}
							class="h-4 w-4 rounded-md border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900"
						/>
						Remember me
					</label>
				</div>

				<!-- Submit button -->
				<button
					type="submit"
					disabled={isLoading}
					class="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-500 hover:shadow-indigo-500/40 focus:ring-2 focus:ring-indigo-500/50 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-60"
				>
					{#if isLoading}
						<svg
							class="h-5 w-5 animate-spin text-white"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
						<span>Signing in...</span>
					{:else}
						<span>Sign in</span>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4 transition-transform group-hover:translate-x-0.5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M14 5l7 7m0 0l-7 7m7-7H3"
							/>
						</svg>
					{/if}
				</button>
			</form>
		</div>

		<!-- Footer Link to Signup -->
		<p class="text-center text-sm text-slate-400">
			Don't have an account yet?
			<a
				href={resolve('/signup')}
				class="font-semibold text-indigo-400 hover:text-indigo-300 hover:underline"
			>
				Create an account
			</a>
		</p>
	</div>
</div>
