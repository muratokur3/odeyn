import { collection, addDoc, serverTimestamp, type FieldValue } from 'firebase/firestore';
import { db } from './firebase';
import { UAParser } from 'ua-parser-js';

export interface Feedback {
    uid: string;
    staticName: string;
    staticPhone: string;
    title: string;
    description: string;
    createdAt: FieldValue;
    appVersion: string;
    deviceInfo: string;
    pagePath: string;
    platform: string;
    deviceName: string;
    browser: string;
}

export const sendFeedback = async (
    uid: string,
    staticName: string,
    staticPhone: string,
    title: string,
    description: string,
    pagePath: string
) => {
    try {
        const parser = new UAParser();
        const result = parser.getResult();

        // Create readable device name e.g. "Chrome on Windows"
        const browserName = result.browser.name || 'Unknown Browser';
        const osName = result.os.name || 'Unknown OS';
        const deviceName = `${browserName} on ${osName}`;

        // Determine platform
        let platform = 'web';
        const os = result.os.name?.toLowerCase() || '';
        if (os.includes('ios')) platform = 'ios';
        if (os.includes('android')) platform = 'android';

        const feedbackData: Feedback = {
            uid,
            staticName,
            staticPhone,
            title,
            description,
            createdAt: serverTimestamp(),
            appVersion: '0.1.0',
            deviceInfo: navigator.userAgent,
            pagePath,
            platform,
            deviceName,
            browser: browserName
        };

        await addDoc(collection(db, 'feedbacks'), feedbackData);
    } catch (error) {
        console.error("Error sending feedback:", error);
        throw error;
    }
};
