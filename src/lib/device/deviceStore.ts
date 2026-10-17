import type { Card, Deck, QueuedReview, SM2Rating } from '$lib/types';
import type { ReviewSchedule } from '$lib/scheduling/reviewSchedule';

/**
 * The store the app owns on the device: the Cards of every Deck held there,
 * each Review's schedule, and the Grades the backend has not accepted yet.
 *
 * It is durable across a reload and written per record, so no entry shares a
 * lifetime with the throwaway cache. It makes no network calls: reading a Deck
 * works with no connection.
 */

const DATABASE_NAME = 'voabkr-device';
// Version 2 added both newCardDays (#31) and library (#30); version 3 ensures a
// database already opened at 2 by either change gains the other store.
const DATABASE_VERSION = 3;

const CARDS = 'cards';
const SCHEDULES = 'schedules';
const HELD_DECKS = 'heldDecks';
const QUEUED_GRADES = 'queuedGrades';
const NEW_CARD_DAYS = 'newCardDays';
const LIBRARY = 'library';

/** Where the queue lived before this store existed. */
const LEGACY_QUEUE_KEY = 'voabkr_review_queue';

/** A Review schedule as stored: the schedule itself plus the Card it belongs to. */
interface StoredSchedule extends ReviewSchedule {
	cardId: number;
}

/** A Deck held on the device: its Cards and each Card's Review schedule. */
export interface DownloadedDeck {
	cards: Card[];
	schedules: Map<number, ReviewSchedule>;
}

/** A Grade recorded on the device that the backend has not accepted yet. */
export interface QueuedGrade {
	/** Assigned when appended, so the queue keeps the order the Grades were given. */
	id: number;
	/**
	 * The learner who gave the Grade. It survives a sign-out, so the Grade uploads
	 * only when that learner signs back in. Null for a Grade migrated from the old
	 * localStorage queue, which predates learner ownership.
	 */
	learnerId: number | null;
	cardId: number;
	grade: SM2Rating;
	answeredAt: Date;
	/**
	 * The Review schedule the Grade produced. Null for a Grade migrated from the
	 * old localStorage queue, which predates device-computed schedules.
	 */
	schedule: ReviewSchedule | null;
	/**
	 * Whether the backend refused this Grade. A parked Grade leaves the active
	 * queue but stays on the device and is offered again on later Syncs.
	 */
	parked?: boolean;
}

/** The New Cards introduced during one Day, kept so the Daily goal does not reset within it. */
interface NewCardDayRecord {
	/** The moment the Day began, as a timestamp; the record's key. */
	dayStart: number;
	/** The Cards introduced during that Day, by id. */
	cardIds: number[];
}

/** A Grade to record, with the Review schedule it produced when one is known. */
export interface GradeToAppend {
	learnerId: number | null;
	cardId: number;
	grade: SM2Rating;
	answeredAt: Date;
	schedule: ReviewSchedule | null;
}

export class DeviceStore {
	readonly #db: IDBDatabase;

	private constructor(db: IDBDatabase) {
		this.#db = db;
	}

	/** Opens the store, creating it on first use, and takes in the old queue. */
	static async open(name: string = DATABASE_NAME): Promise<DeviceStore> {
		if (typeof indexedDB === 'undefined') {
			throw new Error('IndexedDB is not available on this device');
		}
		const store = new DeviceStore(await openDatabase(name));
		await store.#migrateLegacyQueue();
		return store;
	}

	/** Writes each Card as its own record. */
	async saveCards(cards: readonly Card[]): Promise<void> {
		const tx = this.#db.transaction(CARDS, 'readwrite');
		const done = transactionComplete(tx);
		const store = tx.objectStore(CARDS);
		for (const card of cards) {
			store.put(card);
		}
		await done;
	}

	/** Writes the Review schedule a Card now carries. */
	async writeSchedule(cardId: number, schedule: ReviewSchedule): Promise<void> {
		const tx = this.#db.transaction(SCHEDULES, 'readwrite');
		const done = transactionComplete(tx);
		tx.objectStore(SCHEDULES).put(storedSchedule(cardId, schedule));
		await done;
	}

	/** Reads the Review schedule a Card carries, or null for a New Card. */
	async readSchedule(cardId: number): Promise<ReviewSchedule | null> {
		const tx = this.#db.transaction(SCHEDULES, 'readonly');
		const done = transactionComplete(tx);
		const stored = await requestResult<StoredSchedule | undefined>(
			tx.objectStore(SCHEDULES).get(cardId)
		);
		await done;
		if (!stored) return null;
		return {
			interval: stored.interval,
			efactor: stored.efactor,
			repetitions: stored.repetitions,
			nextReviewAt: stored.nextReviewAt
		};
	}

