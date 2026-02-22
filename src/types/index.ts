import { Timestamp } from 'firebase/firestore';

export type UserType = 'INDIVIDUAL' | 'BUSINESS';

export interface AuditMeta {
    actorId: string;     // UID of the person performing the action
    timestamp: Timestamp;
    deviceId?: string;   // Device ID for security tracking
    platform?: string;   // Web, iOS, Android
    ipAddress?: string;  // Optional security log
}

export interface AmountHistory {
    oldAmount: number;
    newAmount: number;
    reason?: string;
    changedAt: Timestamp;
    changedBy: string;   // UID
}

export interface User {
    uid: string;
    phoneNumber?: string; // @deprecated Use phoneNumbers array
    phoneNumbers: string[]; // List of verified E.164 numbers
    primaryPhoneNumber: string; // The main number for display/notifications
    displayName: string;
    userType: UserType; // ✅ Unified naming
    businessName?: string; // For business accounts
    taxNumber?: string;
    taxOffice?: string;
    address?: string; // Simplified for UI
    createdAt: Timestamp;
    /** @deprecated Removed in favor of pure Phone Auth */
    email?: string;
    /** @deprecated Removed in favor of pure Phone Auth */
    recoveryEmail?: string;
    photoURL?: string;
    customExchangeRates?: Record<string, number>; // ✅ Moved to top level
    mutedCreators?: string[]; // IDs of users whose debts are auto-hidden (Silent Mute)
    preferences?: {
        autoApproveDebt?: boolean;
        requireApproval?: boolean;
        /** @deprecated Use settings.contactSyncEnabled instead */
        syncContacts?: boolean;
        defaultAllowPaymentAddition?: boolean;
        customExchangeRates?: Record<string, number>; // Keep for legacy if needed
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

    // Activity Feed Fields
    lastActivityMessage?: string;
    lastActivityAt?: Timestamp;
    hasUnreadActivity?: boolean;
    lastReadAt?: Timestamp; // Timestamp of when the user last opened this contact
    lastActorId?: string;
}

// Simplified DebtStatus - 4 core states
// PENDING: Waiting for initial action (rarely used now)
// ACTIVE: Debt is ongoing
// PAID: Fully settled
// HIDDEN/AUTO_HIDDEN: User archived/hidden (soft states)
// ARCHIVED: User manually archived
// DISPUTED: User rejected the debt as "not mine"
// Note: REJECTED states kept for backwards compatibility with existing data
export type DebtStatus = 'PENDING' | 'ACTIVE' | 'PAID' | 'REJECTED' | 'HIDDEN' | 'REJECTED_BY_RECEIVER' | 'AUTO_HIDDEN' | 'ARCHIVED' | 'DISPUTED';

// Debt Type for Dual-Layer Architecture
export type DebtType = 'ONE_TIME' | 'INSTALLMENT' | 'LEDGER';

export interface Installment {
    id: string;
    dueDate: Timestamp;
    amount: number;
    isPaid: boolean;
    paidAt?: Timestamp;
}

export interface GoldDetail {
    type: string;
    label: string;
    subTypeLabel?: string;
    carat?: number;
    weightPerUnit?: number;
    totalWeight?: number;
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
    updatedAt?: Timestamp;
    createdBy: string;
    installments?: Installment[];
    goldDetail?: GoldDetail;
    customExchangeRate?: number;
    // [REMOVED] isDeleted, deletedAt
    canBorrowerAddPayment?: boolean;
    lockedPhoneNumber?: string; // Immutable E.164 phone number for recovery/display

    // New fields for Unilateral Logic
    rejectedAt?: Timestamp;
    isMuted?: boolean;

    // Dual-Layer Architecture
    type?: DebtType; // Default: 'ONE_TIME', 'LEDGER' for shared stream

    // Blueprint v1 Fields
    lastTransactionAmount?: number;
    lastTransactionDirection?: TransactionDirection;
    editHistory?: AmountHistory[];
    archivedAt?: Timestamp;
    isArchived?: boolean;
    auditMeta?: AuditMeta;
    dispute?: {
        reason: string;
        at: Timestamp;
        by: string;
    };
}

export type PaymentLogType = 'INITIAL_CREATION' | 'PAYMENT' | 'NOTE_ADDED' | 'PAYMENT_DECLARATION' | 'HARD_RESET';

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
    auditMeta?: AuditMeta;
    method?: 'CASH' | 'IBAN' | 'CREDIT_CARD' | 'OTHER';
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

// ======= DUAL-LAYER FINANCIAL ARCHITECTURE =======
// Cari Hesap (Current Account) - Simple money flow
export type TransactionDirection = 'OUTGOING' | 'INCOMING';

export interface Transaction {
    id: string;
    amount: number;
    currency?: string; // Support for multi-currency stream
    description?: string;
    direction: TransactionDirection; // OUTGOING = I gave/paid, INCOMING = I took/received
    createdAt: Timestamp;
    createdBy: string; // UID of who created this entry
    type: 'SIMPLE';
    goldDetail?: GoldDetail;
    customExchangeRate?: number;
    auditMeta?: AuditMeta;
}
