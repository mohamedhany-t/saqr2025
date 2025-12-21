
require('dotenv').config();
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

// --- Configuration ---
let serviceAccount;
try {
    serviceAccount = require('../firebase-admin-sdk.json');
} catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
        console.warn("firebase-admin-sdk.json not found. This is expected in production environments.");
    } else {
        throw e;
    }
}

// --- Initialize Firebase Admin SDK ---
let app;
try {
    const appConfig = serviceAccount ? { credential: cert(serviceAccount) } : {};
    app = initializeApp(appConfig, 'migration-app'); // Use a unique name to avoid conflicts
} catch (e) {
    if (e.code === 'app/duplicate-app') {
        console.warn("Firebase app 'migration-app' already initialized. The script will continue.");
        app = require('firebase-admin/app').getApp('migration-app');
    } else {
        throw e;
    }
}

const db = getFirestore(app);
const BATCH_SIZE = 400; // Firestore batch limit is 500 writes

// --- Helper Functions ---
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function commitBatch(batch, operationName) {
    try {
        await batch.commit();
        console.log(`   - دفعة ${operationName} تمت بنجاح.`);
    } catch (error) {
        console.error(`   - خطأ أثناء تنفيذ دفعة ${operationName}:`, error);
        throw error; // Stop the process if a batch fails
    }
}

/**
 * Migrates documents from an old collection to a new one with updates.
 * It reads from `sourceCollectionName`, applies updates, writes to `targetCollection`, and then deletes from the source.
 * @param {string} sourceCollectionName - The name of the collection to migrate from.
 * @param {string} targetCollectionName - The name of the collection to migrate to.
 * @param {Function} getUpdatePayload - A function that takes a doc and returns the payload to update/set.
 */
async function migrateCollection(sourceCollectionName, targetCollectionName, getUpdatePayload) {
    console.log(`\n[INFO] بدء ترحيل: "${sourceCollectionName}" إلى "${targetCollectionName}"...`);
    const sourceCollectionRef = db.collection(sourceCollectionName);
    const targetCollectionRef = db.collection(targetCollectionName);
    
    const snapshot = await sourceCollectionRef.get();
    if (snapshot.empty) {
        console.log(`[INFO] لا توجد بيانات للترحيل في "${sourceCollectionName}".`);
        return;
    }
    
    console.log(`[INFO] تم العثور على ${snapshot.size} مستند للترحيل.`);
    
    let batch = db.batch();
    let writeCount = 0;
    
    for (const doc of snapshot.docs) {
        const docData = doc.data();
        const updatePayload = getUpdatePayload(docData);

        const targetDocRef = targetCollectionRef.doc(doc.id);
        
        // Use merge: true to avoid overwriting and to combine flags if a shipment was archived for both courier and company
        batch.set(targetDocRef, updatePayload, { merge: true });
        writeCount++;

        // Add the delete operation to the same batch
        batch.delete(doc.ref);
        writeCount++;
        
        if (writeCount >= BATCH_SIZE) {
            await commitBatch(batch, `ترحيل ${sourceCollectionName}`);
            batch = db.batch();
            writeCount = 0;
            await delay(1000); // Add delay to avoid hitting rate limits
        }
    }
    
    if (writeCount > 0) {
        await commitBatch(batch, `ترحيل ${sourceCollectionName}`);
    }
    
    console.log(`[SUCCESS] تم ترحيل ${snapshot.size} مستند من "${sourceCollectionName}" بنجاح.`);
}


async function main() {
    console.log("--- بدء عملية ترحيل الأرشيف ---");
    try {
        // Migrate Shipments
        await migrateCollection(
            'archived_company_shipments', 
            'shipments',
            (docData) => ({ ...docData, isArchivedForCompany: true })
        );
        
        await migrateCollection(
            'archived_courier_shipments',
            'shipments',
            (docData) => ({ ...docData, isArchivedForCourier: true })
        );

        // Migrate Payments
        await migrateCollection(
            'archived_company_payments',
            'company_payments',
            (docData) => ({ ...docData, isArchived: true })
        );
        
        await migrateCollection(
            'archived_courier_payments',
            'courier_payments',
            (docData) => ({ ...docData, isArchived: true })
        );

        console.log("\n--- اكتملت عملية ترحيل الأرشيف بنجاح! ---");
        console.log("الآن جميع البيانات المؤرشفة موجودة في المجموعات الرئيسية مع علامات الأرشفة الصحيحة.");

    } catch (error) {
        console.error("\n[FATAL ERROR] فشلت عملية ترحيل الأرشيف:", error);
        console.error("الرجاء مراجعة الأخطاء. لم يتم حذف جميع البيانات من مجموعات الأرشيف القديمة لضمان عدم فقدان البيانات.");
        process.exit(1);
    }
}

main();