	/** Reads a Deck's Cards and their Review schedules without a network. */
	async readDeck(deckId: number): Promise<DownloadedDeck> {
		const tx = this.#db.transaction([CARDS, SCHEDULES], 'readonly');
		const done = transactionComplete(tx);

		const cards = await cardsOfDeck(tx, deckId);
		const scheduleStore = tx.objectStore(SCHEDULES);
		const stored = await Promise.all(
			cards.map((card) => requestResult<StoredSchedule | undefined>(scheduleStore.get(card.id)))
		);
		await done;

		const schedules = new Map<number, ReviewSchedule>();
		for (const schedule of stored) {
			if (schedule) {
				const { cardId, ...reviewSchedule } = schedule;
				schedules.set(cardId, reviewSchedule);
			}
		}

		return { cards, schedules };
	}

	/** Lists the Decks held on the device, in Deck id order. */
	async listHeldDecks(): Promise<number[]> {
		const tx = this.#db.transaction(HELD_DECKS, 'readonly');
		const done = transactionComplete(tx);
		const deckIds = (await requestResult(tx.objectStore(HELD_DECKS).getAllKeys())) as number[];
		await done;
		return deckIds;
	}

	/** Marks a Deck held on the device. */
	async holdDeck(deckId: number): Promise<void> {
		const tx = this.#db.transaction(HELD_DECKS, 'readwrite');
		const done = transactionComplete(tx);
		tx.objectStore(HELD_DECKS).put({ deckId });
		await done;
	}

	/**
	 * Releases a Deck held on the device, removing its Cards and their schedules
	 * so a Deck not held leaves nothing behind. Queued Grades belong to the
	 * learner, not the Deck, and stay.
	 */
	async releaseDeck(deckId: number): Promise<void> {
		const tx = this.#db.transaction([CARDS, SCHEDULES, HELD_DECKS], 'readwrite');
		const done = transactionComplete(tx);

		const cards = await cardsOfDeck(tx, deckId);
		const cardStore = tx.objectStore(CARDS);
		const scheduleStore = tx.objectStore(SCHEDULES);
		for (const card of cards) {
			cardStore.delete(card.id);
			scheduleStore.delete(card.id);
		}
		tx.objectStore(HELD_DECKS).delete(deckId);
		await done;
	}

	/**
	 * Replaces one Downloaded Deck's Cards and Review schedules wholesale with
	 * what a pull returned. Cards and schedules the pull no longer carries are
	 * removed, so an edited Card is refetched, a deleted one disappears, and a
	 * schedule is never a merge of what the device and the backend each believed.
	 */
	async replaceDeck(deckId: number, contents: DownloadedDeck): Promise<void> {
		const tx = this.#db.transaction([CARDS, SCHEDULES], 'readwrite');
		const done = transactionComplete(tx);
		const cardStore = tx.objectStore(CARDS);
		const scheduleStore = tx.objectStore(SCHEDULES);

		const existing = await cardsOfDeck(tx, deckId);
		const nextCardIds = new Set(contents.cards.map((card) => card.id));
		for (const card of existing) {
			if (!nextCardIds.has(card.id)) {
				cardStore.delete(card.id);
				scheduleStore.delete(card.id);
			}
		}

		for (const card of contents.cards) {
			cardStore.put(card);
			const schedule = contents.schedules.get(card.id);
			if (schedule) {
				scheduleStore.put(storedSchedule(card.id, schedule));
			} else {
				scheduleStore.delete(card.id);
			}
		}

		await done;
	}

	/** The Library list last pulled from the backend, in Deck id order. */
	async readLibrary(): Promise<Deck[]> {
		const tx = this.#db.transaction(LIBRARY, 'readonly');
		const done = transactionComplete(tx);
		const decks = (await requestResult(tx.objectStore(LIBRARY).getAll())) as Deck[];
		await done;
		return decks;
	}

	/** Replaces the Library list wholesale with what a pull returned. */
	async replaceLibrary(decks: readonly Deck[]): Promise<void> {
		const tx = this.#db.transaction(LIBRARY, 'readwrite');
		const done = transactionComplete(tx);
		const store = tx.objectStore(LIBRARY);
		store.clear();
		for (const deck of decks) {
			store.put(deck);
		}
		await done;
	}

