<script lang="ts">
	import { resolve } from '$app/paths';
	import { logout } from '$lib/api/auth';

	let loggingOut = $state(false);
	let message = $state<string | null>(null);

	async function handleLogout() {
		loggingOut = true;
		message = null;
		const res = await logout();
		loggingOut = false;
		if (res.success) {
			message = 'Successfully logged out!';
		} else {
			message = res.error || 'Logout failed';
		}
	}
</script>

<svelte:head>
	<title>voabkr · Korean Flashcard App</title>
</svelte:head>

<div class="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
	<!-- Top Navigation -->
	<header class="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md">
		<div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
			<a href={resolve('/')} class="flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
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
				<div>
					<span class="text-xl font-black tracking-tight text-white">voabkr</span>
					<span class="hidden text-xs font-semibold text-indigo-400 sm:ml-2 sm:inline-block"
						>한국어 단어장</span
					>
				</div>
			</a>

			<nav class="flex items-center gap-3">
				<a
					href={resolve('/login')}
					class="rounded-xl px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
				>
					Sign In
				</a>
				<a
					href={resolve('/signup')}
					class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition hover:bg-indigo-500"
				>
					Get Started
				</a>
			</nav>
		</div>
	</header>

	<!-- Main Content -->
	<main class="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:py-24">
		{#if message}
			<div
				class="mx-auto mb-8 max-w-md rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3 text-sm text-indigo-300"
			>
				{message}
			</div>
		{/if}

		<div
			class="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-300"
		>
			<span>✨ Spaced Repetition Vocabulary</span>
		</div>

		<h1 class="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
			Master Korean Vocabulary, <br class="hidden sm:inline" />
			<span
				class="bg-linear-to-r from-indigo-400 via-sky-400 to-indigo-300 bg-clip-text text-transparent"
			>
				Card by Card
			</span>
		</h1>

		<p class="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
			voabkr helps you memorize Korean words and grammar with an intelligent review algorithm,
			contextual sentences, and progress tracking.
		</p>

		<div class="mt-10 flex flex-wrap items-center justify-center gap-4">
			<a
				href={resolve('/signup')}
				class="rounded-xl bg-indigo-600 px-6 py-3.5 text-base font-semibold text-white shadow-xl shadow-indigo-500/30 transition hover:bg-indigo-500 hover:shadow-indigo-500/50"
			>
				Create Free Account
			</a>
			<a
				href={resolve('/login')}
				class="rounded-xl border border-slate-700 bg-slate-900/60 px-6 py-3.5 text-base font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
			>
				Sign In
			</a>
			<button
				type="button"
				onclick={handleLogout}
				disabled={loggingOut}
				class="rounded-xl border border-slate-800 px-4 py-3.5 text-xs text-slate-400 hover:border-slate-700 hover:text-slate-200 disabled:opacity-50"
			>
				{loggingOut ? 'Logging out...' : 'Test Logout'}
			</button>
		</div>

		<!-- Flashcard preview mock -->
		<div class="mt-16 flex justify-center">
			<div
				class="w-full max-w-sm rounded-2xl border border-slate-800 bg-linear-to-b from-slate-900 to-slate-950 p-6 text-left shadow-2xl"
			>
				<div class="flex items-center justify-between text-xs text-slate-500">
					<span class="rounded-md bg-indigo-950 px-2 py-0.5 font-medium text-indigo-400"
						>Deck: TOPIK I</span
					>
					<span>Card #42</span>
				</div>
				<div class="mt-6 text-center">
					<p class="text-3xl font-bold text-white">행복하다</p>
					<p class="mt-1 text-sm text-slate-400">[haeng-bok-ha-da]</p>
					<div class="my-4 border-t border-slate-800/80"></div>
					<p class="text-lg font-medium text-indigo-300">to be happy</p>
					<p class="mt-2 text-xs text-slate-400 italic">
						"오늘 정말 행복해요." (I'm really happy today.)
					</p>
				</div>
			</div>
		</div>
	</main>
</div>
