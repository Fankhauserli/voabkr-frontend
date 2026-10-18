import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Deck } from '$lib/types';
import DeckCard from './DeckCard.svelte';

const deck: Deck = {
	id: 10,
	name: '한국어 기초',
	type: 'vocabulary',
	cardCount: 24,
	dueCount: 3
};

test('shows the Card total and the Due count the API serves', async () => {
	const screen = render(DeckCard, { deck });

	await expect.element(screen.getByText('24 cards')).toBeVisible();
	await expect.element(screen.getByText('3 due')).toBeVisible();
});

test('shows no Due badge when the caller has nothing due', async () => {
	const screen = render(DeckCard, { deck: { ...deck, dueCount: 0 } });

	expect(screen.getByText('0 due').elements()).toHaveLength(0);
});

test('marks a Deck held on the device and offers to remove it', async () => {
	const onRemoveFromDevice = vi.fn();
	const screen = render(DeckCard, { deck, isDownloaded: true, onRemoveFromDevice });

	await expect.element(screen.getByText('On device')).toBeVisible();
	expect(screen.getByText('Needs a connection').elements()).toHaveLength(0);

	const remove = screen.getByRole('button', { name: /Remove 한국어 기초 from this device/ });
	await expect.element(remove).toBeVisible();
	await remove.click();

	expect(onRemoveFromDevice).toHaveBeenCalledWith(deck);
});

test('says a Deck that is not held needs a connection when there is none', async () => {
	const screen = render(DeckCard, { deck, isDownloaded: false, isOffline: true });

	await expect.element(screen.getByText('Needs a connection')).toBeVisible();
	expect(screen.getByText('On device').elements()).toHaveLength(0);
	expect(
		screen.getByRole('button', { name: /Remove .* from this device/ }).elements()
	).toHaveLength(0);
});

test('shows no device state for a Deck in a Library that has a connection', async () => {
	const screen = render(DeckCard, { deck, isDownloaded: false, isOffline: false });

	expect(screen.getByText('On device').elements()).toHaveLength(0);
	expect(screen.getByText('Needs a connection').elements()).toHaveLength(0);
});
