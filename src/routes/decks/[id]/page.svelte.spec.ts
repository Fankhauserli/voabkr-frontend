/**
 * The Deck detail page (`+page.svelte` in this directory). The spec is named
 * without the leading `+`, which SvelteKit reserves for route files.
 *
 * Issue #78: a grammar Card carries a long rule note in `context`, and the
 * Card list must hold it inside every row at 1-, 2- and 3-column widths.
 */
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import '../../layout.css';
import DeckDetailPage from './+page.svelte';
import { cardApi } from '$lib/api/cards';
import { deckApi } from '$lib/api/decks';
import { reviewApi } from '$lib/api/reviews';
import type { Card, Deck } from '$lib/types';

vi.mock('$app/state', () => ({
	page: { params: { id: '10' } }
}));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$lib/api/cache', () => ({ clientCache: { has: vi.fn(() => false) } }));
vi.mock('$lib/api/decks', () => ({ deckApi: { getDeckById: vi.fn() } }));
vi.mock('$lib/api/cards', () => ({ cardApi: { getCards: vi.fn() } }));
vi.mock('$lib/api/reviews', () => ({ reviewApi: { addCardToReviews: vi.fn(async () => {}) } }));
vi.mock('$lib/stores/auth.svelte', () => ({ auth: { user: null } }));

const DECK: Deck = {
	id: 10,
	name: '고급 문법',
	type: 'grammar',
	cardCount: 1,
	dueCount: 0
};

/** A Korean word long enough that it has to wrap inside a narrow Card. */
const KOREAN_WORD = '가나다라마바사아자차카타파하가나다라마바사아자차카타파하';
/** A Korean word that used to leave only a few pixels for the English meaning. */
const MEDIUM_KOREAN_WORD = '상상하다상상하다상상하다';
const ENGLISH_WORD =
	'to imagine or suppose something that has not happened yet; to conjecture about a future event';
const EXAMPLE =
	'그런 일이 일어날 거라고 상상도 못 했어요. 아무도 그렇게 될 줄 몰랐기 때문에 모두가 놀랐습니다.';
/** A grammar Card's whole rule note, well past 200 characters. */
const CONTEXT =
	'Chapter 01. Expressing Conjecture and Supposition · Rule: An adjective stem ending in a consonant takes -을 것 같다, while a stem ending in a vowel takes -ㄹ 것 같다. Use it when the speaker is guessing from evidence rather than stating a fact.';

const GRAMMAR_CARD: Card = {
	id: 1,
	deckId: 10,
	koreanWord: KOREAN_WORD,
	englishWord: ENGLISH_WORD,
	context: CONTEXT,
	example: EXAMPLE,
	isReviewed: false
};

/** The viewports at which the Card list is one, two and three columns wide. */
const ONE_COLUMN = 390;
const TWO_COLUMNS = 768;
const THREE_COLUMNS = 1280;
/** The narrowest width a Card's English meaning may keep beside its Korean word. */
const READABLE_ENGLISH_WIDTH = 96;

/** Asserts the element's box lies inside the Card row's box. */
function expectInsideCard(element: Element, cardRect: DOMRect) {
	const rect = element.getBoundingClientRect();
	expect(rect.left, `${element.tagName} left inside the Card`).toBeGreaterThanOrEqual(
		cardRect.left - 1
	);
	expect(rect.right, `${element.tagName} right inside the Card`).toBeLessThanOrEqual(
		cardRect.right + 1
	);
}

/** Renders the page at `width` and waits for its Card list. */
async function renderDeckAt(width: number, card: Card = GRAMMAR_CARD) {
	await page.viewport(width, 900);
	vi.mocked(cardApi.getCards).mockResolvedValue([card]);
	const screen = render(DeckDetailPage);
	await expect.element(screen.getByText(card.koreanWord)).toBeVisible();
	return { screen, row: screen.getByRole('listitem').element() as HTMLElement };
}

beforeEach(() => {
	localStorage.clear();
	vi.mocked(deckApi.getDeckById).mockResolvedValue(DECK);
	vi.mocked(reviewApi.addCardToReviews).mockClear();
});

afterEach(async () => {
	await page.viewport(1024, 900);
});

test.each([ONE_COLUMN, TWO_COLUMNS, THREE_COLUMNS])(
	'keeps a grammar Card inside its row at %ipx',
	async (width) => {
		const { screen, row } = await renderDeckAt(width);

		// The page itself must not scroll sideways.
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth + 1);

		// Nothing inside the Card may extend past the Card's own bounds.
		const rowRect = row.getBoundingClientRect();
		expect(rowRect.width).toBeGreaterThan(0);
		for (const element of row.querySelectorAll('*')) {
			expectInsideCard(element, rowRect);
		}
		expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth + 1);

		// + Study is still offered at this width.
		await expect.element(screen.getByRole('button', { name: 'Add to review queue' })).toBeEnabled();
	}
);

