import { describe, it, expect } from 'vitest';
import { main } from './version-cli';
import { InvalidVersionError } from './version';

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
