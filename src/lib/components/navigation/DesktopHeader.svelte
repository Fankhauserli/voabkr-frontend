<script lang="ts">
	import { page } from '$app/state';
	import { auth } from '$lib/stores/auth.svelte';
	import TactileButton from '$lib/components/forms/TactileButton.svelte';

	let currentPath = $derived(page.url.pathname);
	let userInitial = $derived(auth.userName ? auth.userName[0].toUpperCase() : 'V');
</script>

<header
	class="sticky top-0 z-30 hidden w-full border-b border-border-subtle bg-surface/90 backdrop-blur-md md:block"
	style="padding-top: var(--safe-top);"
	aria-label="Desktop Navigation"
>
	<div class="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
		<!-- Brand Logo -->
		<a href="/" class="flex items-center gap-2.5 transition active:scale-98">
			<div
				class="flex h-10 w-10 items-center justify-center rounded-xl border border-border-strong bg-canvas shadow-2xs"
			>
				<span class="font-hangul text-lg font-black text-primary">보</span>
			</div>
			<div class="flex items-baseline gap-1.5">
				<span class="font-hangul text-lg font-black tracking-tight text-ink-primary">voabkr</span>
				<span class="font-hangul text-xs font-semibold text-ink-muted">단어장</span>
			</div>
		</a>

		<!-- Navigation Links -->
		<nav class="flex items-center gap-1.5" aria-label="Main Menu">
			<a
				href="/"
				class="rounded-xl px-3.5 py-2 text-xs font-bold transition {currentPath === '/'
					? 'bg-canvas text-primary shadow-2xs'
					: 'text-ink-secondary hover:text-ink-primary'}"
				aria-current={currentPath === '/' ? 'page' : undefined}
			>
				Today
			</a>

			<a
				href="/decks"
				class="rounded-xl px-3.5 py-2 text-xs font-bold transition {currentPath.startsWith('/decks')
					? 'bg-canvas text-primary shadow-2xs'
					: 'text-ink-secondary hover:text-ink-primary'}"
				aria-current={currentPath.startsWith('/decks') ? 'page' : undefined}
			>
				Decks
			</a>

			{#if auth.isAuthenticated}
				<a
					href="/settings"
					class="rounded-xl px-3.5 py-2 text-xs font-bold transition {currentPath.startsWith(
						'/settings'
					)
						? 'bg-canvas text-primary shadow-2xs'
						: 'text-ink-secondary hover:text-ink-primary'}"
					aria-current={currentPath.startsWith('/settings') ? 'page' : undefined}
				>
					Settings
				</a>
			{/if}
		</nav>

		<!-- Right Side Action / User Profile -->
		<div class="flex items-center gap-3">
			{#if auth.isAuthenticated}
				<a
					href="/settings"
					class="flex items-center gap-2 rounded-xl border border-border-subtle bg-canvas px-3 py-1.5 text-xs font-semibold text-ink-primary transition hover:border-primary active:scale-98"
					aria-label="Account Settings"
				>
					<span
						class="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary"
					>
						{userInitial}
					</span>
					<span>{auth.userName || 'Learner'}</span>
				</a>
			{:else}
				<a href="/login" class="text-xs font-bold text-ink-secondary hover:text-ink-primary">
					Log In
				</a>
				<a href="/login">
					<TactileButton variant="primary" size="sm">Get Started</TactileButton>
				</a>
			{/if}
		</div>
	</div>
</header>
