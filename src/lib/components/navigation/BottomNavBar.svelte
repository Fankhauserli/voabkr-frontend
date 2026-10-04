<script lang="ts">
	import { selectionClick } from '$lib/utils/haptics';
	import { auth } from '$lib/stores/auth.svelte';

	interface Props {
		activeRoute: string;
		dueReviewCount?: number;
	}

	let { activeRoute, dueReviewCount = 0 }: Props = $props();

	function onTabClick() {
		selectionClick();
	}
</script>

<nav
	class="fixed right-0 bottom-0 left-0 z-30 border-t border-border-subtle bg-surface"
	style="padding-bottom: var(--safe-bottom);"
	aria-label="Bottom Navigation"
>
	<div class="mx-auto flex h-16 max-w-lg items-center justify-around px-2">
		<!-- Home Tab -->
		<a
			href="/"
			onclick={onTabClick}
			class="relative flex min-h-[48px] min-w-[64px] flex-col items-center justify-center rounded-lg px-3 py-1 transition {activeRoute ===
			'/'
				? 'font-bold text-primary'
				: 'text-ink-secondary hover:text-ink-primary'}"
			aria-current={activeRoute === '/' ? 'page' : undefined}
		>
			<div class="relative">
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
						d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
					/>
				</svg>
				{#if dueReviewCount > 0}
					<span
						class="absolute -top-1 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white"
					>
						{dueReviewCount > 99 ? '99+' : dueReviewCount}
					</span>
				{/if}
			</div>
			<span class="mt-1 text-xs">Today</span>
		</a>

		<!-- Decks Tab -->
		<a
			href="/decks"
			onclick={onTabClick}
			class="flex min-h-[48px] min-w-[64px] flex-col items-center justify-center rounded-lg px-3 py-1 transition {activeRoute.startsWith(
				'/decks'
			)
				? 'font-bold text-primary'
				: 'text-ink-secondary hover:text-ink-primary'}"
			aria-current={activeRoute.startsWith('/decks') ? 'page' : undefined}
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
					d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
				/>
			</svg>
			<span class="mt-1 text-xs">Decks</span>
		</a>

		<!-- Settings / Profile or Log In Tab -->
		{#if auth.isAuthenticated}
			<a
				href="/settings"
				onclick={onTabClick}
				class="flex min-h-[48px] min-w-[64px] flex-col items-center justify-center rounded-lg px-3 py-1 transition {activeRoute.startsWith(
					'/settings'
				)
					? 'font-bold text-primary'
					: 'text-ink-secondary hover:text-ink-primary'}"
				aria-current={activeRoute.startsWith('/settings') ? 'page' : undefined}
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
						d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
					/>
				</svg>
				<span class="mt-1 text-xs">Profile</span>
			</a>
		{:else}
			<a
				href="/login"
				onclick={onTabClick}
				class="flex min-h-[48px] min-w-[64px] flex-col items-center justify-center rounded-lg px-3 py-1 transition {activeRoute ===
				'/login'
					? 'font-bold text-primary'
					: 'text-ink-secondary hover:text-ink-primary'}"
				aria-current={activeRoute === '/login' ? 'page' : undefined}
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
						d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
					/>
				</svg>
				<span class="mt-1 text-xs">Log In</span>
			</a>
		{/if}
	</div>
</nav>
