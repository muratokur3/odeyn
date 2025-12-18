import { Timestamp } from 'firebase/firestore';
import type { Debt } from '../types';

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
