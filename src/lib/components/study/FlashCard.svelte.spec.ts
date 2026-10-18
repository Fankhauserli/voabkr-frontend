import { test, expect, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import '../../../routes/layout.css';
import FlashCard from './FlashCard.svelte';

/** A grammar Card's context is the whole rule note, not a short category. */
const LONG_CONTEXT =
	'Chapter 01. Expressing Conjecture and Supposition · Rule: An adjective stem ends in a consonant, so the ending -나 보다 attaches to the stem after the past tense marker.';

/** A multi-paragraph example ends with a note the learner must still reach. */
const LONG_EXAMPLE = [
	'날씨가 추운 걸 보니까 눈이 온 것 같아요. 어제는 하늘이 맑았는데 오늘 아침에는 길이 미끄러웠어요.',
	'',
	'친구가 밖을 보더니 코트를 꺼내 입었어요. 바람도 세게 불고 있었거든요.',
	'',
	'[Note] -나 보다 attaches to the stem and expresses an inference from what the speaker sees or hears.'
].join('\n');

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

for (const direction of ['koreanToEnglish', 'englishToKorean'] as const) {
	test(`keeps a long grammar prompt label to one ellipsized line on the front face (${direction})`, async () => {
		await page.viewport(390, 844);
		const screen = render(FlashCard, {
			props: {
				koreanWord: '눈이 온 것 같아요',
				englishWord: 'It seems to have snowed',
				context: LONG_CONTEXT,
				example: LONG_EXAMPLE,
				direction
			}
		});

		const card = screen.getByRole('button', { name: /Chapter 01/ }).element() as HTMLElement;
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

	test(`keeps the revealed note and example inside the Card and clamps the example behind Show more (${direction})`, async () => {
		await page.viewport(390, 844);
		const onFlip = vi.fn();
		const screen = render(FlashCard, {
			props: {
				koreanWord: '눈이 온 것 같아요',
				englishWord: 'It seems to have snowed',
				context: LONG_CONTEXT,
				example: LONG_EXAMPLE,
				direction,
				onFlip
			}
		});

		await screen.rerender({ isFlipped: true });

		const card = screen.getByRole('button', { name: /Chapter 01/ }).element() as HTMLElement;
		const cardRect = card.getBoundingClientRect();

		// The revealed note is clamped to its header line, not left to wrap.
		const revealedNote = screen.getByText(LONG_CONTEXT).elements().at(-1) as HTMLElement;
		await expect.poll(() => revealedNote.scrollWidth > revealedNote.clientWidth).toBe(true);
		await expect.poll(() => revealedNote.scrollHeight <= revealedNote.clientHeight + 1).toBe(true);
		expect(revealedNote.title).toBe(LONG_CONTEXT);

		// The long example is clamped to a readable excerpt …
		const example = screen
			.getByText(/attaches to the stem and expresses an inference/)
			.elements()
			.at(-1) as HTMLElement;
		expect(example.textContent).toContain('[Note]');
		await expect.poll(() => example.scrollHeight > example.clientHeight).toBe(true);

		// … and neither the note nor the example leaves the Card.
		for (const inside of [revealedNote, example]) {
			const rect = inside.getBoundingClientRect();
			expect(rect.left).toBeGreaterThanOrEqual(cardRect.left - 0.5);
			expect(rect.right).toBeLessThanOrEqual(cardRect.right + 0.5);
		}
		expect(example.getBoundingClientRect().bottom).toBeLessThanOrEqual(cardRect.bottom + 0.5);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth + 1);

		// Show more reveals the rest, including the [Note] tail, without flipping the Card.
		await screen.getByRole('button', { name: 'Show more', exact: true }).click();
		expect(onFlip).not.toHaveBeenCalled();
		await expect.poll(() => example.scrollHeight <= example.clientHeight + 1).toBe(true);
		await expect
			.element(screen.getByRole('button', { name: 'Show less', exact: true }))
			.toBeVisible();

		// The learner can collapse it again.
		await screen.getByRole('button', { name: 'Show less', exact: true }).click();
		await expect.poll(() => example.scrollHeight > example.clientHeight).toBe(true);
		expect(onFlip).not.toHaveBeenCalled();
	});
}
