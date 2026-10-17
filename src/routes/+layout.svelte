<script lang="ts">
	import './layout.css';
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { initializeBackButton } from '$lib/utils/backButton';
	import { initializeStatusBar } from '$lib/utils/statusBar';
	import Toast from '$lib/components/feedback/Toast.svelte';
	import InstallPrompt from '$lib/components/feedback/InstallPrompt.svelte';
	import ExitStudyModal from '$lib/components/study/ExitStudyModal.svelte';
	import SEO from '$lib/components/seo/SEO.svelte';

	import DesktopHeader from '$lib/components/navigation/DesktopHeader.svelte';
	import { page } from '$app/state';

	interface Props {
		children?: Snippet;
	}

	let { children }: Props = $props();
	let isStudyRoute = $derived(page.url.pathname.startsWith('/study'));

	onMount(() => {
		// Initialize native Capacitor status bar & back button
		initializeStatusBar('light');
		const cleanBackButton = initializeBackButton({
			onRootExitPrompt: () => {
				toast.info('Press back again to exit');
			}
		});

		// Listen for 401 session expiration
		const handleSessionExpired = () => {
			if (auth.isAuthenticated) {
				toast.warning('Session expired. Please log in again.');
				auth.logout();
				goto('/login');
			}
		};

		window.addEventListener('session-expired', handleSessionExpired);

		// Fetch current profile & settings
		auth.fetchUser();

		// Register PWA service worker for offline caching
		if ('serviceWorker' in navigator && typeof window !== 'undefined') {
			navigator.serviceWorker.register('/service-worker.js').catch((err) => {
				console.debug('[PWA] Service worker registration note:', err);
			});
		}

		return () => {
			window.removeEventListener('session-expired', handleSessionExpired);
			cleanBackButton.then((cleanup) => cleanup?.());
		};
	});
</script>

<SEO />

<div class="min-h-screen bg-canvas font-sans text-ink-primary">
	{#if !isStudyRoute}
		<DesktopHeader />
	{/if}

	<main class="mx-auto flex min-h-screen w-full flex-col">
		{#if children}
			{@render children()}
		{/if}
	</main>

	<!-- Global Overlays & Modals -->
	<InstallPrompt />
	<Toast />
	<ExitStudyModal />
</div>
