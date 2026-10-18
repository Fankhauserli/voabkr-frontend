import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The Theme regression guard (issue #70).
 *
 * The stylesheet is the single source of truth: the palette values under test
 * are parsed from the shipped files rather than imported as a second
 * definition. The contrast thresholds and the pinned Sumi set are the
 * independent oracle that makes a drift visible.
 */

const readProjectFile = (path: string): string =>
	readFileSync(new URL(path, import.meta.url), 'utf8');

const stylesheet = readProjectFile('../routes/layout.css');
const appHtml = readProjectFile('../app.html');
const manifest = JSON.parse(readProjectFile('../../static/manifest.json')) as {
	background_color: string;
	theme_color: string;
};
const statusBar = readProjectFile('./utils/statusBar.ts');

/**
 * The custom properties declared for a selector, merged across every block so
 * an appended override cannot slip past the guard.
 */
function themeTokens(css: string, selector: ':root' | '.dark'): Map<string, string> {
	const escaped = selector.replace('.', '\\.');
	const blocks = [...css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'g'))];

	if (blocks.length === 0) throw new Error(`No ${selector} block in the Theme stylesheet`);

	const tokens = new Map<string, string>();
	for (const [, block] of blocks) {
		for (const match of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
			tokens.set(match[1], match[2].trim().toLowerCase());
		}
	}
	return tokens;
}

const light = themeTokens(stylesheet, ':root');
const dark = themeTokens(stylesheet, '.dark');

function tokenValue(tokens: Map<string, string>, token: string): string {
	const found = tokens.get(token);
	if (!found) throw new Error(`Missing ${token} in the Theme stylesheet`);
	return found;
}

function rgb(hex: string): [number, number, number] {
	const digits = hex.replace('#', '');
	if (!/^[0-9a-f]{6}$/.test(digits)) throw new Error(`Not a six-digit hex colour: ${hex}`);

	return [0, 2, 4].map((offset) => Number.parseInt(digits.slice(offset, offset + 2), 16)) as [
		number,
		number,
		number
	];
}

function luminance(hex: string): number {
	const [red, green, blue] = rgb(hex).map((channel) => {
		const unit = channel / 255;
		return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
	});

	return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: string, second: string): number {
	const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
	return (lighter + 0.05) / (darker + 0.05);
}

const CONTRAST_ROLES = [
	'--text-primary',
	'--text-secondary',
	'--text-muted',
	'--accent-primary',
	'--accent-celadon',
	'--accent-navy',
	'--accent-amber',
	'--accent-crimson'
] as const;

// Contrast is guarded for the light Theme. The dark Sumi set is pinned to its
// shipped values below; several of those values are below AA, so checking them
// would require changing the dark Theme, which #70 forbids.
describe('the light Theme meets WCAG AA', () => {
	for (const role of CONTRAST_ROLES) {
		for (const background of ['--bg-canvas', '--bg-surface'] as const) {
			it(`${role} on ${background}`, () => {
				expect(
					contrast(tokenValue(light, role), tokenValue(light, background))
				).toBeGreaterThanOrEqual(4.5);
			});
		}
	}
});

const GRADES = ['again', 'hard', 'good', 'easy'] as const;

// Only the light Grade colours are contrast-checked: the dark values are the
// Sumi set that ships today and are pinned, unchanged, in the test below.
describe("the light Theme's Grade buttons stand out from their fills", () => {
	for (const grade of GRADES) {
		it(`${grade} border against its fill`, () => {
			const border = tokenValue(light, `--grade-${grade}-border`);
			const fill = tokenValue(light, `--grade-${grade}-bg`);
			expect(contrast(border, fill)).toBeGreaterThanOrEqual(3);
		});
	}
});

describe('the light canvas value agrees across the app shell', () => {
	it('matches the stylesheet, the HTML theme-color, the manifest, and the native status bar', () => {
		const canvas = tokenValue(light, '--bg-canvas');

		const htmlThemeColor =
			/<meta\s+name="theme-color"\s+content="(#[0-9a-f]{6})"\s+media="\(prefers-color-scheme: light\)"/i.exec(
				appHtml
			)?.[1];
		const statusBarLight = /light:\s*\{\s*color:\s*'(#[0-9a-f]{6})'/i.exec(statusBar)?.[1];

		expect(htmlThemeColor?.toLowerCase()).toBe(canvas);
		expect(manifest.background_color.toLowerCase()).toBe(canvas);
		expect(manifest.theme_color.toLowerCase()).toBe(canvas);
		expect(statusBarLight?.toLowerCase()).toBe(canvas);
	});
});

const SUMI = {
	'--bg-canvas': '#121211',
	'--bg-surface': '#1b1a18',
	'--bg-surface-elevated': '#252421',
	'--border-subtle': '#2e2b26',
	'--border-strong': '#46423a',
	'--text-primary': '#eeeae2',
	'--text-secondary': '#a8a296',
	'--text-muted': '#6c675e',
	'--accent-primary': '#6b95bd',
	'--accent-celadon': '#4ea08e',
	'--accent-navy': '#5a8bbd',
	'--accent-amber': '#cf9f4d',
	'--accent-crimson': '#e05555',
	'--grade-again-bg': '#331818',
	'--grade-again-border': '#8a2e2e',
	'--grade-hard-bg': '#332b18',
	'--grade-hard-border': '#8a722e',
	'--grade-good-bg': '#183328',
	'--grade-good-border': '#2e805a',
	'--grade-easy-bg': '#152b24',
	'--grade-easy-border': '#266b59'
};

describe('the dark Theme is the Sumi set that ships today', () => {
	it('keeps every dark token value', () => {
		expect(Object.fromEntries(dark)).toEqual(SUMI);
	});
});
