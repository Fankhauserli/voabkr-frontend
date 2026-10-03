import { test, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import FlashCard from './FlashCard.svelte';

test('renders Korean word and reveals English meaning when flipped (koreanToEnglish)', async () => {
	const screen = render(FlashCard, {
		koreanWord: '도서관',
		englishWord: 'Library',
		context: 'Place / Noun',
		example: '도서관에서 책을 읽어요.',
		isFlipped: false,
		direction: 'koreanToEnglish'
	});

	const hangulElement = screen.getByText('도서관');
	await expect.element(hangulElement).toBeVisible();

	const cardButton = screen.getByRole('button', { name: /Place \/ Noun/i });
	await cardButton.click();

	const englishElement = screen.getByText('Library');
	await expect.element(englishElement).toBeVisible();
});

test('renders English word and reveals Korean meaning when flipped (englishToKorean)', async () => {
	const screen = render(FlashCard, {
		koreanWord: '사과',
		englishWord: 'Apple',
		context: 'Fruit / Noun',
		example: '사과가 맛있어요.',
		isFlipped: false,
		direction: 'englishToKorean'
	});

	const englishPrompt = screen.getByText('Apple');
	await expect.element(englishPrompt).toBeVisible();

	const cardButton = screen.getByRole('button', { name: /Fruit \/ Noun/i });
	await cardButton.click();

	const koreanAnswer = screen.getByText('사과');
	await expect.element(koreanAnswer).toBeVisible();
});
