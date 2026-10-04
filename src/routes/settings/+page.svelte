<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth.svelte';
	import { authApi } from '$lib/api/auth';
	import { reviewSync } from '$lib/stores/syncQueue.svelte';
	import { clientCache } from '$lib/api/cache';
	import { studySession } from '$lib/stores/study.svelte';
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
			if (auth.settings.studyDirection) {
				studySession.setStudyDirection(auth.settings.studyDirection, false);
			}
			if (typeof auth.settings.scratchPadEnabled === 'boolean') {
				studySession.setScratchPadEnabled(auth.settings.scratchPadEnabled, false);
			}
		}
	});

	async function handleDirectionChange(direction: 'koreanToEnglish' | 'englishToKorean') {
		selectionClick();
		studySession.setStudyDirection(direction, false);
		try {
			await authApi.updateSettings({ studyDirection: direction });
			auth.updateSettings({ studyDirection: direction });
			toast.success('Study direction preference saved');
		} catch (err: unknown) {
			toast.error(err instanceof Error ? err.message : 'Failed to save settings');
		}
	}

	async function handleScratchPadToggle() {
		selectionClick();
		const next = !studySession.scratchPadEnabled;
		studySession.setScratchPadEnabled(next, false);
		try {
			await authApi.updateSettings({ scratchPadEnabled: next });
			auth.updateSettings({ scratchPadEnabled: next });
			toast.success(next ? 'Scratch pad enabled' : 'Scratch pad disabled');
		} catch (err: unknown) {
			toast.error(err instanceof Error ? err.message : 'Failed to save settings');
		}
	}

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
		clientCache.clear();
		toast.info('Local card & deck cache cleared');
	}

	async function handleResendVerification() {
		selectionClick();
		isResendingEmail = true;
		try {
			const res = await authApi.resendVerification();
			toast.info(res.message || 'Verification link resent to your email address.');
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Failed to resend verification email.';
			toast.error(msg);
		} finally {
			isResendingEmail = false;
		}
	}

	function handleExportData() {
		selectionClick();
		const exportData = {
			exportDate: new Date().toISOString(),
			application: 'voabkr',
			user: auth.user,
			settings: auth.settings,
			pendingOfflineReviews: reviewSync.pendingCount
		};
		const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `voabkr-data-export-${new Date().toISOString().split('T')[0]}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		toast.success('Personal study data exported');
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
							<span
								class="inline-flex items-center gap-1 rounded-full bg-celadon/15 px-2.5 py-0.5 text-xs font-bold text-celadon"
							>
								<svg
									class="h-3 w-3"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="3"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<polyline points="20 6 9 17 4 12"></polyline>
								</svg>
								<span>Verified</span>
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
									class="text-xs font-semibold text-primary underline"
								>
									{isResendingEmail ? 'Sending...' : 'Resend'}
								</button>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</section>

		<!-- 2. Learning Preferences -->
		<section class="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
			<h2 class="text-xs font-bold tracking-wider text-ink-muted uppercase">Study Preferences</h2>

			<div class="mt-3">
				<span class="mb-1 block text-xs font-semibold text-ink-primary"> Daily Review Target </span>
				<p class="mb-3 text-xs leading-relaxed text-ink-secondary">
					Choose how many cards to study and review each day.
				</p>

				<!-- Stepper pills -->
				<div class="grid grid-cols-4 gap-2">
					{#each [10, 20, 30, 50] as count (count)}
						<button
							type="button"
							onclick={() => handleGoalChange(count)}
							class="min-h-[44px] rounded-xl border py-2 text-xs font-bold transition active:scale-95 {selectedGoal ===
							count
								? 'border-primary bg-primary text-white shadow-xs'
								: 'border-border-subtle bg-canvas text-ink-secondary hover:text-ink-primary'}"
						>
							{count}
						</button>
					{/each}
				</div>

				<!-- Study Direction selector -->
				<div class="mt-4 border-t border-border-subtle pt-3">
					<span class="mb-1 block text-xs font-semibold text-ink-primary">
						Flashcard Direction (학습 방향)
					</span>
					<p class="mb-3 text-xs leading-relaxed text-ink-secondary">
						Choose whether cards prompt you with Korean or English first.
					</p>

					<div class="grid grid-cols-2 gap-2">
						<button
							type="button"
							onclick={() => handleDirectionChange('koreanToEnglish')}
							class="flex min-h-[48px] flex-col items-center justify-center rounded-xl border p-2 text-xs font-bold transition active:scale-95 {studySession.studyDirection ===
							'koreanToEnglish'
								? 'border-primary bg-primary text-white shadow-xs'
								: 'border-border-subtle bg-canvas text-ink-secondary hover:text-ink-primary'}"
						>
							<span class="inline-flex items-center gap-1.5">
								<span>한국어</span>
								<svg
									class="h-3 w-3"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.5"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<polyline points="9 18 15 12 9 6"></polyline>
								</svg>
								<span>English</span>
							</span>
							<span class="mt-0.5 text-[10px] font-normal opacity-80">Korean Prompt</span>
						</button>
						<button
							type="button"
							onclick={() => handleDirectionChange('englishToKorean')}
							class="flex min-h-[48px] flex-col items-center justify-center rounded-xl border p-2 text-xs font-bold transition active:scale-95 {studySession.studyDirection ===
							'englishToKorean'
								? 'border-primary bg-primary text-white shadow-xs'
								: 'border-border-subtle bg-canvas text-ink-secondary hover:text-ink-primary'}"
						>
							<span class="inline-flex items-center gap-1.5">
								<span>English</span>
								<svg
									class="h-3 w-3"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.5"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<polyline points="9 18 15 12 9 6"></polyline>
								</svg>
								<span>한국어</span>
							</span>
							<span class="mt-0.5 text-[10px] font-normal opacity-80">English Prompt</span>
						</button>
					</div>
				</div>

				<!-- iPad Apple Pencil / Stylus Scratch Pad setting -->
				<div class="mt-4 border-t border-border-subtle pt-3">
					<div class="flex items-center justify-between gap-3">
						<div class="flex-1">
							<span class="block text-xs font-semibold text-ink-primary">
								Handwriting Scratch Pad (연습장)
							</span>
							<p class="text-xs leading-relaxed text-ink-secondary">
								Draw or practice writing Hangul syllables with Apple Pencil or finger. Clears
								automatically after each card.
							</p>
						</div>
						<button
							type="button"
							role="switch"
							aria-checked={studySession.scratchPadEnabled}
							onclick={handleScratchPadToggle}
							class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out {studySession.scratchPadEnabled
								? 'bg-primary'
								: 'bg-border-subtle'}"
							aria-label="Toggle iPad Scratch Pad"
						>
							<span
								class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out {studySession.scratchPadEnabled
									? 'translate-x-5'
									: 'translate-x-0'}"
							></span>
						</button>
					</div>
				</div>
			</div>
		</section>

		<!-- 3. App Appearance & Offline Data -->
		<section class="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
			<h2 class="text-xs font-bold tracking-wider text-ink-muted uppercase">Display & Storage</h2>

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
						<span class="text-xs font-bold text-ink-primary">Offline Study Data</span>
						<p class="text-[11px] text-ink-secondary">
							{reviewSync.pendingCount === 0
								? 'All reviews synced'
								: `${reviewSync.pendingCount} review(s) pending sync`}
						</p>
					</div>
					<button
						type="button"
						onclick={handleClearCache}
						class="text-xs font-semibold text-crimson underline"
					>
						Reset Local Data
					</button>
				</div>
			</div>
		</section>

		<!-- 4. Privacy & Data Rights (GDPR & Swiss revDSG) -->
		<section class="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
			<h2 class="text-xs font-bold tracking-wider text-ink-muted uppercase">
				Privacy & Data Rights
			</h2>
			<div class="mt-3 flex flex-col gap-3">
				<div class="flex items-center justify-between">
					<div>
						<span class="text-xs font-bold text-ink-primary">Export Study Data</span>
						<p class="text-[11px] text-ink-secondary">
							Download a copy of your personal study data (JSON)
						</p>
					</div>
					<button
						type="button"
						onclick={handleExportData}
						class="rounded-xl border border-border-strong bg-canvas px-3 py-1.5 text-xs font-semibold text-ink-primary transition hover:border-primary active:scale-95"
					>
						Export Data
					</button>
				</div>

				<div class="flex items-center justify-between border-t border-border-subtle pt-3">
					<div>
						<span class="text-xs font-bold text-ink-primary">Account Deletion</span>
						<p class="text-[11px] text-ink-secondary">
							Permanently delete your account and records
						</p>
					</div>
					<a
						href="mailto:privacy@voyagera.ch?subject=Account%20Deletion%20Request"
						class="text-xs font-semibold text-crimson underline"
					>
						Request Erasure
					</a>
				</div>
			</div>
		</section>

		<!-- 5. Legal Notices -->
		<section class="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
			<h2 class="text-xs font-bold tracking-wider text-ink-muted uppercase">Legal & Compliance</h2>
			<div class="mt-2 flex flex-col divide-y divide-border-subtle text-xs">
				<a
					href="/privacy"
					class="flex items-center justify-between py-2.5 font-medium text-ink-primary hover:text-primary"
				>
					<span>Privacy Policy (개인정보처리방침)</span>
					<span class="text-ink-muted">→</span>
				</a>
				<a
					href="/terms"
					class="flex items-center justify-between py-2.5 font-medium text-ink-primary hover:text-primary"
				>
					<span>Terms of Service (이용약관)</span>
					<span class="text-ink-muted">→</span>
				</a>
				<a
					href="/legal"
					class="flex items-center justify-between py-2.5 font-medium text-ink-primary hover:text-primary"
				>
					<span>Legal Notice & Impressum (법적 고지)</span>
					<span class="text-ink-muted">→</span>
				</a>
			</div>
		</section>

		<!-- 6. Account Actions -->
		<section class="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
			<h2 class="text-xs font-bold tracking-wider text-ink-muted uppercase">Sign Out</h2>
			<div class="mt-3">
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
