import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { main } from './version-cli';
import { InvalidVersionError } from './version';

const CLI = fileURLToPath(new URL('./version-cli.ts', import.meta.url));

/** The runtime the workflow runs the command line with, when this machine has it. */
const bun = spawnSync('bun', ['--version']).status === 0;

describe('version-cli', () => {
	it('prints the fields as the key=value lines a workflow consumes', () => {
		expect(main(['0.1.0-pre.11'])).toBe(
			[
				'versionCode=10000011',
				'versionName=0.1.0-pre.11',
				'prerelease=true',
				'assetName=vocabkr-0.1.0-pre.11.apk',
				''
			].join('\n')
		);
	});

	it('reports a final release as not a pre-release', () => {
		expect(main(['0.1.0'])).toContain('prerelease=false\n');
	});

	it('refuses a version it cannot encode', () => {
		expect(() => main(['0.1.0-pre.999'])).toThrow(InvalidVersionError);
	});

	it('asks for exactly one version when the command line does not carry one', () => {
		expect(() => main([])).toThrow(/usage/i);
		expect(() => main(['0.1.0', '--json'])).toThrow(/usage/i);
	});
});

describe.skipIf(!bun)('version-cli run as a command', () => {
	it('prints the fields for the version it is given', () => {
		const run = spawnSync('bun', [CLI, '0.1.0-pre.11'], { encoding: 'utf8' });

		expect(run.status).toBe(0);
		expect(run.stdout).toBe(
			'versionCode=10000011\n' +
				'versionName=0.1.0-pre.11\n' +
				'prerelease=true\n' +
				'assetName=vocabkr-0.1.0-pre.11.apk\n'
		);
	});

	it('exits non-zero with the reason when the version cannot be encoded', () => {
		const run = spawnSync('bun', [CLI, '0.1.0-pre.999'], { encoding: 'utf8' });

		expect(run.status).toBe(1);
		expect(run.stdout).toBe('');
		expect(run.stderr).toContain('pre-release ordinal must be below 999');
	});
});
