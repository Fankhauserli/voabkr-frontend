<script lang="ts">
	import type { Deck, DeckAccessRole } from '$lib/types';

	interface Props {
		deck?: Deck;
		isPublic?: boolean;
		role?: DeckAccessRole;
	}

	let { deck, isPublic, role }: Props = $props();

	// Determine effective visibility kind: 'public' | 'shared' | 'private'
	let visibility = $derived.by<'public' | 'shared' | 'private'>(() => {
		const effRole = role ?? deck?.userAccessRole ?? deck?.user_access_role;
		const effPublic = isPublic ?? deck?.isPublic ?? deck?.is_public ?? false;

		if (effRole === 'view' || effRole === 'edit') {
			return 'shared';
		}
		if (effPublic || effRole === 'public') {
			return 'public';
		}
		return 'private';
	});
</script>

{#if visibility === 'public'}
	<span
		class="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-canvas px-1.5 py-0.5 text-[10px] font-semibold text-ink-secondary"
		title="Public deck: visible to anyone"
	>
		<svg
			class="h-3 w-3 text-ink-muted"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<circle cx="12" cy="12" r="10"></circle>
			<line x1="2" y1="12" x2="22" y2="12"></line>
			<path
				d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
			></path>
		</svg>
		<span>Public</span>
	</span>
{:else if visibility === 'shared'}
	<span
		class="inline-flex items-center gap-1 rounded-md border border-navy/20 bg-navy/5 px-1.5 py-0.5 text-[10px] font-semibold text-navy"
		title="Shared deck: accessible to you and shared peers"
	>
		<svg
			class="h-3 w-3 text-navy"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
			<circle cx="9" cy="7" r="4"></circle>
			<path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
			<path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
		</svg>
		<span>Shared</span>
	</span>
{:else}
	<span
		class="inline-flex items-center gap-1 rounded-md border border-amber/30 bg-amber/5 px-1.5 py-0.5 text-[10px] font-semibold text-amber"
		title="Private deck: only you and invited learners can access"
	>
		<svg
			class="h-3 w-3 text-amber"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
			<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
		</svg>
		<span>Private</span>
	</span>
{/if}
