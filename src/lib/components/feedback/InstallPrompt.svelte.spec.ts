import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { AppMode } from '$lib/pwa/appMode';
import { INSTALL_PROMPT_DISMISSED_KEY } from '$lib/pwa/installPrompt';
import InstallPrompt from './InstallPrompt.svelte';

const alwaysIn = (mode: AppMode) => () => mode;

const isShown = () => document.querySelector('[role="dialog"]') !== null;

const expectNotShown = () => vi.waitFor(() => expect(isShown()).toBe(false));

describe('InstallPrompt', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('tells a learner in a browser tab that offline study needs the app on their home screen', async () => {
		const screen = render(InstallPrompt, { detectMode: alwaysIn('browser') });

		await expect.element(screen.getByRole('dialog')).toBeVisible();
		expect(screen.container.textContent).toMatch(/offline study/i);
		expect(screen.container.textContent).toMatch(/home screen/i);
	});

	it('does not show in the native shell', async () => {
		render(InstallPrompt, { detectMode: alwaysIn('native') });

		await expectNotShown();
	});

	it('does not show in an installed PWA', async () => {
		render(InstallPrompt, { detectMode: alwaysIn('installed') });

		await expectNotShown();
	});

	it('stays dismissed after the learner dismisses it', async () => {
		const first = render(InstallPrompt, { detectMode: alwaysIn('browser') });
		await expect.element(first.getByRole('dialog')).toBeVisible();

		await first.getByRole('button', { name: /got it/i }).click();
		await expectNotShown();
		expect(localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY)).toBe('true');

		await first.unmount();
		render(InstallPrompt, { detectMode: alwaysIn('browser') });

		await expectNotShown();
	});

	it('does not show when it was dismissed on an earlier visit', async () => {
		localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, 'true');

		render(InstallPrompt, { detectMode: alwaysIn('browser') });

		await expectNotShown();
	});
});
