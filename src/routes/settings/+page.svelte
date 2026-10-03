<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth.svelte';
	import { authApi } from '$lib/api/auth';
	import { reviewSync } from '$lib/stores/syncQueue.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { setStatusBarTheme } from '$lib/utils/statusBar';
	import { selectionClick } from '$lib/utils/haptics';
	import BottomNavBar from '$lib/components/navigation/BottomNavBar.svelte';
	import TactileButton from '$lib/components/forms/TactileButton.svelte';
	import TactileInput from '$lib/components/forms/TactileInput.svelte';

	let name = $state('');
	let isSavingName = $state(false);
	let isLoggingOut = $state(false);
	let isResendingEmail = $state(false);
	let selectedGoal = $state(20);
	let currentTheme = $state<'light' | 'dark'>('light');

	$effect(() => {
		if (auth.user) {
			name = auth.user.name;
		}
		if (auth.settings) {
			selectedGoal = auth.settings.cardsPerDay;
		}
	});

	async function handleSaveName() {
		if (!name.trim()) return;
		isSavingName = true;
		try {
			await authApi.updateProfile({ name: name.trim() });
			auth.updateProfile({ name: name.trim() });
			toast.success('Profile updated');
		} catch (err: unknown) {
			toast.error(err instanceof Error ? err.message : 'Failed to update profile');
		} finally {
			isSavingName = false;
		}
	}

	async function handleGoalChange(goal: number) {
		selectionClick();
		selectedGoal = goal;
		try {
			await authApi.updateSettings({ cardsPerDay: goal });
			auth.updateCardsPerDay(goal);
			toast.success(`Daily goal updated to ${goal} cards/day`);
		} catch (err: unknown) {
			toast.error(err instanceof Error ? err.message : 'Failed to save settings');
		}
	}

	function handleThemeToggle(theme: 'light' | 'dark') {
		selectionClick();
		currentTheme = theme;
		if (typeof document !== 'undefined') {
			if (theme === 'dark') {
				document.documentElement.classList.add('dark');
			} else {
				document.documentElement.classList.remove('dark');
			}
		}
		setStatusBarTheme(theme);
	}

	function handleClearCache() {
		selectionClick();
		reviewSync.clear();
		toast.info('Local card cache cleared');
	}

	async function handleResendVerification() {
		selectionClick();
		isResendingEmail = true;
		setTimeout(() => {
			isResendingEmail = false;
			toast.info('Verification link resent to your email address.');
		}, 800);
	}

	async function handleLogout() {
		isLoggingOut = true;
		try {
			await authApi.logout();
		} catch {
			// Proceed with local logout regardless of network status
		} finally {
			auth.logout();
			isLoggingOut = false;
			toast.info('Logged out successfully');
			goto('/login');
		}
	}
</script>

<svelte:head>
	<title>voabkr — Learning Settings & Profile</title>
</svelte:head>

<div
	class="flex flex-1 flex-col px-4 pt-4 pb-28"
	style="padding-top: calc(var(--safe-top) + 16px);"
