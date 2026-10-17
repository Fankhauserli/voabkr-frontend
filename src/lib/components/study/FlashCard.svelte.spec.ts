import { test, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import FlashCard from './FlashCard.svelte';

test('renders Korean word and reveals English meaning when flipped (koreanToEnglish)', async () => {
	const onFlip = vi.fn();
	const screen = await render(FlashCard, {
		props: {
			koreanWord: '도서관',
			englishWord: 'Library',
			context: 'Place / Noun',
			example: '도서관에서 책을 읽어요.',
			isFlipped: false,
			direction: 'koreanToEnglish',
			onFlip
		}
	});

	await expect.element(screen.getByRole('heading', { name: '도서관', exact: true })).toBeVisible();

	const cardButton = screen.getByRole('button', { name: /Place \/ Noun/i });
	await cardButton.click();
	expect(onFlip).toHaveBeenCalledOnce();

	await screen.rerender({ isFlipped: true });

	await expect.element(screen.getByRole('heading', { name: 'Library', exact: true })).toBeVisible();
});

test('renders English word and reveals Korean meaning when flipped (englishToKorean)', async () => {
	const onFlip = vi.fn();
	const screen = await render(FlashCard, {
		props: {
			koreanWord: '사과',
			englishWord: 'Apple',
			context: 'Fruit / Noun',
			example: '사과가 맛있어요.',
			isFlipped: false,
			direction: 'englishToKorean',
			onFlip
		}
	});

	await expect.element(screen.getByRole('heading', { name: 'Apple', exact: true })).toBeVisible();

	const cardButton = screen.getByRole('button', { name: /Fruit \/ Noun/i });
	await cardButton.click();
	expect(onFlip).toHaveBeenCalledOnce();

	await screen.rerender({ isFlipped: true });

	await expect.element(screen.getByRole('heading', { name: '사과', exact: true })).toBeVisible();
});
