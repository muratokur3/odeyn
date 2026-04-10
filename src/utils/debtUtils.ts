import { Timestamp, FieldValue } from 'firebase/firestore';
import type { Debt, DebtStatus } from '../types';

/**
 * Normalizes a debt object from Firestore to ensure it matches the Debt interface.
 * Specifically handles the case where createdAt might be stored as `created_at` in legacy documents.
 */
export const normalizeDebt = (docId: string, data: any): Debt => {
    let createdAt = data.createdAt;

    // Handle legacy snake_case created_at
    if (!createdAt && data.created_at) {
        // If it has seconds, we can construct a Timestamp
        if (typeof data.created_at.seconds === 'number') {
            createdAt = new Timestamp(data.created_at.seconds, data.created_at.nanoseconds || 0);
        }
    }

    // Ensure createdAt is a Timestamp
    if (!(createdAt instanceof Timestamp)) {
        // If it's a date object or string, try to convert
         if (createdAt && typeof createdAt.toDate === 'function') {
            // It is already a Timestamp (or behaves like one)
         } else if (createdAt instanceof Date) {
             createdAt = Timestamp.fromDate(createdAt);
         } else if (typeof createdAt === 'string') {
             // Try to parse ISO string
             const d = new Date(createdAt);
             if (!isNaN(d.getTime())) {
                 createdAt = Timestamp.fromDate(d);
             } else {
                 // Fallback
                 createdAt = Timestamp.fromMillis(0);
             }
         } else if (createdAt && typeof createdAt.seconds === 'number') {
             // reconstruct from object
             createdAt = new Timestamp(createdAt.seconds, createdAt.nanoseconds || 0);
         }
         else {
            createdAt = Timestamp.fromMillis(0);
         }
    }

    return {
        id: docId,
        ...data,
        createdAt
    } as Debt;
};

/**
 * Recursively removes undefined values from an object or array.
 * Essential for Firestore operations as it does not support undefined values.
 */
export const cleanObject = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;
    
    // Don't clean Date, Firestore Timestamp or FieldValue (e.g. serverTimestamp)
    if (obj instanceof Date || obj instanceof Timestamp || obj instanceof FieldValue) return obj;

    if (Array.isArray(obj)) {
        return obj.map(v => (v && typeof v === 'object' ? cleanObject(v) : v));
    }

    const newObj: any = {};
    Object.keys(obj).forEach(key => {
        const val = obj[key];
        if (val !== undefined) {
            newObj[key] = (val && typeof val === 'object' && !(val instanceof Date) && !(val instanceof Timestamp) && !(val instanceof FieldValue))
                ? cleanObject(val)
                : val;
        }
    });
    return newObj;
};

// --- Status Transition Validation ---

const VALID_TRANSITIONS: Record<DebtStatus, DebtStatus[]> = {
    'PENDING': ['ACTIVE', 'REJECTED'],
    'ACTIVE': ['PAID', 'REJECTED_BY_RECEIVER', 'AUTO_HIDDEN', 'ARCHIVED', 'DISPUTED'],
    'PAID': [], // Terminal state - no transitions allowed
    'REJECTED': [],
    'REJECTED_BY_RECEIVER': ['ACTIVE'],
    'HIDDEN': ['ACTIVE'],
    'AUTO_HIDDEN': ['ACTIVE', 'PAID'],
    'ARCHIVED': ['ACTIVE'],
    'DISPUTED': ['ACTIVE'],
};

/**
 * Validates if a debt status transition is allowed.
 * Prevents invalid transitions like PAID → ACTIVE.
 */
export function isValidStatusTransition(from: DebtStatus, to: DebtStatus): boolean {
    if (from === to) return true; // Same status is always valid
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
