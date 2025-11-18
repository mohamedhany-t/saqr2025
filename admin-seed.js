
const admin = require('firebase-admin');
const fs = require('fs');

// --- إعدادات ---
const ADMIN_EMAIL = 'mhanyt21@gmail.com'; // Admin user from the app

// --- تحميل ملف الصلاحيات ---
let serviceAccount;
try {
    serviceAccount = require('./serviceAccountKey.json');
} catch (e) {
    console.error("\x1b[31m%s\x1b[0m", "Error: `serviceAccountKey.json` not found.");
    console.error("Please download it from your Firebase project settings and place it in the root directory.");
    process.exit(1);
}

// --- تهيئة Firebase Admin ---
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });


const EGYPTIAN_GOVERNORATES = [
    "القاهرة", "الجيزة", "الأسكندرية", "الدقهلية", "الشرقية", "المنوفية", "القليوبية", "البحيرة", 
    "الغربية", "بور سعيد", "دمياط", "الإسماعيلية", "السويس", "كفر الشيخ", "الفيوم", "بني سويف", 
    "مطروح", "شمال سيناء", "جنوب سيناء", "المنيا", "أسيوط", "سوهاج", "قنا", "الأقصر", "أسوان", 
    "البحر الأحمر", "الوادي الجديد"
];

// --- دوال مساعدة ---

const log = (message, data) => console.log(`\x1b[32m✔\x1b[0m ${message}`, data || '');
const logError = (message, error) => console.error(`\x1b[31m✖\x1b[0m ${message}`, error);

async function createFirebaseUser(email, password, displayName) {
    try {
        const userRecord = await auth.createUser({ email, password, displayName });
        log('Successfully created new user in Auth:', { uid: userRecord.uid, email });
        return userRecord;
    } catch (error) {
        if (error.code === 'auth/email-already-exists') {
            log('User already exists in Auth, fetching:', { email });
            return auth.getUserByEmail(email);
        }
        logError(`Error creating user ${email}:`, error);
        throw error;
    }
}

// --- دوال إنشاء البيانات ---

async function seedGovernorates() {
    console.log('\n--- Seeding Governorates ---');
    const batch = db.batch();
    const collectionRef = db.collection('governorates');
    
    // Fetch existing governorates to avoid duplicates
    const snapshot = await collectionRef.get();
    const existingNames = new Set(snapshot.docs.map(doc => doc.data().name));

    let count = 0;
    EGYPTIAN_GOVERNORATES.forEach(name => {
        if (!existingNames.has(name)) {
            const docRef = collectionRef.doc(); // Auto-generate ID
            batch.set(docRef, { id: docRef.id, name });
            count++;
        }
    });
    
    if (count > 0) {
      await batch.commit();
      log(`Seeded ${count} new governorates.`);
    } else {
      log('Governorates are already up-to-date.');
    }
}

async function seedAdminUsers() {
    console.log('\n--- Seeding Admin Users ---');
    try {
        const userRecord = await createFirebaseUser(ADMIN_EMAIL, 'password', 'Admin');
        log(`Found/created admin user: ${ADMIN_EMAIL}`);
        const batch = db.batch();
        const userRef = db.collection('users').doc(userRecord.uid);
        const roleRef = db.collection('roles_admin').doc(userRecord.uid);

        batch.set(userRef, {
            id: userRecord.uid,
            email: userRecord.email,
            name: userRecord.displayName || 'Admin',
            role: 'admin',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        // CRITICAL: Set data in the role document so .data is not null in security rules
        batch.set(roleRef, { email: userRecord.email, createdAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        
        await batch.commit();
        log('Admin user documents created/updated successfully.');
        return [userRecord];
    } catch (error) {
        logError(`Could not find or create admin user ${ADMIN_EMAIL}.`, error.message);
        return [];
    }
}


// --- تشغيل السكربت ---
async function main() {
    try {
        console.log("\x1b[34m%s\x1b[0m", "Starting database seeding process...");

        await seedGovernorates();
        await seedAdminUsers();
        
        console.log("\n\x1b[32m%s\x1b[0m", "Database seeding completed successfully!");
        console.log("Essential data (Admin & Governorates) has been seeded.");
        console.log("You can now add companies, couriers, and shipments through the dashboard.");
        console.log("You can log in with the admin account:");
        console.log(`- Admin: ${ADMIN_EMAIL} (password: 'password')`);


    } catch (error) {
        logError("An error occurred during the seeding process:", error);
    }
}

main();
