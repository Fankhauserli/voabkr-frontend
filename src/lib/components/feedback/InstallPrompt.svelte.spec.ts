import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { AppMode } from '$lib/pwa/appMode';
import { INSTALL_PROMPT_DISMISSED_KEY } from '$lib/pwa/installPrompt';
import InstallPrompt from './InstallPrompt.svelte';

const inMode = (mode: AppMode) => () => mode;

const isShown = () => document.querySelector('[role="dialog"]') !== null;

describe('InstallPrompt', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('tells a learner in a browser tab that offline study needs the app on their home screen', async () => {
		const screen = render(InstallPrompt, { detectMode: inMode('browser') });

		await expect.element(screen.getByRole('dialog')).toBeVisible();
		expect(screen.container.textContent).toMatch(/offline study/i);
		expect(screen.container.textContent).toMatch(/home screen/i);
	});

	it('does not show in the native shell', async () => {
		render(InstallPrompt, { detectMode: inMode('native') });

		await vi.waitFor(() => expect(isShown()).toBe(false));
	});

	it('does not show in an installed PWA', async () => {
		render(InstallPrompt, { detectMode: inMode('installed') });

		await vi.waitFor(() => expect(isShown()).toBe(false));
	});

	it('stays dismissed after the learner dismisses it', async () => {
		const first = render(InstallPrompt, { detectMode: inMode('browser') });
		await expect.element(first.getByRole('dialog')).toBeVisible();

		await first.getByRole('button', { name: /got it/i }).click();
		await vi.waitFor(() => expect(isShown()).toBe(false));
		expect(localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY)).toBe('true');

		await first.unmount();
		render(InstallPrompt, { detectMode: inMode('browser') });

		await vi.waitFor(() => expect(isShown()).toBe(false));
	});

	it('does not show when it was dismissed on an earlier visit', async () => {
		localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, 'true');

		render(InstallPrompt, { detectMode: inMode('browser') });

		await vi.waitFor(() => expect(isShown()).toBe(false));
	});
});
