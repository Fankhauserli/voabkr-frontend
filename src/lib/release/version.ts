/**
 * The release version encoding: a version string like `0.1.0-pre.11` turned into
 * the fields the Android build and the GitHub Release consume.
 *
 * The build pipeline computes one version string for both artifacts — the
 * container image and the APK — so this module is the single place that decides
 * how that string maps onto Android's `versionCode`, its `versionName`, whether
 * the release is a pre-release, and what the release asset is called.
 *
 * A version this module cannot encode faithfully is rejected rather than
 * silently mis-encoded: anything but `major.minor.patch` with an optional
 * `-pre.ordinal`, numbers written without leading zeros, a minor and patch that
 * fit their two-digit fields, and a result inside the range Android accepts.
 */

/**
 * The version code packs the version into fixed-width fields, so that comparing
 * two version codes as integers orders the versions they encode:
 *
 *     major     minor     patch     ordinal
 *     10^9      10^7      10^5      10^0
 *
 * A final release carries 999 in the ordinal field, placing it above every
 * pre-release of the same base version and below every later version.
 */
const VERSION_CODE_MAJOR_SHIFT = 1_000_000_000;
const VERSION_CODE_MINOR_SHIFT = 10_000_000;
const VERSION_CODE_PATCH_SHIFT = 100_000;
const FINAL_RELEASE_ORDINAL = 999;

/** The widest minor and patch a two-digit field holds. */
const FIELD_LIMIT = 100;

/** Android's own ceiling: above this, a version code is not accepted. */
const MAX_VERSION_CODE = 2_100_000_000;

/** `0.1.0-pre.11` — the version string, pre-release part optional. */
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-pre\.(0|[1-9]\d*))?$/;

/** The app's name, as `capacitor.config.json` and the Android shell declare it. */
const APP_NAME = 'vocabkr';

/** What Android and the release workflow need to know about a version. */
export interface AndroidVersionFields {
	/** The integer Android compares to decide whether an APK is an upgrade. */
	versionCode: number;
	/** The version as the learner sees it, e.g. on the Android app info screen. */
	versionName: string;
	/** Whether this version is a pre-release, i.e. its string carries `-pre.N`. */
	prerelease: boolean;
	/** The file name the APK is published under on the GitHub Release. */
	assetName: string;
}

/** A version string that cannot be encoded, with the reason it cannot. */
export class InvalidVersionError extends Error {
	constructor(version: string, reason: string) {
		super(`Cannot encode "${version}": ${reason}`);
		this.name = 'InvalidVersionError';
	}
}

/** Turns a version string into {@link AndroidVersionFields}. */
export function encodeVersion(version: string): AndroidVersionFields {
	const match = VERSION_PATTERN.exec(version);
	if (!match) {
		throw new InvalidVersionError(
			version,
			'expected a version like "0.1.0" or "0.1.0-pre.11", without leading zeros'
		);
	}

	const major = Number(match[1]);
	const minor = Number(match[2]);
	const patch = Number(match[3]);
	const ordinal = match[4] === undefined ? undefined : Number(match[4]);

	if (minor >= FIELD_LIMIT) {
		throw new InvalidVersionError(version, `minor must be below ${FIELD_LIMIT}`);
	}
	if (patch >= FIELD_LIMIT) {
		throw new InvalidVersionError(version, `patch must be below ${FIELD_LIMIT}`);
	}
	if (ordinal !== undefined && ordinal >= FINAL_RELEASE_ORDINAL) {
		throw new InvalidVersionError(
			version,
			`pre-release ordinal must be below ${FINAL_RELEASE_ORDINAL}, ` +
				`or it would encode as the final release ${major}.${minor}.${patch}`
		);
	}

	const versionCode =
		major * VERSION_CODE_MAJOR_SHIFT +
		minor * VERSION_CODE_MINOR_SHIFT +
		patch * VERSION_CODE_PATCH_SHIFT +
		(ordinal ?? FINAL_RELEASE_ORDINAL);

	if (versionCode < 1 || versionCode > MAX_VERSION_CODE) {
		throw new InvalidVersionError(
			version,
			`version code ${versionCode} is outside the 1..${MAX_VERSION_CODE} Android accepts`
		);
	}

	return {
		versionCode,
		versionName: version,
		prerelease: ordinal !== undefined,
		assetName: `${APP_NAME}-${version}.apk`
	};
}