	/**
	 * Appends a Queued Grade and, when it has one, writes the Review schedule it
	 * produced in the same transaction, so a crash between the two cannot leave
	 * the device disagreeing with itself.
	 */
	async appendQueuedGrade(entry: GradeToAppend): Promise<QueuedGrade> {
		const tx = this.#db.transaction([SCHEDULES, QUEUED_GRADES], 'readwrite');
		const done = transactionComplete(tx);

		if (entry.schedule) {
			tx.objectStore(SCHEDULES).put(storedSchedule(entry.cardId, entry.schedule));
		}
		const id = (await requestResult(
			tx.objectStore(QUEUED_GRADES).add({
				learnerId: entry.learnerId,
				cardId: entry.cardId,
				grade: entry.grade,
				answeredAt: entry.answeredAt,
				schedule: entry.schedule
			})
		)) as number;

		await done;
		return { id, ...entry };
	}

	/** Every Queued Grade, in the order the Grades were given. */
	async readQueuedGrades(): Promise<QueuedGrade[]> {
		const tx = this.#db.transaction(QUEUED_GRADES, 'readonly');
		const done = transactionComplete(tx);
		const grades = (await requestResult(tx.objectStore(QUEUED_GRADES).getAll())) as QueuedGrade[];
		await done;
		// A Grade written before learner ownership existed has no owner recorded.
		return grades.map((grade) => ({ ...grade, learnerId: grade.learnerId ?? null }));
	}

	/** Removes Queued Grades by id, leaving every other record alone. */
	async removeQueuedGrades(ids: readonly number[]): Promise<void> {
		const tx = this.#db.transaction(QUEUED_GRADES, 'readwrite');
		const done = transactionComplete(tx);
		const store = tx.objectStore(QUEUED_GRADES);
		for (const id of ids) {
			store.delete(id);
		}
		await done;
	}

	/**
	 * How many New Cards have been introduced in the Day that began at
	 * `dayStart`. The count is kept per Day, so it neither carries over to a
	 * later Day nor refreshes partway through one.
	 */
	async readNewCardsIntroduced(dayStart: Date): Promise<number> {
		const tx = this.#db.transaction(NEW_CARD_DAYS, 'readonly');
		const done = transactionComplete(tx);
		const record = (await requestResult(tx.objectStore(NEW_CARD_DAYS).get(dayStart.getTime()))) as
			NewCardDayRecord | undefined;
		await done;
		return record?.cardIds.length ?? 0;
	}

	/**
	 * Records a New Card as introduced in the Day that began at `dayStart`.
	 * Recording the same Card twice in one Day is a no-op, so a Card returning
	 * from a Relearning step does not consume the allowance again.
	 */
	async recordNewCardIntroduced(dayStart: Date, cardId: number): Promise<void> {
		const key = dayStart.getTime();
		const tx = this.#db.transaction(NEW_CARD_DAYS, 'readwrite');
		const done = transactionComplete(tx);
		const store = tx.objectStore(NEW_CARD_DAYS);
		const record = (await requestResult(store.get(key))) as NewCardDayRecord | undefined;

		if (!record) {
			store.add({ dayStart: key, cardIds: [cardId] });
		} else if (!record.cardIds.includes(cardId)) {
			store.put({ dayStart: key, cardIds: [...record.cardIds, cardId] });
		}

		await done;
	}

	/**
	 * Parks Queued Grades the backend refused. A parked Grade stays on the device
	 * — and is offered again on later Syncs — but is no longer part of the active
	 * queue, so it cannot hold up a Grade behind it.
	 */
	async parkQueuedGrades(ids: readonly number[]): Promise<void> {
		if (ids.length === 0) return;
		const grades = await this.readQueuedGrades();
		const toPark = new Set(ids);
		const tx = this.#db.transaction(QUEUED_GRADES, 'readwrite');
		const done = transactionComplete(tx);
		const store = tx.objectStore(QUEUED_GRADES);
		for (const grade of grades) {
			if (toPark.has(grade.id)) {
				store.put({ ...grade, parked: true });
			}
		}
		await done;
	}

	/**
	 * Copies the Grades the old localStorage queue holds into this store. It runs
	 * on every open and skips entries already held, so a Grade queued into the
	 * old key before this store was wired in cannot be stranded. The old key is
	 * removed only once every entry is safely here; a malformed entry keeps the
	 * key in place rather than being silently discarded.
	 */
	async #migrateLegacyQueue(): Promise<void> {
		let raw: string | null;
		try {
			raw = localStorage.getItem(LEGACY_QUEUE_KEY);
		} catch {
			return;
		}
		if (raw === null) return;

