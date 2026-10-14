import { describe, it, expect } from 'vitest';
import { encodeVersion, InvalidVersionError } from './version';

describe('encodeVersion', () => {
	it('encodes a pre-release version to the fields Android consumes', () => {
		expect(encodeVersion('0.1.0-pre.11')).toEqual({
			versionCode: 10000011,
			versionName: '0.1.0-pre.11',
			prerelease: true,
			assetName: 'vocabkr-0.1.0-pre.11.apk'
		});
	});

	it('encodes a final release above every pre-release of the same base version', () => {
		expect(encodeVersion('0.1.0')).toEqual({
			versionCode: 10000999,
			versionName: '0.1.0',
			prerelease: false,
			assetName: 'vocabkr-0.1.0.apk'
		});
	});

	it('orders a pre-release below its final release and below every later version', () => {
		const codes = ['0.1.0-pre.11', '0.1.0', '0.1.1-pre.1', '0.2.0-pre.1'].map(
			(version) => encodeVersion(version).versionCode
		);

		expect(codes).toEqual([10000011, 10000999, 10100001, 20000001]);
	});

	it('keeps a patch bump above every pre-release of the version before it', () => {
		expect(encodeVersion('0.1.1-pre.1').versionCode).toBeGreaterThan(
			encodeVersion('0.1.0').versionCode
		);
	});

	it('keeps a minor bump above every patch of the minor before it', () => {
		expect(encodeVersion('0.2.0-pre.1').versionCode).toBeGreaterThan(
			encodeVersion('0.1.99').versionCode
		);
	});

	it('rejects a pre-release ordinal that would reach the final release encoding', () => {
		expect(() => encodeVersion('0.1.0-pre.999')).toThrow(InvalidVersionError);
		expect(() => encodeVersion('0.1.0-pre.1000')).toThrow(InvalidVersionError);

		expect(encodeVersion('0.1.0-pre.998').versionCode).toBe(10000998);
	});

	it('rejects malformed version strings', () => {
		for (const version of [
			'',
			'main',
			'v0.1.0',
			'0.1',
			'0.1.0.2',
			'0.1.0-pre',
			'0.1.0-pre.1.2',
			'0.1.0-rc.1',
			'0.1.0-pre.-1',
			' 0.1.0',
			'0.1.0 ',
			'0.1.0-pre.01',
			'01.2.3'
		]) {
			expect(() => encodeVersion(version), version).toThrow(InvalidVersionError);
		}
	});

	it('rejects a minor or patch wider than the field it has to fit', () => {
		expect(() => encodeVersion('0.100.0')).toThrow(InvalidVersionError);
		expect(() => encodeVersion('0.1.100')).toThrow(InvalidVersionError);
	});

	it('rejects a version whose code is outside the signed 32-bit integer Android reads', () => {
		expect(() => encodeVersion('0.0.0-pre.0')).toThrow(InvalidVersionError);
		expect(() => encodeVersion('3.0.0')).toThrow(InvalidVersionError);

		expect(encodeVersion('2.10.0').versionCode).toBe(2100000999);
	});
});
