import { test, expect, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import '../../../routes/layout.css';
import FlashCard from './FlashCard.svelte';
import { LONG_CONTEXT, longGrammarFlashCard } from './flashcardFixtures';

// `context` collides with Svelte's mount option of the same name, so the props
// must be nested under `props` rather than passed flat.
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

	await screen.getByRole('button', { name: 'Tap to flip' }).click();
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

	// Tapping the Card itself also flips it.
	await screen.getByRole('region', { name: /Flashcard/ }).click();
	expect(onFlip).toHaveBeenCalledOnce();

	await screen.rerender({ isFlipped: true });

	await expect.element(screen.getByRole('heading', { name: '사과', exact: true })).toBeVisible();
});

for (const direction of ['koreanToEnglish', 'englishToKorean'] as const) {
	test(`keeps a long grammar prompt label to one ellipsized line on the front face (${direction})`, async () => {
		await page.viewport(390, 844);
		const screen = render(FlashCard, { props: longGrammarFlashCard(direction) });

		const card = screen.getByRole('region', { name: /Flashcard/ }).element() as HTMLElement;
		const promptLabel = screen.getByText(LONG_CONTEXT).elements()[0] as HTMLElement;

		// One line: the label cannot be taller than the line it sits on …
		await expect.poll(() => promptLabel.scrollHeight <= promptLabel.clientHeight + 1).toBe(true);
		// … and the whole note is ellipsized rather than made to fit.
		await expect.poll(() => promptLabel.scrollWidth > promptLabel.clientWidth).toBe(true);

		const cardRect = card.getBoundingClientRect();
		const labelRect = promptLabel.getBoundingClientRect();
		expect(promptLabel.title).toBe(LONG_CONTEXT);
		expect(labelRect.right).toBeLessThanOrEqual(cardRect.right + 0.5);
		expect(labelRect.left).toBeGreaterThanOrEqual(cardRect.left - 0.5);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth + 1);
	});

	test(`keeps the revealed note and example inside the Card and expands them with Show more (${direction})`, async () => {
		await page.viewport(390, 844);
		const onFlip = vi.fn();
		const screen = render(FlashCard, {
			props: { ...longGrammarFlashCard(direction), onFlip }
		});

		await screen.rerender({ isFlipped: true });

		const card = screen.getByRole('region', { name: /Flashcard/ }).element() as HTMLElement;
		const cardRect = card.getBoundingClientRect();

		// Both the note and the example are clamped excerpts.
		const revealedNote = screen.getByText(LONG_CONTEXT).elements().at(-1) as HTMLElement;
		const example = screen
			.getByText(/attaches to the stem and expresses an inference/)
			.elements()
			.at(-1) as HTMLElement;
		await expect.poll(() => revealedNote.scrollHeight > revealedNote.clientHeight).toBe(true);
		await expect.poll(() => example.scrollHeight > example.clientHeight).toBe(true);
		expect(example.textContent).toContain('[Note]');

		// Neither excerpt leaves the Card.
		for (const inside of [revealedNote, example]) {
			const rect = inside.getBoundingClientRect();
			expect(rect.left).toBeGreaterThanOrEqual(cardRect.left - 0.5);
			expect(rect.right).toBeLessThanOrEqual(cardRect.right + 0.5);
		}
		expect(example.getBoundingClientRect().bottom).toBeLessThanOrEqual(cardRect.bottom + 0.5);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth + 1);

		// Show more reveals the rest of both excerpts, including the [Note] tail,
		// without flipping the Card.
		await screen.getByRole('button', { name: 'Show more', exact: true }).click();
		expect(onFlip).not.toHaveBeenCalled();
		await expect.poll(() => revealedNote.scrollHeight <= revealedNote.clientHeight + 1).toBe(true);
		await expect.poll(() => example.scrollHeight <= example.clientHeight + 1).toBe(true);
		await expect
			.element(screen.getByRole('button', { name: 'Show less', exact: true }))
			.toBeVisible();
		expect(example.getBoundingClientRect().bottom).toBeLessThanOrEqual(
			card.getBoundingClientRect().bottom + 0.5
		);

		// The learner can collapse both excerpts again.
		await screen.getByRole('button', { name: 'Show less', exact: true }).click();
		await expect.poll(() => revealedNote.scrollHeight > revealedNote.clientHeight).toBe(true);
		await expect.poll(() => example.scrollHeight > example.clientHeight).toBe(true);
		expect(onFlip).not.toHaveBeenCalled();
	});
}
