/**
 * The Session summary page (`+page.svelte` in this directory). The spec is named without
 * the leading `+`, which SvelteKit reserves for route files.
 */
import { test, expect, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { goto } from '$app/navigation';
import SummaryPage from './+page.svelte';
import { studySession } from '$lib/stores/study.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
// The page drives the real Study session singleton, whose Grades would otherwise be sent
// over the network; stand in for the offline sync queue so no request leaves the test.
vi.mock('$lib/stores/syncQueue.svelte', () => ({
	reviewSync: { addReview: vi.fn(async () => ({ synced: true })) }
}));
// The Study session assembles its queue from the device. A stand-in holds one Deck
// of three New Cards, so the page's scenario does not need IndexedDB.
vi.mock('$lib/study/deviceSource', () => ({
	deviceStudySource: {
		readDecks: async (deckId?: number) =>
			deckId === undefined || deckId === 10
				? [
						{
							deckId: 10,
							cards: Array.from({ length: 3 }, (_, i) => ({
								id: i + 1,
								deckId: 10,
								koreanWord: `단어 ${i + 1}`,
								englishWord: `Word ${i + 1}`,
								context: 'noun',
								example: `예문 ${i + 1}`
							})),
							schedules: new Map()
						}
					]
				: [],
		readNewCardsIntroduced: async () => 0,
		recordNewCardIntroduced: async () => {},
		writeSchedule: async () => {}
	}
}));

beforeEach(() => {
	vi.mocked(goto).mockClear();
});

/** Finishes the three-Card Study session the device stand-in holds, failing the first one. */
const finishSession = async () => {
	studySession.reset();
	await studySession.start({ deckId: 10 });
	await studySession.rateCurrentCard(1); // Card 1 Again: it returns from a Relearning step
	let grades = 0;
	while (!studySession.isSessionFinished) {
		if (grades >= 100) throw new Error('Study session never finished');
		await studySession.rateCurrentCard(3);
		grades += 1;
	}
};

test('sends the learner away without showing a Study session that never happened', async () => {
	studySession.reset();
	render(SummaryPage);

	await vi.waitFor(() => expect(vi.mocked(goto)).toHaveBeenCalledWith('/', { replaceState: true }));

	// Nothing invented: no figures for a session that did not run.
	expect(document.body.textContent).not.toMatch(/Mastered|Retention|Streak/);
});

test('shows the finished Study session’s real numbers', async () => {
	await finishSession(); // 3 Cards, Card 1 failed then answered again: 2 of 3 retained

	const screen = render(SummaryPage);

	await expect.element(screen.getByText('67%')).toBeVisible();
	await expect.element(screen.getByText(/Reinforced\s+1\s+missed card/)).toBeVisible();
	expect(vi.mocked(goto)).not.toHaveBeenCalled();
});
