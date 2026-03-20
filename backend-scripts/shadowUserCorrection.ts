/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import * as admin from 'firebase-admin';

// NOTE: This function is intended to be run in a Node.js Backend Environment (Cloud Functions or Admin Script).
// It requires 'firebase-admin' to be initialized in the calling context.

/**
 * Updates the phone number for a "Shadow User" (non-registered user) on a specific Debt document.
 * 
 * @param db - The Firestore Database instance (admin.firestore.Firestore)
 * @param debtId - The ID of the debt to update
 * @param newPhoneNumber - The new, corrected E.164 phone number
 * @returns Object - Result status
 */
export const updateShadowUserPhoneNumber = async (
    db: admin.firestore.Firestore,
    debtId: string,
    newPhoneNumber: string
): Promise<{ success: boolean; message: string }> => {

    // Validate Input Format (Basic E.164 check)
    if (!newPhoneNumber.startsWith('+') || newPhoneNumber.length < 10) {
        throw new Error("Invalid phone number format. Must be E.164.");
    }

    try {
        await db.runTransaction(async (transaction) => {
            // 1. Fetch & Verify Debt
            const debtRef = db.collection('debts').doc(debtId);
            const debtDoc = await transaction.get(debtRef);

            if (!debtDoc.exists) {
                throw new Error(`Debt not found with ID: ${debtId}`);
            }

            const debtData = debtDoc.data();
            if (!debtData) throw new Error("Debt data is empty.");

            // 2. Guard Clause: Check if borrowerId is a "Shadow User" (starts with 'phone:')
            const currentBorrowerId = debtData.borrowerId;
            if (!currentBorrowerId || !currentBorrowerId.startsWith('phone:')) {
                throw new Error("ABORT: Target is NOT a Shadow User. Cannot update phone number for registered users or non-phone IDs.");
            }

            // 3. Collision Check: Check Target Availability
            // Query Users collection to see if the new phone number is already taken by a REAL user.
            const usersRef = db.collection('users');

            // Checks strictly against primaryPhoneNumber (and optionally phoneNumbers array if your schema supports it heavily)
            const userQuery = usersRef.where('primaryPhoneNumber', '==', newPhoneNumber).limit(1);
            const userSnapshot = await transaction.get(userQuery);

            if (!userSnapshot.empty) {
                throw new Error(`ABORT: Collision detected. A registered user already exists with phone number ${newPhoneNumber}. Cannot merge Shadow Debt into Registered User via this tool.`);
            }

            // Also check phoneNumbers array if it exists as per schema
            const userArrayQuery = usersRef.where('phoneNumbers', 'array-contains', newPhoneNumber).limit(1);
            const userArraySnapshot = await transaction.get(userArrayQuery);

            if (!userArraySnapshot.empty) {
                throw new Error(`ABORT: Collision detected. A registered user has ${newPhoneNumber} in their verified numbers.`);
            }

            // 4. Atomic Update Operation
            // Construct the new borrowerId
            const newBorrowerId = `phone:${newPhoneNumber}`;

            // Prepare updates
            // STRICT RULE: Do NOT change borrowerName. 
            // STRICT RULE: Do NOT touch installments or payments.
            const updates = {
                lockedPhoneNumber: newPhoneNumber,
                borrowerId: newBorrowerId,
                // We also need to update the participants array to maintain query ability
                participants: admin.firestore.FieldValue.arrayRemove(currentBorrowerId),
            };

            // Calculate the participants add in the same step
            // Note: arrayRemove and arrayUnion in the same update for the same field technically work but being explicit is better.
            // Let's manually reconstruct participants to be safe and atomic without race conditions on the array logic 
            // (Transaction ensures safety anyway).

            let currentParticipants = debtData.participants || [];
            // Remove old ID
            currentParticipants = currentParticipants.filter((p: string) => p !== currentBorrowerId);
            // Add new ID
            if (!currentParticipants.includes(newBorrowerId)) {
                currentParticipants.push(newBorrowerId);
            }

            transaction.update(debtRef, {
                lockedPhoneNumber: newPhoneNumber,
                borrowerId: newBorrowerId,
                participants: currentParticipants
            });
        });

        return { success: true, message: `Successfully updated Shadow User phone to ${newPhoneNumber}` };

    } catch (error: any) {
        console.error("Shadow User Phone Update Failed:", error);
        // Re-throw to caller or return error object
        throw new Error(error.message || "Unknown error during transaction");
    }
};
