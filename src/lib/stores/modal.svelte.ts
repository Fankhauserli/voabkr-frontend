import type { Card, Deck } from '$lib/types';

export type ActiveModalType = 'cardCreator' | 'deckCreator' | 'exitStudyConfirm' | null;

export interface CardCreatorModalData {
	deckId?: number;
	cardToEdit?: Card;
}

export interface DeckCreatorModalData {
	deckToEdit?: Deck;
}

export interface ExitStudyConfirmModalData {
	onConfirm: () => void;
}

class ModalStore {
	activeModal = $state<ActiveModalType>(null);
	cardCreatorData = $state<CardCreatorModalData | null>(null);
	deckCreatorData = $state<DeckCreatorModalData | null>(null);
	exitStudyConfirmData = $state<ExitStudyConfirmModalData | null>(null);

	isOpen = $derived(this.activeModal !== null);
	isCardCreatorOpen = $derived(this.activeModal === 'cardCreator');
	isDeckCreatorOpen = $derived(this.activeModal === 'deckCreator');
	isExitStudyConfirmOpen = $derived(this.activeModal === 'exitStudyConfirm');

	openCardCreator(data?: CardCreatorModalData) {
		this.cardCreatorData = data ?? {};
		this.activeModal = 'cardCreator';
	}

	openDeckCreator(data?: DeckCreatorModalData) {
		this.deckCreatorData = data ?? {};
		this.activeModal = 'deckCreator';
	}

	openExitStudyConfirm(onConfirm: () => void) {
		this.exitStudyConfirmData = { onConfirm };
		this.activeModal = 'exitStudyConfirm';
	}

	close() {
		this.activeModal = null;
		this.cardCreatorData = null;
		this.deckCreatorData = null;
		this.exitStudyConfirmData = null;
	}

	handleBackButton(): boolean {
		if (this.isOpen) {
			this.close();
			return true;
		}
		return false;
	}
}

export const modal = new ModalStore();
export { ModalStore };