test('keeps the English meaning readable beside a medium-length Korean word', async () => {
	const { screen } = await renderDeckAt(THREE_COLUMNS, {
		...GRAMMAR_CARD,
		koreanWord: MEDIUM_KOREAN_WORD
	});

	const english = screen.getByText(ENGLISH_WORD).element() as HTMLElement;
	expect(english.getBoundingClientRect().width).toBeGreaterThanOrEqual(READABLE_ENGLISH_WIDTH);
});

test('shows the in-queue indicator inside the Card once the Card is in the queue', async () => {
	const { screen, row } = await renderDeckAt(THREE_COLUMNS, {
		...GRAMMAR_CARD,
		isReviewed: true
	});

	const indicator = screen.getByTitle('In study queue');
	await expect.element(indicator).toBeVisible();
	expectInsideCard(indicator.element(), row.getBoundingClientRect());
	expect(screen.getByRole('button', { name: 'Add to review queue' }).elements()).toHaveLength(0);
});

test('keeps the Korean word, English meaning, note and + Study usable on a narrow Card', async () => {
	const { screen, row } = await renderDeckAt(ONE_COLUMN);

	// The Korean word wraps instead of stretching the row.
	const korean = screen.getByText(KOREAN_WORD).element() as HTMLElement;
	const koreanLineHeight = Number.parseFloat(getComputedStyle(korean).lineHeight);
	expect(korean.getBoundingClientRect().height).toBeGreaterThan(koreanLineHeight * 1.5);
	expect(korean.scrollWidth).toBeLessThanOrEqual(korean.clientWidth + 1);

	// The English meaning ellipsizes, but is not squeezed down to a character.
	const english = screen.getByText(ENGLISH_WORD).element() as HTMLElement;
	expect(getComputedStyle(english).textOverflow).toBe('ellipsis');
	expect(english.scrollWidth).toBeGreaterThan(english.clientWidth);
	expect(english.getBoundingClientRect().width).toBeGreaterThanOrEqual(READABLE_ENGLISH_WIDTH);

	// The example stays to one line as well.
	const example = screen.getByText(EXAMPLE).element() as HTMLElement;
	const exampleLineHeight = Number.parseFloat(getComputedStyle(example).lineHeight);
	expect(example.scrollWidth).toBeGreaterThan(example.clientWidth);
	expect(example.getBoundingClientRect().height).toBeLessThanOrEqual(exampleLineHeight * 1.6);

	// The rule note is one ellipsized line; the whole note stays reachable.
	const note = screen.getByText(CONTEXT).element() as HTMLElement;
	const noteLineHeight = Number.parseFloat(getComputedStyle(note).lineHeight);
	expect(getComputedStyle(note).textOverflow).toBe('ellipsis');
	expect(note.scrollWidth).toBeGreaterThan(note.clientWidth);
	expect(note.getBoundingClientRect().height).toBeLessThanOrEqual(noteLineHeight * 1.6);
	expect(note.textContent).toContain(CONTEXT);

	const disclosure = note.closest('button');
	if (!(disclosure instanceof HTMLButtonElement)) {
		throw new Error('the rule note must sit in a disclosure button');
	}
	expect(disclosure.title).toBe(CONTEXT);
	expect(disclosure.getAttribute('aria-expanded')).toBe('false');
	// The disclosure keeps the 48px touch target the repo requires.
	const disclosureRect = disclosure.getBoundingClientRect();
	expect(disclosureRect.height).toBeGreaterThanOrEqual(48);
	expect(disclosureRect.width).toBeGreaterThanOrEqual(48);

	// Focus alone reveals the whole note in place.
	disclosure.focus();
	expect(document.activeElement).toBe(disclosure);
	await expect.poll(() => note.scrollWidth <= note.clientWidth + 1).toBe(true);

	// Activating pins the note open across losing focus, and activating again unpins it.
	await userEvent.keyboard('{Enter}');
	await expect.poll(() => disclosure.getAttribute('aria-expanded')).toBe('true');
	disclosure.blur();
	expect(note.scrollWidth).toBeLessThanOrEqual(note.clientWidth + 1);
	disclosure.focus();
	await userEvent.keyboard('{Enter}');
	await expect.poll(() => disclosure.getAttribute('aria-expanded')).toBe('false');
	disclosure.blur();
	await expect.poll(() => note.scrollWidth > note.clientWidth).toBe(true);

	// + Study stays on the Card and still works.
	const study = screen.getByRole('button', { name: 'Add to review queue' });
	await expect.element(study).toBeVisible();
	expectInsideCard(study.element(), row.getBoundingClientRect());
	await study.click();
	expect(reviewApi.addCardToReviews).toHaveBeenCalledWith(GRAMMAR_CARD.id);
});
