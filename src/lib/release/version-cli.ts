/**
 * The command line around {@link encodeVersion}, so the release workflow
 * consumes the version encoding instead of re-deriving its arithmetic in YAML:
 *
 *     bun src/lib/release/version-cli.ts 0.1.0-pre.11
 *
 * It prints one `key=value` line per field — the form a workflow can append to
 * `$GITHUB_OUTPUT` — and exits non-zero, with the reason on stderr, when the
 * version cannot be encoded.
 */
import { pathToFileURL } from 'node:url';
import { encodeVersion, type AndroidVersionFields } from './version';

const USAGE = 'usage: version-cli <version>, e.g. version-cli 0.1.0-pre.11';

/** The fields as the `key=value` lines a workflow consumes, newline-terminated. */
function formatVersionFields(fields: AndroidVersionFields): string {
	return [
		`versionCode=${fields.versionCode}`,
		`versionName=${fields.versionName}`,
		`prerelease=${fields.prerelease}`,
		`assetName=${fields.assetName}`,
		''
	].join('\n');
}

/** What the command line prints for these arguments. Throws on anything else. */
export function main(argv: string[]): string {
	if (argv.length !== 1) {
		throw new Error(USAGE);
	}
	return formatVersionFields(encodeVersion(argv[0]));
}

if (isDirectInvocation()) {
	try {
		process.stdout.write(main(process.argv.slice(2)));
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	}
}

/** Whether this file is the script being run, rather than an import from a test. */
function isDirectInvocation(): boolean {
	const entry = process.argv[1];
	return entry !== undefined && import.meta.url === pathToFileURL(entry).href;
}
