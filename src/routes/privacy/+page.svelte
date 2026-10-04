<script lang="ts">
	import SEO from '$lib/components/seo/SEO.svelte';
</script>

<SEO
	title="voabkr · Privacy Policy (개인정보처리방침)"
	description="Privacy policy and data protection disclosures for voabkr, complying with the Swiss Federal Data Protection Act (revDSG) and EU GDPR."
	canonical="https://vocabkr.voyagera.ch/privacy"
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
			<span class="rounded-md bg-celadon/15 px-2.5 py-0.5 text-xs font-bold text-celadon">
				GDPR & Swiss revDSG Compliant
			</span>
			<span class="text-xs text-ink-muted">Last updated: October 2026</span>
		</div>

		<h1 class="mt-2 text-3xl font-extrabold tracking-tight text-ink-primary sm:text-4xl">
			Privacy Policy
		</h1>
		<p class="mt-1 text-sm text-ink-secondary">
			How we handle and protect your personal information and learning records.
		</p>
	</header>

	<!-- Policy Content -->
	<article class="prose prose-sm max-w-none space-y-8 text-sm leading-relaxed text-ink-secondary">
		<!-- 1. Data Controller -->
		<section class="rounded-2xl border border-border-subtle bg-surface p-6 shadow-xs">
			<h2 class="text-base font-bold text-ink-primary">1. Data Controller & Operator</h2>
			<p class="mt-2">
				The controller responsible for processing your personal data on <strong>voabkr</strong>
				(available at
				<a href="https://vocabkr.voyagera.ch" class="text-primary underline">vocabkr.voyagera.ch</a
				>) in accordance with the Swiss Federal Act on Data Protection (<strong>revDSG</strong> /
				FADP) and the General Data Protection Regulation (<strong>EU GDPR</strong>) is:
			</p>
			<div
				class="mt-3 rounded-xl border border-border-subtle bg-canvas p-4 text-xs font-medium text-ink-primary"
			>
				<p><strong>voabkr / Voyagera</strong></p>
				<p>Switzerland</p>
				<p class="mt-1">
					Inquiries & Privacy Requests: <a
						href="mailto:privacy@voyagera.ch"
						class="text-primary underline">privacy@voyagera.ch</a
					>
				</p>
			</div>
		</section>

		<!-- 2. What Data We Collect -->
		<section class="rounded-2xl border border-border-subtle bg-surface p-6 shadow-xs">
			<h2 class="text-base font-bold text-ink-primary">2. Personal Data We Collect & Process</h2>
			<p class="mt-2">
				We collect only the minimum personal information required to deliver a reliable,
				distraction-free spaced repetition flashcard service:
			</p>
			<ul class="mt-3 list-disc space-y-2 pl-5">
				<li>
					<strong class="text-ink-primary">Account Registration Data</strong>: Your display name,
					email address, and a securely salted and hashed password (processed using modern
					cryptographic hashing; we never store plain text passwords).
				</li>
				<li>
					<strong class="text-ink-primary">Learning Progress & SM-2 Review Records</strong>: Card
					study timestamps, recall ease ratings (Again, Hard, Good, Easy), scheduled repetition
					intervals, and daily learning streaks.
				</li>
				<li>
					<strong class="text-ink-primary">Application Settings</strong>: Daily cards target
					preference, default card prompt direction (Korean to English vs English to Korean), theme
					preference, and scratch pad enablement state.
				</li>
				<li>
					<strong class="text-ink-primary">Stylus / Apple Pencil Handwriting</strong>: Canvas
					drawing strokes in the scratch pad (연습장) are processed
					<em>strictly in your local device memory</em> and are never transmitted to our servers or stored
					in remote databases.
				</li>
			</ul>
		</section>

		<!-- 3. Legal Basis for Processing -->
		<section class="rounded-2xl border border-border-subtle bg-surface p-6 shadow-xs">
			<h2 class="text-base font-bold text-ink-primary">3. Legal Basis for Processing</h2>
			<p class="mt-2">
				Under Swiss revDSG (Art. 31) and EU GDPR (Art. 6(1)), we process your data under the
				following legal bases:
			</p>
			<ul class="mt-3 list-disc space-y-2 pl-5">
				<li>
					<strong class="text-ink-primary"
						>Contract Fulfillment (Art. 6(1)(b) GDPR / Art. 31(2)(a) revDSG)</strong
					>: To provide your account, authenticate your login, calculate your individual
					spaced-repetition schedules, and synchronize your flashcard deck state.
				</li>
				<li>
					<strong class="text-ink-primary"
						>Legitimate Interests (Art. 6(1)(f) GDPR / Art. 31(1) revDSG)</strong
					>: To prevent spam, block denial-of-service attacks, ensure network security, and verify
					account emails.
				</li>
			</ul>
		</section>

		<!-- 4. Cookies & Local Storage -->
		<section class="rounded-2xl border border-border-subtle bg-surface p-6 shadow-xs">
			<h2 class="text-base font-bold text-ink-primary">4. Cookies & Local Device Storage</h2>
			<div
				class="mt-2 rounded-xl border border-celadon/30 bg-celadon/10 p-3.5 text-xs text-ink-primary"
			>
				<p class="font-bold text-celadon">Zero Tracking & Zero Advertising</p>
				<p class="mt-1">
					We do not use advertising trackers, Google Analytics, social media tracking pixels, or
					cross-site fingerprinting scripts. We do not sell, rent, or trade your data to any data
					brokers.
				</p>
			</div>
			<p class="mt-3">We use only technically essential storage:</p>
			<ul class="mt-2 list-disc space-y-2 pl-5">
				<li>
					<strong class="text-ink-primary">Authentication Session Cookie</strong>: A strictly
					necessary, secure cookie (<code class="rounded bg-canvas px-1.5 py-0.5 text-xs"
						>userSession</code
					>) issued solely to identify your active session. It is flagged with
					<code class="rounded bg-canvas px-1.5 py-0.5 text-xs">HttpOnly</code>,
					<code class="rounded bg-canvas px-1.5 py-0.5 text-xs">Secure</code>, and
					<code class="rounded bg-canvas px-1.5 py-0.5 text-xs">SameSite=Lax</code> to protect against
					cross-site scripting and request forgery.
				</li>
				<li>
					<strong class="text-ink-primary">Browser LocalStorage</strong>: Used to temporarily buffer
					offline flashcard ratings so your study session continues uninterrupted if your network
					connection drops.
				</li>
			</ul>
			<p class="mt-2 text-xs text-ink-muted">
				Because we only use strictly necessary cookies, no cookie consent banner is legally required
				under the EU ePrivacy Directive (Directive 2002/58/EC) and Swiss data protection law.
			</p>
		</section>

		<!-- 5. Data Retention & Deletion -->
		<section class="rounded-2xl border border-border-subtle bg-surface p-6 shadow-xs">
			<h2 class="text-base font-bold text-ink-primary">5. Data Retention & Deletion</h2>
			<p class="mt-2">
				We retain your personal data and flashcard study history for as long as your account remains
				active. If you wish to delete your account and all associated study records, you can submit
				an account erasure request by emailing <a
					href="mailto:privacy@voyagera.ch"
					class="text-primary underline">privacy@voyagera.ch</a
				>. Your records will be permanently purged from all operational databases within 30 days.
			</p>
		</section>

		<!-- 6. Your Rights -->
		<section class="rounded-2xl border border-border-subtle bg-surface p-6 shadow-xs">
			<h2 class="text-base font-bold text-ink-primary">6. Your Data Subject Rights</h2>
			<p class="mt-2">Under Swiss revDSG and EU GDPR, you are entitled to the following rights:</p>
			<ul class="mt-3 list-disc space-y-2 pl-5">
				<li>
					<strong class="text-ink-primary">Right to Access (Art. 15 GDPR / Art. 25 revDSG)</strong>:
					Request confirmation of whether your personal data is processed and receive a copy.
				</li>
				<li>
					<strong class="text-ink-primary"
						>Right to Data Portability (Art. 20 GDPR / Art. 28 revDSG)</strong
					>: Export your personal data and study records in a structured, machine-readable JSON
					format directly from your Settings page.
				</li>
				<li>
					<strong class="text-ink-primary"
						>Right to Rectification (Art. 16 GDPR / Art. 32 revDSG)</strong
					>: Correct inaccurate display names or email addresses.
				</li>
				<li>
					<strong class="text-ink-primary">Right to Erasure (Art. 17 GDPR / Art. 32 revDSG)</strong
					>: Request the permanent deletion of your account and learning records.
				</li>
				<li>
					<strong class="text-ink-primary">Right to Lodge a Complaint</strong>: You have the right
					to lodge a complaint with the competent supervisory authority:
					<ul class="list-circle mt-1 space-y-1 pl-4 text-xs text-ink-muted">
						<li>
							Switzerland: Federal Data Protection and Information Commissioner (FDPIC / EDÖB),
							Feldeggweg 1, CH-3003 Bern (<a
								href="https://www.edoeb.admin.ch"
								target="_blank"
								rel="noopener noreferrer"
								class="underline">edoeb.admin.ch</a
							>).
						</li>
						<li>European Union: The data protection authority of your EU Member State.</li>
					</ul>
				</li>
			</ul>
		</section>

		<!-- 7. Contact -->
		<section class="rounded-2xl border border-border-subtle bg-surface p-6 shadow-xs">
			<h2 class="text-base font-bold text-ink-primary">7. Contact & Data Protection Inquiries</h2>
			<p class="mt-2">
				For any questions regarding this Privacy Policy, your personal data, or to exercise your
				rights, please contact us at:
			</p>
			<p class="mt-3 font-semibold text-ink-primary">
				Email: <a href="mailto:privacy@voyagera.ch" class="text-primary underline"
					>privacy@voyagera.ch</a
				>
			</p>
		</section>
	</article>

	<!-- Footer Navigation -->
	<div class="mt-12 flex items-center justify-between border-t border-border-subtle pt-6">
		<a href="/terms" class="text-xs font-semibold text-primary hover:underline">
			Terms of Service ➔
		</a>
		<a href="/legal" class="text-xs font-semibold text-primary hover:underline">
			Legal Notice (Impressum) ➔
		</a>
	</div>
</div>
