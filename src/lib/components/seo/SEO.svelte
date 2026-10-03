<script lang="ts">
	interface Props {
		title?: string;
		description?: string;
		keywords?: string;
		canonical?: string;
		ogType?: 'website' | 'article' | 'book' | 'profile';
		ogImage?: string;
		noindex?: boolean;
		schema?: Record<string, unknown> | Array<Record<string, unknown>>;
	}

	let {
		title = 'voabkr — Tactile Korean Spaced Repetition Notebook',
		description = 'Master Korean vocabulary and grammar with voabkr. Editorial stationery aesthetics, Hangul-first typography, and the SuperMemo SM-2 spaced repetition algorithm.',
		keywords = 'Korean flashcards, Learn Korean, Hangul, TOPIK, Spaced Repetition, SM-2, Korean vocabulary, Korean grammar, voabkr, 보아봐',
		canonical = 'https://vocabkr.voyagera.ch',
		ogType = 'website',
		ogImage = 'https://vocabkr.voyagera.ch/og-image.svg',
		noindex = false,
		schema
	}: Props = $props();

	const siteName = 'voabkr · 보아봐';

	// Full formatted title
	let fullTitle = $derived(
		title.includes('voabkr') ? title : `${title} | voabkr — Korean Spaced Repetition`
	);

	// JSON-LD structured data default
	let defaultSchema = $derived({
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: 'voabkr',
		alternateName: '보아봐',
		url: 'https://vocabkr.voyagera.ch',
		description: description,
		applicationCategory: 'EducationalApplication',
		operatingSystem: 'Android, Web',
		inLanguage: ['ko', 'en'],
		offers: {
			'@type': 'Offer',
			price: '0',
			priceCurrency: 'USD'
		}
	});

	let serializedSchema = $derived(
		JSON.stringify(
			schema
				? Array.isArray(schema)
					? [defaultSchema, ...schema]
					: [defaultSchema, schema]
				: defaultSchema
		)
	);
</script>

<svelte:head>
	<!-- Standard Primary SEO Meta Tags -->
	<title>{fullTitle}</title>
	<meta name="description" content={description} />
	<meta name="keywords" content={keywords} />
	<link rel="canonical" href={canonical} />

	{#if noindex}
		<meta name="robots" content="noindex, nofollow" />
	{:else}
		<meta
			name="robots"
			content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"
		/>
	{/if}

	<!-- Open Graph / Facebook / KakaoTalk -->
	<meta property="og:type" content={ogType} />
	<meta property="og:site_name" content={siteName} />
	<meta property="og:url" content={canonical} />
	<meta property="og:title" content={fullTitle} />
	<meta property="og:description" content={description} />
	<meta property="og:image" content={ogImage} />
	<meta property="og:locale" content="en_US" />
	<meta property="og:locale:alternate" content="ko_KR" />

	<!-- Twitter Cards -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:url" content={canonical} />
	<meta name="twitter:title" content={fullTitle} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={ogImage} />

	<!-- JSON-LD Structured Data for Search Engine Rich Snippets -->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html `<script type="application/ld+json">${serializedSchema}</` + `script>`}
</svelte:head>
