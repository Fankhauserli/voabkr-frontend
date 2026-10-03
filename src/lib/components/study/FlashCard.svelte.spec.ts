import { test, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import FlashCard from './FlashCard.svelte';

test('renders Korean word and reveals English meaning when flipped', async () => {
	const screen = render(FlashCard, {
		koreanWord: '도서관',
		englishWord: 'Library',
		context: 'Place / Noun',
		example: '도서관에서 책을 읽어요.',
		isFlipped: false
	});

	const hangulElement = screen.getByText('도서관');
	await expect.element(hangulElement).toBeVisible();

	const cardButton = screen.getByRole('button', { name: /Korean Word/i });
	await cardButton.click();

	const englishElement = screen.getByText('Library');
	await expect.element(englishElement).toBeVisible();
});
