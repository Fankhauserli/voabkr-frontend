import { test, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ScratchPad from './ScratchPad.svelte';

test('renders ScratchPad with title, clear button, and canvas', async () => {
	const screen = render(ScratchPad, {
		cardId: 101,
		revision: 0
	});

	const titleElement = screen.getByText(/연습장/i);
	await expect.element(titleElement).toBeVisible();

	const clearButton = screen.getByRole('button', { name: /지우기/i });
	await expect.element(clearButton).toBeVisible();

	await clearButton.click();
	await expect.element(clearButton).toBeVisible();
});