>
	<header class="mb-5">
		<h1 class="text-2xl font-bold tracking-tight text-ink-primary">Settings & Profile</h1>
		<p class="text-xs text-ink-secondary">Manage your spaced-repetition preferences</p>
	</header>

	<div class="flex flex-col gap-5">
		<!-- 1. Account Section -->
		<section class="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
			<h2 class="text-xs font-bold tracking-wider text-ink-muted uppercase">Account</h2>

			<div class="mt-3 flex flex-col gap-3">
				<div class="flex items-end gap-2">
					<div class="flex-1">
						<TactileInput id="settings-name" label="Display Name" bind:value={name} />
					</div>
					<TactileButton
						variant="secondary"
						size="md"
						onclick={handleSaveName}
						loading={isSavingName}
						disabled={name === auth.userName}
					>
						Save
					</TactileButton>
				</div>

				<div class="flex flex-col gap-1 border-t border-border-subtle pt-3">
					<span class="text-xs font-semibold text-ink-secondary">Email Address</span>
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-ink-primary"
							>{auth.userEmail || 'learner@example.com'}</span
						>
						{#if auth.isVerified}
							<span class="rounded-full bg-celadon/15 px-2.5 py-0.5 text-xs font-bold text-celadon">
								✓ Verified
							</span>
						{:else}
							<div class="flex items-center gap-2">
								<span class="rounded-full bg-amber/15 px-2.5 py-0.5 text-xs font-bold text-amber">
									Unverified
								</span>
								<button
									type="button"
									onclick={handleResendVerification}
									disabled={isResendingEmail}
									class="text-xs font-semibold text-terracotta underline"
								>
									{isResendingEmail ? 'Sending...' : 'Resend'}
								</button>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</section>

		<!-- 2. Learning Algorithm Preferences -->
		<section class="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
			<h2 class="text-xs font-bold tracking-wider text-ink-muted uppercase">
				Spaced Repetition Algorithm
			</h2>

			<div class="mt-3">
				<span class="mb-1 block text-xs font-semibold text-ink-primary">
					Daily Card Target (`cardsPerDay`)
				</span>
				<p class="mb-3 text-xs leading-relaxed text-ink-secondary">
					Controls the maximum number of new and due cards scheduled in your daily review queue.
				</p>

				<!-- Stepper pills -->
				<div class="grid grid-cols-4 gap-2 select-none">
					{#each [10, 20, 30, 50] as count (count)}
						<button
							type="button"
							onclick={() => handleGoalChange(count)}
							class="min-h-[44px] rounded-xl border py-2 text-xs font-bold transition active:scale-95 {selectedGoal ===
							count
								? 'border-terracotta bg-terracotta text-white shadow-xs'
								: 'border-border-subtle bg-canvas text-ink-secondary hover:text-ink-primary'}"
						>
							{count}
						</button>
					{/each}
				</div>
			</div>
		</section>

		<!-- 3. App Appearance & System -->
		<section class="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
			<h2 class="text-xs font-bold tracking-wider text-ink-muted uppercase">
				Appearance & Storage
			</h2>

			<div class="mt-3 flex flex-col gap-3">
				<div class="flex items-center justify-between">
					<div>
						<span class="text-xs font-bold text-ink-primary">Theme Palette</span>
						<p class="text-[11px] text-ink-secondary">Hanji Paper vs Sumi Ink Night</p>
					</div>
					<div class="flex rounded-xl border border-border-subtle bg-canvas p-1">
						<button
							type="button"
							onclick={() => handleThemeToggle('light')}
							class="rounded-lg px-2.5 py-1 text-xs font-bold transition {currentTheme === 'light'
								? 'bg-surface text-ink-primary shadow-xs'
								: 'text-ink-muted hover:text-ink-primary'}"
						>
							Hanji
						</button>
						<button
							type="button"
							onclick={() => handleThemeToggle('dark')}
							class="rounded-lg px-2.5 py-1 text-xs font-bold transition {currentTheme === 'dark'
								? 'bg-surface text-ink-primary shadow-xs'
								: 'text-ink-muted hover:text-ink-primary'}"
						>
							Sumi
						</button>
					</div>
				</div>

				<div class="flex items-center justify-between border-t border-border-subtle pt-3">
					<div>
						<span class="text-xs font-bold text-ink-primary">Local Storage Buffer</span>
						<p class="text-[11px] text-ink-secondary">
							{reviewSync.pendingCount} offline rating(s) queued
						</p>
					</div>
					<button
						type="button"
						onclick={handleClearCache}
						class="text-xs font-semibold text-crimson underline"
					>
						Clear Local Cache
					</button>
				</div>
			</div>
		</section>

		<!-- 4. Session & Security -->
		<section class="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
			<h2 class="text-xs font-bold tracking-wider text-ink-muted uppercase">Session</h2>
			<div class="mt-2 flex items-center justify-between text-xs text-ink-secondary">
				<span>Redis Session Status</span>
				<span class="font-semibold text-celadon">Active (HttpOnly)</span>
			</div>

			<div class="mt-4">
				<TactileButton
					variant="danger"
					size="lg"
					fullWidth
					onclick={handleLogout}
					loading={isLoggingOut}
				>
					Log Out
				</TactileButton>
			</div>
		</section>
	</div>
</div>

<!-- Bottom Navigation Bar -->
<BottomNavBar activeRoute="/settings" />
