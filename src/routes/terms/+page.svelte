<script lang="ts">
	import SEO from '$lib/components/seo/SEO.svelte';
</script>

<SEO
	title="voabkr · Terms of Service (이용약관)"
	description="Terms of service and user agreement for voabkr spaced repetition Korean language learning platform."
	canonical="https://vocabkr.voyagera.ch/terms"
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
			<span class="rounded-md bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
				User Agreement
			</span>
			<span class="text-xs text-ink-muted">Effective Date: October 2026</span>
		</div>

		<h1 class="mt-2 text-3xl font-extrabold tracking-tight text-ink-primary sm:text-4xl">
			Terms of Service
		</h1>
		<p class="mt-1 text-sm text-ink-secondary">
			Rules, obligations, and guidelines for using the voabkr platform.
		</p>
	</header>

	<!-- Terms Content -->
	<article class="prose prose-sm max-w-none space-y-8 text-sm leading-relaxed text-ink-secondary">
		<!-- 1. Acceptance -->
		<section class="rounded-2xl border border-border-subtle bg-surface p-6 shadow-xs">
			<h2 class="text-base font-bold text-ink-primary">1. Acceptance of Terms</h2>
			<p class="mt-2">
				By accessing or using <strong>voabkr</strong> (accessible at
				<a href="https://vocabkr.voyagera.ch" class="text-primary underline">vocabkr.voyagera.ch</a
				>), you agree to be bound by these Terms of Service and our
				<a href="/privacy" class="text-primary underline">Privacy Policy</a>. If you do not agree to
				these terms, please do not use the service.
			</p>
		</section>

		<!-- 2. Eligibility & Accounts -->
		<section class="rounded-2xl border border-border-subtle bg-surface p-6 shadow-xs">
			<h2 class="text-base font-bold text-ink-primary">2. Eligibility & Account Security</h2>
			<p class="mt-2">
				To create an account on voabkr, you must be at least 13 years of age (or 16 years of age in
				jurisdictions where required by law, such as certain EU member states, unless parental
				consent is provided).
			</p>
			<ul class="mt-3 list-disc space-y-2 pl-5">
				<li>
					You are responsible for safeguarding your login credentials and maintaining the
					confidentiality of your password.
				</li>
				<li>You agree to provide accurate and complete information during registration.</li>
				<li>
					You must notify us immediately if you suspect any unauthorized access to your account.
				</li>
			</ul>
		</section>

		<!-- 3. Purpose & Educational Disclaimer -->
		<section class="rounded-2xl border border-border-subtle bg-surface p-6 shadow-xs">
			<h2 class="text-base font-bold text-ink-primary">
				3. Service Description & Educational Disclaimer
			</h2>
			<p class="mt-2">
				voabkr provides spaced-repetition flashcards, handwriting practice pads, and memorization
				assistance designed to facilitate Korean language acquisition.
			</p>
			<p class="mt-2 text-xs leading-relaxed text-ink-muted">
				<em>Educational Disclaimer</em>: While our materials are curated based on standard
				linguistic frameworks (such as TOPIK and common Korean grammar patterns), voabkr is an
				independent self-study tool. We make no warranty or guarantee that using the platform will
				result in passing official examinations, achieving specific proficiency levels, or language
				fluency.
			</p>
		</section>

		<!-- 4. Acceptable Use -->
		<section class="rounded-2xl border border-border-subtle bg-surface p-6 shadow-xs">
			<h2 class="text-base font-bold text-ink-primary">4. Acceptable Use Policy</h2>
			<p class="mt-2">You agree not to:</p>
			<ul class="mt-2 list-disc space-y-2 pl-5">
				<li>
					Use automated scripts, bots, spiders, or scrapers to extract card data or overload our
					backend servers.
				</li>
				<li>
					Attempt to probe, scan, or compromise our infrastructure or session authentication
					mechanisms.
				</li>
				<li>
					Reverse engineer, decompile, or create unauthorized derivative works of the service
					software.
				</li>
				<li>
					Use the platform for any illegal purpose or in violation of any applicable local,
					national, or international law.
				</li>
			</ul>
		</section>

		<!-- 5. Intellectual Property -->
		<section class="rounded-2xl border border-border-subtle bg-surface p-6 shadow-xs">
			<h2 class="text-base font-bold text-ink-primary">5. Intellectual Property Rights</h2>
			<p class="mt-2">
				The software code, layout designs, user interface graphics, trademarks, logos, and curated
				default card sets are the exclusive property of voabkr and its licensors, protected by Swiss
				and international intellectual property laws.
			</p>
			<p class="mt-2">
				You retain all intellectual property rights to any personal study notes or custom example
				sentences you author on the platform.
			</p>
		</section>

		<!-- 6. Disclaimer of Warranties & Limitation of Liability -->
		<section class="rounded-2xl border border-border-subtle bg-surface p-6 shadow-xs">
			<h2 class="text-base font-bold text-ink-primary">
				6. Warranty Disclaimer & Limitation of Liability
			</h2>
			<p class="mt-2">
				The service is provided on an <strong>"AS IS"</strong> and <strong>"AS AVAILABLE"</strong> basis
				without warranties of any kind, whether express or implied, including but not limited to implied
				warranties of merchantability, fitness for a particular purpose, or non-infringement.
			</p>
			<p class="mt-2">
				To the maximum extent permitted by applicable Swiss and European law, voabkr and its
				operators shall not be liable for any indirect, incidental, special, consequential, or
				punitive damages resulting from your use of or inability to use the service.
			</p>
		</section>

		<!-- 7. Termination -->
		<section class="rounded-2xl border border-border-subtle bg-surface p-6 shadow-xs">
			<h2 class="text-base font-bold text-ink-primary">7. Account Termination & Changes</h2>
			<p class="mt-2">
				You may cease using the service at any time and request account deletion. We reserve the
				right to suspend or terminate accounts that violate these Terms of Service or engage in
				abusive or harmful activity.
			</p>
			<p class="mt-2">
				We may update these terms from time to time. If revisions are material, we will provide
				notice through the application or via email.
			</p>
		</section>

		<!-- 8. Governing Law & Jurisdiction -->
		<section class="rounded-2xl border border-border-subtle bg-surface p-6 shadow-xs">
			<h2 class="text-base font-bold text-ink-primary">8. Governing Law & Jurisdiction</h2>
			<p class="mt-2">
				These Terms of Service and any disputes arising out of or related to the service shall be
				governed by and construed in accordance with the substantive laws of <strong
					>Switzerland</strong
				>, excluding its conflict of law principles. The ordinary courts at the operator's
				registered location in Switzerland shall have exclusive jurisdiction.
			</p>
		</section>

		<!-- 9. Contact -->
		<section class="rounded-2xl border border-border-subtle bg-surface p-6 shadow-xs">
			<h2 class="text-base font-bold text-ink-primary">9. Inquiries</h2>
			<p class="mt-2">If you have questions about these Terms of Service, please contact:</p>
			<p class="mt-3 font-semibold text-ink-primary">
				Email: <a href="mailto:contact@voyagera.ch" class="text-primary underline"
					>contact@voyagera.ch</a
				>
			</p>
		</section>
	</article>

	<!-- Footer Navigation -->
	<div class="mt-12 flex items-center justify-between border-t border-border-subtle pt-6">
		<a href="/privacy" class="text-xs font-semibold text-primary hover:underline">
			Privacy Policy ➔
		</a>
		<a href="/legal" class="text-xs font-semibold text-primary hover:underline">
			Legal Notice (Impressum) ➔
		</a>
	</div>
</div>
