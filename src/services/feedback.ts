import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface Feedback {
    uid: string;
    staticName: string;
    staticPhone: string;
    title: string;
    description: string;
    createdAt?: any;
    appVersion: string;
    deviceInfo: string;
}

export const sendFeedback = async (
    uid: string,
    staticName: string,
    staticPhone: string,
    title: string,
    description: string
) => {
    try {
        const feedbackData: Feedback = {
            uid,
            staticName,
            staticPhone,
            title,
            description,
            createdAt: serverTimestamp(),
            appVersion: '1.0.0', // Hardcoded for now as per requirements
            deviceInfo: navigator.userAgent
        };

        await addDoc(collection(db, 'feedbacks'), feedbackData as any);
    } catch (error) {
        console.error("Error sending feedback:", error);
        throw error;
    }
};
