import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Card, Deck } from '$lib/types';
import type { ReviewSchedule } from '$lib/scheduling/reviewSchedule';
import { DeviceStore } from './deviceStore';

/** A Card belonging to a Deck. */
const card = (id: number, deckId: number): Card => ({
	id,
	deckId,
	koreanWord: `단어 ${id}`,
	englishWord: `Word ${id}`,
	context: '',
	example: ''
});

/** A Deck as the Library pull returns it. */
const deck = (id: number): Deck => ({
	id,
	name: `Deck ${id}`,
	type: 'vocabulary',
	cardCount: 0,
	dueCount: 0
});

/** A Review schedule whose next Due moment is the given October day. */
const schedule = (day: number): ReviewSchedule => ({
	interval: 6,
	efactor: 2.5,
	repetitions: 2,
	nextReviewAt: new Date(2026, 9, day, 9, 0)
});

/** Deletes a test database once the store has closed it. */
const deleteDatabase = (name: string): Promise<void> =>
	new Promise((resolve, reject) => {
		const request = indexedDB.deleteDatabase(name);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
		request.onblocked = () => reject(new Error(`Deleting ${name} was blocked`));
	});

describe('DeviceStore', () => {
	let name: string;
	let store: DeviceStore;

	beforeEach(async () => {
		localStorage.clear();
		name = `voabkr-device-test-${crypto.randomUUID()}`;
		store = await DeviceStore.open(name);
	});

	afterEach(async () => {
		store.close();
		await deleteDatabase(name);
		localStorage.clear();
	});

	it("keeps a Deck's Cards and their Review schedules across a reload", async () => {
		const cards = [card(1, 10), card(2, 10)];
		await store.saveCards(cards);
		await store.writeSchedule(1, schedule(23));

		store.close();
		store = await DeviceStore.open(name);

		const contents = await store.readDeck(10);

		expect(contents.cards).toEqual(cards);
		expect(contents.schedules.get(1)).toEqual(schedule(23));
		expect(contents.schedules.has(2)).toBe(false);
	});

	it('lists the Decks held on the device, and releasing one removes only its Cards and schedules', async () => {
		await store.saveCards([card(1, 10), card(2, 10), card(3, 20)]);
		await store.writeSchedule(1, schedule(23));
		await store.writeSchedule(3, schedule(24));
		await store.holdDeck(10);
		await store.holdDeck(20);
		const queued = await store.appendQueuedGrade({
			learnerId: 7,
			cardId: 1,
			grade: 3,
			answeredAt: new Date(2026, 9, 17, 9, 0),
			schedule: schedule(23)
		});

		expect(await store.listHeldDecks()).toEqual([10, 20]);

		await store.releaseDeck(10);

		expect(await store.listHeldDecks()).toEqual([20]);
		expect(await store.readDeck(10)).toEqual({ cards: [], schedules: new Map() });
		expect(await store.readDeck(20)).toEqual({
			cards: [card(3, 20)],
			schedules: new Map([[3, schedule(24)]])
		});
		expect(await store.readQueuedGrades()).toEqual([queued]);

		// The held Decks and the Grade queue also survive a reload.
		store.close();
		store = await DeviceStore.open(name);
		expect(await store.listHeldDecks()).toEqual([20]);
		expect(await store.readQueuedGrades()).toEqual([queued]);
	});

	it('writes a Grade and the Review schedule it produced together, in the order given', async () => {
		await store.saveCards([card(1, 10)]);
		const firstAnsweredAt = new Date(2026, 9, 17, 9, 0);
		const secondAnsweredAt = new Date(2026, 9, 17, 9, 10);

		const first = await store.appendQueuedGrade({
			learnerId: 7,
			cardId: 1,
			grade: 3,
			answeredAt: firstAnsweredAt,
			schedule: schedule(23)
		});
		const second = await store.appendQueuedGrade({
			learnerId: 7,
			cardId: 1,
			grade: 1,
			answeredAt: secondAnsweredAt,
			schedule: schedule(18)
		});

		expect(first.id).toBeLessThan(second.id);
		expect(await store.readQueuedGrades()).toEqual([
			{
				id: first.id,
				learnerId: 7,
				cardId: 1,
				grade: 3,
				answeredAt: firstAnsweredAt,
				schedule: schedule(23)
			},
			{
				id: second.id,
				learnerId: 7,
				cardId: 1,
				grade: 1,
				answeredAt: secondAnsweredAt,
				schedule: schedule(18)
			}
		]);
		// The second Grade's schedule is the one the Card now carries.
		expect((await store.readDeck(10)).schedules.get(1)).toEqual(schedule(18));

		await store.removeQueuedGrades([first.id]);

		expect(await store.readQueuedGrades()).toEqual([
			{
				id: second.id,
				learnerId: 7,
				cardId: 1,
				grade: 1,
				answeredAt: secondAnsweredAt,
				schedule: schedule(18)
			}
		]);
	});

	it('counts the New Cards introduced in a Day once each, and keeps Days apart', async () => {
		const day = new Date(2026, 9, 17, 4, 0);
		const nextDay = new Date(2026, 9, 18, 4, 0);

		await store.recordNewCardIntroduced(day, 1);
		await store.recordNewCardIntroduced(day, 2);
		await store.recordNewCardIntroduced(day, 1); // a Relearning return consumes nothing more

		expect(await store.readNewCardsIntroduced(day)).toBe(2);
		expect(await store.readNewCardsIntroduced(nextDay)).toBe(0);

		// The Day's count survives a reload.
		store.close();
		store = await DeviceStore.open(name);
		expect(await store.readNewCardsIntroduced(day)).toBe(2);
	});

	it('upgrades a database created before the New Card Day record existed', async () => {
		store.close();
		await deleteDatabase(name);

		// Create the version 1 schema by hand, as an older app would have.
		await new Promise<void>((resolve, reject) => {
			const request = indexedDB.open(name, 1);
			request.onupgradeneeded = () => {
				const db = request.result;
				db.createObjectStore('cards', { keyPath: 'id' }).createIndex('deckId', 'deckId');
				db.createObjectStore('schedules', { keyPath: 'cardId' });
				db.createObjectStore('heldDecks', { keyPath: 'deckId' });
				db.createObjectStore('queuedGrades', { keyPath: 'id', autoIncrement: true });
			};
			request.onsuccess = () => {
				request.result.close();
				resolve();
			};
			request.onerror = () => reject(request.error);
		});

		store = await DeviceStore.open(name);
		const day = new Date(2026, 9, 17, 4, 0);
		await store.recordNewCardIntroduced(day, 7);

		expect(await store.readNewCardsIntroduced(day)).toBe(1);
	});

	it('keeps the owning learner with each Queued Grade across a reload', async () => {
		await store.appendQueuedGrade({
			learnerId: 7,
			cardId: 1,
			grade: 3,
			answeredAt: new Date(2026, 9, 17, 9, 0),
			schedule: null
		});
		await store.appendQueuedGrade({
			learnerId: 8,
			cardId: 2,
			grade: 1,
			answeredAt: new Date(2026, 9, 17, 9, 5),
			schedule: null
		});
		await store.appendQueuedGrade({
			learnerId: null,
			cardId: 3,
			grade: 2,
			answeredAt: new Date(2026, 9, 17, 9, 10),
			schedule: null
		});

		store.close();
		store = await DeviceStore.open(name);

		expect((await store.readQueuedGrades()).map((grade) => grade.learnerId)).toEqual([7, 8, null]);
	});

	it('replaces a Deck wholesale, removing Cards and schedules the pull no longer returns', async () => {
		await store.saveCards([card(1, 10), card(2, 10), card(3, 20)]);
		await store.writeSchedule(1, schedule(23));
		await store.writeSchedule(2, schedule(24));
		await store.writeSchedule(3, schedule(25));

		await store.replaceDeck(10, {
			cards: [{ ...card(1, 10), englishWord: 'Edited Word 1' }, card(4, 10)],
			schedules: new Map([
				[1, schedule(30)],
				[4, schedule(31)]
			])
		});

		const contents = await store.readDeck(10);

		expect(contents.cards.map((entry) => entry.id).sort()).toEqual([1, 4]);
		expect(contents.cards.find((entry) => entry.id === 1)?.englishWord).toBe('Edited Word 1');
		expect(contents.schedules.get(1)).toEqual(schedule(30));
		expect(contents.schedules.has(2)).toBe(false);
		expect(contents.schedules.get(4)).toEqual(schedule(31));
		// A Deck that was not replaced is untouched.
		expect(await store.readDeck(20)).toEqual({
			cards: [card(3, 20)],
			schedules: new Map([[3, schedule(25)]])
		});
	});

	it('replaces the Library list wholesale and reads it back after a reload', async () => {
		const first = [deck(10), deck(11)];
		await store.replaceLibrary(first);

		expect(await store.readLibrary()).toEqual(first);

		const second = [deck(11), deck(12)];
		await store.replaceLibrary(second);

		store.close();
		store = await DeviceStore.open(name);
		expect(await store.readLibrary()).toEqual(second);
	});

	it('parks a refused Grade so it leaves the active queue but stays on the device', async () => {
		const queued = await store.appendQueuedGrade({
			learnerId: 7,
			cardId: 1,
			grade: 3,
			answeredAt: new Date(2026, 9, 17, 9, 0),
			schedule: schedule(23)
		});

		await store.parkQueuedGrades([queued.id]);

		expect(await store.readQueuedGrades()).toEqual([{ ...queued, parked: true }]);
	});

	it('moves the old localStorage queue into the store, without losing a Grade', async () => {
		store.close();
		await deleteDatabase(name);
		const firstAnsweredAt = Date.UTC(2026, 9, 17, 9, 0);
		const secondAnsweredAt = Date.UTC(2026, 9, 17, 9, 5);
		localStorage.setItem(
			'voabkr_review_queue',
			JSON.stringify([
				{ cardId: 42, ease: 3, timestamp: firstAnsweredAt },
				{ cardId: 43, ease: 1, timestamp: secondAnsweredAt }
			])
		);

		store = await DeviceStore.open(name);
		const migrated = await store.readQueuedGrades();

		expect(migrated.map((grade) => grade.cardId)).toEqual([42, 43]);
		expect(migrated.map((grade) => grade.grade)).toEqual([3, 1]);
		expect(migrated.map((grade) => grade.answeredAt)).toEqual([
			new Date(firstAnsweredAt),
			new Date(secondAnsweredAt)
		]);
		expect(migrated.map((grade) => grade.schedule)).toEqual([null, null]);
		// The old queue predates learner ownership; it is kept but owned by nobody.
		expect(migrated.map((grade) => grade.learnerId)).toEqual([null, null]);
		// Every entry is here, so the old queue is gone.
		expect(localStorage.getItem('voabkr_review_queue')).toBeNull();

		// Reopening finds nothing left to migrate and adds no duplicates.
		store.close();
		store = await DeviceStore.open(name);
		expect(await store.readQueuedGrades()).toHaveLength(2);
	});

	it('leaves a malformed legacy queue in place while migrating its valid Grades', async () => {
		store.close();
		await deleteDatabase(name);
		localStorage.setItem(
			'voabkr_review_queue',
			JSON.stringify([
				{ cardId: 7, ease: 2, timestamp: Date.UTC(2026, 9, 17, 9, 0) },
				{ cardId: 'not a number', ease: 2, timestamp: Date.UTC(2026, 9, 17, 9, 5) }
			])
		);

		store = await DeviceStore.open(name);

		expect(await store.readQueuedGrades()).toHaveLength(1);
		expect(localStorage.getItem('voabkr_review_queue')).not.toBeNull();

		// The malformed entry keeps the key, but the valid Grade is not duplicated.
		store.close();
		store = await DeviceStore.open(name);
		expect(await store.readQueuedGrades()).toHaveLength(1);
	});
});
