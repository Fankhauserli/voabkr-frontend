<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props {
		id: string;
		label?: string;
		value: string;
		type?: string;
		placeholder?: string;
		error?: string;
		hint?: string;
		required?: boolean;
		disabled?: boolean;
		autocomplete?: HTMLInputAttributes['autocomplete'];
		isKoreanIme?: boolean;
		oninput?: (e: Event & { currentTarget: HTMLInputElement }) => void;
	}

	let {
		id,
		label,
		value = $bindable(''),
		type = 'text',
		placeholder = '',
		error,
		hint,
		required = false,
		disabled = false,
		autocomplete,
		isKoreanIme = false,
		oninput
	}: Props = $props();

	let showPassword = $state(false);
	let actualType = $derived(type === 'password' ? (showPassword ? 'text' : 'password') : type);
</script>

<div class="flex w-full flex-col gap-1.5">
	{#if label}
		<label for={id} class="text-xs font-semibold text-ink-secondary">
			{label}
			{#if required}
				<span class="text-terracotta">*</span>
			{/if}
		</label>
	{/if}

	<div class="relative flex items-center">
		<input
			{id}
			type={actualType}
			bind:value
			{placeholder}
			{required}
			{disabled}
			{autocomplete}
			lang={isKoreanIme ? 'ko' : undefined}
			{oninput}
			class="min-h-[48px] w-full rounded-xl border bg-surface px-3.5 py-2.5 text-base text-ink-primary transition placeholder:text-ink-muted focus:outline-none disabled:opacity-50 {error
				? 'border-crimson focus:border-crimson focus:ring-1 focus:ring-crimson'
				: 'border-border-strong focus:border-terracotta focus:ring-1 focus:ring-terracotta'} {isKoreanIme
				? 'font-medium'
				: ''}"
		/>

		{#if type === 'password'}
			<button
				type="button"
				onclick={() => (showPassword = !showPassword)}
				class="absolute right-3 p-1.5 text-ink-muted transition hover:text-ink-primary"
				aria-label={showPassword ? 'Hide password' : 'Show password'}
			>
				{#if showPassword}
					<!-- Eye off icon -->
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
							stroke-width="2"
							d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
						/>
					</svg>
				{:else}
					<!-- Eye icon -->
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
							stroke-width="2"
							d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
						/>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
						/>
					</svg>
				{/if}
			</button>
		{/if}
	</div>

	{#if error}
		<p class="text-xs text-crimson">{error}</p>
	{:else if hint}
		<p class="text-xs text-ink-muted">{hint}</p>
	{/if}
</div>
