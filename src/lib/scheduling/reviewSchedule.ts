import type { AnkiRating } from '$lib/types';

/**
 * The Review schedule rules, ported from the backend's `handlers/review.go` so
 * that the device is the only implementation. Given the Review schedule a Card
 * carries, the Grade it was just given, and the moment it was given, this module
 * returns the Review schedule that follows.
 *
 * It is pure: no storage, no network, no DOM, and no clock of its own — the
 * moment a Grade was given is supplied by the caller.
 */

/** A Grade: Again, Hard, Good, or Easy. */
export type Grade = AnkiRating;

/**
 * The state that decides when a Review is next Due: its Interval in days (0
 * while it is in a Relearning step), its Efactor, how many times it has been
 * answered, and the moment it is next Due.
 */
export interface ReviewSchedule {
	interval: number;
	efactor: number;
	/** How many Grades the Review has recorded; named as the backend stores it. */
	repetitions: number;
	/** The moment the Review is next Due, named as the backend serves it. */
	nextReviewAt: Date;
}

/** The Efactor never falls below this floor. */
const EFACTOR_FLOOR = 1.3;

/** Turns a Review schedule into the one that follows a Grade. */
export function nextReviewSchedule(
	schedule: ReviewSchedule,
	grade: Grade,
	answeredAt: Date
): ReviewSchedule {
	const efactor = efactorAfter(schedule.efactor, grade);
	let interval: number;
	let nextReviewAt: Date;

	switch (grade) {
		case 1:
			// Again – relearning: 1 minute, and the Interval stays 0.
			interval = 0;
			nextReviewAt = addMinutes(answeredAt, 1);
			break;

		case 2:
			// Hard – a Relearning step is 6 minutes; a graduated Card grows by 1.2×,
			// rounded down, and never below one day.
			if (schedule.interval === 0) {
				interval = 0;
				nextReviewAt = addMinutes(answeredAt, 6);
			} else {
				interval = Math.max(1, Math.trunc(schedule.interval * 1.2));
				nextReviewAt = addDays(answeredAt, interval);
			}
			break;

		case 3:
			// Good – graduates a Card out of its Relearning step to one day, then
			// 6 days for a first graduation, then Interval × Efactor, always making
			// progress.
			if (schedule.interval === 0) {
				// The deliberate divergence from handlers/review.go, which leaves the
				// Interval at 0 and loops the Card at ten minutes forever. The port
				// graduates it, which is what the Go comment always claimed.
				interval = 1;
			} else if (schedule.interval === 1) {
				interval = 6;
			} else {
				interval = Math.trunc(schedule.interval * efactor);
			}
			if (interval <= schedule.interval) {
				interval = schedule.interval + 1;
			}
			nextReviewAt = addDays(answeredAt, interval);
			break;

		case 4:
			// Easy – skip relearning and jump to at least 4 days, then grow by
			// Efactor × 1.3.
			interval = schedule.interval < 4 ? 4 : Math.trunc(schedule.interval * efactor * 1.3);
			interval = Math.max(4, interval);
			nextReviewAt = addDays(answeredAt, interval);
			break;

		default:
			// Unreachable through the Grade type. Refusing an untrusted Grade is
			// safer than the Go fallback's silent one-day schedule, and matches the
			// batch route, which refuses a Grade outside 1–4.
			throw new Error(`Unhandled Grade: ${grade}`);
	}

	return {
		interval,
		efactor,
		repetitions: schedule.repetitions + 1,
		nextReviewAt
	};
}

/**
 * Anki's Efactor update, applied on every Grade. The backend remaps our 1–4
 * Grades onto Anki's 0–4 scale, so Again is 0 and Easy is 3.
 */
function efactorAfter(efactor: number, grade: Grade): number {
	const ankiQ = grade - 1;
	const updated = efactor + (0.1 - (3 - ankiQ) * (0.08 + (3 - ankiQ) * 0.02));
	return updated < EFACTOR_FLOOR ? EFACTOR_FLOOR : updated;
}

/** A moment a number of minutes after another. */
function addMinutes(at: Date, minutes: number): Date {
	return new Date(at.getTime() + minutes * 60 * 1000);
}

/**
 * A moment a number of days after another, as the backend's `AddDate` does:
 * whole days in the device's time zone, so the wall-clock time is kept.
 */
function addDays(at: Date, days: number): Date {
	const next = new Date(at);
	next.setDate(next.getDate() + days);
	return next;
}
