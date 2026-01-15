
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { firebaseConfig } from './src/services/firebase';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const DEBT_ID = '8asumlCT5W3gxIIPcR38';

async function debugDebt() {
    try {
        console.log(`Fetching Debt: ${DEBT_ID}`);
        const debtRef = doc(db, 'debts', DEBT_ID);
        const debtSnap = await getDoc(debtRef);

        if (!debtSnap.exists()) {
            console.error("Debt not found!");
            return;
        }

        const data = debtSnap.data();
        console.log("--- DEBT DATA ---");
        console.log("Remaining:", data.remainingAmount);
        console.log("Status:", data.status);
        console.log("Installments:");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data.installments?.forEach((inst: any, idx: number) => {
            console.log(`[${idx}] ID: ${inst.id}, Amount: ${inst.amount}, IsPaid: ${inst.isPaid}`);
        });

        console.log("\n--- LOGS ---");
        const logsRef = collection(db, 'debts', DEBT_ID, 'logs');
        const logsSnap = await getDocs(logsRef);
        logsSnap.forEach(log => {
            const l = log.data();
            console.log(`Type: ${l.type}, Amount: ${l.amountPaid}, InstallmentID: ${l.installmentId || 'N/A'}, Date: ${l.timestamp?.toDate ? l.timestamp.toDate() : l.timestamp}`);
        });

    } catch (error) {
        console.error("Error:", error);
    }
}

debugDebt();
