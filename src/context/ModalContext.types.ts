export type ModalType = 'success' | 'error' | 'warning' | 'info';

export interface ModalContextType {
    showAlert: (title: string, message: string, type?: ModalType) => Promise<void>;
    showConfirm: (title: string, message: string, type?: ModalType) => Promise<boolean>;
}
