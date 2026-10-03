export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
	id: string;
	message: string;
	type: ToastType;
	duration: number;
}

class ToastStore {
	toasts = $state<ToastItem[]>([]);

	hasToasts = $derived(this.toasts.length > 0);
	latestToast = $derived(this.toasts[this.toasts.length - 1] ?? null);

	show(message: string, type: ToastType = 'info', duration: number = 3500): string {
		const id =
			typeof crypto !== 'undefined' && crypto.randomUUID
				? crypto.randomUUID()
				: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

		const item: ToastItem = {
			id,
			message,
			type,
			duration
		};

		this.toasts = [...this.toasts, item];

		if (duration > 0 && typeof window !== 'undefined') {
			setTimeout(() => {
				this.dismiss(id);
			}, duration);
		}

		return id;
	}

	success(message: string, duration: number = 3500): string {
		return this.show(message, 'success', duration);
	}

	error(message: string, duration: number = 4500): string {
		return this.show(message, 'error', duration);
	}

	warning(message: string, duration: number = 4000): string {
		return this.show(message, 'warning', duration);
	}

	info(message: string, duration: number = 3500): string {
		return this.show(message, 'info', duration);
	}

	dismiss(id: string) {
		this.toasts = this.toasts.filter((t) => t.id !== id);
	}

	clear() {
		this.toasts = [];
	}
}

export const toast = new ToastStore();
export { ToastStore };
