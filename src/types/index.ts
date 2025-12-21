import { Timestamp } from 'firebase/firestore';

export interface User {
    uid: string;
    phoneNumber?: string; // @deprecated Use phoneNumbers array
    phoneNumbers: string[]; // List of verified E.164 numbers
    primaryPhoneNumber: string; // The main number for display/notifications
    displayName: string;
    createdAt: Timestamp;
    email?: string;
    recoveryEmail?: string;
    photoURL?: string;
    preferences?: {
        autoApproveDebt?: boolean;
        requireApproval?: boolean;
        /** @deprecated Use settings.contactSyncEnabled instead */
        syncContacts?: boolean;
        defaultAllowPaymentAddition?: boolean;
    };
    settings?: {
        contactSyncEnabled: boolean;
        contactAccessGranted: boolean;
        suppressSyncSuggestion: boolean;
        lastSyncAt?: Timestamp;
    };
}

export interface Contact {
    id: string; // Document ID
    name: string;
    phoneNumber: string; // E.164 format strictly (e.g., +905551234567)
    linkedUserId?: string; // If matched with a system user
    createdAt: Timestamp;
}

export type DebtStatus = 'PENDING' | 'ACTIVE' | 'PARTIALLY_PAID' | 'PAID' | 'REJECTED' | 'HIDDEN';

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
    allow_counterparty_edit?: boolean;
    lockedPhoneNumber?: string; // Immutable E.164 phone number for recovery/display
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

export interface DisplayProfile {
    displayName: string;      // The best name to show
    secondaryText: string;    // The subtext (Real name or Phone)
    photoURL?: string;        // Real avatar or null
    initials: string;         // Fallback for avatar
    isSystemUser: boolean;    // For badges
    isContact: boolean;       // To toggle "Add to Contact" buttons
    phoneNumber: string;      // The immutable anchor
    uid?: string;             // The system link for live updates
}
