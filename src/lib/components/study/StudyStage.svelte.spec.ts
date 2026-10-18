/**
 * The Study stage (`StudyStage.svelte`): the one sitting both study routes render.
 * Each test drives a real Study session over an injected device, then renders the
 * stage with that session and the Deck it studies (null for the due queue).
 */
import { beforeEach, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import '../../../routes/layout.css';
import StudyStage from './StudyStage.svelte';
import ExitStudyModal from './ExitStudyModal.svelte';
import { longGrammarCard } from './flashcardFixtures';
import { StudySessionStore } from '$lib/stores/study.svelte';
import { modal } from '$lib/stores/modal.svelte';
import type { StudyDeviceSource } from '$lib/study/deviceSource';
import type { DeckContents } from '$lib/study/queueAssembly';
import type { Card } from '$lib/types';
import { goto } from '$app/navigation';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

const NOW = new Date(2026, 9, 17, 12);

/** A Card belonging to Deck 10. */
const card = (id: number): Card => ({
	id,
	deckId: 10,
	koreanWord: `단어 ${id}`,
	englishWord: `Word ${id}`,
	context: 'noun',
	example: `예문 ${id}`
});

/** The device's copy of a Deck. */
const heldDeck = (deckId: number, cards: readonly Card[]): DeckContents => ({
	deckId,
	cards,
	schedules: new Map()
});

/** A Study session over the Decks the stand-in device holds. */
function createSession(decks: readonly DeckContents[]): StudySessionStore {
	const device: StudyDeviceSource = {
		readDecks: async (deckId?: number) =>
			deckId === undefined ? [...decks] : decks.filter((deck) => deck.deckId === deckId),
		readNewCardsIntroduced: async () => 0,
		recordNewCardIntroduced: async () => {},
		writeSchedule: async () => {}
	};

	return new StudySessionStore({
		reviews: { addReview: async () => ({ synced: true }) },
		haptics: { cardFlip() {}, sm2Rating() {} },
		device,
		dailyGoal: () => 20,
		now: () => new Date(NOW.getTime())
	});
}

beforeEach(() => {
	vi.mocked(goto).mockClear();
	modal.close();
});

test('reveals the Card and rates it through the stage to the Session summary', async () => {
	const session = createSession([heldDeck(10, [card(1)])]);
	await session.start({ deckId: 10 });

	const screen = render(StudyStage, { props: { session, deckId: 10 } });

	await expect.element(screen.getByRole('heading', { name: '단어 1', exact: true })).toBeVisible();

	await screen.getByRole('button', { name: /Reveal Meaning/ }).click();
	await expect.element(screen.getByRole('heading', { name: 'Word 1', exact: true })).toBeVisible();

	await screen.getByRole('button', { name: /^Good/ }).click();

	await vi.waitFor(() => expect(vi.mocked(goto)).toHaveBeenCalledWith('/study/summary'));
	expect(session.isSessionFinished).toBe(true);
});

test('says a Deck with nothing to study is empty and offers the way back', async () => {
	const session = createSession([heldDeck(10, [])]);
	await session.start({ deckId: 10 });

	const screen = render(StudyStage, { props: { session, deckId: 10 } });

	await expect.element(screen.getByText('This Deck is Empty')).toBeVisible();
	await expect
		.element(screen.getByRole('link', { name: 'Return to Deck' }))
		.toHaveAttribute('href', '/decks/10');
	await expect
		.element(screen.getByRole('link', { name: 'Browse Other Decks' }))
		.toHaveAttribute('href', '/decks');
	expect(screen.getByText('No Cards Due').elements()).toHaveLength(0);
});

test('says the due queue has no Cards due and offers the Library and Home', async () => {
	const session = createSession([]);
	await session.start();

	const screen = render(StudyStage, { props: { session, deckId: null } });

	await expect.element(screen.getByText('No Cards Due')).toBeVisible();
	await expect
		.element(screen.getByRole('link', { name: 'Browse Decks' }))
		.toHaveAttribute('href', '/decks');
	await expect
		.element(screen.getByRole('link', { name: 'Return Home' }))
		.toHaveAttribute('href', '/');
	expect(screen.getByText('This Deck is Empty').elements()).toHaveLength(0);
});

test('says another voabkr tab or window is in the way and retries when asked', async () => {
	const session = createSession([]);
	await session.start();
	session.storeBlocked = true;

	const onRetry = vi.fn();
	const screen = render(StudyStage, { props: { session, deckId: null, onRetry } });

	await expect
		.element(screen.getByRole('heading', { name: /other voabkr tab or window/i }))
		.toBeVisible();
	await expect.element(screen.getByText(/Close the other tab or window/)).toBeVisible();
	// The blocked store is not a sitting with nothing due.
	expect(screen.getByText('No Cards Due').elements()).toHaveLength(0);

	await screen.getByRole('button', { name: 'Try again' }).click();

	expect(onRetry).toHaveBeenCalledOnce();
});

test('confirms before leaving a Deck sitting and returns to that Deck', async () => {
	const session = createSession([heldDeck(10, [card(1)])]);
	await session.start({ deckId: 10 });

	const screen = render(StudyStage, { props: { session, deckId: 10 } });
	render(ExitStudyModal);

	await screen.getByRole('button', { name: 'Exit session', exact: true }).click();
	await expect.element(screen.getByRole('dialog', { name: 'Exit Study Session?' })).toBeVisible();

	await screen.getByRole('button', { name: 'Exit Session', exact: true }).click();

	await vi.waitFor(() => expect(vi.mocked(goto)).toHaveBeenCalledWith('/decks/10'));
	expect(session.isActive).toBe(false);
	expect(modal.isExitStudyConfirmOpen).toBe(false);
});

test('confirms before leaving the due queue and returns Home', async () => {
	const session = createSession([heldDeck(10, [card(1)])]);
	await session.start();

	const screen = render(StudyStage, { props: { session, deckId: null } });
	render(ExitStudyModal);

	await screen.getByRole('button', { name: 'Exit session', exact: true }).click();
	await expect.element(screen.getByRole('dialog', { name: 'Exit Study Session?' })).toBeVisible();

	await screen.getByRole('button', { name: 'Exit Session', exact: true }).click();

	await vi.waitFor(() => expect(vi.mocked(goto)).toHaveBeenCalledWith('/'));
	expect(session.isActive).toBe(false);
});

for (const expanded of [false, true]) {
	test(`keeps a long grammar Card clear of the Grade buttons and operable when ${expanded ? 'expanded' : 'collapsed'}`, async () => {
		await page.viewport(390, 844);
		const session = createSession([heldDeck(10, [longGrammarCard()])]);
		await session.start({ deckId: 10 });

		const screen = render(StudyStage, { props: { session, deckId: 10 } });

		await screen.getByRole('button', { name: /Reveal Meaning/ }).click();

		if (expanded) {
			// Expanding the excerpts may scroll the page, but they still cannot cover the Grades.
			await screen.getByRole('button', { name: 'Show more', exact: true }).click();
		}

		const cardElement = screen.getByRole('region', { name: /Flashcard/ }).element() as HTMLElement;
		const revealedExample = screen
			.getByText(/attaches to the stem and expresses an inference/)
			.elements()
			.at(-1) as HTMLElement;
		const gradeBar = screen
			.getByRole('group', { name: /Rate your recall/i })
			.element() as HTMLElement;
		// Card content — not merely the Card's box — stays inside the Card, and the
		// Card ends above the Grade buttons.
		const clearOfGrades = () => {
			const cardRect = cardElement.getBoundingClientRect();
			const gradeTop = gradeBar.getBoundingClientRect().top;
			return (
				revealedExample.getBoundingClientRect().bottom <= cardRect.bottom + 0.5 &&
				cardRect.bottom <= gradeTop + 0.5
			);
		};

		await expect.poll(clearOfGrades).toBe(true);

		if (!expanded) {
			// Collapsed, the Card and the Grade buttons fit the screen, so they stay in the thumb zone.
			expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight + 1);
			expect(gradeBar.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight + 1);
		}

		for (const grade of ['Again', 'Hard', 'Good', 'Easy']) {
			await expect
				.element(screen.getByRole('button', { name: new RegExp(`^${grade}`) }))
				.toBeVisible();
		}

		// Operable in this state: the click reaches the Grade button, not the Card.
		await screen.getByRole('button', { name: /^Good/ }).click();
		await vi.waitFor(() => expect(vi.mocked(goto)).toHaveBeenCalledWith('/study/summary'));
	});
}