		const { entries, hasMalformed } = parseLegacyQueue(raw);
		const tx = this.#db.transaction(QUEUED_GRADES, 'readwrite');
		const done = transactionComplete(tx);
		const grades = tx.objectStore(QUEUED_GRADES);

		const existing = (await requestResult(grades.getAll())) as QueuedGrade[];
		const seen = new Set(existing.map(queuedGradeKey));
		for (const legacy of entries) {
			const key = `${legacy.cardId}|${legacy.ease}|${legacy.timestamp}`;
			if (seen.has(key)) continue;
			seen.add(key);
			grades.add({
				// The old queue does not know which learner gave the Grade.
				learnerId: null,
				cardId: legacy.cardId,
				grade: legacy.ease,
				answeredAt: new Date(legacy.timestamp),
				schedule: null
			});
		}
		await done;

		if (!hasMalformed) {
			try {
				localStorage.removeItem(LEGACY_QUEUE_KEY);
			} catch {
				// The copy is committed; a later open finds the key and dedupes it.
			}
		}
	}

	/** Releases the database connection. */
	close(): void {
		this.#db.close();
	}
}

/** Opens the IndexedDB database, creating its stores on first use. */
function openDatabase(name: string): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(name, DATABASE_VERSION);

		request.onupgradeneeded = () => {
			const db = request.result;
			// Each store is created only if it is not already there, so an older
			// database can be upgraded in place.
			if (!db.objectStoreNames.contains(CARDS)) {
				const cards = db.createObjectStore(CARDS, { keyPath: 'id' });
				cards.createIndex('deckId', 'deckId');
			}
			if (!db.objectStoreNames.contains(SCHEDULES)) {
				db.createObjectStore(SCHEDULES, { keyPath: 'cardId' });
			}
			if (!db.objectStoreNames.contains(HELD_DECKS)) {
				db.createObjectStore(HELD_DECKS, { keyPath: 'deckId' });
			}
			if (!db.objectStoreNames.contains(QUEUED_GRADES)) {
				db.createObjectStore(QUEUED_GRADES, { keyPath: 'id', autoIncrement: true });
			}
			if (!db.objectStoreNames.contains(NEW_CARD_DAYS)) {
				db.createObjectStore(NEW_CARD_DAYS, { keyPath: 'dayStart' });
			}
			if (!db.objectStoreNames.contains(LIBRARY)) {
				db.createObjectStore(LIBRARY, { keyPath: 'id' });
			}
		};

		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

/** The Cards of one Deck, read inside a transaction. */
async function cardsOfDeck(tx: IDBTransaction, deckId: number): Promise<Card[]> {
	return (await requestResult(
		tx.objectStore(CARDS).index('deckId').getAll(IDBKeyRange.only(deckId))
	)) as Card[];
}

/** A Review schedule as it is stored. */
function storedSchedule(cardId: number, schedule: ReviewSchedule): StoredSchedule {
	return { cardId, ...schedule };
}

/** How a Queued Grade is compared with a legacy queue entry. */
function queuedGradeKey(grade: QueuedGrade): string {
	return `${grade.cardId}|${grade.grade}|${grade.answeredAt.getTime()}`;
}

/** Resolves with a request's result, or rejects with its error. */
function requestResult<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

/** Resolves when a transaction commits, or rejects if it fails or aborts. */
function transactionComplete(tx: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
	});
}

/** Reads the old queue's entries, reporting whether anything was malformed. */
function parseLegacyQueue(raw: string): { entries: QueuedReview[]; hasMalformed: boolean } {
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return { entries: [], hasMalformed: true };
		const entries = parsed.filter(isLegacyQueuedReview);
		return { entries, hasMalformed: entries.length !== parsed.length };
	} catch {
		return { entries: [], hasMalformed: true };
	}
}

function isLegacyQueuedReview(entry: unknown): entry is QueuedReview {
	if (typeof entry !== 'object' || entry === null) return false;
	const candidate = entry as Partial<QueuedReview>;
	return (
		typeof candidate.cardId === 'number' &&
		typeof candidate.ease === 'number' &&
		Number.isInteger(candidate.ease) &&
		candidate.ease >= 0 &&
		candidate.ease <= 5 &&
		typeof candidate.timestamp === 'number'
	);
}
