import { describe, expect, it } from 'vitest';
import { newCardSchedule, nextReviewSchedule, type ReviewSchedule } from './reviewSchedule';

/**
 * A local wall-clock moment in 2026. An Interval is a whole number of days, so
 * the expectations are the same wall-clock time that many days later, making
 * them independent of the time zone the test runs in.
 */
const at = (month: number, day: number, hours = 9, minutes = 0): Date =>
	new Date(2026, month - 1, day, hours, minutes);

/** The moment these Grades were given; every expected moment is relative to it. */
const ANSWERED_AT = at(10, 17);

/** A Review schedule at the start of its life: a New Card's first Grade. */
const FIRST_GRADE_SCHEDULE: ReviewSchedule = {
	interval: 0,
	efactor: 2.5,
	repetitions: 0,
	nextReviewAt: ANSWERED_AT
};

describe('newCardSchedule', () => {
	it('starts a New Card at Interval 0 and Efactor 2.5 with nothing answered', () => {
		expect(newCardSchedule(ANSWERED_AT)).toEqual(FIRST_GRADE_SCHEDULE);
	});
});

describe('nextReviewSchedule', () => {
	it('Again keeps the Card in its Relearning step and makes it Due one minute later', () => {
		// handlers/review.go: Again – relearning: 1 minute, Interval stays 0.
		// Efactor: 2.5 + (0.1 - 3 × (0.08 + 3 × 0.02)) in float64, exactly as Go
		// evaluates it.
		expect(nextReviewSchedule(FIRST_GRADE_SCHEDULE, 1, ANSWERED_AT)).toEqual({
			interval: 0,
			efactor: 2.1799999999999997,
			repetitions: 1,
			nextReviewAt: at(10, 17, 9, 1)
		});
	});

	it('Hard in a Relearning step stays in it and makes the Card Due six minutes later', () => {
		// handlers/review.go: Hard while Interval is 0 – a 6-minute step, Interval stays 0.
		// Efactor: 2.5 + (0.1 - 2 × (0.08 + 2 × 0.02)) = 2.36.
		expect(nextReviewSchedule(FIRST_GRADE_SCHEDULE, 2, ANSWERED_AT)).toEqual({
			interval: 0,
			efactor: 2.36,
			repetitions: 1,
			nextReviewAt: at(10, 17, 9, 6)
		});
	});

	it('Hard grows a graduated Interval by 1.2×, rounded down, and never below one day', () => {
		// handlers/review.go: newInterval = int32(interval × 1.2), minimum 1.
		// Interval 1 → int32(1.2) = 1; Interval 10 → 12.
		expect(nextReviewSchedule({ ...FIRST_GRADE_SCHEDULE, interval: 1 }, 2, ANSWERED_AT)).toEqual({
			interval: 1,
			efactor: 2.36,
			repetitions: 1,
			nextReviewAt: at(10, 18)
		});
		expect(nextReviewSchedule({ ...FIRST_GRADE_SCHEDULE, interval: 10 }, 2, ANSWERED_AT)).toEqual({
			interval: 12,
			efactor: 2.36,
			repetitions: 1,
			nextReviewAt: at(10, 29)
		});
	});

	it('Good takes an Interval of 1 to 6 days and grows a longer one by the Efactor', () => {
		// handlers/review.go: Interval 1 – first graduation, 6 days.
		expect(nextReviewSchedule({ ...FIRST_GRADE_SCHEDULE, interval: 1 }, 3, ANSWERED_AT)).toEqual({
			interval: 6,
			efactor: 2.5,
			repetitions: 1,
			nextReviewAt: at(10, 23)
		});
		// Interval 10 × Efactor 2.5 = 25 days.
		expect(nextReviewSchedule({ ...FIRST_GRADE_SCHEDULE, interval: 10 }, 3, ANSWERED_AT)).toEqual({
			interval: 25,
			efactor: 2.5,
			repetitions: 1,
			nextReviewAt: at(11, 11)
		});
		// Interval 2 × Efactor 1.3 = 2.6, rounded down to 2, which makes no progress,
		// so the Interval is forced to 3.
		expect(
			nextReviewSchedule({ ...FIRST_GRADE_SCHEDULE, interval: 2, efactor: 1.3 }, 3, ANSWERED_AT)
		).toEqual({
			interval: 3,
			efactor: 1.3,
			repetitions: 1,
			nextReviewAt: at(10, 20)
		});
	});

	it('Easy jumps an Interval below 4 days to 4, and grows a longer one by the Efactor and 1.3', () => {
		// handlers/review.go: Interval < 4 – skip relearning, at least 4 days.
		// Interval 0 (a New Card's first Grade) and 1 both collapse to 4 days.
		expect(nextReviewSchedule(FIRST_GRADE_SCHEDULE, 4, ANSWERED_AT)).toEqual({
			interval: 4,
			efactor: 2.6,
			repetitions: 1,
			nextReviewAt: at(10, 21)
		});
		expect(nextReviewSchedule({ ...FIRST_GRADE_SCHEDULE, interval: 1 }, 4, ANSWERED_AT)).toEqual({
			interval: 4,
			efactor: 2.6,
			repetitions: 1,
			nextReviewAt: at(10, 21)
		});
		expect(nextReviewSchedule({ ...FIRST_GRADE_SCHEDULE, interval: 3 }, 4, ANSWERED_AT)).toEqual({
			interval: 4,
			efactor: 2.6,
			repetitions: 1,
			nextReviewAt: at(10, 21)
		});
		// Interval 4 × Efactor 2.6 × 1.3 = 13.52, rounded down to 13.
		expect(nextReviewSchedule({ ...FIRST_GRADE_SCHEDULE, interval: 4 }, 4, ANSWERED_AT)).toEqual({
			interval: 13,
			efactor: 2.6,
			repetitions: 1,
			nextReviewAt: at(10, 30)
		});
		// Interval 10 × 2.6 × 1.3 = 33.8, rounded down to 33.
		expect(nextReviewSchedule({ ...FIRST_GRADE_SCHEDULE, interval: 10 }, 4, ANSWERED_AT)).toEqual({
			interval: 33,
			efactor: 2.6,
			repetitions: 1,
			nextReviewAt: at(11, 19)
		});
	});

	it('keeps the Efactor at its 1.3 floor when a Grade would take it lower', () => {
		// Again and Hard from an Efactor of 1.3 would fall to 0.98 and 1.16; both
		// stay at the floor.
		expect(
			nextReviewSchedule({ ...FIRST_GRADE_SCHEDULE, interval: 5, efactor: 1.3 }, 1, ANSWERED_AT)
		).toEqual({
			interval: 0,
			efactor: 1.3,
			repetitions: 1,
			nextReviewAt: at(10, 17, 9, 1)
		});
		expect(
			nextReviewSchedule({ ...FIRST_GRADE_SCHEDULE, interval: 5, efactor: 1.3 }, 2, ANSWERED_AT)
		).toEqual({
			interval: 6,
			efactor: 1.3,
			repetitions: 1,
			nextReviewAt: at(10, 23)
		});
		// Easy rises from the floor: 1.3 + 0.1 in float64.
		expect(
			nextReviewSchedule({ ...FIRST_GRADE_SCHEDULE, interval: 5, efactor: 1.3 }, 4, ANSWERED_AT)
		).toEqual({
			interval: 9,
			efactor: 1.4000000000000001,
			repetitions: 1,
			nextReviewAt: at(10, 26)
		});
	});

	it('Good from a Relearning step graduates the Card to one day, deliberately unlike the Go source', () => {
		// handlers/review.go leaves the Interval at 0 and makes the Card Due again in
		// 10 minutes, so only Easy ever escapes Relearning. The port graduates it
		// instead: Interval 1, Due one Day later, which the next Good takes to 6 days.
		expect(nextReviewSchedule(FIRST_GRADE_SCHEDULE, 3, ANSWERED_AT)).toEqual({
			interval: 1,
			efactor: 2.5,
			repetitions: 1,
			nextReviewAt: at(10, 18)
		});
	});

	it('Again resets a graduated Interval to a Relearning step and increments Repetitions', () => {
		// handlers/review.go: Again – Interval 0 and a 1-minute step, whatever the
		// Interval was; Repetitions is the schedule's count plus this Grade.
		expect(nextReviewSchedule({ ...FIRST_GRADE_SCHEDULE, interval: 1 }, 1, ANSWERED_AT)).toEqual({
			interval: 0,
			efactor: 2.1799999999999997,
			repetitions: 1,
			nextReviewAt: at(10, 17, 9, 1)
		});
		expect(
			nextReviewSchedule({ ...FIRST_GRADE_SCHEDULE, interval: 10, repetitions: 7 }, 1, ANSWERED_AT)
		).toEqual({
			interval: 0,
			efactor: 2.1799999999999997,
			repetitions: 8,
			nextReviewAt: at(10, 17, 9, 1)
		});
	});
});
