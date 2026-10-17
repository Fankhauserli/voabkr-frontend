import type { Card, QueuedReview, SM2Rating } from '$lib/types';
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
const DATABASE_VERSION = 1;

const CARDS = 'cards';
const SCHEDULES = 'schedules';
const HELD_DECKS = 'heldDecks';
const QUEUED_GRADES = 'queuedGrades';

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
	cardId: number;
	grade: SM2Rating;
	answeredAt: Date;
	/**
	 * The Review schedule the Grade produced. Null for a Grade migrated from the
	 * old localStorage queue, which predates device-computed schedules, and for
	 * one recorded before the Study session carries a schedule (#31).
	 */
	schedule: ReviewSchedule | null;
}

/** A Grade to record, with the Review schedule it produced when one is known. */
export interface GradeToAppend {
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
		return grades;
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
			const cards = db.createObjectStore(CARDS, { keyPath: 'id' });
			cards.createIndex('deckId', 'deckId');
			db.createObjectStore(SCHEDULES, { keyPath: 'cardId' });
			db.createObjectStore(HELD_DECKS, { keyPath: 'deckId' });
			db.createObjectStore(QUEUED_GRADES, { keyPath: 'id', autoIncrement: true });
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
