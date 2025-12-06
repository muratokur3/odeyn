import { Timestamp } from 'firebase/firestore';

export interface User {
    uid: string;
    phoneNumber: string;
    displayName: string;
    createdAt: Timestamp;
    email?: string;
    photoURL?: string;
    savedContacts?: string[]; // List of UIDs
    lastSeen?: Timestamp;
    isOnline?: boolean;
}

export interface Contact {
    id: string; // Document ID
    name: string;
    phoneNumber: string;
    linkedUserId?: string; // If matched with a system user
    createdAt: Timestamp;
}

export type DebtStatus = 'PENDING' | 'ACTIVE' | 'PARTIALLY_PAID' | 'PAID' | 'REJECTED';

export interface Installment {
    id: string;
    dueDate: Timestamp;
    amount: number;
    isPaid: boolean;
    paidAt?: Timestamp;
}

export interface Debt {
    id: string;
    lenderId: string;
    lenderName: string;
    borrowerId: string;
    borrowerName: string;
    originalAmount: number;
    remainingAmount: number;
    currency: string;
    status: DebtStatus;
    dueDate?: Timestamp;
    note?: string;
    participants: string[];
    createdAt: Timestamp;
    createdBy: string;
    installments?: Installment[];
    isDeleted?: boolean;
    deletedAt?: Timestamp;
    canBorrowerAddPayment?: boolean;
}

export type PaymentLogType = 'INITIAL_CREATION' | 'PAYMENT' | 'NOTE_ADDED' | 'PAYMENT_DECLARATION';

export interface PaymentLog {
    id: string;
    type: PaymentLogType;
    amountPaid?: number;
    previousRemaining: number;
    newRemaining: number;
    performedBy: string;
    timestamp: Timestamp;
    note?: string;
    status?: 'PENDING' | 'APPROVED' | 'REJECTED';
    installmentId?: string;
}
