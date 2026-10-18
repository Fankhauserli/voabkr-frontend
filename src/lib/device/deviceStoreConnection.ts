import { DeviceStore, DeviceStoreBlockedError } from './deviceStore';

/** How a consumer opens the store. Overridable so a test can fail the first attempt. */
export type DeviceStoreOpener = () => Promise<DeviceStore>;

/** How one consumer connects to the device store. */
export interface DeviceStoreConnectionOptions {
	/** The database to open; the app's own store by default. */
	databaseName?: string;
	/** Opens the store; the real IndexedDB store by default. */
	openStore?: DeviceStoreOpener;
}

/**
 * One consumer's connection to the device store: opened once, and openable
 * again in place when another tab or window that held an older version closes.
 *
 * A blocked open is remembered rather than swallowed, so every read can report
 * it until a Retry succeeds. Any other failure leaves the consumer without a
 * store, as it always has, and one consumer's connection never affects another.
 */
export class DeviceStoreConnection {
	readonly #openStore: DeviceStoreOpener;
	#store: Promise<DeviceStore | null>;
	#blocked: DeviceStoreBlockedError | null = null;

	constructor(options: DeviceStoreConnectionOptions = {}) {
		this.#openStore = options.openStore ?? (() => DeviceStore.open(options.databaseName));
		this.#store = this.#attempt();
	}

	/**
	 * The store, once it has opened. A store that could not open for any reason
	 * other than a block is null; a blocked open throws, so the caller can tell
	 * the learner what stands in the way.
	 */
	async current(): Promise<DeviceStore | null> {
		const store = await this.#store;
		if (!store && this.#blocked) throw this.#blocked;
		return store;
	}

	/**
	 * Re-attempts the open, as Retry does once the other tab or window is
	 * closed. Returns the store on success, null for an unavailability that
	 * Retrying cannot fix, and throws when the store is still blocked.
	 */
	async reopen(): Promise<DeviceStore | null> {
		// A Retry can be pressed more than once; release the connection a previous
		// attempt opened rather than leaving it behind.
		const previous = await this.#store;
		previous?.close();
		this.#store = this.#attempt();
		return this.current();
	}

	/** Releases the connection; a blocked or failed open has none to release. */
	async close(): Promise<void> {
		(await this.#store)?.close();
	}

	async #attempt(): Promise<DeviceStore | null> {
		this.#blocked = null;
		try {
			return await this.#openStore();
		} catch (error) {
			if (error instanceof DeviceStoreBlockedError) {
				this.#blocked = error;
				return null;
			}
			console.error('[DeviceStore] Failed to open the device store:', error);
			return null;
		}
	}
}
