import { afterEach, test, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { SM2_RATINGS_CONFIG, type SM2RatingMeta } from '$lib/types';
import '../../../routes/layout.css';
import Sm2RatingBar from './Sm2RatingBar.svelte';

// The Theme's palette, written out as the independent source of truth for this
// test (issue #69). Browsers report the colours as rgb().
const GRADE_COLORS: Record<
	'light' | 'dark',
	Record<SM2RatingMeta['tone'], { bg: string; border: string }>
> = {
	light: {
		again: { bg: 'rgb(251, 237, 236)', border: 'rgb(203, 106, 100)' },
		hard: { bg: 'rgb(250, 242, 226)', border: 'rgb(173, 130, 40)' },
		good: { bg: 'rgb(234, 243, 239)', border: 'rgb(79, 150, 123)' },
		easy: { bg: 'rgb(228, 241, 236)', border: 'rgb(67, 139, 116)' }
	},
	dark: {
		again: { bg: 'rgb(51, 24, 24)', border: 'rgb(138, 46, 46)' },
		hard: { bg: 'rgb(51, 43, 24)', border: 'rgb(138, 114, 46)' },
		good: { bg: 'rgb(24, 51, 40)', border: 'rgb(46, 128, 90)' },
		easy: { bg: 'rgb(21, 43, 36)', border: 'rgb(38, 107, 89)' }
	}
};

function colorsOf(element: HTMLElement): { bg: string; border: string } {
	const style = getComputedStyle(element);
	return { bg: style.backgroundColor, border: style.borderTopColor };
}

afterEach(() => {
	document.documentElement.classList.remove('dark');
});

test('the Grade buttons take their fill and border from the Theme in use', async () => {
	const screen = render(Sm2RatingBar, { onSelectEase: vi.fn() });

	for (const theme of ['light', 'dark'] as const) {
		if (theme === 'dark') document.documentElement.classList.add('dark');

		for (const { label, tone } of SM2_RATINGS_CONFIG) {
			const button = screen.getByRole('button', { name: new RegExp(`^${label}`) });
			// The buttons transition their colours, so let the Theme change settle.
			await expect
				.poll(() => colorsOf(button.element() as HTMLElement))
				.toEqual(GRADE_COLORS[theme][tone]);
		}
	}
});

test('renders all 4 Anki rating buttons and triggers callback on click', async () => {
	const onSelectEase = vi.fn();
	const screen = render(Sm2RatingBar, {
		onSelectEase,
		disabled: false
	});

	const againButton = screen.getByRole('button', { name: /Again/i });
	const easyButton = screen.getByRole('button', { name: /Easy/i });

	await expect.element(againButton).toBeVisible();
	await expect.element(easyButton).toBeVisible();

	await easyButton.click();
	expect(onSelectEase).toHaveBeenCalledWith(4);

	await againButton.click();
	expect(onSelectEase).toHaveBeenCalledWith(1);
});
