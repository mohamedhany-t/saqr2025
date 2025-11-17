
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

// --- دوال مساعدة ---
const log = (message, data) => console.log(`\x1b[32m✔\x1b[0m ${message}`, data || '');
const logError = (message, error) => console.error(`\x1b[31m✖\x1b[0m ${message}`, error);

async function getAdminUser() {
    try {
        const userRecord = await auth.getUserByEmail(ADMIN_EMAIL);
        return userRecord;
    } catch (error) {
        logError(`Could not find admin user ${ADMIN_EMAIL}. Make sure this user exists in Firebase Auth.`, error.message);
        return null;
    }
}

async function getCouriers() {
    const snapshot = await db.collection('couriers').get();
    if (snapshot.empty) {
        log('No couriers found in the database. Run `npm run seed` first.');
        return [];
    }
    return snapshot.docs.map(doc => doc.data());
}

async function ensureAdminRole(adminUser) {
    if (!adminUser) return;
    
    log(`Ensuring admin role for ${adminUser.email}...`);
    const batch = db.batch();
    const userRef = db.collection('users').doc(adminUser.uid);
    const roleRef = db.collection('roles_admin').doc(adminUser.uid);
    
    // Set user document
    batch.set(userRef, {
        id: adminUser.uid,
        email: adminUser.email,
        name: adminUser.displayName || 'Admin',
        role: 'admin',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // Set role document with some data
    batch.set(roleRef, { 
        email: adminUser.email,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await batch.commit();
    log(`Admin role document for ${adminUser.email} created/verified.`);
}


async function seedChats(couriers, adminUser) {
    console.log(`\n--- Seeding Chats for ${couriers.length} Couriers ---`);
    if (!adminUser) {
        logError("Cannot seed chats without an admin user.");
        return;
    }

    const now = admin.firestore.Timestamp.now();
    const lastMessageText = `مرحباً، هذه رسالة تلقائية من الإدارة.`;

    for (const courier of couriers) {
        const batch = db.batch();
        
        // Chat document
        const chatRef = db.collection('chats').doc(courier.id);
        batch.set(chatRef, {
            id: courier.id,
            lastMessage: lastMessageText,
            lastMessageAt: now,
            courierName: courier.name,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Messages subcollection
        const messagesRef = chatRef.collection('messages');
        const adminMessageRef = messagesRef.doc();
        batch.set(adminMessageRef, {
            id: adminMessageRef.id,
            text: `مرحباً ${courier.name}, كيف يمكنني مساعدتك؟`,
            senderId: adminUser.uid,
            senderName: adminUser.displayName || "الإدارة",
            createdAt: now,
        });
        
        await batch.commit();
        log(`Seeded chat for courier: ${courier.name}`);
    }
}


// --- تشغيل السكربت ---
async function main() {
    try {
        console.log("\x1b[34m%s\x1b[0m", "Starting chat seeding process...");

        const adminUser = await getAdminUser();
        const couriers = await getCouriers();
        
        if (adminUser) {
            await ensureAdminRole(adminUser); // Ensure admin permissions are set correctly
        }

        if (adminUser && couriers.length > 0) {
            await seedChats(couriers, adminUser);
            console.log("\n\x1b[32m%s\x1b[0m", "Chat seeding completed successfully!");
        } else {
            logError("Could not seed chats. Admin user or couriers not found.");
        }

    } catch (error) {
        logError("An error occurred during the chat seeding process:", error);
    }
}

main();
