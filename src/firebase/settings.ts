
'use client';
import { doc, getDoc, setDoc, Firestore, serverTimestamp } from "firebase/firestore";
import type { SystemSettings } from "@/lib/types";

const SETTINGS_COLLECTION = 'settings';
const SYSTEM_SETTINGS_DOC_ID = 'system_settings';

const defaultSettings: SystemSettings = {
    returnReasons: [
        "لم يرد",
        "رفض الاستلام",
        "الهاتف مغلق",
        "الهاتف غير صحيح",
        "العنوان خاطئ",
        "تأجيل",
        "أسباب أخرى",
    ],
    whatsappTemplate: `أهلاً {customerName}، معاك {courierName} من شركة الصقر. حضرتك ليك اوردر بمبلغ {orderAmount} والعنوان: {fullAddress}. برجاء تأكيد إذا كنت ترغب في الاستلام – التأجيل – أو إلغاء الأوردر.\nشكرًا لك 🌸.`
};

/**
 * Fetches the system settings from Firestore. If they don't exist, it creates them with default values.
 * @param firestore The Firestore instance.
 * @returns A promise that resolves to the system settings.
 */
export async function getSettings(firestore: Firestore): Promise<SystemSettings> {
    const settingsDocRef = doc(firestore, SETTINGS_COLLECTION, SYSTEM_SETTINGS_DOC_ID);
    const docSnap = await getDoc(settingsDocRef);

    if (docSnap.exists()) {
        const data = docSnap.data();
        // Merge with defaults to ensure all properties are present
        return { ...defaultSettings, ...data };
    } else {
        // Document doesn't exist, so create it with default settings
        await setDoc(settingsDocRef, defaultSettings);
        return defaultSettings;
    }
}

/**
 * Updates the system settings in Firestore.
 * @param firestore The Firestore instance.
 * @param data The partial settings data to update.
 * @returns A promise that resolves when the update is complete.
 */
export async function updateSettings(firestore: Firestore, data: Partial<SystemSettings>): Promise<void> {
    const settingsDocRef = doc(firestore, SETTINGS_COLLECTION, SYSTEM_SETTINGS_DOC_ID);
    // Use set with merge:true to create the doc if it doesn't exist, or update it if it does.
    return setDoc(settingsDocRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

    