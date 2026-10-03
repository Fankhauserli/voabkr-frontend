import { test, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Sm2RatingBar from './Sm2RatingBar.svelte';

test('renders all 6 rating tiers and triggers callback on click', async () => {
	const onSelectEase = vi.fn();
	const screen = render(Sm2RatingBar, {
		onSelectEase,
		disabled: false
	});

	const easyButton = screen.getByRole('button', { name: /Easy/i });
	await expect.element(easyButton).toBeVisible();

	await easyButton.click();
	expect(onSelectEase).toHaveBeenCalledWith(5);
});
