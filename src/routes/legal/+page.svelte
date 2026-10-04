<script lang="ts">
	import SEO from '$lib/components/seo/SEO.svelte';
</script>

<SEO
	title="voabkr · Legal Notice & Impressum (법적 고지)"
	description="Legal notice, publisher identification, and impressum for voabkr in accordance with Swiss and European telecommunications regulations."
	canonical="https://vocabkr.voyagera.ch/legal"
/>

<div
	class="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-6 pb-24 sm:px-6"
	style="padding-top: calc(var(--safe-top) + 20px);"
>
	<!-- Header -->
	<header class="mb-8 border-b border-border-subtle pb-6">
		<a
			href="/"
			class="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-secondary hover:text-ink-primary"
		>
			<svg
				class="h-3.5 w-3.5"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<polyline points="15 18 9 12 15 6"></polyline>
			</svg>
			<span>Back to voabkr</span>
		</a>

		<div class="mt-4 flex items-center gap-2">
			<span
				class="rounded-md border border-border-subtle bg-canvas px-2.5 py-0.5 text-xs font-bold text-ink-secondary"
			>
				Impressum / Legal Disclosure
			</span>
			<span class="text-xs text-ink-muted">UWG Art. 3 Abs. 1 lit. s compliant</span>
		</div>

		<h1 class="mt-2 text-3xl font-extrabold tracking-tight text-ink-primary sm:text-4xl">
			Legal Notice (Impressum)
		</h1>
		<p class="mt-1 text-sm text-ink-secondary">
			Information in accordance with Swiss and European e-commerce legislation.
		</p>
	</header>

	<!-- Content -->
	<article class="prose prose-sm max-w-none space-y-8 text-sm leading-relaxed text-ink-secondary">
		<!-- 1. Operator Information -->
		<section class="rounded-2xl border border-border-subtle bg-surface p-6 shadow-xs">
			<h2 class="text-base font-bold text-ink-primary">1. Service Provider & Operator</h2>
			<div class="mt-3 space-y-1 text-sm font-medium text-ink-primary">
				<p><strong>voabkr · Korean Spaced Repetition Notebook</strong></p>
				<p>Operated by Voyagera Project</p>
				<p>Switzerland (Schweiz / Suisse)</p>
			</div>

			<div class="mt-4 border-t border-border-subtle pt-3">
				<p class="text-xs font-bold tracking-wider text-ink-muted uppercase">Contact</p>
				<p class="mt-1 text-sm text-ink-primary">
					General Inquiries: <a href="mailto:contact@voyagera.ch" class="text-primary underline"
						>contact@voyagera.ch</a
					>
				</p>
				<p class="mt-0.5 text-sm text-ink-primary">
					Privacy & Data Requests: <a
						href="mailto:privacy@voyagera.ch"
						class="text-primary underline">privacy@voyagera.ch</a
					>
				</p>
			</div>
		</section>

		<!-- 2. Technical Hosting & Infrastructure -->
		<section class="rounded-2xl border border-border-subtle bg-surface p-6 shadow-xs">
			<h2 class="text-base font-bold text-ink-primary">2. Hosting & Infrastructure</h2>
			<p class="mt-2">
				The application servers, caching systems, and database infrastructure are deployed in secure
				data center facilities in Europe / Switzerland, conforming to strict security and data
				protection regulations.
			</p>
		</section>

		<!-- 3. Intellectual Property Notice -->
		<section class="rounded-2xl border border-border-subtle bg-surface p-6 shadow-xs">
			<h2 class="text-base font-bold text-ink-primary">3. Intellectual Property & Copyright</h2>
			<p class="mt-2">
				The layout, typography, graphic design elements, Hangul stationery aesthetics, and software
				implementations are protected by copyright law. Any reproduction, adaptation, distribution,
				or commercial exploitation requires prior written consent from the operator.
			</p>
		</section>

		<!-- 4. Disclaimer for External Links -->
		<section class="rounded-2xl border border-border-subtle bg-surface p-6 shadow-xs">
			<h2 class="text-base font-bold text-ink-primary">4. Liability for External Links</h2>
			<p class="mt-2">
				Our website may contain links to third-party external resources (e.g. linguistic references
				or dictionaries). We have no influence on the contents of these external sites and assume no
				liability for third-party content. The respective provider or operator of the linked pages
				is solely responsible.
			</p>
		</section>
	</article>

	<!-- Footer Navigation -->
	<div class="mt-12 flex items-center justify-between border-t border-border-subtle pt-6">
		<a href="/privacy" class="text-xs font-semibold text-primary hover:underline">
			Privacy Policy ➔
		</a>
		<a href="/terms" class="text-xs font-semibold text-primary hover:underline">
			Terms of Service ➔
		</a>
	</div>
</div>
