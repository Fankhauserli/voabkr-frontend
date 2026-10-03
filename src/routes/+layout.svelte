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
	import ExitStudyModal from '$lib/components/study/ExitStudyModal.svelte';
	import SEO from '$lib/components/seo/SEO.svelte';

	interface Props {
		children?: Snippet;
	}

	let { children }: Props = $props();

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
			toast.warning('Session expired. Please log in again.');
			auth.logout();
			goto('/login');
		};

		window.addEventListener('session-expired', handleSessionExpired);

		// Fetch current profile & settings
		auth.fetchUser();

		return () => {
			window.removeEventListener('session-expired', handleSessionExpired);
			cleanBackButton.then((cleanup) => cleanup?.());
		};
	});
</script>

<SEO />

<div class="min-h-screen bg-canvas font-sans text-ink-primary">
	<main class="mx-auto flex min-h-screen max-w-lg flex-col">
		{#if children}
			{@render children()}
		{/if}
	</main>

	<!-- Global Overlays & Modals -->
	<Toast />
	<ExitStudyModal />
</div>
